# OME Translate Technical Debt Issue Breakdown

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the architecture remediation plan into assignable implementation issues that can be scheduled across one or more sprints.

**Architecture:** The backlog follows the same dependency order as the remediation plan: stabilize with tests first, unify the backend orchestration path second, converge auth and repository boundaries third, then simplify the frontend and legacy admin surface, and finally introduce a durable async translation mechanism. Each issue is scoped to leave the system runnable after merge.

**Tech Stack:** React 19, TypeScript, Vite, Express, tRPC, React Query, Drizzle ORM, MySQL, Vitest

---

## How to Use This Backlog

- Each issue below is intended to fit one PR.
- If capacity is limited, prioritize all `A-*` and `B-*` issues before anything else.
- Do not run `F-*` queue work in parallel with `B-*` orchestration consolidation unless the shared service contracts are already merged.

## Epic A: Baseline and Safety Net

### Issue A-1: Add characterization tests for upload and translation entry flows

**Owner type:** Backend

**Depends on:** None

**Files**

- Modify: [package.json](/D:/aicoding/ome-translate/ome-transalate/package.json)
- Modify: [server/courses.attachImage.test.ts](/D:/aicoding/ome-translate/ome-transalate/server/courses.attachImage.test.ts)
- Create: `server/routers/__tests__/documents.upload.test.ts`
- Create: `server/routers/__tests__/courses.create.test.ts`
- Create: `server/routers/__tests__/translation.retry.test.ts`

**Scope**

- Cover document upload from old admin path.
- Cover course creation from dashboard path using file input.
- Cover course creation from dashboard path using plain text input.
- Cover translation retry behavior for both paths.

**Acceptance criteria**

- Tests prove translation jobs are created with expected target languages.
- Tests prove both router entry points still work before refactor.
- Tests run under `npm test`.

### Issue A-2: Add auth behavior coverage for learner and dashboard identities

**Owner type:** Backend

**Depends on:** None

**Files**

- Modify: [server/dashboard.test.ts](/D:/aicoding/ome-translate/ome-transalate/server/dashboard.test.ts)
- Modify: [server/auth.logout.test.ts](/D:/aicoding/ome-translate/ome-transalate/server/auth.logout.test.ts)
- Create: `server/routers/__tests__/auth.identity-boundaries.test.ts`

**Scope**

- Cover `auth.me` for learner/main-site identity.
- Cover `dashboard.me` for dashboard session identity.
- Cover forbidden behavior when the wrong identity hits the wrong route.

**Acceptance criteria**

- The three principal types in the handover doc are represented in tests.
- Mixed auth assumptions become visible in failing tests if behavior changes.

### Issue A-3: Document current source of truth for orchestration and auth

**Owner type:** Backend or Tech Lead

**Depends on:** None

**Files**

- Create: `docs/architecture/current-state-baseline.md`

**Scope**

- Summarize current upload flow.
- Summarize current translation trigger path.
- Summarize current auth models and router ownership.

**Acceptance criteria**

- New contributors can find one short baseline doc without rereading the whole handover.

## Epic B: Unify Upload and Translation Orchestration

### Issue B-1: Extract shared ingestion input/output types

**Owner type:** Backend

**Depends on:** A-1

**Files**

- Create: `server/services/types.ts`
- Modify: [server/routers/documents.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/documents.ts)
- Modify: [server/routers/courses.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/courses.ts)

**Scope**

- Define normalized input types for uploaded file, manual text source, metadata, and target languages.
- Define normalized output types for parse result, document creation result, and translation enqueue result.

**Acceptance criteria**

- Routers no longer each invent their own shape for the same ingestion workflow.

### Issue B-2: Extract shared course/document ingestion service

**Owner type:** Backend

**Depends on:** A-1, B-1

**Files**

- Create: `server/services/courseIngestionService.ts`
- Modify: [server/documentParser.ts](/D:/aicoding/ome-translate/ome-transalate/server/documentParser.ts)
- Modify: [server/documentIr.ts](/D:/aicoding/ome-translate/ome-transalate/server/documentIr.ts)
- Create: `server/services/__tests__/courseIngestionService.test.ts`

**Scope**

- Move file persistence, parsing, and segment normalization into one service.
- Support both uploaded files and manual text content.
- Return a single normalized result for router use.

**Acceptance criteria**

- `documents.ts` and `courses.ts` can both call the same ingestion service.
- Parsing and normalization logic is no longer duplicated in routers.

### Issue B-3: Extract shared translation orchestration service

**Owner type:** Backend

**Depends on:** A-1, B-2

**Files**

- Create: `server/services/translationOrchestrator.ts`
- Modify: [server/translationEngine.ts](/D:/aicoding/ome-translate/ome-transalate/server/translationEngine.ts)
- Modify: [server/previewHtml.ts](/D:/aicoding/ome-translate/ome-transalate/server/previewHtml.ts)
- Modify: [server/storage.ts](/D:/aicoding/ome-translate/ome-transalate/server/storage.ts)
- Create: `server/services/__tests__/translationOrchestrator.test.ts`

**Scope**

- Move translation job processing into one orchestrator.
- Centralize preview generation and artifact persistence.
- Replace duplicated `triggerTranslation()` implementations.

**Acceptance criteria**

- There is exactly one translation orchestration implementation in the codebase.

### Issue B-4: Refactor `documents` router to thin orchestration shell

**Owner type:** Backend

**Depends on:** B-2, B-3

**Files**

- Modify: [server/routers/documents.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/documents.ts)

**Scope**

- Keep only auth, input validation, and response shaping in the router.
- Delegate upload and retry flows to shared services.

**Acceptance criteria**

- The router does not contain parsing or translation orchestration code.

### Issue B-5: Refactor `courses` router to thin orchestration shell

**Owner type:** Backend

**Depends on:** B-2, B-3

**Files**

- Modify: [server/routers/courses.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/courses.ts)

**Scope**

- Keep only dashboard-specific auth, defaults, input validation, and response shaping.
- Delegate upload and retry flows to shared services.

**Acceptance criteria**

- The router does not contain parsing or translation orchestration code.

## Epic C: Converge Auth and Authorization

### Issue C-1: Define explicit principal and policy model

**Owner type:** Backend

**Depends on:** A-2

**Files**

- Create: `server/_core/authTypes.ts`
- Create: `server/_core/authz.ts`
- Modify: [server/_core/context.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/context.ts)

**Scope**

- Define learner user, platform admin, and dashboard admin as named principals.
- Add policy helpers such as `canManageGlossary`, `canManageCourses`, `canViewDashboard`.

**Acceptance criteria**

- Auth reasoning shifts from scattered role checks to named policy functions.

### Issue C-2: Replace router-local auth checks with shared procedures/policies

**Owner type:** Backend

**Depends on:** C-1

**Files**

- Modify: [server/_core/trpc.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/trpc.ts)
- Modify: [server/_core/dashboardAuth.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/dashboardAuth.ts)
- Modify: [server/routers/feedbacks.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/feedbacks.ts)
- Modify: [server/routers/glossary.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/glossary.ts)
- Modify: [server/routers/dashboard.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/dashboard.ts)

**Scope**

- Remove duplicated `adminProcedure` variants where possible.
- Replace glossary special-case auth with shared authz policy.

**Acceptance criteria**

- Feature routers stop defining ad hoc authorization rules inline.

### Issue C-3: Align frontend auth consumers with backend auth boundaries

**Owner type:** Frontend

**Depends on:** C-1

**Files**

- Modify: [client/src/_core/hooks/useAuth.ts](/D:/aicoding/ome-translate/ome-transalate/client/src/_core/hooks/useAuth.ts)
- Modify: [client/src/components/DashboardAdminLayout.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/components/DashboardAdminLayout.tsx)
- Modify: [client/src/components/AdminLayout.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/components/AdminLayout.tsx)
- Create: `client/src/_core/hooks/useDashboardAuth.ts`

**Scope**

- Make learner auth and dashboard auth consumption explicit in client code.
- Stop hiding multiple identity models behind ambiguous component usage.

**Acceptance criteria**

- Frontend code clearly shows whether a screen depends on `auth.me` or `dashboard.me`.

## Epic D: Split the Repository Layer

### Issue D-1: Extract document and translation job repositories

**Owner type:** Backend

**Depends on:** B-3

**Files**

- Create: `server/db/index.ts`
- Create: `server/db/documents.ts`
- Create: `server/db/translationJobs.ts`
- Modify: [server/db.ts](/D:/aicoding/ome-translate/ome-transalate/server/db.ts)
- Modify: [server/services/courseIngestionService.ts](/D:/aicoding/ome-translate/ome-transalate/server/services/courseIngestionService.ts)
- Modify: [server/services/translationOrchestrator.ts](/D:/aicoding/ome-translate/ome-transalate/server/services/translationOrchestrator.ts)

**Scope**

- Move document and translation job queries first, because they support the highest-risk orchestration flow.

**Acceptance criteria**

- Orchestration code no longer imports these queries from the giant `server/db.ts`.

### Issue D-2: Extract glossary and feedback repositories

**Owner type:** Backend

**Depends on:** C-2, D-1

**Files**

- Create: `server/db/glossary.ts`
- Create: `server/db/feedbacks.ts`
- Modify: [server/db.ts](/D:/aicoding/ome-translate/ome-transalate/server/db.ts)
- Modify: [server/routers/glossary.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/glossary.ts)
- Modify: [server/routers/feedbacks.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/feedbacks.ts)
- Modify: [server/routers/dashboardFeedbacks.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/dashboardFeedbacks.ts)

**Scope**

- Align repository split with the auth convergence work in glossary and feedback domains.

**Acceptance criteria**

- Glossary and feedback features use domain-scoped data access modules.

### Issue D-3: Extract users, admins, progress, and exercises repositories

**Owner type:** Backend

**Depends on:** D-1

**Files**

- Create: `server/db/users.ts`
- Create: `server/db/admins.ts`
- Create: `server/db/progress.ts`
- Create: `server/db/exercises.ts`
- Modify: [server/db.ts](/D:/aicoding/ome-translate/ome-transalate/server/db.ts)
- Modify: related routers and tests

**Scope**

- Finish the repository split with lower-risk domains.

**Acceptance criteria**

- `server/db.ts` becomes a temporary compatibility barrel rather than the main implementation file.

## Epic E: Simplify Frontend and Retire Legacy Admin Drift

### Issue E-1: Extract dashboard course feature hooks and presentation components

**Owner type:** Frontend

**Depends on:** B-5

**Files**

- Create: `client/src/features/dashboard-courses/hooks/`
- Create: `client/src/features/dashboard-courses/components/`
- Modify: [client/src/pages/dashboard/DashboardCourses.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/dashboard/DashboardCourses.tsx)

**Scope**

- Extract query/mutation hooks.
- Extract upload form and list/table rendering.
- Extract publish and retry action handlers.

**Acceptance criteria**

- `DashboardCourses.tsx` becomes a thin page orchestrator.

### Issue E-2: Extract learner reading feature hooks and presentation components

**Owner type:** Frontend

**Depends on:** B-4

**Files**

- Create: `client/src/features/learn-view/hooks/`
- Create: `client/src/features/learn-view/components/`
- Modify: [client/src/pages/LearnView.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/LearnView.tsx)
- Modify: [client/src/pages/LearnPortal.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/LearnPortal.tsx)

**Scope**

- Extract translation loading, pane state, AI explain flow, feedback flow, and progress flow.

**Acceptance criteria**

- `LearnView.tsx` stops mixing all data, controls, and layout in one file.

### Issue E-3: Audit and retire `/admin/*` routes

**Owner type:** Frontend

**Depends on:** E-1, C-3

**Files**

- Modify: [client/src/App.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/App.tsx)
- Modify: [client/src/pages/admin/DocumentUpload.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/admin/DocumentUpload.tsx)
- Modify: [client/src/pages/admin/DocumentList.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/admin/DocumentList.tsx)
- Modify: [client/src/pages/admin/GlossaryManager.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/admin/GlossaryManager.tsx)
- Modify: [client/src/components/AdminLayout.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/components/AdminLayout.tsx)

**Scope**

- Decide page-by-page whether to delete, redirect, or preserve.
- Remove dead navigation and stale compatibility wrappers.

**Acceptance criteria**

- The product has one intentional admin surface.

## Epic F: Introduce Durable Async Translation Jobs

### Issue F-1: Add persistent translation queue abstraction

**Owner type:** Backend / Infra

**Depends on:** B-3, D-1

**Files**

- Create: `server/jobs/types.ts`
- Create: `server/jobs/translationQueue.ts`
- Modify: `server/db/translationJobs.ts`

**Scope**

- Add enqueue, claim, mark-complete, mark-failed, and retry primitives.

**Acceptance criteria**

- Queue state is persisted outside in-memory process state.

### Issue F-2: Add translation worker and orchestrator integration

**Owner type:** Backend / Infra

**Depends on:** F-1

**Files**

- Create: `server/jobs/translationWorker.ts`
- Modify: [server/services/translationOrchestrator.ts](/D:/aicoding/ome-translate/ome-transalate/server/services/translationOrchestrator.ts)
- Modify: [server/_core/index.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/index.ts)
- Modify: [server/routers/documents.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/documents.ts)
- Modify: [server/routers/courses.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/courses.ts)

**Scope**

- Make upload and retry endpoints enqueue work instead of executing translation inline.
- Start a worker loop in the current deployment model.

**Acceptance criteria**

- API requests return before translation completes.
- Translation still completes through worker execution.

### Issue F-3: Add queue observability and failure recovery rules

**Owner type:** Backend / Infra

**Depends on:** F-2

**Files**

- Modify: `server/jobs/translationQueue.ts`
- Modify: `server/jobs/translationWorker.ts`
- Create: `server/jobs/__tests__/translationQueue.test.ts`

**Scope**

- Add basic metrics/logging.
- Add retry policy and stuck-job recovery policy.
- Add idempotency guardrails for repeated execution attempts.

**Acceptance criteria**

- Queue failures and retries are diagnosable without stepping through code manually.

## Suggested Sprint Cut

### Sprint 1

- [ ] A-1
- [ ] A-2
- [ ] A-3
- [ ] B-1
- [ ] B-2

### Sprint 2

- [ ] B-3
- [ ] B-4
- [ ] B-5
- [ ] C-1

### Sprint 3

- [ ] C-2
- [ ] C-3
- [ ] D-1
- [ ] E-1
- [ ] E-2

### Sprint 4

- [ ] D-2
- [ ] D-3
- [ ] E-3

### Sprint 5

- [ ] F-1
- [ ] F-2
- [ ] F-3

## Highest-Priority First Five Issues

1. `A-1` Add characterization tests for upload and translation entry flows
2. `B-2` Extract shared course/document ingestion service
3. `B-3` Extract shared translation orchestration service
4. `B-4` Refactor `documents` router to thin orchestration shell
5. `B-5` Refactor `courses` router to thin orchestration shell

## Sequencing Rules

- `A-*` must finish before moving business logic out of routers.
- `B-2` and `B-3` should merge before `C-*` and `D-*` expand in scope.
- `E-*` can begin once `B-*` contracts stabilize.
- `F-*` should start only after one canonical orchestration path exists.

Plan complete and saved to `docs/superpowers/plans/2026-05-30-technical-debt-issue-breakdown.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
