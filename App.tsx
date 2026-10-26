import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import PickerScreen from './src/components/PickerScreen';
import ResultScreen from './src/components/ResultScreen';
import PdfWorkerView from './src/components/PdfWorkerView';
import { assetToBase64, fileUriToBase64 } from './src/lib/assets';
import { matchSubjects, type MatchResult } from './src/lib/match';
import { mergeParsedWorkbooks, parseWorkbookFromBase64 } from './src/lib/parseExcel';
import { downloadRemoteWorkbooks } from './src/lib/remoteWorkbook';
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

  const applyWorkbooks = useCallback((workbooks: ParsedWorkbook[], label: string) => {
    const merged = mergeParsedWorkbooks(workbooks);
    setParsed(merged);
    setStatus(`Planificación cargada (${label}): ${merged.uniqueSubjects.length} materias.`);
  }, []);

  const loadExcelBase64 = useCallback(
    async (b64: string, label: string) => {
      const startedAt = Date.now();
      console.log(`[Excel] Iniciando lectura de la planificación (${label})...`);
      setStatus(`Leyendo planificación (${label})...`);
      setError('');
      try {
        const result = parseWorkbookFromBase64(b64);
        console.log(
          `[Excel] Lectura finalizada (${label}) en ${Date.now() - startedAt} ms: ` +
            `${result.entries.length} filas y ${result.uniqueSubjects.length} materias.`
        );
        applyWorkbooks([result], label);
      } catch (e) {
        console.error(`[Excel] Error al leer la planificación (${label}):`, e);
        setParsed(null);
        setStatus('');
        setError(`No se pudo leer la planificación: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [applyWorkbooks]
  );

  const loadBundledExcel = useCallback(
    (reason?: string) => {
      console.log('[Excel] Cargando la planificación incluida en la app...');
      setStatus(
        reason
          ? `${reason} Usando la planificación incluida en la app...`
          : 'Usando la planificación incluida en la app...'
      );
      assetToBase64(require('./assets/planificacion.xlsx'))
        .then((b64) => loadExcelBase64(b64, 'incluida en la app'))
        .catch((e) => {
          console.error('[Excel] No se pudo acceder a la planificación incluida:', e);
          setStatus('');
          setError(`No se pudo acceder a la planificación incluida: ${String(e)}`);
        });
    },
    [loadExcelBase64]
  );

  const loadRemoteExcel = useCallback(async () => {
    const startedAt = Date.now();
    console.log('[Excel] Descargando las planificaciones publicadas en la web...');
    setError('');
    setStatus('Descargando planificaciones desde la página de la FP-UNA...');
    try {
      const remotes = await downloadRemoteWorkbooks();
      console.log(
        `[Excel] Descarga finalizada en ${Date.now() - startedAt} ms: ` +
          `${remotes.length} planificación(es): ${remotes.map((r) => r.label).join(', ')}.`
      );

      const parsedWorkbooks: ParsedWorkbook[] = [];
      for (const remote of remotes) {
        const parseStartedAt = Date.now();
        console.log(`[Excel] Iniciando lectura de la planificación (${remote.label})...`);
        try {
          const result = parseWorkbookFromBase64(remote.base64);
          console.log(
            `[Excel] Lectura finalizada (${remote.label}) en ${Date.now() - parseStartedAt} ms: ` +
              `${result.entries.length} filas y ${result.uniqueSubjects.length} materias.`
          );
          parsedWorkbooks.push(result);
        } catch (e) {
          console.error(`[Excel] Error al leer la planificación (${remote.label}):`, e);
        }
      }

      if (!parsedWorkbooks.length) {
        throw new Error('no se pudo leer ninguna de las planificaciones descargadas');
      }

      applyWorkbooks(
        parsedWorkbooks,
        parsedWorkbooks.length > 1 ? `${parsedWorkbooks.length} planificaciones de la web` : remotes[0].label
      );
    } catch (e) {
      console.error('[Excel] No se pudo descargar la planificación desde la web:', e);
      const detail = e instanceof Error ? e.message : String(e);
      loadBundledExcel(`No se pudo descargar de la web (${detail}).`);
    }
  }, [applyWorkbooks, loadBundledExcel]);

  useEffect(() => {
    loadRemoteExcel();
  }, [loadRemoteExcel]);

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
      console.log(`[Excel] Archivo seleccionado: ${asset.name || asset.uri}`);
      const b64 = await fileUriToBase64(asset.uri);
      await loadExcelBase64(b64, asset.name || 'seleccionada');
    } catch (e) {
      console.error('[Excel] Error al seleccionar o leer el archivo:', e);
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
      const name = asset.name || 'comprobante.pdf';
      console.log(`[Comprobante] Iniciando lectura de "${name}"...`);
      setPdfName(name);
      setStatus('Extrayendo texto del PDF...');
      const b64 = await fileUriToBase64(asset.uri);
      setPdfBase64(b64);
    } catch (e) {
      console.error('[Comprobante] Error al seleccionar o leer el PDF:', e);
      setStatus('');
      setError(`No se pudo seleccionar el PDF: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const handlePdfText = useCallback(
    (text: string) => {
      console.log(`[Comprobante] Lectura finalizada: ${text.length} caracteres extraídos.`);
      setPdfText(text);
      setStatus('Buscando coincidencias en la planificación...');
    },
    []
  );

  const handlePdfError = useCallback((message: string) => {
    console.error(`[Comprobante] Error al leer el PDF: ${message}`);
    setStatus('');
    setError(`Error al leer el PDF: ${message}`);
    setPdfBase64(null);
  }, []);

  useEffect(() => {
    if (!parsed || !pdfText) return;
    try {
      const m = matchSubjects(parsed, pdfText);
      if (!m.subjects.length) {
        console.error('[Comprobante] No se encontraron asignaturas en la planificación.');
        setStatus('');
        setError('No se encontraron asignaturas del comprobante en la planificación.');
        setMatch(null);
        return;
      }
      console.log(`[Comprobante] Coincidencias encontradas: ${m.subjects.length} materias.`);
      setMatch(m);
      setStatus('');
      setError('');
      setStage('result');
    } catch (e) {
      console.error('[Comprobante] Error al buscar coincidencias:', e);
      setStatus('');
      setError(`Error al buscar coincidencias: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [parsed, pdfText]);

  const handleBack = useCallback(() => {
    setStage('pick');
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.safe}>
        <StatusBar style="auto" />
        {stage === 'pick' ? (
          <PickerScreen
            status={status}
            error={error}
            subjectCount={match?.subjects.length ?? 0}
            resultReady={!!match && match.subjects.length > 0}
            onPickPdf={pickPdf}
            onPickExcel={pickExcel}
            onRefreshFromWeb={loadRemoteExcel}
            onViewResult={() => setStage('result')}
          />
        ) : match ? (
          <ResultScreen match={match} pdfName={pdfName} onBack={handleBack} />
        ) : null}
        {pdfBase64 ? (
          <View style={styles.hiddenLayer} pointerEvents="none">
            <PdfWorkerView base64={pdfBase64} onText={handlePdfText} onError={handlePdfError} />
          </View>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  hiddenLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});
