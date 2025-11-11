import React, { useEffect, useMemo, useRef, useState } from 'react';

function useDebounced<T>(value: T, delay = 500) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const DEFAULT_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <div id="app">Hello from preview</div>
    <script src="script.js"></script>
  </body>
</html>`;

const DEFAULT_CSS = `body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 24px; background: #fff; color: #111 }
#app { padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px }
`;

const DEFAULT_JS = `const el = document.getElementById('app');
el.innerHTML += ' — script loaded';
`;

export function CodeEditor() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [css, setCss] = useState(DEFAULT_CSS);
  const [js, setJs] = useState(DEFAULT_JS);
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html');
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>(null);

  const debHtml = useDebounced(html, 500);
  const debCss = useDebounced(css, 500);
  const debJs = useDebounced(js, 500);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const combinedSrcDoc = useMemo(() => {
    // If user edited a full HTML file, use it and inject CSS/JS if placeholders not present
    const hasHtmlTag = /<html[\s>]/i.test(debHtml);
    if (hasHtmlTag) {
      // attempt to insert CSS and JS by replacing head/body markers
      let doc = debHtml;
      if (!/style\.css/.test(doc)) {
        doc = doc.replace(/<\/head>/i, `<style>${debCss}</style>\n</head>`);
      }
      if (!/script\.js/.test(doc)) {
        doc = doc.replace(/<\/body>/i, `<script>${debJs}<\/script>\n</body>`);
      }
      return doc;
    }

    // Otherwise create a full HTML document
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${debCss}</style></head><body>${debHtml}<script>${debJs}</script></body></html>`;
  }, [debHtml, debCss, debJs]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.srcdoc = combinedSrcDoc;
    } catch (e) {
      // fallback: write into document
      const doc = iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(combinedSrcDoc);
        doc.close();
      }
    }
  }, [combinedSrcDoc]);

  useEffect(() => {
    const t = setTimeout(() => setAutoSaveMessage(null), 2000);
    return () => clearTimeout(t);
  }, [autoSaveMessage]);

  const openInNewTab = () => {
    const w = window.open();
    if (!w) return;
    w.document.open();
    w.document.write(combinedSrcDoc);
    w.document.close();
  };

  const exportZip = async () => {
    const indexHtml = html.includes('<html') ? html : DEFAULT_HTML.replace('<link rel="stylesheet" href="style.css" />', '').replace('</body>', `<script src="script.js"></script>\n</body>`).replace('<div id="app">Hello from preview</div>', html);
    // prefer JSZip if available
    if (typeof window.JSZip !== 'undefined') {
      try {
        const zip = new window.JSZip();
        zip.file('index.html', indexHtml);
        zip.file('style.css', css);
        zip.file('script.js', js);
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        // fallback to single html
        downloadSingle();
      }
    } else {
      downloadSingle();
    }

    function downloadSingle() {
      const blob = new Blob([combinedSrcDoc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'preview.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    setAutoSaveMessage('Export started');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 text-sm">Editor</div>
            <div className="flex space-x-1 text-sm">
              <button onClick={() => setActiveTab('html')} className={`px-2 py-1 rounded ${activeTab === 'html' ? 'bg-white dark:bg-gray-900 border' : 'bg-transparent'}`}>
                HTML
              </button>
              <button onClick={() => setActiveTab('css')} className={`px-2 py-1 rounded ${activeTab === 'css' ? 'bg-white dark:bg-gray-900 border' : 'bg-transparent'}`}>
                CSS
              </button>
              <button onClick={() => setActiveTab('js')} className={`px-2 py-1 rounded ${activeTab === 'js' ? 'bg-white dark:bg-gray-900 border' : 'bg-transparent'}`}>
                JS
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={openInNewTab} className="px-3 py-1 rounded border text-sm">Open in new tab</button>
            <button onClick={exportZip} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Export ZIP</button>
          </div>
        </div>

        <div>
          {activeTab === 'html' && (
            <textarea value={html} onChange={(e) => setHtml(e.target.value)} className="w-full min-h-[220px] font-mono text-xs p-3 border rounded resize-y bg-white dark:bg-gray-900" />
          )}
          {activeTab === 'css' && (
            <textarea value={css} onChange={(e) => setCss(e.target.value)} className="w-full min-h-[220px] font-mono text-xs p-3 border rounded resize-y bg-white dark:bg-gray-900" />
          )}
          {activeTab === 'js' && (
            <textarea value={js} onChange={(e) => setJs(e.target.value)} className="w-full min-h-[220px] font-mono text-xs p-3 border rounded resize-y bg-white dark:bg-gray-900" />
          )}
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">{autoSaveMessage}</div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Preview</div>
          <div className="text-xs text-gray-500">Live (debounced)</div>
        </div>
        <div className="border rounded overflow-hidden bg-white dark:bg-gray-900" style={{ minHeight: 320 }}>
          <iframe title="preview" ref={iframeRef} className="w-full h-[520px]" sandbox="allow-scripts allow-forms allow-same-origin" />
        </div>
      </div>
    </div>
  );
}
