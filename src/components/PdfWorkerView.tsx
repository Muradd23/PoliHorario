import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { assetToText } from '../lib/assets';
import { buildPdfExtractionHtml } from '../lib/parsePdf';

export interface PdfWorkerViewProps {
  base64: string;
  onText: (text: string) => void;
  onError: (message: string) => void;
}

interface InjectedMessage {
  type?: string;
  text?: string;
  message?: string;
}

export default function PdfWorkerView({ base64, onText, onError }: PdfWorkerViewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pdfLib, worker] = await Promise.all([
          assetToText(require('../../assets/pdf.min.js.txt')),
          assetToText(require('../../assets/pdf.worker.min.js.txt')),
        ]);
        if (!cancelled) setHtml(buildPdfExtractionHtml({ pdfLib, worker, base64 }));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base64]);

  useEffect(() => {
    if (loadError) onError(loadError);
  }, [loadError, onError]);

  if (!html) return null;

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={styles.fill}
      javaScriptEnabled
      domStorageEnabled
      textZoom={100}
      onMessage={(event) => {
        try {
          const data: InjectedMessage = JSON.parse(event.nativeEvent.data);
          if (data.type === 'success' && typeof data.text === 'string') {
            onText(data.text);
          } else {
            onError(data.message || 'No se pudo extraer el texto del PDF.');
          }
        } catch {
          onError('Respuesta inválida del visor PDF.');
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
