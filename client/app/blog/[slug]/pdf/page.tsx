import React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";

// Match env base logic from main blog page
const SSR_API_BASE = (process.env.NODE_ENV === 'development')
  ? (process.env.SERVER_API_BASE_URL || "http://server:8000")
  : (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.SERVER_API_BASE_URL || "");

const PUBLIC_API_BASE = (process.env.NODE_ENV === 'development')
  ? (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000")
  : (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.SERVER_API_BASE_URL || "");

async function fetchPost(slug: string) {
  const res = await fetch(`${SSR_API_BASE}/api/posts/slug/${slug}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const post = await fetchPost(params.slug);
    const title = (post && post.title) || "Blog";
    const description = (post?.summary || "").slice(0, 180) || "Read this post";
    return { title: `${title} — PDF view`, description };
  } catch {
    return { title: "Blog" };
  }
}

export default async function BlogPostPdf({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  if (post == null) {
    // Soft 404 for view
    return (
      <main>
        <div className="card card--bold"><div className="card-body">Not found</div></div>
        <div className="section"><Link href="/blog" className="btn">Back to Blog</Link></div>
      </main>
    );
  }
  let contentHtml: string | null = post.content_html || null;
  if (contentHtml) {
    contentHtml = contentHtml
      .replace(/src\s*=\s*"\s*\/static\/images\/([^"\s>]+)/gi, (_m, fname) => `src="${PUBLIC_API_BASE}/static-redis/image:${fname}`)
      .replace(/src\s*=\s*"\s*\/static\/uploads\/([^"\s>]+)/gi, (_m, fname) => `src="${PUBLIC_API_BASE}/static-redis/upload:${fname}`)
      .replace(/src\s*=\s*"\s*\/static-redis\//gi, `src="${PUBLIC_API_BASE}/static-redis/`)
      .replace(/src\s*=\s*"\s*\/static/gi, `src="${PUBLIC_API_BASE}/static`);
  }
  const contentMd: string = post.content_text || '';
  return (
    <main>
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
                    let src = props.src as string | undefined;
                    if (typeof src === 'string') {
                      if (src.startsWith('/static-redis/')) src = `${PUBLIC_API_BASE}${src}`;
                      else if (src.startsWith('/static')) src = `${PUBLIC_API_BASE}${src}`;
                    }
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
            {post.images.map((img: any, i: number) => {
              let src = String(img.url || '');
              if (!src.startsWith('http')) {
                if (src.startsWith('/static/images/')) {
                  const pathAfterPrefix = src.substring('/static/images/'.length);
                  src = `${PUBLIC_API_BASE}/static-redis/image:${pathAfterPrefix}`;
                } else if (src.startsWith('/static/uploads/')) {
                  const pathAfterPrefix = src.substring('/static/uploads/'.length);
                  src = `${PUBLIC_API_BASE}/static-redis/upload:${pathAfterPrefix}`;
                } else if (src.startsWith('/static-redis/')) {
                  src = `${PUBLIC_API_BASE}${src}`;
                } else {
                  src = `${PUBLIC_API_BASE}${src}`;
                }
              }
              return (
                <div key={i} className="sticker" style={{ padding: 8 }}>
                  <img
                    src={src}
                    alt={img.alt || ''}
                    style={{ width: '100%', height: 160, objectFit: 'cover' }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      <div className="section">
        <Link href={`/blog/${post.slug}`} className="btn">Back to Blog</Link>
      </div>
    </main>
  );
}


