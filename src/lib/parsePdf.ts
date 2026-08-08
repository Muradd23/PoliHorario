function escapeJs(s: string): string {
  return JSON.stringify(s).replace(/</g, '\\u003c');
}

export function buildPdfExtractionHtml(opts: {
  pdfLib: string;
  worker: string;
  base64: string;
}): string {
  const pdfLib = escapeJs(opts.pdfLib);
  const worker = escapeJs(opts.worker);
  const base64 = escapeJs(opts.base64);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<script>
(function () {
  function fail(msg) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(msg) }));
    } catch (e) {}
  }
  try {
    var libScript = document.createElement('script');
    libScript.text = ${pdfLib};
    document.head.appendChild(libScript);
    if (!window.pdfjsLib) { fail('No se pudo cargar pdf.js'); return; }
    var workerBlob = new Blob([${worker}], { type: 'text/javascript' });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
    var raw = atob(${base64});
    var data = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i) & 0xff;
    window.pdfjsLib.getDocument({ data: data, isEvalSupported: false }).promise
      .then(function (pdf) {
        var tasks = [];
        for (var p = 1; p <= pdf.numPages; p++) {
          tasks.push(pdf.getPage(p).then(function (page) {
            return page.getTextContent().then(function (tc) {
              var out = '';
              for (var j = 0; j < tc.items.length; j++) {
                var it = tc.items[j];
                out += it.str;
                if (it.hasEOL) out += '\\n';
              }
              return out;
            });
          }));
        }
        return Promise.all(tasks);
      })
      .then(function (pages) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', text: pages.join('\\n') }));
      })
      .catch(function (err) {
        fail((err && err.message) ? err.message : err);
      });
  } catch (e) {
    fail((e && e.message) ? e.message : e);
  }
})();
</script>
</body>
</html>`;
}

export function sanitizePdfText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
}
