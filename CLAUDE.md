# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this project is

**GymBro** — a college final project (Colman). An AI-powered web fitness assistant that:
1. Generates personalized workout plans from a fitness questionnaire (RAG + LLM).
2. Analyzes uploaded exercise videos with **pose estimation** and returns form feedback + a quality score.
3. Tracks workouts, progress, and basic social sharing.

This is academic coursework, not production. Favor clarity and the design described in `docs/` over speculative hardening.

## The `docs/` folder is the source of truth — read it before non-trivial work

The `docs/` folder contains the agreed design. **Always consult the relevant file before adding features, changing schemas, or refactoring shared code.** If you change behavior that contradicts a doc, either update the doc in the same change or call it out explicitly to the user.

| File | When to read it |
|---|---|
| `docs/PLAN.md` | Before any backend feature work. Contains executive scope, tech decisions, full project structure, **domain model**, **database schema + indexes**, **REST API contract**, testing targets, and phased deliverables. This is the canonical spec. |
| `docs/Architecture.md` | Before touching cross-cutting concerns (auth flow, request pipeline, AI flows, embedded-document session logging, progress aggregation). Contains flow diagrams for: auth, video pose analysis, plan generation, session logging, progress queries, social feed. |
| `docs/design.md` | Before any frontend/UI change. Contains the **color palette (hex tokens)**, **typography scale**, navigation structure, and per-screen feature descriptions. |
| `docs/screens.md` | Before building or modifying a page. Per-screen layout breakdown with the matching mockup PNG and the screen → component → route mapping table at the bottom. |
| `docs/mockups/*.png` | Visual reference for each screen. Use the Read tool to view them when implementing UI. |

**Rule of thumb:** if a task touches a domain model, an endpoint, or a screen, open the corresponding doc first. Do not invent new endpoints, fields, or routes when the spec already names one.

## Reality vs. docs — known divergences

The codebase is mid-implementation and diverges from `PLAN.md` in places. Trust the code for what *exists*; trust the docs for the intended *target*. When in doubt, ask before "fixing" a divergence.

- **LLM provider**: PLAN.md says OpenAI GPT-4o. Code uses **Groq** (see `backend/src/services/workoutPlan/GroqAiService.ts`, `.env.example` → `GROQ_API_KEY`, `GROQ_MODEL`). A Gemini adapter also exists but Groq is wired in.
- **Pose estimation**: PLAN.md says in-process TF.js + MoveNet + ffmpeg. Code calls an **external HTTP service** via `VideoAnalysisApiAdapter` (`VIDEO_ANALYSIS_SERVICE_URL` in `.env.example`), with a `VideoAnalysisStubAdapter` fallback. No TF.js or ffmpeg dependency is installed.
- **Backend folder layout**: PLAN.md describes `src/modules/<domain>/`. Actual layout is flatter: `src/controllers/`, `src/routers/`, `src/services/`, `src/models/`, `src/middleware/`. Follow the existing layout when adding files.
- **WorkoutPlan schema**: PLAN.md prescribes `weeks[].sessions[].exercises[]`. The Groq prompt produces (and we persist) `weeklyPlan[].exercises[]` — a single week, no `sessions` layer. Will be widened when `WorkoutSession` is introduced; existing rows will need a migration script.
- **Auth transport**: PLAN.md says `Authorization: Bearer <token>`. Code uses an httpOnly `accessToken` cookie (`middleware/auth.ts`) and the Axios client sends `withCredentials: true`. Refresh flow lives at `POST /api/auth/refresh`.
- **Implemented surface so far**: auth, users, video analyze, workout-plan generate + persist (`/api/plans/*`). Sessions, set logging, progress, and social endpoints from PLAN.md are **not yet built**.

## Tech stack (actual)

- **Frontend**: React 18 + TypeScript + Vite, React Router v6, Axios, `@react-oauth/google`, `lucide-react`. Styling per the palette in `docs/design.md` (no Tailwind installed yet despite the plan).
- **Backend**: Express 4 + TypeScript, Mongoose 8, JWT (`jsonwebtoken`) + bcryptjs, `cookie-parser`, `multer`, `google-auth-library`.
- **AI**: Groq SDK calls for plan generation; HTTP call to external pose-estimation service for video analysis.
- **DB**: MongoDB via Mongoose. Connection string in `MONGODB_URI`.
- **Tests**: Jest + ts-jest. Coverage target ≥ 80% on `services/`, `controllers/`, `middleware/`.

## Commands

```bash
# Backend (from backend/)
npm install
npm run dev          # ts-node src/server.ts — runs on PORT (default 3001)
npm run build        # tsc → dist/
npm start            # node dist/server.js
npm test             # jest
npm run test:coverage

# Frontend (from frontend/)
npm install
npm run dev          # vite — http://localhost:5173
npm run build        # tsc && vite build
npm run lint
```

Both apps read `.env` at the repo root (or per-package — see `.env.example`). Required: `GROQ_API_KEY`, `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `FRONTEND_URL`, `VIDEO_ANALYSIS_SERVICE_URL`.

## Conventions

- **Naming**: `camelCase` for vars/functions, `PascalCase` for types and Mongoose models, `kebab-case` for filenames *except* existing patterns like `WorkoutPlanService.ts` — match the surrounding file.
- **Architecture pattern**: Page → `src/api/*.api.ts` (Axios) → Express router → controller → service → Mongoose model. Pages must not call Axios directly; services must not import Mongoose primitives outside `src/models/`.
- **Validation**: manual at the top of each controller — no Zod/Joi (per PLAN.md §7).
- **Errors**: services throw plain `Error`; controllers map to HTTP codes; `middleware/errorHandler.ts` is the global net. Error response shape: `{ error, message }`.
- **Auth**: JWT in `Authorization: Bearer <token>`. `middleware/auth.ts` attaches `req.user`. Never log tokens or passwords.

## When implementing a new screen

1. Read the matching section in `docs/screens.md` and view the mockup PNG.
2. Cross-check `docs/design.md` for colors, typography, and feature behaviors.
3. Use the screen → component → route table in `docs/screens.md` for the file and path.
4. Wire it through `App.tsx` behind `ProtectedRoute` + `Layout` if it's an authenticated page.

## When implementing a new endpoint

1. Find the endpoint in `docs/PLAN.md` §7 "API Design" — the URL, method, and payload shape are already specified.
2. Check `docs/Architecture.md` for the relevant flow diagram (auth, plan-gen, pose analysis, session logging, progress, feed).
3. Follow the existing `routers/ → controllers/ → services/ → models/` chain. Don't introduce a `modules/` folder.
4. Add a unit test in `backend/tests/` for any new service function (PLAN.md §9 lists what each service should cover).

## Do not

- Don't add infra the spec doesn't ask for (Redis, Docker beyond the planned MongoDB, message queues, a Tailwind setup if not present, etc.).
- Don't swap the LLM provider or pose-estimation approach without asking — both are intentional divergences from PLAN.md.
- Don't create new top-level docs. If something belongs in the design record, edit the existing file in `docs/`.
