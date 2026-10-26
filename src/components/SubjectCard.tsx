import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MatchedSubject } from '../types';

export default function SubjectCard({
  subject,
  onSelectSection,
}: {
  subject: MatchedSubject;
  onSelectSection?: (subjectName: string, section: string) => void;
}) {
  const initialIndex = Math.max(
    0,
    subject.entries.findIndex((entry) => entry.seccion === subject.defaultSection)
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const safeIndex = Math.min(Math.max(selectedIndex, 0), subject.entries.length - 1);
  const selected = subject.entries[safeIndex];
  const multiple = subject.entries.length > 1;
  const sectionUnknown = subject.sectionMatched === false;
  const receiptTurno = (subject.receiptTurno ?? '').trim().toUpperCase();
  const hasReceiptTurno = subject.entries.some(
    (entry) => entry.turno.trim().toUpperCase() === receiptTurno
  );
  const distinctTurnos = new Set(
    subject.entries.map((entry) => entry.turno.trim().toUpperCase())
  );

  if (!selected) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {subject.semesterFromReceipt ? `${subject.semesterFromReceipt} - ` : ''}
          {subject.name}
        </Text>
        <Text style={styles.subtitle}>
          Sección {selected.seccion} · Turno {selected.turno}
          {multiple ? ` · ${subject.entries.length} publicadas` : ''}
        </Text>
      </View>

      {sectionUnknown ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            El comprobante indica Turno {subject.receiptTurno} / Sección{' '}
            {subject.receiptSeccion}.{' '}
            {hasReceiptTurno
              ? 'Esa sección no figura en la planificación actual'
              : 'La planificación actual no publica horarios para ese turno'}
            {multiple ? '; elegí la tuya:' : '.'}
          </Text>
          {multiple ? (
            <View style={styles.chips}>
              {subject.entries.map((entry, index) => {
                const active = index === safeIndex;
                return (
                  <TouchableOpacity
                    key={`${entry.seccion}-${index}`}
                    onPress={() => {
                      setSelectedIndex(index);
                      onSelectSection?.(subject.name, entry.seccion);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {distinctTurnos.size > 1
                        ? `${entry.turno}/${entry.seccion}`
                        : entry.seccion}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.entry}>
        <Text style={styles.meta}>
          Carrera: {selected.carrera} · Nivel: {selected.nivel} · Grupo: {selected.grupo} ·
          Turno: {selected.turno} · Sección: {selected.seccion}
        </Text>
        {selected.clases.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clases</Text>
            {selected.clases.map((c, j) => (
              <Text key={j} style={styles.row}>
                {c.day}: {c.time}
                {c.aula ? `  ·  Aula ${c.aula}` : ''}
              </Text>
            ))}
          </View>
        )}
        {selected.examenes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exámenes</Text>
            {selected.examenes.map((x, j) => (
              <Text key={j} style={styles.row}>
                {x.label}: {x.date}
                {x.time ? ` ${x.time}` : ''}
                {x.aula ? `  ·  Aula ${x.aula}` : ''}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e3e6ea',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c2733',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7684',
    marginTop: 2,
  },
  hint: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#92400e',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  chipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  entry: {
    borderTopWidth: 1,
    borderTopColor: '#eef0f3',
    paddingTop: 12,
    marginTop: 12,
  },
  meta: {
    fontSize: 13,
    color: '#33404f',
    fontWeight: '600',
    marginBottom: 8,
  },
  section: {
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  row: {
    fontSize: 14,
    color: '#2b3644',
    lineHeight: 20,
  },
});
