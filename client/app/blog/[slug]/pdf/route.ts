export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug;
  // 1) Serve pre-generated static if present
  const url = new URL(`/blog/${encodeURIComponent(slug)}.pdf`, 'http://local');
  try {
    // try reading from public/ via Next static (using fetch to self)
    // NOTE: Next route handlers cannot read fs of public directly reliably in edge; use fetch
    const staticResp = await fetch(url.pathname);
    if (staticResp.ok && staticResp.headers.get('content-type')?.includes('pdf')) {
      const buf = await staticResp.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${slug}.pdf"`,
        },
      });
    }
  } catch {}

  // 2) Fallback to server endpoint
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '');
  if (!publicBase) return new Response('API base not configured', { status: 500 });
  const location = `${publicBase.replace(/\/$/, '')}/api/posts/slug/${encodeURIComponent(slug)}/pdf`;
  return new Response(null, { status: 307, headers: { Location: location } });
}


