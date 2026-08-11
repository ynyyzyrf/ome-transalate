# Course Content Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard-only original-content editor so admins can fix uploaded PDF/Word text blocks without breaking image blocks, then mark translations as needing manual retranslation.

**Architecture:** Keep `documents.segments` as the source of truth. Add a dedicated dashboard editor page that edits only text-like blocks, preserves image block structure/meta, rewrites `extractedText`, and marks translation jobs back to `pending` instead of auto-retranslating.

**Tech Stack:** React, Wouter, tRPC, Drizzle/MySQL, Vitest, existing dashboard admin UI

---

## File Map

- Modify: `D:\aicoding\ome-translate\ome-transalate\client\src\pages\dashboard\DashboardCourses.tsx`
  Add the `编辑原文` entry and pending-retranslation status UI.
- Create: `D:\aicoding\ome-translate\ome-transalate\client\src\pages\dashboard\DashboardCourseContentEditor.tsx`
  Dedicated editor page for structured Chinese content blocks.
- Modify: `D:\aicoding\ome-translate\ome-transalate\client\src\App.tsx`
  Register the new dashboard route.
- Modify: `D:\aicoding\ome-translate\ome-transalate\server\routers\courses.ts`
  Add `getEditableContent` and `updateContentBlocks`.
- Modify: `D:\aicoding\ome-translate\ome-transalate\server\db.ts`
  Add block-content persistence helper and translation reset helper.
- Create: `D:\aicoding\ome-translate\ome-transalate\server\courses.updateContentBlocks.test.ts`
  Regression tests for preserving image blocks and resetting translation status.

## Task 1: Add Content Editing API

**Files:**
- Modify: `D:\aicoding\ome-translate\ome-transalate\server\routers\courses.ts`
- Modify: `D:\aicoding\ome-translate\ome-transalate\server\db.ts`
- Test: `D:\aicoding\ome-translate\ome-transalate\server\courses.updateContentBlocks.test.ts`

- [ ] **Step 1: Write the failing test for content updates preserving image blocks**

Test cases to cover:
- text blocks can be updated
- image blocks remain `type: "image"` with original `meta.imageUrl`
- translation jobs for the document are reset to `pending`

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- server/courses.updateContentBlocks.test.ts`
Expected: FAIL because `courses.updateContentBlocks` does not exist yet.

- [ ] **Step 3: Add DB helper(s)**

In `server/db.ts`, add:
- `updateDocumentContent(id, { extractedText, segments })`
- `resetTranslationJobsToPending(documentId)`

Requirements:
- only update the intended fields
- clear stale translated payloads when resetting jobs:
  - `translatedSegments: null`
  - `outputS3Key: null`
  - `outputS3Url: null`
  - `errorMessage: null`
  - `startedAt: null`
  - `completedAt: null`

- [ ] **Step 4: Add router procedures**

In `server/routers/courses.ts`, add:
- `getEditableContent`
  - returns document basics plus IR blocks
- `updateContentBlocks`
  - accepts `documentId` and edited blocks
  - only allows editing text-like blocks
  - preserves image blocks and their meta
  - rewrites `documents.segments`
  - rewrites `documents.extractedText`
  - resets translation jobs to `pending`
  - sets document status to `pending`

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `pnpm test -- server/courses.updateContentBlocks.test.ts`
Expected: PASS

## Task 2: Add Dashboard Content Editor Page

**Files:**
- Create: `D:\aicoding\ome-translate\ome-transalate\client\src\pages\dashboard\DashboardCourseContentEditor.tsx`
- Modify: `D:\aicoding\ome-translate\ome-transalate\client\src\App.tsx`

- [ ] **Step 1: Build a read-only loading shell first**

Page requirements:
- route `/dashboard/courses/:id/content`
- back button to courses list
- load document via `trpc.courses.getEditableContent`
- show title and warning that save will require manual retranslation

- [ ] **Step 2: Render structured blocks**

Render behavior:
- `heading`, `paragraph`, `list`, `other`: editable textarea
- `image`: read-only preview or placeholder card
- preserve block order exactly as returned

- [ ] **Step 3: Wire save mutation**

Use `trpc.courses.updateContentBlocks`

On success:
- toast success
- invalidate `courses.getById`, `courses.getEditableContent`, `courses.list`
- keep user on page with fresh saved state

- [ ] **Step 4: Add simple dirty-state UX**

Minimum UX:
- disable save while mutation pending
- show cancel/back action
- if no changes, save button disabled

- [ ] **Step 5: Run type-check**

Run: `pnpm check`
Expected: PASS

## Task 3: Add Entry Point From Course List

**Files:**
- Modify: `D:\aicoding\ome-translate\ome-transalate\client\src\pages\dashboard\DashboardCourses.tsx`

- [ ] **Step 1: Add `编辑原文` action**

In the actions column:
- keep existing edit/delete/retry/image actions
- add a text or icon+label action linking to `/dashboard/courses/:id/content`

- [ ] **Step 2: Add pending-retranslation status display**

For first phase, infer `需重翻` from document status being reset to `pending` after content edits.

Display guidance:
- if status is `pending` but document already exists, show copy that makes sense for admins, such as `待重翻`

- [ ] **Step 3: Re-check the list page visually**

Verify:
- action column remains usable
- no overlap on smaller desktop widths

## Task 4: Learn-Side Behavior For Pending Retranslation

**Files:**
- Modify: `D:\aicoding\ome-translate\ome-transalate\client\src\pages\LearnView.tsx`

- [ ] **Step 1: Confirm current pending/processing UI behavior against edited documents**

If existing pending translation UI already covers this case cleanly, keep changes minimal.

- [ ] **Step 2: Add clearer message if needed**

If current wording is too generic, update copy to mention:
- original content has been updated
- translation is pending regeneration

- [ ] **Step 3: Run manual browser verification**

Verify:
- edited source text appears immediately on Chinese side
- target language area does not show stale translated text as if it were current

## Task 5: Regression Coverage

**Files:**
- Test: `D:\aicoding\ome-translate\ome-transalate\server\courses.updateContentBlocks.test.ts`
- Existing tests:
  - `D:\aicoding\ome-translate\ome-transalate\server\courses.attachImage.test.ts`
  - `D:\aicoding\ome-translate\ome-transalate\server\assetUrls.test.ts`

- [ ] **Step 1: Add preservation assertions**

Assert that saving text edits does not:
- remove image blocks
- clear `meta.imageUrl`
- mutate untouched block ids

- [ ] **Step 2: Add extractedText assertions**

Assert that the rewritten `extractedText` matches the edited text blocks in order.

- [ ] **Step 3: Run focused tests**

Run: `pnpm test -- server/courses.updateContentBlocks.test.ts server/courses.attachImage.test.ts server/assetUrls.test.ts`
Expected: PASS

- [ ] **Step 4: Run full type/build verification**

Run:
- `pnpm check`
- `pnpm build`

Expected:
- both commands pass
- only pre-existing warnings are acceptable

## Acceptance Checklist

- Admin can open a dedicated content editor from dashboard courses.
- Admin can edit Chinese text blocks without flattening image blocks.
- Saving updates `documents.segments` and `documents.extractedText`.
- Saving resets related translation jobs to `pending`.
- Course list exposes a clear post-edit retranslation state.
- Learn page no longer presents stale translation as fresh content after an edit.
- Existing image supplement workflow still works.
