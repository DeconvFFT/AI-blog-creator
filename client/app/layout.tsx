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
              <h1 className="title">AI Blog Platform</h1>
              <nav className="nav">
                <Link href="/">Editor</Link>
                <Link href="/blog">Blog</Link>
              </nav>
            </div>
            <p className="tagline">Minimal, fast, and pastel-themed.</p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
