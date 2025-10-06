"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Post = {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  source_type: string;
  source_url?: string | null;
};

export default function BlogListClient({ initial }: { initial: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initial);
  const swipe = useRef<{ id: string | null; startX: number; dx: number }>({ id: null, startX: 0, dx: 0 });
  const [revealId, setRevealId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function onPointerDown(id: string, x: number) {
    swipe.current = { id, startX: x, dx: 0 };
  }
  function onPointerMove(x: number) {
    if (!swipe.current.id) return;
    swipe.current.dx = x - swipe.current.startX;
    if (swipe.current.dx > 80) {
      setRevealId(swipe.current.id);
    }
  }
  function onPointerUp() {
    swipe.current = { id: null, startX: 0, dx: 0 };
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this blog? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const resp = await fetch(`${API_BASE}/api/posts/${id}/delete`, { method: "POST" });
      if (!resp.ok) {
        const msg = await resp.text().catch(() => "");
        throw new Error(`${resp.status} ${msg}`);
      }
    } catch (e: any) {
      setDeletingId(null);
      alert(`Delete failed: ${e?.message || e}`);
      return;
    }
    // Animate out then remove from list
    setTimeout(() => {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setRevealId(null);
      setDeletingId(null);
    }, 320);
  }

  return (
    <div className="card-grid">
      {posts.map((p) => (
        <div
          key={p.id}
          className={`card card--bold ${deletingId === p.id ? 'deleting' : ''}`}
          style={{ position: 'relative', overflow: 'hidden' }}
          onPointerDown={(e) => onPointerDown(p.id, e.clientX)}
          onPointerMove={(e) => onPointerMove(e.clientX)}
          onPointerUp={onPointerUp}
          onTouchStart={(e) => onPointerDown(p.id, e.touches[0].clientX)}
          onTouchMove={(e) => onPointerMove(e.touches[0].clientX)}
          onTouchEnd={onPointerUp}
        >
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>
                <Link href={`/blog/${p.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{p.title}</Link>
              </h3>
              {p.source_type === 'external' && p.source_url ? (
                <span className="pill">↗ external</span>
              ) : null}
            </div>
            {p.summary ? (
              <p style={{ margin: '8px 0 0 0', color: 'var(--muted)' }}>{p.summary}</p>
            ) : null}
          </div>

          {revealId === p.id && deletingId !== p.id ? (
            <div style={{ position: 'absolute', inset: '0 0 0 auto', width: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', borderLeft: '2px solid var(--outline)' }}>
              <button className="btn" onClick={() => handleDelete(p.id)} style={{ background: '#fecaca' }}>🗑 Delete</button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
