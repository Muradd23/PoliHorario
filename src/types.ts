export interface ClassSlot {
  day: string;
  time: string;
  aula: string;
}

export interface ExamSlot {
  label: string;
  date: string;
  time: string;
  aula: string;
}

export interface SubjectEntry {
  subject: string;
  departamento: string;
  nivel: string;
  grupo: string;
  carrera: string;
  enfasis: string;
  turno: string;
  seccion: string;
  clases: ClassSlot[];
  examenes: ExamSlot[];
  fechasSabados: string;
}

export interface MatchedSubject {
  name: string;
  semesterFromReceipt?: string;
  entries: SubjectEntry[];
  /** Turno y sección tal como figuran en el comprobante. */
  receiptTurno?: string;
  receiptSeccion?: string;
  /** true si la sección del comprobante existe en la planificación. */
  sectionMatched?: boolean;
  /** Sección que conviene mostrar primero cuando el comprobante no la precisa. */
  defaultSection?: string;
}

export interface ParsedWorkbook {
  entries: SubjectEntry[];
  uniqueSubjects: { name: string; normalized: string }[];
  careerNames: { sigla: string; name: string; normalized: string }[];
}

export type Stage = 'pick' | 'result';
