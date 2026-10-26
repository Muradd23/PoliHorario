import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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

const iframeStyle: React.CSSProperties = {
  border: 0,
  width: '100%',
  height: '100%',
  display: 'block',
  backgroundColor: 'transparent',
};

/**
 * En la web no existe react-native-webview: el PDF se procesa en un iframe
 * aislado con el mismo pdf.js que usa la app nativa. El iframe publica el
 * resultado con postMessage y este componente lo recibe.
 */
export default function PdfWorkerView({ base64, onText, onError }: PdfWorkerViewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) {
        return;
      }
      try {
        const data: InjectedMessage =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'success' && typeof data.text === 'string') {
          onText(data.text);
        } else {
          onError(data.message || 'No se pudo extraer el texto del PDF.');
        }
      } catch {
        onError('Respuesta inválida del visor PDF.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onText, onError]);

  if (!html) return null;

  return (
    <View style={styles.fill}>
      <iframe
        ref={frameRef}
        title="Lector de comprobante PDF"
        srcDoc={html}
        sandbox="allow-scripts"
        style={iframeStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
