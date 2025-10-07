import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "AI Blog Platform",
  description: "Upload, parse, refine, and publish blogs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header" style={{ marginBottom: 24 }}>
            <div className="header-top">
              <h1 className="title">Blogly AI</h1>
              <nav className="nav">
                <Link href="/">Editor</Link>
                <Link href="/blog">Blog</Link>
              </nav>
            </div>
            <p className="tagline">Minimal, Fast AI blog editor.</p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
