import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MatchResult } from '../lib/match';

interface CalendarItem {
  key: string;
  subject: string;
  label: string;
  date: string;
  time: string;
  aula: string;
  seccion: string;
  turno: string;
  dayName?: string;
}

function parseExamDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;
  const d = new Date(year, month, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateKey(dateStr: string): string {
  const d = parseExamDate(dateStr);
  if (!d) return dateStr;
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const d = parseExamDate(dateStr);
  if (!d) return dateStr;
  try {
    return d.toLocaleDateString('es-PY', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function extractDayName(dateStr: string): string | undefined {
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length && /^[A-Za-zÁÉÍÓÚÑáéíóúñ]+$/.test(parts[0])) {
    return parts[0];
  }
  return undefined;
}

export default function ExamCalendar({ match }: { match: MatchResult }) {
  const items = useMemo(() => {
    const list: CalendarItem[] = [];

    for (const subject of match.subjects) {
      const activeEntry =
        subject.entries.find((e) => e.seccion === subject.defaultSection) ||
        subject.entries[0];

      if (!activeEntry) continue;

      for (const exam of activeEntry.examenes || []) {
        list.push({
          key: `${subject.name}-${activeEntry.seccion}-${exam.label}-${exam.date}-${exam.time}`,
          subject: subject.name,
          label: exam.label,
          date: exam.date,
          time: exam.time,
          aula: exam.aula,
          seccion: activeEntry.seccion,
          turno: activeEntry.turno,
          dayName: extractDayName(exam.date),
        });
      }
    }

    list.sort((a, b) => {
      const da = parseExamDate(a.date);
      const db = parseExamDate(b.date);
      if (da && db && da.getTime() !== db.getTime()) {
        return da.getTime() - db.getTime();
      }
      if (da && !db) return -1;
      if (!da && db) return 1;
      const ta = a.time || '';
      const tb = b.time || '';
      if (ta !== tb) return ta.localeCompare(tb);
      return a.subject.localeCompare(b.subject);
    });

    return list;
  }, [match]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: CalendarItem[] }>();
    for (const item of items) {
      const key = formatDateKey(item.date);
      if (!map.has(key)) {
        map.set(key, { label: formatDateLabel(item.date), items: [] });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Sin exámenes para mostrar</Text>
        <Text style={styles.emptyText}>
          No hay fechas de examen cargadas para las secciones seleccionadas.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {grouped.map(([key, group]) => (
        <View key={key} style={styles.group}>
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>{group.label}</Text>
          </View>
          {group.items.map((item) => (
            <View key={item.key} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.subject}>{item.subject}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.label}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Horario</Text>
                <Text style={styles.rowValue}>{item.time || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Aula</Text>
                <Text style={styles.rowValue}>{item.aula || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Sección</Text>
                <Text style={styles.rowValue}>
                  {item.seccion} · Turno {item.turno}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  empty: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e3e6ea',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c2733',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 14,
    color: '#5f6b7a',
  },
  group: {
    marginTop: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1c2733',
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e3e6ea',
    shadowColor: '#0f172a',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  subject: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1c2733',
  },
  badge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f3f6',
  },
  rowLabel: {
    fontSize: 13,
    color: '#6b7684',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c2733',
    textAlign: 'right',
  },
});
