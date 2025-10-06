Project: AI-Powered Blog Platform (Scaffold)

Overview
- Full-stack scaffold for a minimal, effective blog platform.
- Features: uploads and parsing (Docling), LLM refinement via Groq with Ollama fallback, Redis caching (24h TTL, LFU), Postgres persistence, Excalidraw for diagrams, external blog linking, simple editor with append/overwrite.

Stack
- Backend: FastAPI, SQLAlchemy, Alembic, Redis, Docling, Requests.
- Frontend: Next.js (App Router), React, Excalidraw component.
- Infra: Docker Compose (Postgres, Redis, Ollama, Server, Client).

Quick Start
1) Copy `.env.example` to `.env` at repo root and set values. Do NOT commit secrets.
2) Run `docker compose up --build` to start db, redis, ollama, server, and client.
3) Visit client at http://localhost:3000 and API docs at http://localhost:8000/docs.

Notes
- Groq is preferred with model `GROQ_MODEL` (e.g., gpt-oss-120b). Fallback to Ollama (`OLLAMA_MODEL`, default gpt-oss-20b).
- Redis cache TTL ~24 hours for blogs; eviction policy `allkeys-lfu` is configured.
- Uploaded files are stored under `server/storage/` and served via `/static`.
- Docling is used for parsing; if unavailable, a robust basic parser is used.

Development
- Backend dev: `cd server && uvicorn app.main:app --reload`
- Frontend dev: `cd client && npm i && npm run dev`
- Migrations: `cd server && alembic upgrade head`

Security
- Keep `.env` and credentials secret.
- Set proper CORS origins via `BACKEND_CORS_ORIGINS` in `.env`.

Frontend Pages
- Editor/Upload: `client/app/page.tsx`
- Blog list (SSR): `client/app/blog/page.tsx`
- Blog post (SSR): `client/app/blog/[slug]/page.tsx`
