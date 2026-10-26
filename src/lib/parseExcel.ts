import * as XLSX from 'xlsx/dist/xlsx.full.min.js';
import { normalize } from './normalize';
import type {
  ClassSlot,
  ExamSlot,
  ParsedWorkbook,
  SubjectEntry,
} from '../types';

const HEADER_SUBJECTS = new Set(['ASIGNATURA', 'ITEM', 'CARRERA']);

const SKIP_SHEETS = (name: string): boolean => {
  const n = normalize(name);
  if (!n) return true;
  if (n === 'CODIGOS' || n === 'DOCENTES' || n === 'HOJA1') return true;
  if (n.includes('HOMOLOG')) return true;
  return false;
};

const SIGLA_RE = /^[a-záéíóúñü]{2,4}\d{0,2}$/i;

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type ExamKey = 'first' | 'second' | 'final' | 'revision' | 'final2' | 'revision2';

const EXAM_LABELS: Record<ExamKey, string> = {
  first: '1ra Etapa',
  second: '2da Etapa',
  final: '1er Final',
  revision: 'Revisión',
  final2: '2do Final',
  revision2: 'Revisión 2do',
};

interface DayColumn {
  day: string;
  timeIdx: number;
  aulaIdx: number;
}

interface ExamColumn {
  key: ExamKey;
  dateIdx: number;
  timeIdx: number;
  aulaIdx: number;
}

interface SheetLayout {
  headerRow: number;
  subjectIdx: number;
  dptoIdx: number;
  nivelIdx: number;
  grupoIdx: number;
  carreraIdx: number;
  enfasisIdx: number;
  turnoIdx: number;
  seccionIdx: number;
  fechasSabadosIdx: number;
  days: DayColumn[];
  exams: ExamColumn[];
}

function cell(row: unknown[], idx: number): string {
  if (idx < 0) return '';
  const v = row[idx];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function rowHeaders(row: unknown[] | undefined): string[] {
  if (!Array.isArray(row)) return [];
  return row.map((v) => normalize(v === undefined || v === null ? '' : String(v)));
}

function findColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return -1;
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const headers = rowHeaders(rows[i]);
    if (headers.includes('ASIGNATURA') && headers.includes('SIGLA CARRERA')) {
      return i;
    }
  }
  return -1;
}

function findGroupRow(rows: unknown[][], headerRow: number): number {
  for (let i = headerRow - 1; i >= 0; i--) {
    const headers = rowHeaders(rows[i]);
    if (headers.some((h) => classifyExamGroup(h) !== null)) return i;
  }
  return -1;
}

function classifyExamGroup(value: string): ExamKey | null {
  if (!value) return null;
  if (
    value.includes('EVALUACION PRIMERA') ||
    value.includes('PRIMER PARCIAL') ||
    value === '1ER. PARCIAL' ||
    value === '1RA ETAPA'
  ) {
    return 'first';
  }
  if (
    value.includes('EVALUACION SEGUNDA') ||
    value.includes('SEGUNDO PARCIAL') ||
    value === '2DO. PARCIAL' ||
    value === '2DA ETAPA'
  ) {
    return 'second';
  }
  if (value.includes('2DO') && value.includes('FINAL')) return 'final2';
  if (value.includes('REVISION')) return 'revision';
  if (value.includes('FINAL')) return 'final';
  return null;
}

function isTimeLike(value: string): boolean {
  return /\d{1,2}:\d{2}/.test(value);
}

function countAulaValues(rows: unknown[][], headerRow: number, timeIdx: number, aulaIdx: number): number {
  let count = 0;
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    if (!cell(row, timeIdx)) continue;
    const value = cell(row, aulaIdx);
    if (value && !isTimeLike(value)) count++;
  }
  return count;
}

/**
 * En las planificaciones publicadas el aula puede estar antes o después de la
 * columna del día, según la versión del formato. Se detecta observando cuál de
 * las dos columnas vecinas contiene datos reales de aula.
 */
function findDays(rows: unknown[][], headerRow: number, headers: string[]): DayColumn[] {
  const days: DayColumn[] = [];
  for (const day of DAY_NAMES) {
    const timeIdx = headers.indexOf(normalize(day));
    if (timeIdx < 0) continue;

    const prevIdx = timeIdx - 1;
    const nextIdx = timeIdx + 1;
    const prevIsAula = headers[prevIdx] === 'AULA';
    const nextIsAula = headers[nextIdx] === 'AULA';

    let aulaIdx = -1;
    if (prevIsAula && nextIsAula) {
      const prevCount = countAulaValues(rows, headerRow, timeIdx, prevIdx);
      const nextCount = countAulaValues(rows, headerRow, timeIdx, nextIdx);
      aulaIdx = prevCount > nextCount ? prevIdx : nextIdx;
    } else if (prevIsAula) {
      aulaIdx = prevIdx;
    } else if (nextIsAula) {
      aulaIdx = nextIdx;
    }

    days.push({ day, timeIdx, aulaIdx });
  }
  return days;
}

function findFechasSabados(headers: string[]): number {
  return headers.findIndex((h) => h.startsWith('FECHAS DE CLASES'));
}

function findExamColumns(
  rows: unknown[][],
  headerRow: number,
  headers: string[],
  classStart: number
): ExamColumn[] {
  const groupRow = findGroupRow(rows, headerRow);
  if (groupRow < 0) return [];

  const groups = rowHeaders(rows[groupRow])
    .map((value, index) => ({ key: classifyExamGroup(value), index }))
    .filter((g): g is { key: ExamKey; index: number } => g.key !== null);

  const exams: ExamColumn[] = [];
  let revisionCount = 0;
  let finalTimeIdx = -1;
  let finalAulaIdx = -1;

  for (let i = 0; i < groups.length; i++) {
    const { key, index: start } = groups[i];
    const end = i + 1 < groups.length ? groups[i + 1].index : classStart >= 0 ? classStart : headers.length;
    const block = headers.slice(start, end);
    const dateOffset = block.indexOf('DIA');
    const timeOffset = block.indexOf('HORA');

    let resolvedKey = key;
    if (key === 'revision') {
      revisionCount += 1;
      if (revisionCount > 1) resolvedKey = 'revision2';
    }

    const isRevision = resolvedKey === 'revision' || resolvedKey === 'revision2';
    const aulaOffset = isRevision ? -1 : block.indexOf('AULA');

    const exam: ExamColumn = {
      key: resolvedKey,
      dateIdx: dateOffset >= 0 ? start + dateOffset : -1,
      timeIdx: timeOffset >= 0 ? start + timeOffset : -1,
      aulaIdx: aulaOffset >= 0 ? start + aulaOffset : -1,
    };

    if (resolvedKey === 'final') {
      finalTimeIdx = exam.timeIdx;
      finalAulaIdx = exam.aulaIdx;
    }

    exams.push(exam);
  }

  for (const exam of exams) {
    if (exam.timeIdx < 0) exam.timeIdx = finalTimeIdx;
    if (exam.aulaIdx < 0) exam.aulaIdx = finalAulaIdx;
  }

  return exams;
}

function buildLayout(rows: unknown[][]): SheetLayout | null {
  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) return null;

  const headers = rowHeaders(rows[headerRow]);
  const subjectIdx = findColumn(headers, ['ASIGNATURA']);
  if (subjectIdx < 0) return null;

  const days = findDays(rows, headerRow, headers);
  const classStart = days.length ? Math.min(...days.map((d) => d.timeIdx)) : -1;

  return {
    headerRow,
    subjectIdx,
    dptoIdx: findColumn(headers, ['DPTO.', 'DPTO']),
    nivelIdx: findColumn(headers, ['NIVEL']),
    grupoIdx: findColumn(headers, ['SEM/GRUPO', 'GRUPO', 'SEMESTRE/GRUPO']),
    carreraIdx: findColumn(headers, ['SIGLA CARRERA', 'CARRERA']),
    enfasisIdx: findColumn(headers, ['ENFASIS']),
    turnoIdx: findColumn(headers, ['TURNO']),
    seccionIdx: findColumn(headers, ['SECCION']),
    fechasSabadosIdx: findFechasSabados(headers),
    days,
    exams: findExamColumns(rows, headerRow, headers, classStart),
  };
}

function buildEntry(row: unknown[], layout: SheetLayout): SubjectEntry {
  const subject = cell(row, layout.subjectIdx);
  const clases: ClassSlot[] = [];
  for (const d of layout.days) {
    const time = cell(row, d.timeIdx);
    if (time) {
      clases.push({ day: d.day, time, aula: cell(row, d.aulaIdx) });
    }
  }

  const examenes: ExamSlot[] = [];
  for (const exam of layout.exams) {
    const date = cell(row, exam.dateIdx);
    if (!date) continue;
    examenes.push({
      label: EXAM_LABELS[exam.key],
      date,
      time: cell(row, exam.timeIdx),
      aula: cell(row, exam.aulaIdx),
    });
  }

  return {
    subject,
    departamento: cell(row, layout.dptoIdx),
    nivel: cell(row, layout.nivelIdx),
    grupo: cell(row, layout.grupoIdx),
    carrera: cell(row, layout.carreraIdx),
    enfasis: cell(row, layout.enfasisIdx),
    turno: cell(row, layout.turnoIdx),
    seccion: cell(row, layout.seccionIdx),
    clases,
    examenes,
    fechasSabados: cell(row, layout.fechasSabadosIdx),
  };
}

function dedupeKey(e: SubjectEntry): string {
  return [e.subject, e.carrera, e.nivel, e.grupo, e.turno, e.seccion]
    .map(normalize)
    .join('|');
}

function addWorkbookEntries(target: ParsedWorkbook, entries: SubjectEntry[], seen: Set<string>) {
  for (const entry of entries) {
    const key = dedupeKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    target.entries.push(entry);
  }
}

function buildDerivedData(entries: SubjectEntry[], careerNames: ParsedWorkbook['careerNames']) {
  const subjectMap = new Map<string, string>();
  for (const e of entries) {
    if (!subjectMap.has(normalize(e.subject))) {
      subjectMap.set(normalize(e.subject), e.subject);
    }
  }
  const uniqueSubjects = Array.from(subjectMap.entries()).map(([normalized, name]) => ({
    name,
    normalized,
  }));

  return { entries, uniqueSubjects, careerNames };
}

export function parseWorkbookFromBase64(b64: string): ParsedWorkbook {
  const wb = XLSX.read(b64, { type: 'base64', cellNF: false, sheetStubs: false });
  const entries: SubjectEntry[] = [];
  const seen = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEETS(sheetName)) continue;
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    let rows: unknown[][];
    try {
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][];
    } catch {
      continue;
    }

    const layout = buildLayout(rows);
    if (!layout) continue;

    for (let i = layout.headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const subject = cell(row, layout.subjectIdx);
      const subjectNorm = normalize(subject);
      if (!subjectNorm || HEADER_SUBJECTS.has(subjectNorm)) continue;
      const nivel = cell(row, layout.nivelIdx);
      const carrera = cell(row, layout.carreraIdx);
      if (!nivel && !carrera) continue;
      const entry = buildEntry(row, layout);
      if (!entry.clases.length && !entry.examenes.length) continue;
      const key = dedupeKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }

  const careerNames = wb.SheetNames.filter((n) => !SKIP_SHEETS(n) && SIGLA_RE.test(n)).map(
    (sigla) => ({
      sigla,
      name: '',
      normalized: normalize(sigla),
    })
  );

  return buildDerivedData(entries, careerNames);
}

/**
 * Combina planificaciones descargadas por separado (por ejemplo, el plan 2026
 * y los planes anteriores). Las filas repetidas se descartan.
 */
export function mergeParsedWorkbooks(workbooks: ParsedWorkbook[]): ParsedWorkbook {
  const merged: ParsedWorkbook = { entries: [], uniqueSubjects: [], careerNames: [] };
  const seen = new Set<string>();
  const careerMap = new Map<string, ParsedWorkbook['careerNames'][number]>();

  for (const workbook of workbooks) {
    addWorkbookEntries(merged, workbook.entries, seen);
    for (const career of workbook.careerNames) {
      if (!careerMap.has(career.normalized)) careerMap.set(career.normalized, career);
    }
  }

  return buildDerivedData(merged.entries, Array.from(careerMap.values()));
}
