import React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Use docker network name for SSR to reach FastAPI from the Node container
const API_BASE = process.env.SERVER_API_BASE_URL || "http://server:8000";

async function fetchPost(slug: string) {
  const res = await fetch(`${API_BASE}/api/posts/slug/${slug}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  let contentHtml: string | null = post.content_html || null;
  if (contentHtml) {
    contentHtml = contentHtml.replace(/src\s*=\s*"\s*\/static/gi, `src="${API_BASE}/static`);
  }
  const contentMd: string = post.content_text || '';
  return (
    <main>
      <div style={{ marginBottom: 12 }}>
        <Link href="/blog" className="btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18l-6-6 6-6" stroke="var(--outline)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Blog
        </Link>
      </div>
      <div className="card card--bold">
        <div className="card-body">
          <h1 style={{ marginTop: 0 }}>{post.title}</h1>
          {contentHtml ? (
            <article dangerouslySetInnerHTML={{ __html: contentHtml }} />
          ) : (
            <article className="md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({node, ...props}) => {
                    const src = typeof props.src === 'string' && props.src.startsWith('/static') ? `${API_BASE}${props.src}` : props.src;
                    return <img {...props} src={src} />
                  }
                }}
              >
                {contentMd}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>
      {post.images?.length ? (
        <section className="section">
          <h3>Images</h3>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {post.images.map((img: any, i: number) => (
              <div key={i} className="sticker" style={{ padding: 8 }}>
                <img src={(img.url || '').startsWith('http') ? img.url : `${API_BASE}${img.url}`} alt={img.alt || ''} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="section">
        <Link href="/blog" className="btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18l-6-6 6-6" stroke="var(--outline)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Blog
        </Link>
      </div>
    </main>
  );
}
