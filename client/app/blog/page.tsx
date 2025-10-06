import Link from "next/link";
import BlogListClient from "../../components/BlogListClient";

// Use docker network name for SSR to reach FastAPI from the Node container
const API_BASE = process.env.SERVER_API_BASE_URL || "http://server:8000";

async function fetchPosts() {
  try {
    const res = await fetch(`${API_BASE}/api/posts`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function BlogIndex() {
  const posts = await fetchPosts();
  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Blog</h2>
      <BlogListClient initial={posts} />
    </main>
  );
}
