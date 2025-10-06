"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileLabel, setFileLabel] = useState<string>("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [refine, setRefine] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [showRefine, setShowRefine] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [refinedDraft, setRefinedDraft] = useState<string | null>(null);
  const [refineHint, setRefineHint] = useState<string>("");

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
      // Navigate to the new post page
      if (data?.slug) {
        router.push(`/blog/${data.slug}`);
      } else {
        router.push('/blog');
      }
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
    <>
    <main>
      <section className="card card--bold">
        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          <div>
            <div className="section-title">Upload document (txt, md, pdf, docx, html, csv, json, xlsx)</div>
            <div className="upload-wrap">
              <input id="file-upload" className="visually-hidden" type="file" onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                setFileLabel(f ? f.name : "");
              }} />
              <label htmlFor="file-upload" className="btn btn-primary">⬆ Upload file</label>
              {fileLabel ? <span className="upload-filename">{fileLabel}</span> : null}
            </div>
          </div>
          <div>
            <div className="section-title">Or parse from URL (Medium/Substack/etc.)</div>
            <input className="input" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label><input type="checkbox" checked={refine} onChange={e => setRefine(e.target.checked)} /> Refine with LLM</label>
            <label><input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} /> Overwrite instead of append</label>
            <button className="btn btn-primary" onClick={parseUpload} disabled={loading}>{loading ? 'Parsing…' : 'Parse'}</button>
          </div>
        </div>
      </section>

      <section className="section card">
        <div className="card-body">
          <div className="section-title">Title</div>
          <input className="input" style={{ fontSize: 18 }} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </section>

      <section className="section card">
        <div className="card-body">
          <div className="section-title">Content (Markdown)</div>
          <textarea
          ref={editorRef}
          onPaste={handlePaste}
          onSelect={() => {
            if (showRefine) return;
            const ta = editorRef.current;
            if (!ta) return;
            const start = ta.selectionStart || 0;
            const end = ta.selectionEnd || 0;
            const text = ta.value.slice(start, end);
            if (end > start && text.trim().length > 1) {
              setSelection({ start, end, text });
              setRefinedDraft(null);
              setShowRefine(true);
            }
          }}
          className="textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        </div>
      </section>

      <section className="section card">
        <div className="card-body">
          <h3 style={{ margin: '0 0 8px 0' }}>Preview</h3>
          <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || ""}
            </ReactMarkdown>
          </div>
        </div>
      </section>

      {bundle?.images?.length ? (
        <section className="section">
          <h3>Extracted Images</h3>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {bundle.images.map((img, i) => {
              const src = img.url?.startsWith('http') ? img.url : `${API_BASE}${img.url}`;
              return (
              <div key={i} className="sticker" style={{ padding: 8 }}>
                <img src={src} alt={img.alt || ''} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                <small style={{ wordBreak: 'break-all', color: 'var(--muted)' }}>{src}</small>
              </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="section card card--bold">
        <div className="card-body">
          <h3 style={{ margin: 0 }}>Add Diagram (Excalidraw)</h3>
          <ExcalidrawBox />
        </div>
      </section>

      <section className="section">
        <button className="btn btn-primary" onClick={submitPost}>Submit</button>
      </section>
    </main>
    {showRefine && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, width: 'min(720px, 92vw)', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
          <h3 style={{ marginTop: 0 }}>Refine Selection</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Original</div>
              <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6, maxHeight: 160, overflow: 'auto', background: '#fafafa', whiteSpace: 'pre-wrap' }}>
                {selection?.text}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Refined preview</div>
              <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6, minHeight: 80, maxHeight: 160, overflow: 'auto', background: '#fff', whiteSpace: 'pre-wrap' }}>
                {refinedDraft ?? 'Click Refine to preview…'}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>What do you want to change? (optional)</label>
              <textarea
                value={refineHint}
                onChange={(e) => setRefineHint(e.target.value)}
                placeholder="E.g., simplify language, convert bullet list to table, fix headings, keep code blocks intact."
                style={{ width: '100%', minHeight: 64, padding: 10, borderRadius: 6, border: '1px solid #eee', fontFamily: 'inherit' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => { setShowRefine(false); setRefinedDraft(null); }} disabled={refineBusy}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (!selection) return;
                if (refinedDraft == null) {
                  // First phase: refine and preview
                  setRefineBusy(true);
                  try {
                    const resp = await fetch(`${API_BASE}/api/refine/section`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: selection.text, instructions: refineHint || undefined }),
                    });
                    if (!resp.ok) throw new Error(await resp.text());
                    const data = await resp.json();
                    const refined: string = data.refined || '';
                    setRefinedDraft(refined);
                  } catch (e: any) {
                    alert(`Refine failed: ${e?.message || e}`);
                  } finally {
                    setRefineBusy(false);
                  }
                } else {
                  // Second phase: rewrite selected text with refinedDraft
                  const ta = editorRef.current;
                  const refined = refinedDraft;
                  if (ta) {
                    const before = content.slice(0, selection.start);
                    const after = content.slice(selection.end);
                    const updated = `${before}${refined}${after}`;
                    setContent(updated);
                    setShowRefine(false);
                    setRefinedDraft(null);
                    setRefineHint("");
                    // reset selection to the newly inserted range
                    requestAnimationFrame(() => {
                      try {
                        const posStart = selection.start;
                        const posEnd = selection.start + refined.length;
                        ta.selectionStart = posStart;
                        ta.selectionEnd = posEnd;
                        ta.focus();
                      } catch {}
                    });
                  }
                }
              }}
              disabled={refineBusy}
            >
              {refineBusy ? 'Refining…' : (refinedDraft == null ? 'Refine' : 'Rewrite')}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
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
