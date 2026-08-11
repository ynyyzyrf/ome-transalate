# OME Translate Current State Baseline

## Purpose

This document is the short operational baseline for engineers working on the current OME Translate codebase before the technical-debt remediation work is complete.

It does not describe the target architecture. It describes the current source of truth.

## 1. Main Business Object

- The core entity is still `documents`.
- Even when the product surface says "course", the backend usually persists that concept through the `documents` table and related `translation_jobs`.
- Frontend learner pages, dashboard course management, translation output, and user feedback all orbit this same document-centered model.

## 2. Upload and Translation Entry Points

There are currently two primary backend entry points for course/document ingestion:

- [server/routers/documents.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/documents.ts)
- [server/routers/courses.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/courses.ts)

### `documents.upload`

Used by the older admin-style flow.

Current lifecycle:

1. Accept file payload as base64.
2. Detect file type.
3. Persist the original file through `storagePut`.
4. Parse content through `parseDocument`.
5. Normalize parsed content into `segments`.
6. Create a `document`.
7. Create one `translation_job` per requested target language.
8. Trigger translation in-process through the local `triggerTranslation()` helper.
9. Persist generated preview HTML and translation results.

### `courses.create`

Used by the dashboard flow.

Current lifecycle:

1. Accept either uploaded file content or plain text content.
2. If file-based, persist the original file through `storagePut` and parse it with `parseDocument`.
3. If text-based, synthesize `segments` directly from lines of text.
4. Create a `document`.
5. Create one `translation_job` per target language.
6. If no target languages are supplied, default to `en`, `es`, `th`, `hi`, `vi`.
7. Trigger translation in-process through the local `triggerTranslation()` helper.
8. Persist generated preview HTML and translation results.

## 3. Translation Execution Path

The current translation execution path is duplicated in both routers above.

Shared behavior today:

- Translation is not queued through a durable worker system.
- Translation runs asynchronously but still inside the API process.
- Each router owns its own `triggerTranslation()` implementation.
- Translation flow:
  - load source `document`
  - mark document as `processing`
  - iterate target languages
  - load `translation_job`
  - load glossary entries for the target language
  - call `translateBlocks`
  - generate preview HTML through `renderTranslationPreviewHtml`
  - persist preview through `storagePut`
  - mark each `translation_job` as `completed` or `failed`
  - mark the parent document as `completed` or `failed` once all jobs finish

### Important current limitation

- API process restart can interrupt in-flight translation work.
- Queue semantics such as durable retry, worker isolation, and observability are not first-class yet.

## 4. Authentication Models

There are three identity models in the current system.

### OAuth / Main-Site User

Files:

- [server/_core/context.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/context.ts)
- [server/_core/sdk.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/sdk.ts)
- [client/src/_core/hooks/useAuth.ts](/D:/aicoding/ome-translate/ome-transalate/client/src/_core/hooks/useAuth.ts)

Behavior:

- Resolved into `ctx.user`.
- Exposed to the client through `auth.me`.
- Used by learner flows and parts of the older admin flow.

### Local Bearer Token User

Files:

- [server/routers/authLocal.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/authLocal.ts)
- [server/_core/context.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/context.ts)

Behavior:

- Verified from the `Authorization: Bearer ...` header.
- Also resolves into `ctx.user`.
- Shares the same protected-procedure path as OAuth users once resolved.

### Dashboard Session Admin

Files:

- [server/_core/dashboardAuth.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/dashboardAuth.ts)
- [server/routers/dashboard.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/dashboard.ts)

Behavior:

- Uses a separate `dashboard_session` cookie.
- Resolves into `ctx.dashboardSession`, not `ctx.user`.
- Exposed to the client through `dashboard.me`.
- Used by the newer `/dashboard/*` style admin UI.

## 5. Current Auth Boundaries That Matter

These boundaries are intentional current behavior and should not be changed accidentally during refactors:

- `auth.me` returns `ctx.user`, not `ctx.dashboardSession`.
- A dashboard-only session does not become a learner/main-site user automatically.
- `dashboard.me` requires a valid dashboard session cookie.
- An OAuth admin without a dashboard session still does not satisfy `dashboard.me`.
- `documents.*` admin routes depend on `ctx.user.role === "admin"`.
- `courses.*` dashboard routes depend on `dashboardProcedure`.
- `glossary.*` is a special mixed-auth path that accepts either OAuth admin or dashboard session.

## 6. Data Access Reality

Primary file:

- [server/db.ts](/D:/aicoding/ome-translate/ome-transalate/server/db.ts)

Current state:

- Most database reads and writes are still centralized in one large module.
- This module currently spans user, admin, document, translation, glossary, feedback, progress, and exercise concerns.
- It is still the practical source of truth for repository behavior.

## 7. Frontend Surfaces to Treat Carefully

High-risk pages:

- [client/src/pages/dashboard/DashboardCourses.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/dashboard/DashboardCourses.tsx)
- [client/src/pages/LearnView.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/LearnView.tsx)

Why they matter:

- They mix data loading, mutation flows, error handling, state orchestration, and rendering.
- They are likely to be affected once backend orchestration and auth boundaries are cleaned up.

## 8. Current Refactor Rule of Thumb

Before changing upload, translation, or auth logic:

1. Check whether the behavior exists in both `documents.ts` and `courses.ts`.
2. Check whether the route depends on `ctx.user`, `ctx.dashboardSession`, or both.
3. Check whether the change affects `glossary` as a mixed-auth exception.
4. Check whether the behavior is already locked by characterization tests in `server/routers/__tests__/`.
