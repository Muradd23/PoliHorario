import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import PickerScreen from './src/components/PickerScreen';
import ResultScreen from './src/components/ResultScreen';
import PdfWorkerView from './src/components/PdfWorkerView';
import { assetToBase64, fileUriToBase64 } from './src/lib/assets';
import { matchSubjects, type MatchResult } from './src/lib/match';
import { parseWorkbookFromBase64 } from './src/lib/parseExcel';
import type { ParsedWorkbook } from './src/types';

type Stage = 'pick' | 'result';

const XLSX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/zip',
];

export default function App() {
  const [stage, setStage] = useState<Stage>('pick');
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState('comprobante.pdf');
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [status, setStatus] = useState('Cargando planificación...');
  const [error, setError] = useState('');

  const loadExcelBase64 = useCallback(async (b64: string, label: string) => {
    setStatus(`Leyendo planificación (${label})...`);
    setError('');
    try {
      const result = parseWorkbookFromBase64(b64);
      setParsed(result);
      setStatus(`Planificación cargada: ${result.uniqueSubjects.length} materias.`);
    } catch (e) {
      setParsed(null);
      setStatus('');
      setError(`No se pudo leer la planificación: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const loadBundledExcel = useCallback(() => {
    assetToBase64(require('./assets/planificacion.xlsx'))
      .then((b64) => loadExcelBase64(b64, 'incluida'))
      .catch((e) => {
        setStatus('');
        setError(`No se pudo acceder a la planificación incluida: ${String(e)}`);
      });
  }, [loadExcelBase64]);

  useEffect(() => {
    loadBundledExcel();
  }, [loadBundledExcel]);

  const pickExcel = useCallback(async () => {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: XLSX_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const b64 = await fileUriToBase64(asset.uri);
      await loadExcelBase64(b64, asset.name || 'seleccionada');
    } catch (e) {
      setError(`No se pudo seleccionar la planificación: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [loadExcelBase64]);

  const pickPdf = useCallback(async () => {
    setError('');
    setMatch(null);
    setPdfText(null);
    setStatus('Seleccioná el comprobante PDF...');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setPdfName(asset.name || 'comprobante.pdf');
      setStatus('Extrayendo texto del PDF...');
      const b64 = await fileUriToBase64(asset.uri);
      setPdfBase64(b64);
    } catch (e) {
      setStatus('');
      setError(`No se pudo seleccionar el PDF: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const handlePdfText = useCallback(
    (text: string) => {
      setPdfText(text);
      setStatus('Buscando coincidencias en la planificación...');
    },
    []
  );

  const handlePdfError = useCallback((message: string) => {
    setStatus('');
    setError(`Error al leer el PDF: ${message}`);
    setPdfBase64(null);
  }, []);

  useEffect(() => {
    if (!parsed || !pdfText) return;
    try {
      const m = matchSubjects(parsed, pdfText);
      if (!m.subjects.length) {
        setStatus('');
        setError('No se encontraron asignaturas del comprobante en la planificación.');
        setMatch(null);
        return;
      }
      setMatch(m);
      setStatus('');
      setError('');
      setStage('result');
    } catch (e) {
      setStatus('');
      setError(`Error al buscar coincidencias: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [parsed, pdfText]);

  const handleBack = useCallback(() => {
    setStage('pick');
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      {stage === 'pick' ? (
        <PickerScreen
          status={status}
          error={error}
          subjectCount={match?.subjects.length ?? 0}
          resultReady={!!match && match.subjects.length > 0}
          onPickPdf={pickPdf}
          onPickExcel={pickExcel}
          onUseBundledExcel={loadBundledExcel}
          onViewResult={() => setStage('result')}
        />
      ) : match ? (
        <ResultScreen match={match} pdfName={pdfName} onBack={handleBack} />
      ) : null}
      {pdfBase64 ? (
        <PdfWorkerView base64={pdfBase64} onText={handlePdfText} onError={handlePdfError} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
});
