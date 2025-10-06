"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type ImageRef = { url: string; alt?: string };
type TableRef = { html?: string; data?: any };
type ParsedBundle = {
  title?: string | null;
  text?: string | null;
  html?: string | null;
  images: ImageRef[];
  tables: TableRef[];
  meta?: any;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [refine, setRefine] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  async function parseUpload() {
    setLoading(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      form.append("refine_with_llm", String(refine));
      if (url) form.append("url", url);
      const resp = await fetch(`${API_BASE}/api/posts/parse`, { method: "POST", body: form });
      if (!resp.ok) throw new Error(await resp.text());
      const data: ParsedBundle = await resp.json();
      setBundle(data);
      const raw = data.text || data.html || "";
      const absolutized = absolutizeMarkdownImages(raw);
      if (overwrite) setContent(absolutized);
      else setContent(prev => `${prev}\n\n${absolutized}`.trim());
      if (data.title) setTitle(data.title);
    } catch (e: any) {
      alert(`Parse failed: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function submitPost() {
    try {
      const payload = {
        title: title || "Untitled",
        content_text: content,
        content_html: null,
        images: (bundle?.images || []),
        tables: (bundle?.tables || []),
        source_type: url ? "external" : "upload",
        source_url: url || null,
        meta: bundle?.meta || {},
      };
      const resp = await fetch(`${API_BASE}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      alert(`Posted: ${data.slug}`);
    } catch (e: any) {
      alert(`Submit failed: ${e.message || e}`);
    }
  }

  async function uploadAsset(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch(`${API_BASE}/api/assets`, { method: "POST", body: fd });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    const url: string = data.url;
    // Convert relative server path to absolute for preview embedding
    return url.startsWith("http") ? url : `${API_BASE}${url}`;
  }

  function insertAtCursor(textarea: HTMLTextAreaElement, textToInsert: string) {
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const next = `${before}${textToInsert}${after}`;
    setContent(next);
    // restore caret after state update
    requestAnimationFrame(() => {
      try {
        const pos = start + textToInsert.length;
        textarea.selectionStart = textarea.selectionEnd = pos;
        textarea.focus();
      } catch {}
    });
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type && it.type.startsWith("image/")) {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const url = await uploadAsset(file);
            const ta = editorRef.current;
            if (ta) insertAtCursor(ta, `![pasted image](${url})`);
          } catch (err: any) {
            alert(`Paste upload failed: ${err?.message || err}`);
          }
        }
      }
    }
  }

  return (
    <main>
      <section style={{ display: 'grid', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>Upload document (txt, md, pdf, docx, html)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>Or parse from URL (Medium/Substack/etc.)</label>
          <input style={{ width: '100%', padding: 8 }} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label><input type="checkbox" checked={refine} onChange={e => setRefine(e.target.checked)} /> Refine with LLM</label>
          <label><input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} /> Overwrite instead of append</label>
          <button onClick={parseUpload} disabled={loading}>{loading ? 'Parsing…' : 'Parse'}</button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>Title</label>
        <input style={{ width: '100%', padding: 8, fontSize: 18 }} value={title} onChange={(e) => setTitle(e.target.value)} />
      </section>

      <section style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>Content (Markdown)</label>
        <textarea
          ref={editorRef}
          onPaste={handlePaste}
          style={{ width: '100%', height: 320, padding: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas' }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </section>

      <section style={{ marginTop: 16 }}>
        <h3 style={{ margin: '12px 0' }}>Preview</h3>
        <div style={{
          border: '1px solid #eee',
          padding: 16,
          borderRadius: 6,
          background: '#fafafa'
        }}>
          <ReactMarkdown>{content || ""}</ReactMarkdown>
        </div>
      </section>

      {bundle?.images?.length ? (
        <section style={{ marginTop: 16 }}>
          <h3>Extracted Images</h3>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {bundle.images.map((img, i) => {
              const src = img.url?.startsWith('http') ? img.url : `${API_BASE}${img.url}`;
              return (
              <div key={i} style={{ border: '1px solid #eee', padding: 8 }}>
                <img src={src} alt={img.alt || ''} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                <small style={{ wordBreak: 'break-all' }}>{src}</small>
              </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 16 }}>
        <h3>Add Diagram (Excalidraw)</h3>
        <ExcalidrawBox />
      </section>

      <section style={{ marginTop: 24 }}>
        <button onClick={submitPost}>Submit</button>
      </section>
    </main>
  );
}

function ExcalidrawBox() {
  const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then(m => m.Excalidraw), { ssr: false });
  return (
    <div style={{ height: 360, border: '1px solid #eee' }}>
      <Excalidraw
        initialData={{
          appState: {
            viewBackgroundColor: 'transparent',
            exportBackground: false,
          },
        }}
      />
    </div>
  );
}
  function absolutizeMarkdownImages(md: string): string {
    // Replace ![alt](/static/...) with absolute URL using API_BASE
    return md.replace(/!\[([^\]]*)\]\((\s*\/static[^)\s]*)\)/g, (_m, alt, path) => {
      const url = `${API_BASE}${String(path).trim()}`;
      return `![${alt}](${url})`;
    });
  }
