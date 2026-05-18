# 企業多語言培訓智能本地化學習平台

一個基於 AI 的全棧多語言培訓內容本地化平台，支持將中文培訓文檔自動翻譯為多種目標語言，並提供三欄對比學習視圖。

**技術棧：** React 19 + TypeScript + Express 4 + tRPC 11 + Drizzle ORM + MySQL + Tailwind CSS 4

## 項目架構

```
multilingual-training-platform/
├── client/                  # 前端 React 應用（Vite 構建）
│   └── src/
│       ├── pages/           # 頁面組件
│       ├── components/      # 可重用組件（基於 shadcn/ui）
│       └── lib/trpc.ts      # tRPC 客戶端
├── server/                  # 後端 Express + tRPC 服務
│   ├── _core/               # 框架核心
│   ├── routers/             # tRPC 路由器（按功能模塊拆分）
│   └── db.ts                # 資料庫查詢層
├── drizzle/                 # 資料庫 Schema 與遷移文件
├── shared/                  # 前後端共用類型與常量
└── docker-compose.yml        # Docker 部署配置
```

## 核心功能

- **AI 翻譯引擎** — 中文 → 英文（中間層） → 目標語言（西班牙語/泰文/印地語/越南文），注入術語庫確保一致性
- **三欄對比學習視圖** — 原文/譯文/術語解釋三欄同步，點擊段落雙向高亮聯動
- **文件解析管道** — 支持 PDF/DOCX/XLSX/PPTX/圖片（LLM Vision OCR）
- **術語庫管理** — CSV 批量導入，多語言術語條目 CRUD
- **雙後台系統** — Manus OAuth 管理後台 + 獨立帳號密碼後台
- **Docker 一鍵部署** — 提供完整的 docker-compose.yml

## 技術棧

| 技術 | 用途 |
|------|------|
| React 19 | 前端框架 |
| TypeScript 5 | 類型系統 |
| Vite 7 | 前端構建 |
| Express 4 | 後端 HTTP 服務 |
| tRPC 11 | 端對端類型安全 API |
| Drizzle ORM | 資料庫 ORM |
| MySQL | 資料庫 |
| Tailwind CSS 4 | CSS 框架 |
| shadcn/ui | UI 組件庫 |
| Zod 4 | 輸入驗證 |
| Vitest | 單元測試 |

## 本地開發

```bash
# 1. 安裝依賴
pnpm install

# 2. 配置環境變量
cp .env.example .env
# 編輯 .env 填入必要配置（DATABASE_URL、JWT_SECRET 等）

# 3. 初始化資料庫
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# 4. 啟動開發服務器（端口 3000）
pnpm dev

# 5. 執行測試
pnpm test
```

## 環境變量

| 環境變量 | 說明 | 必填 |
|----------|------|------|
| `DATABASE_URL` | MySQL 連接字串 | 是 |
| `JWT_SECRET` | Session Cookie 簽名密鑰 | 是 |
| `BUILT_IN_FORGE_API_URL` | LLM API 基礎 URL | 是 |
| `BUILT_IN_FORGE_API_KEY` | LLM API Bearer Token | 是 |
| `VITE_FRONTEND_FORGE_API_KEY` | LLM API Key（前端） | 是 |
| `VITE_FRONTEND_FORGE_API_URL` | LLM API URL（前端） | 是 |

完整環境變量說明請參閱 `.env.example`。

## Docker 部署

```bash
docker-compose up -d
```

## 頁面路由

| 路徑 | 說明 |
|------|------|
| `/` | 平台首頁 |
| `/language-select` | 語言選擇 |
| `/learn` | 學習門戶（教程列表） |
| `/learn/:id` | 三欄對比學習視圖 |
| `/admin/*` | Manus OAuth 管理後台 |
| `/dashboard/*` | 獨立帳號密碼後台 |
