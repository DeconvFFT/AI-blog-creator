export const metadata = {
  title: "AI Blog Platform",
  description: "Upload, parse, refine, and publish blogs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, Avenir, Arial', margin: 0 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px' }}>
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0 }}>AI Blog Platform</h1>
            <p style={{ color: '#666', marginTop: 4 }}>Minimal, fast, and effective.</p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

