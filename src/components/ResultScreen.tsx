import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MatchResult } from '../lib/match';
import SubjectCard from './SubjectCard';

export interface ResultScreenProps {
  match: MatchResult;
  pdfName: string;
  onBack: () => void;
}

export default function ResultScreen({ match, pdfName, onBack }: ResultScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={styles.heading}>Horarios encontrados</Text>
        <Text style={styles.subheading}>{pdfName}</Text>
        {match.career ? (
          <View style={styles.careerBadge}>
            <Text style={styles.careerText}>
              Carrera: {match.career.name} ({match.career.sigla})
            </Text>
          </View>
        ) : null}
        <Text style={styles.count}>
          {match.subjects.length} asignatura{match.subjects.length === 1 ? '' : 's'} del comprobante
        </Text>
        {match.subjects.map((s) => (
          <SubjectCard
            key={`${s.name}|${s.receiptTurno ?? ''}|${s.receiptSeccion ?? ''}|${s.defaultSection ?? ''}`}
            subject={s}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',

    width:'100%'
  },
  topbar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e3e6ea',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    fontSize: 15,
    color: '#0f766e',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    height:'100%'
  },
  content: {
    flexGrow: 1,
    padding: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1c2733',
  },
  subheading: {
    fontSize: 14,
    color: '#6b7684',
    marginTop: 2,
  },
  careerBadge: {
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  careerText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
    color: '#33404f',
    marginTop: 8,
    marginBottom: 16,
  },
});
