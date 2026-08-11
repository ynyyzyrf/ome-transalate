# OME Translate 技術債處理計劃

> **建立日期：** 2026-08-09
> **基於：** 對當前代碼庫的完整審查
> **前置文檔：** `docs/superpowers/plans/2026-05-30-technical-debt-remediation.md`（原始計劃）、`docs/handover-architecture.md`

---

## 一、當前狀態評估

2026-05-30 的原始技術債計劃已部分執行。以下是各項目的實際進展：

### 已完成 ✅

| 項目 | 說明 |
|------|------|
| 服務層提取 | `server/services/` 已建立，含 `courseIngestionService.ts`、`translationOrchestrator.ts`、`documentWorkflowService.ts`、`types.ts` |
| 路由器瘦身（主要邏輯） | `documents.ts`（166 行）和 `courses.ts`（211 行）的上傳/解析/翻譯主流程已委託至共享服務 |
| 認證類型與策略 | `server/_core/authTypes.ts` 定義了 4 種 Principal；`server/_core/authz.ts` 提供 `resolvePrincipal`、`canManageGlossary`、`canManageCourses` 等策略函數 |
| 特徵化測試 | `server/routers/__tests__/`（6 個測試文件）和 `server/services/__tests__/`（4 個測試文件）已建立 |
| 架構基線文檔 | `docs/architecture/current-state-baseline.md` 已建立 |
| 遺留路由重定向 | `App.tsx` 中所有 `/admin/*` 路由已重定向至 `/dashboard/*` |

### 未完成 ❌

| # | 項目 | 當前狀態 | 嚴重程度 |
|---|------|----------|----------|
| 1 | `attachImageToBlock` 邏輯重複 | `documents.ts` 和 `courses.ts` 各有一份幾乎相同的實現（~30 行） | 中 |
| 2 | `feedbacks.ts` 與 `dashboardFeedbacks.ts` 路由器重複 | 兩個路由器調用相同的 db 函數，但維護兩套端點 | 中 |
| 3 | `server/db.ts` 仍未拆分 | 717 行，55+ 個導出函數，涵蓋全部領域，無 `server/db/` 目錄 | 高 |
| 4 | 翻譯無持久化隊列 | `documentWorkflowService.ts` 仍使用 `void triggerTranslationForDocument()` fire-and-forget，無 `server/jobs/` | 高 |
| 5 | 遺留 `/admin/*` 頁面組件未清理 | `client/src/pages/admin/` 下 6 個文件（1373 行）仍存在，雖然路由已重定向 | 中 |
| 6 | 前端頁面組件過大 | `DashboardCourses.tsx` 777 行、`LearnView.tsx` 687 行 | 中 |

---

## 二、處理計劃

### 原則

1. **每個階段結束後系統必須可運行** — 不允許大爆炸式重構
2. **先提取後重寫** — 優先使用 "extract and redirect" 而非重寫
3. **測試先行** — 每個重構步驟前確認測試通過，重構後再驗證
4. **小步快跑** — 每個任務控制在可在一個 PR 中完成
5. **不改變行為** — 重構階段不改變用戶可見的行為

---

### Phase 1: 清理殘留重複邏輯

**目標：** 消除路由器層最後的重複代碼

**風險：** 低
**預估工時：** 0.5–1 天

#### Task 1.1: 提取共享 `attachImageToBlock` 邏輯

**現狀：** `documents.ts` 第 125–165 行和 `courses.ts` 第 159–201 行幾乎完全相同，僅有 storage key 前綴（`documents/` vs `courses/`）和 image block 類型檢查方式不同。

**操作：**
- [ ] 在 `server/services/documentWorkflowService.ts` 中新增 `attachImageToBlock(params)` 函數
- [ ] 參數包含 `storagePrefix: "documents" | "courses"` 以處理路徑差異
- [ ] 統一使用 `isImageLikeBlock()` 進行類型檢查
- [ ] `documents.ts` 和 `courses.ts` 的 `attachImageToBlock` mutation 改為調用共享函數
- [ ] 新增/更新測試覆蓋兩條路徑

**驗收標準：**
- `attachImageToBlock` 邏輯只存在於一處
- 兩個路由器的 mutation 各不超過 10 行
- 現有測試通過

#### Task 1.2: 合併 feedbacks 路由器

**現狀：** `feedbacks.ts`（97 行，使用 `adminProcedure`/`protectedProcedure`）和 `dashboardFeedbacks.ts`（68 行，使用 `dashboardProcedure`）提供相同的功能，調用相同的 `db.ts` 函數。

**操作：**
- [ ] 評估是否可以通過 tRPC 的 procedure 組合實現一套端點兩種認證
- [ ] 方案 A：在 `feedbacks.ts` 中使用 `resolvePrincipal` 統一認證，讓 `dashboardFeedbacks` 成為薄包裝
- [ ] 方案 B：如果 tRPC 限制不允許，則至少提取共享的 input schema 和業務邏輯到 `server/services/feedbackService.ts`
- [ ] 更新前端 tRPC 客戶端調用（如需要）
- [ ] 確認測試覆蓋兩種認證路徑

**驗收標準：**
- 反饋管理的業務邏輯只存在於一處
- `dashboardFeedbacks.ts` 要麼被刪除，要麼成為不超過 20 行的薄包裝
- 認證邊界測試通過

---

### Phase 2: 拆分 `server/db.ts` God Repository

**目標：** 將 717 行的單體數據訪問層按領域拆分為獨立模塊

**風險：** 中
**預估工時：** 1.5–2 天

#### Task 2.1: 建立目錄結構和連接池共享層

**操作：**
- [ ] 建立 `server/db/` 目錄
- [ ] 建立 `server/db/index.ts` — 導出連接池管理函數（`getPool`、`getDb`、`withDb`、`pingDb`、`closeDb`）和 `DatabaseError`/`DatabaseNotAvailableError`
- [ ] 暫時讓 `server/db.ts` re-export `server/db/index.ts` 的內容作為兼容層

**驗收標準：**
- `pnpm check` 通過
- `pnpm test` 通過
- 連接池管理只有一個來源

#### Task 2.2: 提取 documents 和 translationJobs 倉庫

**操作：**
- [ ] 建立 `server/db/documents.ts` — 移入：`createDocument`、`getDocumentById`、`listDocuments`、`listPublishedDocuments`、`updateDocumentStatus`、`updateDocumentPublished`、`updateDocumentMeta`、`deleteDocument`
- [ ] 建立 `server/db/translationJobs.ts` — 移入：`createTranslationJob`、`getTranslationJob`、`getTranslationJobById`、`getTranslationJobsByDocument`、`updateTranslationJobStatus`、`listAllTranslationJobs`
- [ ] 更新 `server/db.ts` 兼容層 re-export 新模塊
- [ ] 更新 `server/services/` 和 `server/routers/` 中的直接 import（改為從新模塊導入）

**驗收標準：**
- documents 和 translationJobs 的查詢不再從 `server/db.ts` 導入
- `pnpm check` 和 `pnpm test` 通過

#### Task 2.3: 提取 glossary 和 feedbacks 倉庫

**操作：**
- [ ] 建立 `server/db/glossary.ts` — 移入：`createGlossaryEntry`、`bulkCreateGlossaryEntries`、`listGlossaryEntries`、`deleteGlossaryEntry`、`createGlossaryBatch`、`listGlossaryBatches`、`getGlossaryForLanguage`
- [ ] 建立 `server/db/feedbacks.ts` — 移入：`createFeedback`、`getFeedbacksByUser`、`listAllFeedbacks`、`updateFeedbackStatus`、`getFeedbackById`
- [ ] 更新兼容層和所有消費者

**驗收標準：**
- glossary 和 feedbacks 的查詢不再從 `server/db.ts` 導入

#### Task 2.4: 提取 users、admins、progress、exercises 倉庫

**操作：**
- [ ] 建立 `server/db/users.ts` — 移入：`upsertUser`、`getUserByOpenId`、`updateUserLanguage`、`listUsers`、`getUserByEmail`、`createLocalUser`、`updatePassword`、`updateUserLastSignedIn`、`updateUserRole`
- [ ] 建立 `server/db/admins.ts` — 移入：`getAdminByUsername`、`getAdminById`、`createAdminAccount`、`listAdminAccounts`
- [ ] 建立 `server/db/progress.ts` — 移入：`getProgress`、`upsertProgress`、`listUserProgress`
- [ ] 建立 `server/db/exercises.ts` — 移入：`createExercise`、`getExercisesByDocument`、`createExerciseAttempt`、`getExerciseAttempts`、`deleteExercise`
- [ ] 將 `server/db.ts` 縮減為純兼容 barrel 或直接刪除

**驗收標準：**
- `server/db.ts` 要麼不存在，要麼是不超過 30 行的 re-export barrel
- 所有領域代碼從專注的模塊導入
- `pnpm check` 和 `pnpm test` 全部通過

---

### Phase 3: 引入持久化翻譯隊列

**目標：** 翻譯任務不再依賴 API 進程存活，服務器重啟不中斷進行中的工作

**風險：** 高
**預估工時：** 2–3 天
**狀態：** ✅ 已完成（2026-08-09）

#### 實現摘要（與原計畫的差異）

- **位置調整**：隊列原語與 worker 合併於 `server/services/translationQueue.ts`（而非計畫中的 `server/jobs/`），因為翻譯處理邏輯本就來自 `translationOrchestrator.ts`，直接合併避免過度拆分
- **復用 `translation_jobs` 表作為隊列**（計畫允許的選項），無需新建隊列表；僅新增 3 個欄位：
  - `workerId` — 認領者（可歸因、可恢復）
  - `attempts` — 認領次數（重試計數）
  - `claimedAt` — 認領時間（過期回收依據）
  - 遷移：`drizzle/0004_next_whizzer.sql`
- **刪除** `server/services/translationOrchestrator.ts`（其 per-job 處理邏輯遷入 `processTranslationJob()`）

#### Task 3.1: 隊列數據模型與原語 ✅

- `server/db/translationJobs.ts` 新增：
  - `claimPendingTranslationJobs(workerId, limit)` — 單條 `UPDATE ... JOIN (SELECT ... LIMIT n)` 原子認領，並發 worker 不會重複認領同一任務
  - `resetStaleProcessingJobs(staleAfterMs)` — 過期認領回收（`claimedAt` 超過閾值 → 重置 pending）
  - `getDocumentIdsNeedingStatusRecompute()` — 找「文檔仍 processing 但 job 已終態」的恢復對象
  - `countPendingTranslationJobs()` — 隊列深度（供健康檢查）
- 全部經 `server/db.ts` barrel 導出

**驗收：** 隊列狀態持久化於 MySQL；原子 claim 防重複 ✅

#### Task 3.2: 翻譯 Worker ✅

- `server/services/translationQueue.ts`：
  - `startTranslationWorker()` — 3 秒輪詢、批次並發上限 3、`timer.unref()` 不阻擋進程退出、啟動即跑一輪
  - `kickTranslationWorker()` — 入隊後立即喚醒（`running` 守衛防重疊）
  - `processDueJobs()` — 每次 pass：過期回收 → 原子認領 → 逐個翻譯 → 聚合文檔狀態
  - `processTranslationJob()` — 原 orchestrator 的 per-job 邏輯（翻譯 → 預覽 HTML 上傳 → completed/failed）
- `documentWorkflowService.ts`：`dispatchTranslation()`（fire-and-forget 調 orchestrator）→ 直接 `kickTranslationWorker()`；create/retry 只負責把 job 置為 `pending` 後喚醒 worker
- `server/_core/index.ts`：啟動時先 `recoverStuckTranslationJobs()` 再 `startTranslationWorker()`；優雅關閉時 `stopTranslationWorker()`

**驗收：** 上傳/重試端點入隊後立即返回；翻譯由 worker 執行；重啟後 pending 任務被恢復 ✅

#### Task 3.3: 可觀測性與故障恢復 ✅

- **啟動自癒** `recoverStuckTranslationJobs()`：把 `processing` 任務全部釋放回隊列（單實例假設），並重算「doc 卡 processing 但 job 已終態」的文檔狀態
- **運行時兜底**：worker 每次 pass 都回收超過 10 分鐘的 stale claim（崩潰兜底）
- **健康檢查**：`/api/health` 新增 `translationQueue: healthy (N pending)`
- **日誌**：claim 批次、失敗原因、恢復結果
- 測試：`server/services/__tests__/translationQueue.test.ts`（claim→翻譯→完成→聚合、空輸出失敗、缺 segments 失敗、啟動恢復）

**驗收：** 失敗/重試可通過日誌診斷；stuck 任務自動恢復 ✅

#### 已知限制（有意為之）

- 啟動恢復會釋放**所有** `processing` 任務 —— 適用於當前單實例部署；多實例時應改用 lease 閾值（`resetStaleProcessingJobs(staleAfterMs)` 已支持）
- 批次內任務順序執行（與舊 orchestrator 的 for 循環行為一致）
- 失敗任務仍需管理員手動重試（自動重試 N 次後永久失敗的策略未引入，可後續以 `attempts` 欄位擴展）

---

### Phase 4: 清理遺留前端代碼

**目標：** 刪除已無實際入口的 `/admin/*` 頁面組件，減少維護負擔

**風險：** 低
**預估工時：** 0.5 天

#### Task 4.1: 審計並刪除遺留 admin 頁面

**現狀：** `App.tsx` 中所有 `/admin/*` 路由已重定向，但以下 6 個文件仍存在（共 1373 行）：
- `DocumentImageReview.tsx`（186 行）
- `DocumentList.tsx`（169 行）
- `DocumentUpload.tsx`（278 行）
- `GlossaryManager.tsx`（279 行）
- `TranslationJobs.tsx`（179 行）
- `UserManager.tsx`（282 行）

**操作：**
- [ ] 全局搜索確認這些文件沒有被任何活躍代碼 import
- [ ] 檢查是否有共享組件被 dashboard 頁面依賴（如果有，提取到 `client/src/components/`）
- [ ] 刪除 `client/src/pages/admin/` 目錄
- [ ] 刪除 `App.tsx` 中的重定向路由（或保留作為兼容，取決於是否有外部書籍標鏈接）
- [ ] 檢查 `client/src/components/AdminLayout.tsx` 是否仍被使用，如否則刪除

**驗收標準：**
- `client/src/pages/admin/` 目錄不再存在
- `pnpm build` 成功
- 無未使用的 import 警告

---

### Phase 5: 拆分過大的前端頁面

**目標：** 將兩個最大的頁面組件拆分為可維護的 feature 模塊

**風險：** 中
**預估工時：** 2–3 天

#### Task 5.1: 拆分 `DashboardCourses.tsx`（777 行）

**操作：**
- [ ] 建立 `client/src/features/dashboard-courses/` 目錄
- [ ] 提取 hooks：
  - `useCourses()` — 列表查詢 + 分頁
  - `useCreateCourse()` — 創建 mutation
  - `useDeleteCourse()` — 刪除 mutation
  - `useRetryTranslation()` — 重試 mutation
  - `useAttachImage()` — 圖片上傳 mutation
- [ ] 提取組件：
  - `CourseUploadForm.tsx` — 上傳表單（文件選擇 + 文字輸入 + 元數據）
  - `CourseListTable.tsx` — 課程列表表格
  - `CourseActions.tsx` — 發布/重試/刪除操作按鈕
  - `ImageReviewDialog.tsx` — 圖片審核對話框
- [ ] `DashboardCourses.tsx` 縮減為不超過 150 行的頁面編排器

**驗收標準：**
- `DashboardCourses.tsx` 不超過 150 行
- 每個提取的文件不超過 200 行
- 功能行為不變
- `pnpm build` 成功

#### Task 5.2: 拆分 `LearnView.tsx`（687 行）

**操作：**
- [ ] 建立 `client/src/features/learn-view/` 目錄
- [ ] 提取 hooks：
  - `useDocument(id)` — 文檔 + IR 加載
  - `useTranslation(documentId, language)` — 譯文加載 + 語言切換
  - `useExplain()` — AI 解釋 mutation
  - `useFeedback()` — 反饋提交 mutation
  - `useReadingProgress()` — 閱讀進度
- [ ] 提取組件：
  - `SourcePane.tsx` — 左欄原文
  - `TranslationPane.tsx` — 中欄譯文 + 語言切換
  - `InteractionPane.tsx` — 右欄互動面板（AI 解釋 + 反饋）
  - `HighlightSync.tsx` — 雙向高亮聯動邏輯
  - `DownloadButtons.tsx` — 下載按鈕組
- [ ] `LearnView.tsx` 縮減為不超過 150 行的頁面編排器

**驗收標準：**
- `LearnView.tsx` 不超過 150 行
- 每個提取的文件不超過 200 行
- 雙向高亮、AI 解釋、反饋、下載功能全部正常
- `pnpm build` 成功

---

## 三、優先級與排程建議

### 依賴關係

```
Phase 1 (殘留重複) ──────┐
                          ├──> Phase 3 (翻譯隊列)
Phase 2 (db.ts 拆分) ────┘
                          
Phase 4 (遺留清理) ──> Phase 5 (頁面拆分)
```

- Phase 1 和 Phase 2 可以並行（不同文件）
- Phase 3 依賴 Phase 2（隊列需要 `translationJobs` 倉庫已分離）
- Phase 4 和 Phase 5 可以並行，且不依賴後端階段
- Phase 4 應在 Phase 5 之前完成（避免拆分即將刪除的代碼）

### 建議衝刺安排

| 衝刺 | 任務 | 預估工時 |
|------|------|----------|
| Sprint 1 | Phase 1（Task 1.1 + 1.2）+ Phase 2（Task 2.1 + 2.2） | 2 天 |
| Sprint 2 | Phase 2（Task 2.3 + 2.4）+ Phase 4 | 2 天 |
| Sprint 3 | Phase 5（Task 5.1） | 1.5 天 |
| Sprint 4 | Phase 5（Task 5.2） | 1.5 天 |
| Sprint 5 | Phase 3（Task 3.1 + 3.2 + 3.3） | 3 天 |

**總預估工時：** 約 10 個工作日

### 最高優先級前三項

1. **Phase 2 — 拆分 `db.ts`**：影響所有後端開發效率，是進一步重構的基礎
2. **Phase 3 — 持久化翻譯隊列**：當前架構的最大可靠性風險
3. **Phase 5 — 拆分前端頁面**：影響前端開發效率和迭代速度

---

## 四、不應做的事

- ❌ 不要在拆分 `db.ts` 的同時改變查詢語義
- ❌ 不要在引入隊列的同時重寫翻譯邏輯
- ❌ 不要在未確認 import 關係的情況下刪除 admin 頁面
- ❌ 不要在拆分前端頁面的同時改變 UI 行為
- ❌ 不要跳過測試直接重構

---

## 五、退出標準

完成全部階段後，以下條件應全部滿足：

- [ ] 路由器層不存在重複的業務邏輯
- [ ] `server/db.ts` 要麼不存在，要麼是不超過 30 行的兼容 barrel
- [ ] 翻譯任務通過持久化隊列執行，服務器重啟不丟失進行中的工作
- [ ] `client/src/pages/admin/` 目錄不存在
- [ ] `DashboardCourses.tsx` 和 `LearnView.tsx` 各不超過 150 行
- [ ] `pnpm check`、`pnpm test`、`pnpm build` 全部通過
