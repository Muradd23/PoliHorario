import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { DetectedCareer, MatchResult, ReceiptRow } from './match';
import type { Stage } from '../types';

export interface LastSchedule {
  version: 1;
  savedAt: string;
  pdfName: string;
  rows: ReceiptRow[];
  career: DetectedCareer | null;
  match: MatchResult;
  /** Sección elegida por materia, con la clave normalizada del nombre. */
  selections: Record<string, string>;
  stage: Stage;
}

const WEB_KEY = 'polihorario:last-schedule:v1';
const NATIVE_FILE = 'ultimo-horario.json';

function nativeFileUri(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) {
    throw new Error('No hay directorio de documentos disponible.');
  }
  return `${dir}${NATIVE_FILE}`;
}

function parseStored(raw: string): LastSchedule | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;

    const value = data as Partial<LastSchedule>;
    if (value.version !== 1) return null;
    if (typeof value.pdfName !== 'string') return null;
    if (!Array.isArray(value.rows) || value.rows.length === 0) return null;
    if (
      !value.match ||
      !Array.isArray(value.match.subjects) ||
      value.match.subjects.length === 0
    ) {
      return null;
    }
    if (!value.selections || typeof value.selections !== 'object') return null;
    if (value.stage !== 'pick' && value.stage !== 'result') return null;

    return value as LastSchedule;
  } catch {
    return null;
  }
}

export async function loadLastSchedule(): Promise<LastSchedule | null> {
  if (Platform.OS === 'web') {
    try {
      const raw = window.localStorage.getItem(WEB_KEY);
      return raw ? parseStored(raw) : null;
    } catch {
      return null;
    }
  }

  try {
    const file = nativeFileUri();
    const info = await FileSystem.getInfoAsync(file);
    if (!info.exists) return null;
    return parseStored(await FileSystem.readAsStringAsync(file));
  } catch {
    return null;
  }
}

export async function saveLastSchedule(state: LastSchedule): Promise<void> {
  const raw = JSON.stringify(state);

  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(WEB_KEY, raw);
    } catch (e) {
      console.warn('[Persistencia] No se pudo guardar en localStorage:', e);
    }
    return;
  }

  await FileSystem.writeAsStringAsync(nativeFileUri(), raw);
}
