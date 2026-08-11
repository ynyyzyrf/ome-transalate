# OME Translate Technical Debt Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the current architecture risk by eliminating duplicated business flows, converging authentication boundaries, splitting the oversized data access layer, and extracting the most fragile frontend pages before adding major new features.

**Architecture:** Start with the highest-leverage consolidation work in the backend upload/translation pipeline, because it currently exists in parallel in `documents` and `courses` routers. Once the main business flow is unified, converge auth rules behind shared procedures/policies, then split the repository layer by domain, and finally decompose large pages so UI evolution no longer depends on monolithic components. Introduce a real async job mechanism only after the main flow has one orchestration path.

**Tech Stack:** React 19, TypeScript, Vite, Express, tRPC, React Query, Drizzle ORM, MySQL, Vitest

---

## Scope Summary

This plan is based on the technical debt described in [handover-architecture.md](/D:/aicoding/ome-translate/ome-transalate/docs/handover-architecture.md) and validated against the current codebase:

- Duplicate upload/translation flow exists in [documents.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/documents.ts) and [courses.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/courses.ts).
- Authentication is split across [context.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/context.ts), [trpc.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/trpc.ts), [dashboardAuth.ts](/D:/aicoding/ome-translate/ome-transalate/server/_core/dashboardAuth.ts), [authLocal.ts](/D:/aicoding/ome-translate/ome-transalate/server/routers/authLocal.ts), and mixed router-level guards.
- The data access layer is concentrated in [db.ts](/D:/aicoding/ome-translate/ome-transalate/server/db.ts).
- High-risk frontend pages include [DashboardCourses.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/dashboard/DashboardCourses.tsx) and [LearnView.tsx](/D:/aicoding/ome-translate/ome-transalate/client/src/pages/LearnView.tsx).

## Delivery Strategy

1. Do not tackle all debt in one branch.
2. Sequence work so each phase leaves the system in a shippable state.
3. Prefer "extract and redirect" over large rewrites.
4. Add characterization tests before moving shared logic.
5. Delay infrastructure-heavy work such as a queue until the business flow has a single orchestration path.

## Phase 0: Baseline and Guardrails

**Objective**

Create a safe baseline so later refactors can be validated quickly.

**Files to touch**

- Modify: `package.json`
- Modify: `server/*.test.ts`
- Modify: `client/src/pages/dashboard/DashboardCourses.tsx`
- Modify: `client/src/pages/LearnView.tsx`
- Create: `server/routers/__tests__/`
- Create: `server/services/__tests__/`

**Key actions**

- [ ] Inventory all current upload, retry, publish, translation, and feedback flows that differ between `documents` and `courses`.
- [ ] Add characterization tests around:
  - document upload and translation job creation
  - course creation from text and file
  - translation retry
  - dashboard session auth
  - learner auth-dependent read flow
- [ ] Add a short architecture note describing the current source of truth for:
  - document/course lifecycle
  - auth models
  - translation execution path
- [ ] Confirm `npm run check` and `npm test` are green before structural work starts.

**Acceptance criteria**

- Existing behaviors are captured in tests before any shared logic moves.
- The team can detect regressions in both old admin and new dashboard flows.

**Risk level**

Low.

**Estimated effort**

0.5 to 1 day.

## Phase 1: Unify Upload, Parse, Translate, and Preview Orchestration

**Objective**

Remove the highest-value duplication by moving the common document/course pipeline into one service layer.

**Files to touch**

- Create: `server/services/courseIngestionService.ts`
- Create: `server/services/translationOrchestrator.ts`
- Create: `server/services/types.ts`
- Modify: `server/routers/documents.ts`
- Modify: `server/routers/courses.ts`
- Modify: `server/documentParser.ts`
- Modify: `server/documentIr.ts`
- Modify: `server/previewHtml.ts`
- Modify: `server/storage.ts`
- Test: `server/services/__tests__/courseIngestionService.test.ts`
- Test: `server/services/__tests__/translationOrchestrator.test.ts`

**Implementation notes**

- Extract common responsibilities from both routers:
  - source file persistence
  - text extraction and segment/IR normalization
  - document creation
  - translation job creation
  - translation execution trigger
  - preview generation
- Keep router-specific concerns in the router:
  - auth policy
  - dashboard-specific defaults such as target languages
  - response shape differences if still needed
- Replace both local `triggerTranslation()` implementations with one shared orchestrator.
- Standardize storage key rules so `documents/*` and `courses/*` conventions are no longer divergent without reason.

**Acceptance criteria**

- `documents.ts` and `courses.ts` no longer each own a full translation pipeline.
- There is only one orchestration path for upload and retry translation.
- Behavior differences between dashboard and old admin are explicit and minimal.

**Risk level**

Medium.

**Estimated effort**

2 to 3 days.

## Phase 2: Converge Authentication and Authorization Boundaries

**Objective**

Make identity models explicit and centralize authorization decisions.

**Files to touch**

- Create: `server/_core/authz.ts`
- Create: `server/_core/authTypes.ts`
- Modify: `server/_core/context.ts`
- Modify: `server/_core/trpc.ts`
- Modify: `server/_core/dashboardAuth.ts`
- Modify: `server/routers/glossary.ts`
- Modify: `server/routers/feedbacks.ts`
- Modify: `server/routers/dashboard.ts`
- Modify: `client/src/_core/hooks/useAuth.ts`
- Modify: `client/src/components/DashboardAdminLayout.tsx`
- Modify: `client/src/components/AdminLayout.tsx`

**Implementation notes**

- Define three explicit principals:
  - learner user
  - platform admin
  - dashboard admin
- Decide whether dashboard admin remains an independent identity or becomes a mapped admin capability.
- Move ad hoc router checks into shared procedures or policy helpers.
- Replace glossary's mixed special-case auth with a named policy, for example `canManageGlossary`.
- Document which frontend surfaces depend on `auth.me` and which depend on `dashboard.me`.
- Leave OIDC stub work out of this phase unless it blocks convergence.

**Acceptance criteria**

- Auth logic is no longer primarily encoded as one-off middleware inside feature routers.
- Every protected route can be explained in terms of named principals and shared policy helpers.
- New contributors can answer "which identity model is active here?" in one place.

**Risk level**

Medium to high.

**Estimated effort**

2 to 4 days.

## Phase 3: Split `db.ts` by Domain

**Objective**

Replace the monolithic repository module with domain-focused access modules.

**Files to touch**

- Create: `server/db/index.ts`
- Create: `server/db/users.ts`
- Create: `server/db/admins.ts`
- Create: `server/db/documents.ts`
- Create: `server/db/translationJobs.ts`
- Create: `server/db/glossary.ts`
- Create: `server/db/feedbacks.ts`
- Create: `server/db/progress.ts`
- Create: `server/db/exercises.ts`
- Modify: `server/db.ts`
- Modify: `server/routers/*.ts`
- Modify: `server/services/*.ts`
- Test: `server/**/*.test.ts`

**Implementation notes**

- Start with pure extraction, not query redesign.
- Keep `server/db.ts` temporarily as a compatibility barrel that re-exports new modules.
- Move functions in small vertical slices:
  - documents + translation jobs first
  - glossary and feedbacks second
  - users/admins/progress/exercises last
- After migration, remove dead exports from the compatibility layer.

**Acceptance criteria**

- Domain code imports from focused modules instead of one giant file.
- Future refactors can target `documents` or `feedbacks` without reopening unrelated database logic.
- Test mocks can be scoped to a domain instead of the whole repository layer.

**Risk level**

Medium.

**Estimated effort**

1.5 to 3 days.

## Phase 4: Decompose the Two Largest Frontend Pages

**Objective**

Reduce change risk in the dashboard course management and learner reading experience.

**Files to touch**

- Create: `client/src/features/dashboard-courses/`
- Create: `client/src/features/learn-view/`
- Modify: `client/src/pages/dashboard/DashboardCourses.tsx`
- Modify: `client/src/pages/LearnView.tsx`
- Modify: `client/src/pages/LearnPortal.tsx`
- Modify: `client/src/components/DashboardLayout.tsx`
- Modify: `client/src/components/DashboardAdminLayout.tsx`

**Implementation notes**

- Extract from `DashboardCourses.tsx`:
  - query/mutation hooks
  - upload form state
  - course list/table
  - publish/retry actions
  - image review and preview subviews
- Extract from `LearnView.tsx`:
  - document/translation loading
  - reading pane state
  - explain interaction
  - feedback submission
  - progress tracking
- Keep page files as orchestration shells with minimal JSX and routing glue.
- Prefer colocated feature folders over dumping more hooks into generic global locations.

**Acceptance criteria**

- The two page files shrink substantially and stop mixing all data, UI, and interaction code in one place.
- New UI work in either area can be made without reading 600 to 700 lines first.

**Risk level**

Medium.

**Estimated effort**

2 to 4 days.

## Phase 5: Remove Legacy Admin Drift

**Objective**

Finish the half-completed `/admin/*` to `/dashboard/*` migration so only one backend UI path remains active.

**Files to touch**

- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/admin/*.tsx`
- Modify: `client/src/components/AdminLayout.tsx`
- Modify: `client/src/components/DashboardLayout.tsx`
- Modify: related navigation components

**Implementation notes**

- Audit whether old admin pages are still linked, redirected, or reused indirectly.
- For each old page, choose one:
  - delete
  - redirect
  - preserve as a thin compatibility wrapper
- Do not delete shared UI pieces until imports are confirmed.

**Acceptance criteria**

- `/admin/*` is either fully retired or intentionally kept as a compatibility layer with clear ownership.
- There is one primary admin experience in the product.

**Risk level**

Medium.

**Estimated effort**

1 to 2 days.

## Phase 6: Introduce a Real Async Translation Job Mechanism

**Objective**

Move translation execution out of the request-serving process once the orchestration path is unified.

**Files to touch**

- Create: `server/jobs/translationQueue.ts`
- Create: `server/jobs/translationWorker.ts`
- Create: `server/jobs/types.ts`
- Modify: `server/services/translationOrchestrator.ts`
- Modify: `server/_core/index.ts`
- Modify: `server/routers/documents.ts`
- Modify: `server/routers/courses.ts`
- Modify: `server/db/translationJobs.ts`

**Implementation notes**

- Start with a minimal queue abstraction.
- First support:
  - enqueue
  - claim/start
  - completion/failure
  - retry
  - basic observability
- Prefer a queue design that can begin in-process with persistence, then move to a separate worker if scale demands it.
- Add idempotency around translation job execution so retries do not duplicate artifacts.

**Acceptance criteria**

- Upload and retry endpoints enqueue work instead of translating directly in the request lifecycle.
- Translation jobs survive API process restart.
- Retry, timeout, and failure states are observable and testable.

**Risk level**

High.

**Estimated effort**

3 to 5 days.

## Recommended Order and Milestones

### Milestone A: Stop Structural Drift

- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 design decision made on identity model

**Outcome**

There is one main business pipeline and auth rules stop spreading.

### Milestone B: Improve Maintainability

- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete

**Outcome**

Daily development cost drops because the core files become easier to change safely.

### Milestone C: Prepare for Growth

- [ ] Phase 5 complete
- [ ] Phase 6 complete

**Outcome**

The system is ready for higher document volume and less legacy confusion.

## What Not to Do

- Do not start with the async queue before consolidating the duplicated upload/translation logic.
- Do not redesign the data model and auth model in the same branch.
- Do not delete `/admin/*` pages before confirming whether they still provide fallback behavior.
- Do not split `db.ts` and change query semantics at the same time.

## Suggested Staffing

- 1 backend-focused engineer can complete Phases 0 to 3.
- 1 frontend-focused engineer can start Phase 4 once Phase 1 contracts stabilize.
- Phase 6 should be taken by whoever owns infra and observability concerns.

## Suggested Tracking Format

Track each phase with:

- owner
- branch
- start date
- target merge date
- blocked by
- rollout risk
- verification status

## Exit Criteria for the Whole Remediation

- There is one canonical upload/parse/translate orchestration path.
- Auth rules are centralized and named.
- `server/db.ts` is no longer the default entry point for every query.
- The two largest frontend pages are decomposed into feature-level pieces.
- Legacy admin paths are either retired or intentionally preserved.
- Translation work no longer depends on the API process staying alive.

Plan complete and saved to `docs/superpowers/plans/2026-05-30-technical-debt-remediation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
