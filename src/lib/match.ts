import { normalize } from './normalize';
import type { MatchedSubject, ParsedWorkbook, SubjectEntry } from '../types';

export interface ReceiptRow {
  semester: string;
  subject: string;
  careerName: string;
  turno: string;
  seccion: string;
}

export interface DetectedCareer {
  sigla: string;
  name: string;
}

export interface MatchResult {
  subjects: MatchedSubject[];
  career: DetectedCareer | null;
}

const CAREER_MAP: { name: string; sigla: string }[] = [
  { name: 'INGENIERIA EN INFORMATICA', sigla: 'IIN' },
  { name: 'INGENIERIA EN SISTEMAS DE PRODUCCION', sigla: 'ISP' },
  { name: 'INGENIERIA EN ELECTRONICA', sigla: 'IEN' },
  { name: 'INGENIERIA EN ELECTRICIDAD', sigla: 'IEL' },
  { name: 'INGENIERIA EN MARKETING', sigla: 'IMK' },
  { name: 'INGENIERIA EN CIENCIAS DE MATERIALES', sigla: 'ICM' },
  { name: 'LICENCIATURA EN ANALISIS DE SISTEMAS', sigla: 'LCA' },
  { name: 'LICENCIATURA EN CIENCIAS INFORMATICAS CON ENFASIS', sigla: 'LCIk' },
  { name: 'LICENCIATURA EN CIENCIAS INFORMATICAS', sigla: 'LCI' },
  { name: 'LICENCIATURA EN ELECTRONICA', sigla: 'LEL' },
  { name: 'LICENCIATURA EN GESTION DE LA HOSPITALIDAD', sigla: 'LGH' },
].sort((a, b) => b.name.length - a.name.length);

export function extractReceiptRows(text: string): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  const dateRe =
    /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(SI|NO)\s+([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9-]+)/g;
  let m: RegExpExecArray | null;
  let cursor = 0;
  while ((m = dateRe.exec(text))) {
    const segment = text.slice(cursor, m.index).replace(/\s+/g, ' ');
    cursor = dateRe.lastIndex;
    const subjectMatch = segment.match(
      /(\d{1,2})\s*-\s*([A-ZÁÉÍÓÚÑÜa-záéíóúñü0-9][A-ZÁÉÍÓÚÑÜa-záéíóúñü0-9 ._,()#*'/+-]*)$/
    );
    if (!subjectMatch) continue;
    const pre = segment.slice(0, segment.length - subjectMatch[0].length);
    const careerMatch = pre.match(/([A-ZÁÉÍÓÚÑÜ]{2,}(?:\s+[A-ZÁÉÍÓÚÑÜ]{2,})*)\s*$/);
    rows.push({
      semester: subjectMatch[1],
      subject: subjectMatch[2].trim(),
      careerName: careerMatch ? careerMatch[1].trim() : '',
      turno: m[4].toUpperCase(),
      seccion: m[5].toUpperCase(),
    });
  }
  return rows;
}

export function detectCareer(text: string): DetectedCareer | null {
  const n = normalize(text);
  for (const c of CAREER_MAP) {
    if (n.includes(normalize(c.name))) return { sigla: c.sigla, name: c.name };
  }
  if (n.includes('INFORMATICA')) return { sigla: 'IIN', name: 'INGENIERIA EN INFORMATICA' };
  return null;
}

function tsKey(turno: string, seccion: string): string {
  return `${normalize(turno)}/${normalize(seccion)}`;
}

interface PendingMatch {
  row: ReceiptRow;
  candidates: SubjectEntry[];
  exact: SubjectEntry[];
  sameTurno: SubjectEntry[];
}

function uniqueSections(entries: SubjectEntry[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const key = normalize(entry.seccion);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(entry.seccion);
  }
  return result;
}

/**
 * Cuando el comprobante no indica una sección que exista en la planificación
 * (por ejemplo "T/X" en planes donde ya se publican TQ/TR/TS), se infiere la
 * sección más probable observando las secciones comunes entre las materias del
 * mismo turno del comprobante.
 */
function inferSectionsByTurno(pending: PendingMatch[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();

  for (const item of pending) {
    if (item.exact.length || !item.sameTurno.length) continue;
    const turno = normalize(item.row.turno);
    const bySection = counts.get(turno) ?? new Map<string, number>();
    for (const seccion of uniqueSections(item.sameTurno)) {
      const key = normalize(seccion);
      bySection.set(key, (bySection.get(key) ?? 0) + 1);
    }
    counts.set(turno, bySection);
  }

  const inferred = new Map<string, string>();
  for (const [turno, bySection] of counts) {
    const best = Array.from(bySection.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0];
    if (best) inferred.set(turno, best[0]);
  }
  return inferred;
}

export function matchSubjects(parsed: ParsedWorkbook, text: string): MatchResult {
  const rows = extractReceiptRows(text);
  const career = detectCareer(text);
  const bySubject = new Map<string, SubjectEntry[]>();
  for (const e of parsed.entries) {
    const key = normalize(e.subject);
    const list = bySubject.get(key);
    if (list) list.push(e);
    else bySubject.set(key, [e]);
  }

  const pending: PendingMatch[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const n = normalize(row.subject);
    if (!n || seen.has(n)) continue;

    let candidates = bySubject.get(n) || [];
    if (career) {
      const careerNorm = normalize(career.sigla);
      const filtered = candidates.filter((e) => normalize(e.carrera) === careerNorm);
      if (filtered.length) candidates = filtered;
    }

    const ts = tsKey(row.turno, row.seccion);
    const exact = candidates.filter((e) => tsKey(e.turno, e.seccion) === ts);
    const sameTurno = candidates.filter(
      (e) => normalize(e.turno) === normalize(row.turno)
    );

    if (!candidates.length) continue;
    seen.add(n);
    pending.push({ row, candidates, exact, sameTurno });
  }

  const inferredByTurno = inferSectionsByTurno(pending);

  const subjects: MatchedSubject[] = [];
  for (const item of pending) {
    const { row } = item;
    let entries: SubjectEntry[];
    let sectionMatched: boolean;
    let defaultSection: string | undefined;

    if (item.exact.length) {
      entries = item.exact;
      sectionMatched = true;
      defaultSection = item.exact[0].seccion;
    } else if (item.sameTurno.length) {
      const inferred = inferredByTurno.get(normalize(row.turno));
      entries = [...item.sameTurno].sort((a, b) => {
        const aInferred = inferred && normalize(a.seccion) === inferred ? 0 : 1;
        const bInferred = inferred && normalize(b.seccion) === inferred ? 0 : 1;
        if (aInferred !== bInferred) return aInferred - bInferred;
        return normalize(a.seccion).localeCompare(normalize(b.seccion));
      });
      sectionMatched = false;
      defaultSection = entries[0].seccion;
    } else {
      entries = item.candidates;
      sectionMatched = false;
      defaultSection = entries[0].seccion;
    }

    subjects.push({
      name: entries[0].subject,
      semesterFromReceipt: row.semester,
      entries,
      receiptTurno: row.turno,
      receiptSeccion: row.seccion,
      sectionMatched,
      defaultSection,
    });
  }

  return { subjects, career };
}
