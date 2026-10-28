import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MatchResult } from '../lib/match';

interface ExamItem {
  key: string;
  subject: string;
  label: string;
  date: string;
  time: string;
  aula: string;
  seccion: string;
  turno: string;
  category: string;
}

interface Category {
  key: string;
  title: string;
}

const CATEGORIES: Category[] = [
  { key: 'p1', title: 'Primer parcial' },
  { key: 'p2', title: 'Segundo parcial' },
  { key: 'f1', title: 'Primer final' },
  { key: 'f2', title: 'Segundo final' },
  { key: 'other', title: 'Otros' },
];

function categoryOf(label: string): string {
  const l = (label || '').toLowerCase();
  const isFinal = l.includes('final');
  const first = l.includes('1ra') || l.includes('1er') || l.includes('primer');
  const second = l.includes('2da') || l.includes('2do') || l.includes('segund');
  if (isFinal && first) return 'f1';
  if (isFinal && second) return 'f2';
  if (first) return 'p1';
  if (second) return 'p2';
  return 'other';
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
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateLabel(dateStr: string): string {
  const d = parseExamDate(dateStr);
  if (!d) return dateStr;
  try {
    const label = d.toLocaleDateString('es-PY', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string): string {
  const d = parseExamDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' });
}

export default function ExamCalendar({ match }: { match: MatchResult }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const items = useMemo(() => {
    const list: ExamItem[] = [];

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
          category: categoryOf(exam.label),
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

  const byCategory = useMemo(() => {
    const map = new Map<string, ExamItem[]>();
    for (const item of items) {
      const list = map.get(item.category);
      if (list) list.push(item);
      else map.set(item.category, [item]);
    }
    return map;
  }, [items]);

  const visibleCategories = useMemo(
    () => CATEGORIES.filter((c) => (byCategory.get(c.key)?.length ?? 0) > 0),
    [byCategory]
  );

  const activeItems = openKey ? byCategory.get(openKey) || [] : [];

  const groupedByDate = useMemo(() => {
    const map = new Map<string, { label: string; items: ExamItem[] }>();
    for (const item of activeItems) {
      const key = formatDateKey(item.date);
      if (!map.has(key)) {
        map.set(key, { label: formatDateLabel(item.date), items: [] });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.entries());
  }, [activeItems]);

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
      <View style={styles.grid}>
        {visibleCategories.map((category) => {
          const list = byCategory.get(category.key) || [];
          const isOpen = openKey === category.key;
          const firstDate = list.length ? formatShortDate(list[0].date) : '';
          return (
            <TouchableOpacity
              key={category.key}
              onPress={() => setOpenKey(isOpen ? null : category.key)}
              style={[styles.typeButton, isOpen && styles.typeButtonActive]}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <Text style={[styles.typeTitle, isOpen && styles.typeTitleActive]}>
                {category.title}
              </Text>
              <Text style={[styles.typeMeta, isOpen && styles.typeMetaActive]}>
                {list.length} {list.length === 1 ? 'fecha' : 'fechas'}
                {firstDate ? ` · desde ${firstDate}` : ''}
              </Text>
              <Text style={[styles.chevron, isOpen && styles.chevronActive]}>
                {isOpen ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {openKey && activeItems.length > 0 ? (
        <View style={styles.detail}>
          {groupedByDate.map(([key, group]) => (
            <View key={key} style={styles.group}>
              <Text style={styles.dateText}>{group.label}</Text>
              {group.items.map((item) => (
                <View key={item.key} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.subject}>{item.subject}</Text>
                    <Text style={styles.time}>{item.time || '—'}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Aula</Text>
                    <Text style={styles.rowValue}>{item.aula || 'No informada'}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Sección</Text>
                    <Text style={styles.rowValue}>
                      {item.seccion} · Turno {item.turno}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Examen</Text>
                    <Text style={styles.rowValue}>{item.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e3e6ea',
    minHeight: 92,
  },
  typeButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c2733',
  },
  typeTitleActive: {
    color: '#ffffff',
  },
  typeMeta: {
    fontSize: 12,
    color: '#6b7684',
    marginTop: 4,
  },
  typeMetaActive: {
    color: '#d1fae5',
  },
  chevron: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    fontSize: 11,
    color: '#94a3b8',
  },
  chevronActive: {
    color: '#d1fae5',
  },
  detail: {
    marginTop: 16,
  },
  group: {
    marginTop: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1c2733',
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e3e6ea',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  subject: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1c2733',
  },
  time: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f766e',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
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
