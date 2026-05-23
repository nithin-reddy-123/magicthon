# Magicthon — Meme Tool

A modern AI-powered meme creation tool. Built for the Magicthon hackathon. Drop a photo → 6 or 9 photo-specific captions from Claude → edit live in a Konva canvas → ship a shareable link → watch reactions roll in over Server-Sent Events.

**Live**: deploy your own — the link you publish from Render becomes your submission.

## Stack at a glance

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | React 18 · Vite · TypeScript · react-konva · react-router | Render Static Site |
| Backend | Java 21 · Spring Boot 3.3 · JPA/Hibernate · RestClient | Render Web Service (Docker) |
| Database | Postgres 16 | Neon (serverless) |
| AI | Anthropic Claude — Opus 4.7 → Sonnet 4.6 → Haiku 4.5 fallback chain (vision) | Anthropic API |
| Real-time | Server-Sent Events (Spring SseEmitter) | n/a |
| Animation | CSS keyframes + `cubic-bezier(0.16,1,0.3,1)` | n/a |

---

## Architecture

### High-level topology

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER                                                     │
│  ┌─────────────────────┐    ┌──────────────────────┐         │
│  │  HomePage           │    │  SharePage           │         │
│  │  stage =            │    │  /m/:slug            │         │
│  │    upload →         │    │  meme + reactions    │         │
│  │    ideas  →         │    │  SSE live updates    │         │
│  │    editor →         │    │                      │         │
│  │    shared           │    │                      │         │
│  │  (Konva canvas)     │    │                      │         │
│  └─────────┬───────────┘    └────────┬─────────────┘         │
└────────────┼─────────────────────────┼───────────────────────┘
             │ HTTPS                   │ SSE (EventSource)
             ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│  RENDER WEB SERVICE — Spring Boot 3 / Java 21               │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │  /api/analyze│  /api/memes  │  /api/memes/.../stream   │ │
│  └──────┬───────┴──────┬───────┴────────────┬─────────────┘ │
│         │              │                    ▲               │
│         ▼              ▼                    │               │
│  ┌──────────────┐ ┌──────────────┐  ┌──────────────────┐   │
│  │ ClaudeVision │ │ MemeService  │  │ ReactionStream   │   │
│  │ Service      │ │ (persistence)│  │ (SseEmitter map) │   │
│  │ (fallback ↓) │ │              │  │                  │   │
│  └──────┬───────┘ └──────┬───────┘  └──────────────────┘   │
└─────────┼────────────────┼─────────────────────────────────┘
          │                │
          ▼                ▼
   Anthropic API      Postgres (Neon)
   ┌────────────┐     ┌──────────┐
   │ Opus 4.7   │     │  memes   │
   │   ↓ fail   │     │  reactions
   │ Sonnet 4.6 │     └──────────┘
   │   ↓ fail   │
   │ Haiku 4.5  │
   └────────────┘
```

### Request flow — full product loop

The brief asks for six steps. Each is implemented across a specific set of files:

| # | User action | Frontend | Backend | DB/External |
|---|---|---|---|---|
| 1 | Drop/paste/snap photo | `ImageInput.tsx` reads `File`, fires `onPicked(file, dataUrl)` | — | — |
| 2 | AI generates captions | `HomePage.handlePicked` → `api.ts: analyzeImage(file, count)` (count is 9 on desktop, 6 on mobile via `useIdeaCount()`) | `AnalyzeController` → `ClaudeVisionService.generateMemeIdeas` iterates models, returns first non-empty result | Anthropic Messages API with vision content block (base64) |
| 3 | Show 6/9 previews | `IdeaGrid.tsx` renders format-aware overlay (Impact/band/chat bubble/etc) on the user's image | — | — |
| 4 | Edit in canvas | `MemeCanvas.tsx` — Konva Stage at logical 720px scaled to container via `ResizeObserver`; click to select, click-again to edit inline | — | — |
| 5 | Export + ship link | `stage.toDataURL({pixelRatio:2})` → `saveMeme(b64, caption)` | `MemeController.save` → `MemeService.save` decodes base64, generates slug | `INSERT INTO memes` |
| 6 | Anyone reacts live | `SharePage.tsx` opens `EventSource(.../reactions/stream)`, key on `<span>` triggers count-pop animation on update | `MemeController` POST reaction → `MemeService.react` saves + `ReactionStream.publish(slug, totals)` | `INSERT INTO reactions`; group-by count query |

### Frontend — finite state machine

```
                  Click idea card
   ┌──────────┐      ┌────────────┐      ┌──────────┐      ┌─────────┐
   │  upload  │─────▶│   ideas    │─────▶│  editor  │─────▶│ shared  │
   └──────────┘      └────────────┘      └──────────┘      └─────────┘
        ▲                  ▲                 │                   │
        │                  └─────────────────┤                   │
        │                  back: "pick another format"           │
        └────────────────────────────────────────────────────────┘
                  back: "different photo" / "make another"
```

Each stage renders inside `<div key={stage} className="stage-enter">`. The keyed wrapper forces React to unmount/mount on stage change, triggering CSS entrance animations.

**Files**: `frontend/src/pages/HomePage.tsx` (state machine), `frontend/src/pages/SharePage.tsx` (separate route).

### Canvas editor

Konva Stage runs at a **logical resolution** (`logicalWidth=720` × derived `logicalHeight` from photo aspect ratio). Display width is measured via `ResizeObserver` on `.canvas-wrap`, and `scaleX/Y` are applied to the Stage so it fits any container without losing coordinate precision.

```
imageDims (logical 720 × Y)
                │
                ▼
         scale = displayWidth / 720
                │
                ▼
   <Stage width=displayWidth scaleX=scale scaleY=scale>
       <Layer>
           <Image width=logicalWidth height=logicalHeight />
       </Layer>
       <Layer>
           <Text x y width fontSize stroke strokeWidth shadow* />  ← layers in logical coords
           <Transformer />                                          ← scale handles
       </Layer>
   </Stage>
```

**Export at HD**: before calling `stage.toDataURL({pixelRatio:2})`, temporarily reset `scaleX/Y=1` and size to logical — the output is 1440×Y regardless of display size. After export, restore the display state.

**Inline text editing**: click selects (Transformer attaches). Click-again-on-selected (or double-click) → an absolute-positioned `<textarea>` is appended to `document.body` at the screen-space coordinates of the Konva node, sized via `scale`, styled to match. Enter saves, Escape cancels.

**Format-aware initial layers**: When the user picks an idea, `initialLayers(idea, w, h)` in `HomePage.tsx` builds the right Konva text layers per format — `topbottom` → two Impact ALL-CAPS layers; `caption`/`deadpan`/`fact` → one bottom soft layer; `pov`/`telltale`/`screenshot` → one top soft layer; `rating` → two stacked top layers; `thoughts` → two soft layers top + bottom.

### AI integration

**Multi-model fallback chain** is the heart of the resilience strategy. `ClaudeVisionService` reads a CSV from `ANTHROPIC_MODELS` (default: `claude-opus-4-7,claude-sonnet-4-6,claude-haiku-4-5-20251001`), builds the request payload **once**, and tries each model in order. Any failure (rate-limit 429, payment-required 402, model-not-available 403, transient 5xx, timeout, or even an empty parse result) is logged and falls through to the next model. The first model returning a non-empty `ideas[]` wins. If all fail, an `IllegalStateException` propagates and the frontend surfaces the error.

**Prompt engineering** lives in `ClaudeVisionService` and is purpose-built for the brief's "Soul: does it make us laugh" judging criterion. Key design choices:

- **4-step structured process** inside the prompt: observe → brainstorm raw → pick + assign → audit. The model writes everything before the JSON inside a `<scratchpad>` block which the parser then strips.
- **Brainstorm-then-curate**: the model is asked for `n*2` raw ideas first (no rules, just funny), then picks the best `n` and assigns formats. Real comedy writing is volume → curation.
- **Comedy mechanics named explicitly**: incongruity, exaggeration, pivot, oversharing, hyper-specificity, deadpan-roast — each with mini-examples in the prompt.
- **`✗ commentary` vs `✓ joke` contrasts per format** — directly attacks the most common failure mode (the model describing the photo instead of joking about it).
- **Banned-phrase list** of clichéd template starters ("when you ___ but ___", "tag a friend", etc.).
- **Specificity test** applied twice — once during writing, once at the audit step.
- **Format-aware**: 6 base formats (`pov`, `caption`, `telltale`, `deadpan`, `thoughts`, `topbottom`) always present; 3 bonus formats (`screenshot`, `rating`, `fact`) appended when `count >= 9`.
- **Dynamic prompt assembly**: counts are injected via `String.formatted("%d")` placeholders. **Gotcha**: any literal `%` in the prompt must be escaped as `%%` or it'll throw `IllegalFormatException` at runtime.

The parser is lenient — it finds the first `{` and last `}` in the model output, parses what's between as JSON, returns an empty list on parse failure (which the fallback loop then treats as a failed model attempt).

### Data model

```sql
CREATE TABLE memes (
  id           BIGSERIAL PRIMARY KEY,
  slug         VARCHAR(16) NOT NULL UNIQUE,    -- 6-char alphanumeric, gen by SlugService
  caption      VARCHAR(500),                   -- one-line joke summary for UI
  image_bytes  BYTEA NOT NULL,                 -- final rendered PNG bytes
  content_type VARCHAR(64),                    -- image/png usually
  created_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_memes_slug ON memes (slug);

CREATE TABLE reactions (
  id         BIGSERIAL PRIMARY KEY,
  meme_slug  VARCHAR(16) NOT NULL,             -- denormalized (no FK to keep writes cheap)
  kind       VARCHAR(32) NOT NULL,             -- laugh, dead, fire, mid, love
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_reactions_slug ON reactions (meme_slug);
```

Hibernate `ddl-auto: update` manages the schema. Counts are computed on demand:

```sql
SELECT kind, COUNT(*) FROM reactions WHERE meme_slug = ? GROUP BY kind;
```

No separate counter table — keeps everything consistent and simplifies the SSE publish step.

### Real-time reactions

```
Client A POST /reactions
     │
     ▼
MemeService.react(slug, kind)
     │
     ├─▶ INSERT INTO reactions
     ├─▶ SELECT kind, COUNT(*) GROUP BY kind  ← fresh totals
     │
     └─▶ ReactionStream.publish(slug, totals)
              │
              ▼
        emittersBySlug.get(slug)
              │
              └──▶ for each emitter: emitter.send(SseEmitter.event().name("reaction").data(totals))
                          │
                          ▼
                   Client B (EventSource) listener:
                     setCounts(r.counts); setTotal(r.total)
                          │
                          ▼
                   <span key={`${kind}-${count}`}> remount → count-pop CSS animation
```

`ReactionStream` keeps a `ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>>`. Subscribe registers an emitter against the slug; on `onCompletion`/`onTimeout`/`onError` it removes itself. Publish iterates the slug's list and sends; on `IOException` the emitter is completed (lazy cleanup).

### Motion / animation system

- **Single easing curve everywhere**: `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` — the shoots-in-then-settles feel popularized by Linear.
- **3 reveal keyframes** + 1 swap keyframe:
  - `reveal` — translateY(22px → 0) + opacity 0 → 1, 0.85–1.05s
  - `reveal-soft` — smaller translateY, faster
  - `scale-in` — 0.96 → 1 + opacity, used for the canvas and meme frame
  - `dropzone-swap` — opacity + translateY + `blur(4px → 0)` for the upload → analyzing morph
- **Stagger via CSS `nth-child`** — no JS orchestration. Hero stages over ~1.5s; idea grid cards cascade with 100ms gaps.
- **Stage transitions** by re-mount: `<div key={stage}>` forces React to discard old DOM, mount new with the entrance animation re-firing.
- **`prefers-reduced-motion: reduce`** collapses every animation to 0.01ms, pauses the marquee, freezes the floating blobs — vestibular safety.

### Deployment topology

```
GitHub repo (monorepo, two roots)
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── public/_redirects        ← SPA fallback (also configurable via Render dashboard)
│   └── src/
│       ├── pages/               HomePage, SharePage
│       ├── components/          ImageInput, IdeaGrid, MemeCanvas, BgBlobs
│       ├── lib/api.ts           fetch wrappers for backend
│       └── styles.css           all CSS (single file, ~1k lines)
│
└── backend/
    ├── pom.xml                  Spring Boot 3.3.4
    ├── Dockerfile               multi-stage: maven:3.9.9 → temurin-21-jre
    ├── render.yaml              service declaration
    └── src/main/
        ├── resources/
        │   └── application.yml
        └── java/com/magicthon/
            ├── MagicthonApplication.java
            ├── config/          WebConfig (CORS), DataSourceConfig (Neon URL parser)
            ├── entity/          Meme, Reaction (JPA)
            ├── repository/      MemeRepository, ReactionRepository (Spring Data)
            ├── service/         ClaudeVisionService, MemeService, ReactionStream, SlugService
            ├── controller/      AnalyzeController, MemeController, HealthController, ErrorAdvice
            └── dto/             request/response records
```

**Hosting plan:**
- Frontend → Render Static Site (root `frontend/`, build `npm install && npm run build`, publish `dist`)
- Backend → Render Web Service (root `backend/`, Docker, Dockerfile auto-detected, health check `/api/health`)
- DB → Neon serverless Postgres (project-level credential, exposed to Render as `DATABASE_URL`)
- SPA rewrite for `/m/:slug` configured on Render dashboard (Redirects/Rewrites tab) — file-based `_redirects` is a fallback

**Why both halves on Render** rather than Vercel for the frontend: single dashboard, single auto-deploy webhook, slightly simpler CORS reasoning. The frontend CDN difference vs Vercel is negligible (~10–50ms TTFB).

**Free-tier gotcha**: Render's free Web Service sleeps after 15 min idle and cold-starts in ~30–50s. Mitigation: hit `/api/health` a minute before demo, or upgrade to Starter ($7/mo, no sleep).

### Environment variables

#### Backend (Render Web Service)
| Name | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Your Claude API key |
| `ANTHROPIC_MODELS` | no | CSV fallback chain. Default: `claude-opus-4-7,claude-sonnet-4-6,claude-haiku-4-5-20251001` |
| `DATABASE_URL` | yes | Neon connection string in `postgresql://user:pass@host/db?sslmode=require` form. `DataSourceConfig` parses it. |
| `CORS_ORIGIN` | yes | Frontend origin (e.g. `https://<your-site>.onrender.com`). No trailing slash. |
| `PUBLIC_BASE_URL` | yes | Same as CORS_ORIGIN — used in the share URL returned by the API. |
| `PORT` | auto | Set by Render. |

#### Frontend (Render Static Site, baked at build time)
| Name | Required | Notes |
|---|---|---|
| `VITE_API_URL` | yes | Full backend URL, no trailing slash. Vite inlines this into the JS bundle. |

---

## Local dev

### 1. Postgres (Neon)
1. Sign up at https://neon.tech, create a project, copy the connection string.
2. Export: `export DATABASE_URL='postgresql://user:pass@host/db?sslmode=require'`

### 2. Backend
```bash
cd backend
export ANTHROPIC_API_KEY=sk-ant-...
export DATABASE_URL=postgresql://...
export CORS_ORIGIN=http://localhost:5173
mvn spring-boot:run
```
Backend boots on `http://localhost:8080`. Health: `GET /api/health` returns `{"status":"ok"}`.

To override the model chain locally:
```bash
export ANTHROPIC_MODELS=claude-sonnet-4-6,claude-haiku-4-5-20251001
```

### 3. Frontend
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8080" > .env.local
npm run dev
```
Open http://localhost:5173.

---

## Deploy

### Backend → Render Web Service
1. Push the repo to GitHub.
2. Render → **New +** → **Web Service** → connect your repo.
3. **Root Directory**: `backend`. **Language**: Docker (auto-detected).
4. **Environment Variables**: set all five backend env vars from the table above. Use placeholders for `CORS_ORIGIN` and `PUBLIC_BASE_URL` if frontend isn't deployed yet.
5. **Create Web Service**. First build takes ~4–6 min (Maven pulls Spring deps).
6. Note the URL (e.g. `https://memer-r1l0.onrender.com`).

### Frontend → Render Static Site
1. Render → **New +** → **Static Site** → same repo.
2. **Root Directory**: `frontend`. **Build Command**: `npm install && npm run build`. **Publish Directory**: `dist`.
3. **Environment Variable**: `VITE_API_URL=<backend-url>`.
4. Add a Rewrite rule via the **Redirects/Rewrites** tab: source `/*` → destination `/index.html` → action **Rewrite**. (The `_redirects` file is a fallback but the dashboard rule is more reliable.)
5. **Create Static Site**. Build takes ~30–45s.

### Stitch
6. Backend service → **Environment** → update `CORS_ORIGIN` and `PUBLIC_BASE_URL` to the static site URL. Backend auto-restarts.
7. Smoke-test the live flow. Submit the static-site URL as your Magicthon prototype link.

---

## Feature checklist (against the brief)

- [x] Photo input: drag, paste, webcam
- [x] Vision LLM generates 6 (mobile) or 9 (desktop) ideas — each in a distinct format
- [x] Six live previews on the user's real photo, format-aware (Impact, chat bubble, lime band, etc.)
- [x] Canvas editor: draggable text, outline, shadow, line wrap, font swap, color swap, template swap
- [x] Inline text editing directly on the canvas (no panel textarea)
- [x] Export PNG + shareable link (no signup)
- [x] Live reactions via SSE, count pulses on every update
- [x] Mobile responsive — fluid canvas via Konva scaling, 2-column grid on small screens
- [x] Choreographed animations across the entire app
- [x] `prefers-reduced-motion` honored
- [x] Multi-model fallback (Opus → Sonnet → Haiku) for resilience

## Future work

- Replace polling-style group-by reaction counts with a counter table + atomic increment if reactions volume grows
- Move image storage out of Postgres bytea into object storage (S3/R2) if memes grow large
- Add OG image generation so shared links unfurl nicely in chat apps
- Per-user history (currently no auth, by design — "no signup" is part of the brief)
- WebSocket fallback if SSE proxy issues arise on free-tier Render
