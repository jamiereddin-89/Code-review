import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dualChat } from '../services/ai';
import { useSettings } from '../contexts/SettingsContext';

const DEFAULT_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app">Hello from preview</div>
  </body>
</html>`;

const DEFAULT_CSS = `body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 24px; background: #fff; color: #111 }
#app { padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px }
`;

const DEFAULT_JS = `const el = document.getElementById('app');
el.innerHTML += ' — script loaded';
`;

export function CodeEditor(): JSX.Element {
  const { preferredProvider, theme, setTheme } = useSettings();

  const [html, setHtml] = useState<string>(DEFAULT_HTML);
  const [css, setCss] = useState<string>(DEFAULT_CSS);
  const [js, setJs] = useState<string>(DEFAULT_JS);
  const [tab, setTab] = useState<'html' | 'css' | 'js' | 'output'>('html');
  const [deviceSize, setDeviceSizeState] = useState<'full' | 'iphone' | 'ipad' | 'desktop'>('full');

  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('openai');
  const [editorVisible, setEditorVisible] = useState<boolean>(true);
  const [overlayVisible, setOverlayVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const combinedSrcDoc = useMemo(() => {
    const hasHtml = /<html[\s>]/i.test(html);
    if (hasHtml) {
      let doc = html;
      if (!/<style[\s\S]*?>/.test(doc)) {
        doc = doc.replace(/<\/head>/i, `<style>${css}</style>\n</head>`);
      }
      if (!/<script[\s\S]*?>/.test(doc)) {
        doc = doc.replace(/<\/body>/i, `<script>${js}<\/script>\n</body>`);
      }
      return doc;
    }
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
  }, [html, css, js]);

  useEffect(() => {
    const t = setTimeout(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        iframe.srcdoc = combinedSrcDoc;
      } catch (e) {
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(combinedSrcDoc);
          doc.close();
        }
      }
    }, 250);
    return () => clearTimeout(t);
  }, [combinedSrcDoc]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatHistory]);

  useEffect(() => {
    document.body.classList.remove('dark-mode', 'light-mode');
    document.body.classList.add(theme === 'dark' ? 'dark-mode' : 'light-mode');
  }, [theme]);

  const adjustLayout = useCallback(() => {
    const header = document.querySelector('header') as HTMLElement | null;
    const footer = document.querySelector('footer') as HTMLElement | null;
    const chatInput = document.querySelector('.chat-input') as HTMLElement | null;
    const chat = document.querySelector('.chat') as HTMLElement | null;
    const content = document.querySelector('.content') as HTMLElement | null;
    const leftPanel = document.querySelector('.left-panel') as HTMLElement | null;
    const rightPanel = document.querySelector('.right-panel') as HTMLElement | null;
    const chatHeader = document.querySelector('.chat-header') as HTMLElement | null;
    const toolbar = document.querySelector('.toolbar') as HTMLElement | null;
    const tabs = document.querySelector('.tabs') as HTMLElement | null;

    const headerHeight = header?.offsetHeight ?? 0;
    const footerHeight = footer?.offsetHeight ?? 0;
    const chatHeaderHeight = chatHeader?.offsetHeight ?? 0;
    const toolbarHeight = toolbar?.offsetHeight ?? 0;
    const tabsHeight = tabs?.offsetHeight ?? 0;
    const chatInputHeight = chatInput?.offsetHeight ?? 0;

    if (window.innerWidth <= 768) {
      if (chatInput) chatInput.style.bottom = `${footerHeight}px`;
      if (chat) chat.style.paddingBottom = `${footerHeight + chatInputHeight}px`;
      if (chat) chat.style.maxHeight = `calc(100dvh - ${headerHeight + footerHeight + chatHeaderHeight + chatInputHeight}px)`;
      if (rightPanel) {
        rightPanel.style.top = `${headerHeight}px`;
        rightPanel.style.height = `calc(100dvh - ${headerHeight + footerHeight + chatInputHeight}px)`;
      }
      if (content) content.style.maxHeight = `calc(100dvh - ${headerHeight + toolbarHeight + tabsHeight + footerHeight + chatInputHeight}px)`;
    } else {
      if (leftPanel) leftPanel.style.height = `calc(100vh - ${headerHeight + footerHeight}px)`;
      if (rightPanel) rightPanel.style.height = `calc(100vh - ${headerHeight + footerHeight}px)`;
      if (chat) chat.style.maxHeight = `calc(100vh - ${headerHeight + footerHeight + chatHeaderHeight + chatInputHeight}px)`;
      if (content) content.style.maxHeight = `calc(100vh - ${headerHeight + footerHeight + toolbarHeight + tabsHeight}px)`;
      if (chatInput) chatInput.style.bottom = '0';
      if (chat) chat.style.paddingBottom = '10px';
      if (rightPanel) rightPanel.style.top = '0';
    }
  }, []);

  useEffect(() => {
    adjustLayout();
    window.addEventListener('resize', adjustLayout);
    return () => window.removeEventListener('resize', adjustLayout);
  }, [adjustLayout]);

  function switchTab(to: 'html' | 'css' | 'js' | 'output') {
    setTab(to);
    if (to === 'output') setDeviceSizeState((s) => s);
  }

  function startNewChat() {
    setChatHistory([]);
    setHtml(DEFAULT_HTML);
    setCss(DEFAULT_CSS);
    setJs(DEFAULT_JS);
    setUserInput('');
    setDeviceSizeState('full');
  }

  function toggleEditor() {
    setEditorVisible((v) => !v);
    setOverlayVisible((v) => !v);
  }

  async function generateCode() {
    if (!userInput.trim()) return;
    const input = userInput.trim();
    setChatHistory((h) => [...h, `You: ${input}`, `AI: Loading...`]);
    setLoading(true);

    const messages = [
      { role: 'system', content: 'You are a coding assistant that generates or modifies HTML, CSS, and JS code. Always return the complete, updated, and fully functional code. Return code blocks with delimiters: ```html``` ```css``` ```javascript```.' },
      { role: 'user', content: `Here is the current code:\n\nHTML:\n${html}\n\nCSS:\n${css}\n\nJS:\n${js}\n\nNow: ${input}` },
    ];

    try {
      const res = await dualChat(messages as any, { preferred: preferredProvider, model: selectedModel as any, timeoutMs: 30000 });
      const text = res.content || '';

      setChatHistory((h) => h.filter((x) => x !== 'AI: Loading...'));
      setChatHistory((h) => [...h, `AI (${res.provider}): ${text.slice(0, 200)}...`]);

      const htmlMatch = text.match(/```html\n([\s\S]*?)\n```/);
      const cssMatch = text.match(/```css\n([\s\S]*?)\n```/);
      const jsMatch = text.match(/```javascript\n([\s\S]*?)\n```/);

      if (htmlMatch) setHtml(htmlMatch[1].trim());
      if (cssMatch) setCss(cssMatch[1].trim());
      if (jsMatch) setJs(jsMatch[1].trim());

      setTab('output');
    } catch (e) {
      setChatHistory((h) => h.filter((x) => x !== 'AI: Loading...'));
      setChatHistory((h) => [...h, `AI (${selectedModel}): Error generating code`]);
      console.error(e);
    } finally {
      setLoading(false);
      setUserInput('');
    }
  }

  function importFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = String(ev.target?.result || '');
        if (file.name.endsWith('.html')) setHtml(content);
        else if (file.name.endsWith('.css')) setCss(content);
        else if (file.name.endsWith('.js')) setJs(content);
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openInNewTab() {
    const full = combinedSrcDoc;
    const w = window.open();
    if (!w) { alert('Please allow popups'); return; }
    w.document.open();
    w.document.write(full);
    w.document.close();
  }

  async function downloadZip() {
    const zipAvailable = typeof (window as any).JSZip !== 'undefined';
    if (!zipAvailable) {
      const blob = new Blob([combinedSrcDoc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'preview.html'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      return;
    }
    try {
      const zip = new (window as any).JSZip();
      zip.file('index.html', html);
      zip.file('styles.css', css);
      zip.file('script.js', js);
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a'); a.href = url; a.download = 'vibe-coder-files.zip'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    const iframe = iframeRef.current;
    const content = document.querySelector('.content') as HTMLElement | null;
    if (!iframe || !content) return;
    const maxWidth = Math.max(0, content.clientWidth - 20);
    const maxHeight = Math.max(0, content.clientHeight - 20);
    switch (deviceSize) {
      case 'iphone':
        iframe.style.width = Math.min(320, maxWidth) + 'px';
        iframe.style.height = Math.min(568, maxHeight) + 'px';
        break;
      case 'ipad':
        iframe.style.width = Math.min(768, maxWidth) + 'px';
        iframe.style.height = Math.min(1024, maxHeight) + 'px';
        break;
      case 'desktop':
        iframe.style.width = Math.min(1280, maxWidth) + 'px';
        iframe.style.height = Math.min(720, maxHeight) + 'px';
        break;
      case 'full':
      default:
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        break;
    }
  }, [deviceSize, combinedSrcDoc]);

  return (
    <div className="flex w-full">
      <div className="overlay" style={{ display: overlayVisible ? 'block' : 'none' }} onClick={toggleEditor} />

      <div className="left-panel">
        <div className="chat-header">
          <button onClick={startNewChat} className="px-3 py-1">➕ New Chat</button>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="openai">OpenAI GPT-4o-mini</option>
            <option value="openai-large">OpenAI GPT-4o</option>
            <option value="qwen-coder">Qwen 2.5 Coder</option>
            <option value="llama">Llama 3.3 70B</option>
            <option value="mistral">Mistral</option>
          </select>
          <button className="editor-toggle px-3 py-1" onClick={toggleEditor}>🧩 Editor</button>
        </div>

        <div className="chat" ref={chatRef}>
          {chatHistory.length === 0 ? (
            <div className="text-sm text-gray-500">No messages yet. Type a prompt below to generate code.</div>
          ) : (
            chatHistory.map((m, i) => <div key={i} style={{ marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: escapeHtml(m).replace(/\n/g, '<br>') }} />)
          )}
        </div>

        <div className="chat-input">
          <input value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') generateCode(); }} placeholder="Type your idea..." />
          <button onClick={generateCode} disabled={loading}>{loading ? '...' : '➡️'}</button>
        </div>
      </div>

      <div className={`right-panel ${editorVisible ? 'visible' : ''}`}>
        <div className="toolbar">
          <button className="close-btn" onClick={toggleEditor}>✖ Close</button>
          <button onClick={downloadZip}>⬇️ Download ZIP</button>
          <button onClick={openInNewTab}>🔗 Open in New Tab</button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>🌓 Toggle Theme</button>
          <button onClick={() => fileInputRef.current?.click()}>⬆️ Import Files</button>
          <input ref={fileInputRef} type="file" multiple accept=".html,.css,.js" style={{ display: 'none' }} onChange={importFiles} />
          <select value={deviceSize} onChange={(e) => setDeviceSizeState(e.target.value as any)}>
            <option value="full">Full Size</option>
            <option value="iphone">iPhone (320x568)</option>
            <option value="ipad">iPad (768x1024)</option>
            <option value="desktop">Desktop (1280x720)</option>
          </select>
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'html' ? 'active' : ''}`} onClick={() => switchTab('html')}>HTML</div>
          <div className={`tab ${tab === 'css' ? 'active' : ''}`} onClick={() => switchTab('css')}>CSS</div>
          <div className={`tab ${tab === 'js' ? 'active' : ''}`} onClick={() => switchTab('js')}>JS</div>
          <div className={`tab ${tab === 'output' ? 'active' : ''}`} onClick={() => switchTab('output')}>Output</div>
        </div>

        <div className="content">
          <textarea className={tab === 'html' ? '' : 'hidden'} value={html} onChange={(e) => setHtml(e.target.value)} />
          <textarea className={tab === 'css' ? '' : 'hidden'} value={css} onChange={(e) => setCss(e.target.value)} />
          <textarea className={tab === 'js' ? '' : 'hidden'} value={js} onChange={(e) => setJs(e.target.value)} />
          <iframe id="preview" ref={iframeRef} className={tab === 'output' ? '' : 'hidden'} sandbox="allow-scripts allow-forms allow-same-origin" />
        </div>
      </div>
    </div>
  );
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
