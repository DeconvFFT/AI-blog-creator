import React from "react";
import ReactMarkdown from "react-markdown";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function fetchPost(slug: string) {
  const res = await fetch(`${API_BASE}/api/posts/slug/${slug}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  const content = post.content_html || post.content_text || '';
  return (
    <main>
      <h1 style={{ marginTop: 0 }}>{post.title}</h1>
      {post.content_html ? (
        <article dangerouslySetInnerHTML={{ __html: post.content_html }} />
      ) : (
        <article>
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
      )}
      {post.images?.length ? (
        <section style={{ marginTop: 24 }}>
          <h3>Images</h3>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {post.images.map((img: any, i: number) => (
              <div key={i} style={{ border: '1px solid #eee', padding: 8 }}>
                <img src={img.url} alt={img.alt || ''} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

