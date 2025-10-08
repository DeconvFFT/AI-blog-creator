/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

async function main() {
  const puppeteer = require('puppeteer');
  const args = process.argv.slice(2);
  const idx = args.indexOf('--slug');
  const singleSlug = idx >= 0 ? args[idx + 1] : null;

  const apiBase = process.env.SERVER_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const siteBase = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

  // Fetch posts
  const postsRes = await fetch(`${apiBase.replace(/\/$/, '')}/api/posts`);
  if (!postsRes.ok) throw new Error(`Failed to list posts: ${postsRes.status}`);
  let posts = await postsRes.json();
  if (singleSlug) posts = posts.filter(p => p.slug === singleSlug);

  // Ensure public/blog exists
  const outDir = path.join(process.cwd(), 'public', 'blog');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  await page.emulateMediaType('screen');

  for (const p of posts) {
    const url = `${siteBase.replace(/\/$/, '')}/blog/${encodeURIComponent(p.slug)}`;
    const out = path.join(outDir, `${p.slug}.pdf`);
    console.log(`Generating PDF for ${p.slug} -> ${out}`);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    // ensure images loaded
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })));
    });
    // compute full page height for exact visual match (single tall page)
    const fullHeight = await page.evaluate(() => {
      const b = document.body;
      const e = document.documentElement;
      return Math.max(b.scrollHeight, e.scrollHeight, b.offsetHeight, e.offsetHeight, b.clientHeight, e.clientHeight);
    });
    // remove print margins to avoid layout shifts
    await page.addStyleTag({ content: '@page { size: auto; margin: 0; } html, body { margin: 0 !important; }' });
    const pdf = await page.pdf({
      printBackground: true,
      width: '1200px',
      height: `${fullHeight}px`,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });
    fs.writeFileSync(out, pdf);
  }

  await browser.close();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });


