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

const I_SUBJECT = 2;
const I_DPTO = 1;
const I_NIVEL = 3;
const I_GRUPO = 4;
const I_CARRERA = 5;
const I_ENFASIS = 6;
const I_TURNO = 8;
const I_SECCION = 9;

const DAYS: { day: string; timeIdx: number; aulaIdx: number }[] = [
  { day: 'Lunes', timeIdx: 26, aulaIdx: 27 },
  { day: 'Martes', timeIdx: 28, aulaIdx: 29 },
  { day: 'Miércoles', timeIdx: 30, aulaIdx: 31 },
  { day: 'Jueves', timeIdx: 32, aulaIdx: 33 },
  { day: 'Viernes', timeIdx: 34, aulaIdx: 35 },
  { day: 'Sábado', timeIdx: 36, aulaIdx: 37 },
];

function cell(row: unknown[], idx: number): string {
  const v = row[idx];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function buildEntry(row: unknown[]): SubjectEntry {
  const subject = cell(row, I_SUBJECT);
  const clases: ClassSlot[] = [];
  for (const d of DAYS) {
    const time = cell(row, d.timeIdx);
    if (time) {
      clases.push({ day: d.day, time, aula: cell(row, d.aulaIdx) });
    }
  }

  const exHora = cell(row, 13);
  const exAula = cell(row, 14);
  const examenes: ExamSlot[] = [];
  const exSpecs: [string, number][] = [
    ['1ra Etapa', 10],
    ['2da Etapa', 11],
    ['1er Final', 12],
  ];
  for (const [label, idx] of exSpecs) {
    const date = cell(row, idx);
    if (date) examenes.push({ label, date, time: exHora, aula: exAula });
  }
  const rev = cell(row, 15);
  if (rev) examenes.push({ label: 'Revisión', date: rev, time: cell(row, 16), aula: '' });
  const fin2 = cell(row, 17);
  if (fin2) {
    examenes.push({ label: '2do Final', date: fin2, time: cell(row, 18), aula: cell(row, 19) });
  }
  const rev2 = cell(row, 20);
  if (rev2) examenes.push({ label: 'Revisión 2do', date: rev2, time: cell(row, 21), aula: '' });

  return {
    subject,
    departamento: cell(row, I_DPTO),
    nivel: cell(row, I_NIVEL),
    grupo: cell(row, I_GRUPO),
    carrera: cell(row, I_CARRERA),
    enfasis: cell(row, I_ENFASIS),
    turno: cell(row, I_TURNO),
    seccion: cell(row, I_SECCION),
    clases,
    examenes,
    fechasSabados: cell(row, 37),
  };
}

function dedupeKey(e: SubjectEntry): string {
  return [e.subject, e.carrera, e.nivel, e.grupo, e.turno, e.seccion]
    .map(normalize)
    .join('|');
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
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const subject = cell(row, I_SUBJECT);
      const subjectNorm = normalize(subject);
      if (!subjectNorm || HEADER_SUBJECTS.has(subjectNorm)) continue;
      const nivel = cell(row, I_NIVEL);
      const carrera = cell(row, I_CARRERA);
      if (!nivel && !carrera) continue;
      const entry = buildEntry(row);
      if (!entry.clases.length && !entry.examenes.length) continue;
      const key = dedupeKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }

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

  const careerNames = wb.SheetNames.filter((n) => !SKIP_SHEETS(n) && SIGLA_RE.test(n)).map(
    (sigla) => ({
      sigla,
      name: '',
      normalized: normalize(sigla),
    })
  );

  return { entries, uniqueSubjects, careerNames };
}
