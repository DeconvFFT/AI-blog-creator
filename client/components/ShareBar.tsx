"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function ShareBar({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const shareNative = useCallback(async () => {
    try {
      if ((navigator as any).share && url) {
        await (navigator as any).share({ title, url });
        setOpen(false);
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied");
        setOpen(false);
      }
    } catch {}
  }, [url, title]);

  const encodedUrl = encodeURIComponent(url || "");
  const encodedTitle = encodeURIComponent(title || "");

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-primary" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="true">
        Share
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '110%',
            left: 0,
            background: 'var(--surface)',
            border: '2px solid var(--outline)',
            borderRadius: 12,
            boxShadow: '0 6px 0 var(--outline)',
            padding: 8,
            minWidth: 240,
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="btn" onClick={shareNative}>Quick share</button>
            <a className="btn" href={`${url}.pdf`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Share on X</a>
            <a className="btn" href={`${url}.pdf`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Share on LinkedIn</a>
            <a className="btn" href={`${url}.pdf`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Share on WhatsApp</a>
            <a className="btn" href={`mailto:?subject=${encodedTitle}&body=${encodeURIComponent(url + '.pdf')}`} onClick={() => setOpen(false)}>Email</a>
            <button className="btn" onClick={async () => { await navigator.clipboard.writeText(url); alert('Link copied'); setOpen(false); }}>Copy link</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
