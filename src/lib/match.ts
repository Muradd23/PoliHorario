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
  const dateRe = /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(SI|NO)\s+([A-Za-z])\/([A-Za-z])/g;
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

  const subjects: MatchedSubject[] = [];
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
    const preferred = candidates.filter((e) => tsKey(e.turno, e.seccion) === ts);
    const final = preferred.length ? preferred : candidates;
    if (!final.length) continue;
    seen.add(n);
    subjects.push({
      name: final[0].subject,
      semesterFromReceipt: row.semester,
      entries: final,
    });
  }

  return { subjects, career };
}
