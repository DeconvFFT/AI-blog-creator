import React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ShareBar from "../../../components/ShareBar";
import type { Metadata } from "next";

// Split bases: SSR fetch base vs. public absolute base used in rendered HTML
const SSR_API_BASE = (process.env.NODE_ENV === 'development')
  ? (process.env.SERVER_API_BASE_URL || "http://server:8000")
  : (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.SERVER_API_BASE_URL || "");

const PUBLIC_API_BASE = (process.env.NODE_ENV === 'development')
  ? (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000")
  : (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.SERVER_API_BASE_URL || "");
const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:3001" : "");

async function fetchPost(slug: string) {
  const res = await fetch(`${SSR_API_BASE}/api/posts/slug/${slug}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const post = await fetchPost(params.slug);
    const title = post.title || "Blog";
    const description = (post.summary || "").slice(0, 180) || "Read this post";
    const url = SITE_BASE ? `${SITE_BASE}/blog/${params.slug}` : undefined;
  const firstImg = Array.isArray(post.images) && post.images.length > 0 ? post.images[0].url : undefined;
  const ogImg = firstImg ? (firstImg.startsWith("http") ? firstImg : `${PUBLIC_API_BASE}${firstImg}`) : undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        images: ogImg ? [{ url: ogImg }] : undefined,
      },
      twitter: {
        card: ogImg ? "summary_large_image" : "summary",
        title,
        description,
        images: ogImg ? [ogImg] : undefined,
      },
    };
  } catch {
    return { title: "Blog" };
  }
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  let contentHtml: string | null = post.content_html || null;
  if (contentHtml) {
    // Rewrite legacy /static paths to Redis-backed endpoints, then absolutize to public API
    contentHtml = contentHtml
      .replace(/src\s*=\s*"\s*\/static\/images\/([^"\s>]+)/gi, (_m, fname) => `src="${PUBLIC_API_BASE}/static-redis/image:${fname}`)
      .replace(/src\s*=\s*"\s*\/static\/uploads\/([^"\s>]+)/gi, (_m, fname) => `src="${PUBLIC_API_BASE}/static-redis/upload:${fname}`)
      .replace(/src\s*=\s*"\s*\/static-redis\//gi, `src="${PUBLIC_API_BASE}/static-redis/`)
      .replace(/src\s*=\s*"\s*\/static/gi, `src="${PUBLIC_API_BASE}/static`);
  }
  const contentMd: string = post.content_text || '';
  const shareUrl = SITE_BASE ? `${SITE_BASE}/blog/${post.slug}` : '';
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
          <div style={{ margin: '6px 0 12px 0' }}>
            <ShareBar url={shareUrl} title={post.title} />
          </div>
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
            {post.images.map((img: any, i: number) => (
              <div key={i} className="sticker" style={{ padding: 8 }}>
                <img src={(img.url || '').startsWith('http') ? img.url : `${PUBLIC_API_BASE}${img.url}`} alt={img.alt || ''} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
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
