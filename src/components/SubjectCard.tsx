import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MatchedSubject } from '../types';

export default function SubjectCard({ subject }: { subject: MatchedSubject }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {subject.semesterFromReceipt ? `${subject.semesterFromReceipt} - ` : ''}
          {subject.name}
        </Text>
        <Text style={styles.subtitle}>
          {subject.entries.length === 1 ? '1 sección' : `${subject.entries.length} secciones`}
        </Text>
      </View>
      {subject.entries.map((entry, i) => (
        <View key={i} style={styles.entry}>
          <Text style={styles.meta}>
            Carrera: {entry.carrera} · Nivel: {entry.nivel} · Grupo: {entry.grupo} · Turno:{' '}
            {entry.turno} · Sección: {entry.seccion}
          </Text>
          {entry.clases.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Clases</Text>
              {entry.clases.map((c, j) => (
                <Text key={j} style={styles.row}>
                  {c.day}: {c.time}
                  {c.aula ? `  ·  Aula ${c.aula}` : ''}
                </Text>
              ))}
            </View>
          )}
          {entry.examenes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exámenes</Text>
              {entry.examenes.map((x, j) => (
                <Text key={j} style={styles.row}>
                  {x.label}: {x.date}
                  {x.time ? ` ${x.time}` : ''}
                  {x.aula ? `  ·  Aula ${x.aula}` : ''}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
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
