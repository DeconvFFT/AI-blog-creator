import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function fetchPosts() {
  const res = await fetch(`${API_BASE}/api/posts`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

export default async function BlogIndex() {
  const posts = await fetchPosts();
  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Blog</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {posts.map((p: any) => (
          <li key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
            <Link href={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
              <strong>{p.title}</strong>
            </Link>
            {p.source_type === 'external' && p.source_url ? (
              <span style={{ marginLeft: 8 }}>
                <a href={p.source_url} target="_blank" rel="noreferrer">(external)</a>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

