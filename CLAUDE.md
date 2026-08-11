# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OME Translate — an AI-based multilingual training-content localization platform. Admins upload Chinese training material; the server parses it into segments, triggers multi-language translation (zh → en → es/th/hi/vi via English pivot), and learners browse a side-by-side original/translation view and submit feedback.

Full-stack TypeScript monorepo: **React 19 + Vite 7 + wouter + Tailwind 4 + shadcn/ui** (client) · **Express 4 + tRPC 11 + Drizzle ORM + MySQL** (server).

The single most important thing to know: **the `documents` table is the de-facto "course" entity.** Courses in the UI, translation jobs, and learner feedback all orbit `documents`. Don't let the name mislead you.

## Commands

| Task | Command |
|------|---------|
| Server dev (port 3000, auto-increments if busy) | `pnpm dev` |
| Client dev (Vite, port 5173) | `pnpm dev:client` |
| Both together | `pnpm dev:all` |
| Build client + server bundle to `dist/` | `pnpm build` |
| Type check (whole repo) | `pnpm check` |
| Run all tests | `pnpm test` |
| Run a single test file | `pnpm test -- server/routers/__tests__/courses.create.test.ts` |
| Generate + run DB migrations | `pnpm db:push` (or `db:generate` / `db:migrate` separately) |
| Format | `pnpm format` |

Setup: `cp .env.example .env`, then fill in `DATABASE_URL` (MySQL), `JWT_SECRET` (≥ 32 chars), and the LLM provider. See `.env.example` for the full list. LLM is OpenAI-compatible by default (`OPENAI_API_KEY`); `LLM_PROVIDER`/`LLM_MODEL` switch between `openai | anthropic | deepseek`, with optional per-task overrides (`LLM_TRANSLATE_*`, `LLM_EXPLAIN_*`).

Tests are **server-only** (Vitest globs `server/**/*.test.ts`) and mock the `db` layer via `vi.hoisted` — no live MySQL needed. Test env auto-fills a local `mysql://test@...` URL and a dummy JWT secret in `server/_core/env.ts`.

Path aliases: `@/*` → `client/src/*`, `@shared/*` → `shared/*`. `server/` code imports `@shared/*` too.

## Architecture

```
client/src   React SPA — routes in App.tsx (wouter); tRPC client in lib/trpc.ts
server/_core Infrastructure: startup (index.ts), env.ts (zod-validated), tRPC
               (trpc.ts), auth (context/authz/dashboardAuth/authTypes), LLM
               providers (llm/), OAuth, storage, image generation
server/routers  tRPC business routers; all composed in server/routers.ts (appRouter)
server/db.ts    The single Drizzle/MySQL data-access layer (~700 lines, "god repository")
server/services  Consolidated ingestion/translation orchestrators (the refactor target)
server/documentParser.ts  Local parsing (PDF/DOCX/XLSX/PPTX/VSDX/XMind/OCR) with MinerU fallback
server/documentIr.ts      Conversion between persisted `segments` and runtime IR blocks
server/translationEngine.ts  Two-stage translation (zh→en→target) + AI explain
server/previewHtml.ts     Side-by-side translation preview HTML generation
server/storage.ts         Local-filesystem (dev) vs S3-compatible (prod) storage abstraction
shared/        Types, constants, and helpers shared between client and server
drizzle/       Schema + migrations (drizzle-orm)
```

Core data entities (`drizzle/schema.ts`): `documents` (the course), `translation_jobs` (one per document per target language; JSON `translatedSegments` + preview `outputS3Url`), `glossary_entries` (zh term → en → es/th/hi/vi, injected into translation prompts), `feedbacks`, `user_progress`, `exercises`/`exercise_attempts`. `users` and `admin_accounts` are separate identity tables.

**Upload → translation flow** (see `docs/architecture/current-state-baseline.md`):
1. `storagePut` persists the original file
2. `parseDocument` extracts content → normalized into `segments` (JSON)
3. create a `document` + one `translation_job` per target language
4. `triggerTranslation` runs **in-process** (async but not queued — a server restart interrupts in-flight work; there is no durable job queue)
5. translate via `translateBlocks` → write `translatedSegments` → render + store preview HTML → mark job/document completed/failed

`segments` (DB JSON) and DocumentIR `blocks` (runtime format with image/heading/paragraph types) are different representations; `documentIr.ts` converts between them.

## Critical: three identity models (do not conflate)

- **OAuth main-site user** — resolved into `ctx.user`; exposed as `auth.me`; learner + older admin flows (`client/src/_core/hooks/useAuth.ts`).
- **Local JWT user** — `Authorization: Bearer` token (`authLocal.ts`); also resolves into `ctx.user`.
- **Dashboard session admin** — separate `dashboard_session` cookie; resolves into `ctx.dashboardSession` (NOT `ctx.user`); exposed as `dashboard.me`; powers the newer `/dashboard/*` UI.

Current boundaries are intentional (per `docs/architecture/current-state-baseline.md` §5):
- `auth.me` returns `ctx.user`; a dashboard session does NOT become a learner user, and vice-versa.
- `documents.*` admin routes require `ctx.user.role === "admin"`; `courses.*` uses `dashboardProcedure`; `glossary.*` is a mixed-auth path accepting either. Authorization helpers live in `server/_core/authz.ts` (`resolvePrincipal` returns a discriminated `AuthPrincipal` union).

## Gotchas (surfaced by handover docs, verified in code)

- **Upload/translation logic is duplicated** in `server/routers/documents.ts` and `server/routers/courses.ts`. Change both, or use the consolidated `server/services/` layer (`courseIngestionService.ts`, `translationOrchestrator.ts`, `documentWorkflowService.ts`). Characterization tests live in `server/routers/__tests__/`.
- **Legacy `/admin/*` pages still exist** in the client but most routes redirect to `/dashboard/*` (`client/src/App.tsx`). Don't assume they're dead; check before deleting.
- `server/uploads/` and `dist/` contain runtime artifacts (uploaded files, preview HTML) — exclude from packaging/migration.
- The server auto-picks a free port starting at 3000 if busy; health check is `GET /api/health`.
- `server/_core/llm.ts` and `server/_core/llm/` both exist; the LLM provider abstraction is in `llm/provider.ts`, `openai.ts`, `anthropic.ts`.

Deep-dive docs already in-repo: `docs/handover-architecture.md` (business flows, tech-debt analysis, refactor priorities) and `docs/architecture/current-state-baseline.md` (current operational source of truth). Read these before refactoring auth, ingestion, or translation.
