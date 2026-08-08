import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface PickerScreenProps {
  status: string;
  error: string;
  subjectCount: number;
  resultReady: boolean;
  onPickPdf: () => void;
  onPickExcel: () => void;
  onUseBundledExcel: () => void;
  onViewResult: () => void;
}

export default function PickerScreen({
  status,
  error,
  subjectCount,
  resultReady,
  onPickPdf,
  onPickExcel,
  onUseBundledExcel,
  onViewResult,
}: PickerScreenProps) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Estirar Horario</Text>
        <Text style={styles.subtitle}>
          Seleccioná tu comprobante de inscripción (PDF) y la planificación de horarios (Excel)
          para ver el horario completo de cada asignatura.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={onPickPdf}>
          <Text style={styles.primaryText}>Seleccionar comprobante PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onPickExcel}>
          <Text style={styles.secondaryText}>Seleccionar planificación (.xlsx)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={onUseBundledExcel}>
          <Text style={styles.linkText}>Usar planificación incluida en la app</Text>
        </TouchableOpacity>

        {status ? <Text style={styles.status}>{status}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {resultReady ? (
          <TouchableOpacity style={styles.resultButton} onPress={onViewResult}>
            <Text style={styles.resultText}>
              Ver horarios ({subjectCount} asignatura{subjectCount === 1 ? '' : 's'})
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  content: {
    padding: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1c2733',
  },
  subtitle: {
    fontSize: 15,
    color: '#55606e',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 28,
  },
  primaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d4d9df',
  },
  secondaryText: {
    color: '#1c2733',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkButton: {
    paddingVertical: 10,
  },
  linkText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  status: {
    fontSize: 14,
    color: '#33404f',
    marginTop: 18,
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    color: '#b91c1c',
    marginTop: 12,
    textAlign: 'center',
  },
  resultButton: {
    backgroundColor: '#1c2733',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  resultText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
