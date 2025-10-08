export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug;
  const publicBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '');
  if (!publicBase) return new Response('API base not configured', { status: 500 });
  const location = `${publicBase.replace(/\/$/, '')}/api/posts/slug/${encodeURIComponent(slug)}/pdf`;
  return new Response(null, { status: 307, headers: { Location: location } });
}


