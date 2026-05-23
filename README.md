# Magicthon — Meme Tool

Modern meme creation tool built for the Magicthon hackathon.

**Stack**
- Frontend: React + Vite + TypeScript + react-konva (Vercel)
- Backend: Java 21 + Spring Boot 3 (Render)
- DB: Postgres (Neon)
- Vision LLM: Claude (Anthropic API)
- Live reactions: Server-Sent Events

## Local dev

### 1. Postgres on Neon
1. Sign up at https://neon.tech, create a project, copy the connection string.
2. Export it: `export DATABASE_URL='postgresql://user:pass@host/db?sslmode=require'`

### 2. Backend
```bash
cd backend
export ANTHROPIC_API_KEY=sk-ant-...
export DATABASE_URL=postgresql://...
export CORS_ORIGIN=http://localhost:5173
./mvnw spring-boot:run
```
Backend runs on `http://localhost:8080`.

### 3. Frontend
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8080" > .env.local
npm run dev
```
Open http://localhost:5173.

## Deploy

### Backend on Render
1. Push this repo to GitHub.
2. On Render, **New > Web Service**, point at the repo, root directory `backend/`.
3. Render will detect the `Dockerfile`. Set env vars: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `CORS_ORIGIN=https://<your-vercel-domain>`.
4. Deploy. Note the URL, e.g. `https://magicthon-backend.onrender.com`.

### Frontend on Vercel
1. On Vercel, **Add New > Project**, import the repo, root directory `frontend/`.
2. Set env var: `VITE_API_URL=https://<your-render-url>`.
3. Deploy. Your live URL is the submission link.

## Feature checklist (from the brief)
- [x] Photo input: drag, paste, webcam
- [x] Vision LLM generates 6 meme ideas from the real photo
- [x] Six live previews on the user's photo
- [x] Canvas editor: draggable text, outline, shadow, line wrap, font swap, template swap
- [x] Export PNG + shareable link (no signup)
- [x] Live reactions via SSE
