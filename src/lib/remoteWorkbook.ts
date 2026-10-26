import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { arrayBufferToBase64 } from './base64';

/**
 * Página oficial de la FP-UNA donde se publican (y actualizan) los horarios.
 */
export const PLAN_PAGE_URL =
  'https://www.pol.una.py/academico/horarios-de-clases-y-examenes/';

/**
 * En la web la página de la FP-UNA no envía cabeceras CORS, por lo que se
 * consulta a través del proxy configurado en netlify.toml.
 */
const WEB_PAGE_PROXY_URL = '/api/planificaciones';

function planPageUrl(): string {
  return Platform.OS === 'web' ? WEB_PAGE_PROXY_URL : PLAN_PAGE_URL;
}

const PERIOD_HEADING_RE =
  /<h[1-6][^>]*>[\s\S]{0,120}?Periodo Acad[eé]mico\s*\d{4}/gi;
const TABLE_RE = /<table[\s\S]*?<\/table>/gi;
const ROW_RE = /<tr[\s\S]*?<\/tr>/i;
const CELL_RE = /<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi;
const CELL_OPEN_RE = /<t[dh][^>]*>/gi;
const SPREADSHEET_RE = /spreadsheets\/d\/([A-Za-z0-9_-]{10,})/g;
const XLSX_HREF_RE = /href="([^"]+\.xlsx[^"]*)"/gi;
const LAB_CONTEXT_CHARS = 280;

const PAGE_TIMEOUT_MS = 20000;
const DOWNLOAD_TIMEOUT_MS = 60000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface RemoteWorkbook {
  base64: string;
  label: string;
  sourceUrl: string;
}

interface PlanLink {
  sourceUrl: string;
  label: string;
}

function looksLikeLab(context: string): boolean {
  return context.toLowerCase().includes('laboratorio');
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

function tableHeaders(tableHtml: string): string[] {
  const firstRow = ROW_RE.exec(tableHtml);
  if (!firstRow) return [];
  return Array.from(firstRow[0].matchAll(CELL_RE)).map((m) => stripHtml(m[0]));
}

/**
 * Deduce la etiqueta de la columna de la tabla ("Planes de estudios 2026
 * (nuevos)", "Planes de estudios anteriores", etc.) para el enlace indicado.
 */
function labelForLink(tableHtml: string, offset: number, headers: string[]): string {
  const before = tableHtml.slice(0, offset);
  const rowStart = before.lastIndexOf('<tr');
  const row = rowStart >= 0 ? before.slice(rowStart) : before;
  const cells = Array.from(row.matchAll(CELL_OPEN_RE));
  const column = Math.max(0, cells.length - 1);
  return headers[column] || '';
}

function findPlanLinks(section: string): PlanLink[] {
  const links: PlanLink[] = [];
  const seen = new Set<string>();

  const addLink = (sourceUrl: string, label: string) => {
    if (seen.has(sourceUrl)) return;
    seen.add(sourceUrl);
    links.push({ sourceUrl, label: label || 'Planificación publicada' });
  };

  TABLE_RE.lastIndex = 0;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = TABLE_RE.exec(section))) {
    const table = tableMatch[0];
    const tableOffset = tableMatch.index;
    const headers = tableHeaders(table);
    const candidates: { index: number; sourceUrl: string }[] = [];

    SPREADSHEET_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SPREADSHEET_RE.exec(table))) {
      candidates.push({
        index: match.index,
        sourceUrl: `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`,
      });
    }

    XLSX_HREF_RE.lastIndex = 0;
    while ((match = XLSX_HREF_RE.exec(table))) {
      candidates.push({
        index: match.index,
        sourceUrl: match[1].replace(/&amp;/g, '&'),
      });
    }

    candidates.sort((a, b) => a.index - b.index);

    for (const candidate of candidates) {
      const absolute = tableOffset + candidate.index;
      const context = section.slice(Math.max(0, absolute - LAB_CONTEXT_CHARS), absolute);
      if (looksLikeLab(context)) continue;
      addLink(candidate.sourceUrl, labelForLink(table, candidate.index, headers));
    }
  }

  // Respaldo: si la página no usa tablas, se buscan los enlaces directamente.
  if (!links.length) {
    SPREADSHEET_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SPREADSHEET_RE.exec(section))) {
      const context = section.slice(Math.max(0, match.index - LAB_CONTEXT_CHARS), match.index);
      if (looksLikeLab(context)) continue;
      addLink(
        `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`,
        'Planificación publicada'
      );
    }

    XLSX_HREF_RE.lastIndex = 0;
    while ((match = XLSX_HREF_RE.exec(section))) {
      const context = section.slice(Math.max(0, match.index - LAB_CONTEXT_CHARS), match.index);
      if (looksLikeLab(context)) continue;
      addLink(match[1].replace(/&amp;/g, '&'), 'Planificación publicada');
    }
  }

  return links;
}

/**
 * Devuelve la sección HTML del período académico publicado más reciente
 * (el primero que aparece en la página).
 */
function findCurrentPeriodSection(html: string): string | null {
  PERIOD_HEADING_RE.lastIndex = 0;
  const first = PERIOD_HEADING_RE.exec(html);
  if (!first) return null;

  const start = first.index;
  const next = PERIOD_HEADING_RE.exec(html);
  const end = next ? next.index : html.length;
  return html.slice(start, end);
}

function base64Size(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/**
 * Busca todas las planificaciones publicadas en la sección del período
 * actual (se omite la planificación de laboratorio).
 */
export async function discoverCurrentPlanLinks(): Promise<PlanLink[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const response = await fetch(planPageUrl(), {
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`la página respondió con estado ${response.status}`);
    }
    const html = await response.text();
    const section = findCurrentPeriodSection(html);
    if (!section) return [];
    return findPlanLinks(section);
  } finally {
    clearTimeout(timer);
  }
}

async function downloadPlanFromWeb(link: PlanLink): Promise<RemoteWorkbook> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(link.sourceUrl, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`la descarga respondió con estado ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const bytes = buffer.byteLength;
    const mimeType = response.headers.get('content-type') || 'tipo desconocido';

    if (!base64.startsWith('UEsDB')) {
      throw new Error(
        `el archivo descargado no es un .xlsx válido (firma ZIP ausente, ` +
          `${bytes} bytes, tipo ${mimeType})`
      );
    }

    console.log(
      `[Excel] Descarga OK (${link.label}): HTTP ${response.status}, ` +
        `${mimeType}, ${bytes} bytes, XLSX verificado. ${link.sourceUrl}`
    );

    return { base64, label: link.label, sourceUrl: link.sourceUrl };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`la descarga de "${link.label}" tardó demasiado`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadPlan(link: PlanLink, index: number): Promise<RemoteWorkbook> {
  if (Platform.OS === 'web') {
    return downloadPlanFromWeb(link);
  }

  const cacheDir = FileSystem.cacheDirectory ?? '';
  const target = `${cacheDir}planificacion-web-${Date.now()}-${index}.xlsx`;

  try {
    const result = await withTimeout(
      FileSystem.downloadAsync(link.sourceUrl, target, {
        headers: { 'Cache-Control': 'no-cache' },
      }),
      DOWNLOAD_TIMEOUT_MS,
      `la descarga de "${link.label}" tardó demasiado`
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(
        `la descarga respondió con estado ${result.status}${
          result.mimeType ? ` (${result.mimeType})` : ''
        }`
      );
    }

    const base64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = base64Size(base64);

    if (!base64.startsWith('UEsDB')) {
      throw new Error(
        `el archivo descargado no es un .xlsx válido (firma ZIP ausente, ` +
          `${bytes} bytes, tipo ${result.mimeType || 'desconocido'})`
      );
    }

    console.log(
      `[Excel] Descarga OK (${link.label}): HTTP ${result.status}, ` +
        `${result.mimeType || 'tipo desconocido'}, ${bytes} bytes, XLSX verificado. ` +
        link.sourceUrl
    );

    return { base64, label: link.label, sourceUrl: link.sourceUrl };
  } finally {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
  }
}

/**
 * Descarga todas las planificaciones de clases y exámenes publicadas en la
 * web de la FP-UNA. Si una falla, se conservan las que sí se descargaron.
 */
export async function downloadRemoteWorkbooks(): Promise<RemoteWorkbook[]> {
  const links = await discoverCurrentPlanLinks();
  if (!links.length) {
    throw new Error('no se encontró un enlace de planificación en la página');
  }

  console.log(
    `[Excel] Planificaciones encontradas en la web: ${links.length} ` +
      `(${links.map((l) => l.label).join(', ')}).`
  );

  const downloads: RemoteWorkbook[] = [];
  const failures: string[] = [];

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    try {
      downloads.push(await downloadPlan(link, i));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      failures.push(`"${link.label}": ${detail}`);
      console.error(`[Excel] No se pudo descargar "${link.label}":`, e);
    }
  }

  if (!downloads.length) {
    throw new Error(`no se pudo descargar ninguna planificación (${failures.join('; ')})`);
  }

  if (failures.length) {
    console.warn(`[Excel] Descarga parcial: ${failures.join('; ')}`);
  }

  return downloads;
}
