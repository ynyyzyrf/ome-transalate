# Zeabur Deployment Readiness Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make this project deploy reliably on Zeabur as a single web service backed by MySQL and production-safe file storage.

**Architecture:** Deploy the existing Node/TypeScript app with the repository `Dockerfile` so Zeabur builds one container that serves the Express API and the built Vite frontend on the same domain. Use Zeabur MySQL for relational data, and use either external object storage or an attached persistent volume for uploaded files and generated previews.

**Tech Stack:** Zeabur, Docker, Node.js 20, pnpm, Vite, Express, tRPC, Drizzle ORM, MySQL

---

### Task 1: Close the production web-serving gap

**Files:**
- Modify: `server/_core/index.ts`
- Verify: `dist/public/index.html`
- Verify: `package.json`

- [ ] **Step 1: Confirm the production build already emits frontend assets**

Run:

```powershell
pnpm build
Test-Path dist/public/index.html
```

Expected:

```text
True
```

- [ ] **Step 2: Add production static file serving to the Express server**

Update `server/_core/index.ts` so production mode serves `dist/public` and falls back to `index.html` for non-API routes. Keep `/api/*` handling above the SPA fallback.

Target shape:

```ts
import path from "node:path";

const distPublicDir = path.join(process.cwd(), "dist", "public");

if (ENV.isProduction) {
  app.use(express.static(distPublicDir));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    if (req.path.startsWith("/uploads/")) return next();
    res.sendFile(path.join(distPublicDir, "index.html"));
  });
}
```

- [ ] **Step 3: Verify the built server can render the SPA entry in production mode**

Run:

```powershell
pnpm build
$env:NODE_ENV='production'
$env:PORT='3000'
node dist/index.js
```

Then verify from another shell:

```powershell
Invoke-WebRequest http://localhost:3000/ | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest http://localhost:3000/api/health | Select-Object -ExpandProperty StatusCode
```

Expected:

```text
200
200
```

- [ ] **Step 4: Commit the serving fix**

```bash
git add server/_core/index.ts
git commit -m "fix: serve frontend assets in production"
```

### Task 2: Choose and implement the production file storage strategy

**Files:**
- Modify: `server/storage.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Decide between external object storage and persistent disk**

Recommended choice: keep cloud/object storage in production.

Reason:

```text
Current production code disables local storage when Forge storage credentials are absent, and /uploads is only served in development.
```

Decision matrix:

```text
Option A (recommended): keep BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY and let uploads/previews live outside the container.
Option B: add a Zeabur persistent volume and explicitly support local uploads in production.
```

- [ ] **Step 2: If using Option A, document required production env vars**

Ensure `.env.example` and `README.md` clearly mark these as required for production uploads:

```env
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
FRONTEND_URL=https://your-zeabur-domain
```

- [ ] **Step 3: If using Option B, add explicit production local-storage support**

Modify `server/storage.ts` and `server/_core/index.ts` to allow a mounted uploads directory in production.

Target shape:

```ts
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "server", "uploads");

function useLocalStorage(): boolean {
  if (ENV.forgeApiUrl && ENV.forgeApiKey) return false;
  return true;
}
```

And serve uploads in both development and production when local storage is active:

```ts
app.use("/uploads", express.static(getLocalUploadsDir()));
```

- [ ] **Step 4: Verify upload URLs resolve correctly under the Zeabur domain**

Run:

```powershell
pnpm test server/assetUrls.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the storage strategy changes**

```bash
git add server/storage.ts server/_core/index.ts .env.example README.md
git commit -m "feat: prepare production file storage for zeabur"
```

### Task 3: Make database migration execution deterministic on Zeabur

**Files:**
- Modify: `package.json`
- Verify: `drizzle.config.ts`
- Verify: `drizzle/*.sql`

- [ ] **Step 1: Separate deploy-time migration from local schema generation**

Replace the current deploy-facing migration command with a deterministic command that applies committed SQL only.

Target script block:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "pnpm db:generate && pnpm db:migrate"
  }
}
```

- [ ] **Step 2: Verify migrations run against a real MySQL URL**

Run:

```powershell
$env:DATABASE_URL='mysql://user:password@host:3306/dbname'
pnpm db:migrate
```

Expected:

```text
Drizzle connects and applies only committed migration files from ./drizzle
```

- [ ] **Step 3: Confirm the latest migration set is complete**

Run:

```powershell
Get-ChildItem drizzle\*.sql | Select-Object Name
```

Expected:

```text
All committed SQL migrations, including the latest 0004 file, are present and intended for production
```

- [ ] **Step 4: Commit the migration command cleanup**

```bash
git add package.json README.md
git commit -m "chore: add deterministic migration command for deploys"
```

### Task 4: Configure Zeabur services and environment

**Files:**
- Verify: `Dockerfile`
- Verify: `.env.example`
- Verify: `server/_core/env.ts`

- [ ] **Step 1: Create the Zeabur resources**

Create:

```text
1. One Web Service from this Git repository
2. One MySQL service in the same Zeabur project
3. Optional persistent volume only if Task 2 chooses local storage
```

- [ ] **Step 2: Use Docker deployment mode**

Zeabur should build from the repository `Dockerfile`.

Key commands already present:

```text
Build: pnpm build
Start: node dist/index.js
Port: use Zeabur PORT env
```

- [ ] **Step 3: Configure the required environment variables in Zeabur**

Set:

```env
DATABASE_URL=<Zeabur MySQL connection string>
JWT_SECRET=<random 32+ char secret>
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://<your-zeabur-domain>
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=<if using OpenAI>
```

Set these when the matching features are enabled:

```env
OPENAI_BASE_URL=
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
MINERU_BASE_URL=https://mineru.net
MINERU_TIMEOUT_SECONDS=120
MINERU_API_KEY=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
OAUTH_SERVER_URL=
VITE_APP_ID=
OWNER_OPEN_ID=
UPLOADS_DIR=/data/uploads
```

- [ ] **Step 4: Run migrations before routing production traffic**

Use Zeabur shell or a pre-deploy job:

```powershell
pnpm db:migrate
```

Expected:

```text
Database schema matches the committed Drizzle migrations before the app begins serving requests
```

- [ ] **Step 5: Commit any Zeabur-specific docs updates**

```bash
git add README.md .env.example
git commit -m "docs: add zeabur deployment configuration"
```

### Task 5: Execute post-deploy smoke tests

**Files:**
- Verify: deployed Zeabur URL
- Verify: Zeabur logs

- [ ] **Step 1: Verify the health endpoint**

Run:

```powershell
Invoke-WebRequest https://<your-zeabur-domain>/api/health | Select-Object -ExpandProperty Content
```

Expected:

```json
{"status":"ok","checks":{"database":"healthy"}}
```

- [ ] **Step 2: Verify the SPA loads on the root route**

Run:

```powershell
Invoke-WebRequest https://<your-zeabur-domain>/ | Select-Object -ExpandProperty StatusCode
```

Expected:

```text
200
```

- [ ] **Step 3: Verify one authenticated admin flow and one uploaded asset**

Check:

```text
1. Dashboard login succeeds
2. Document list loads
3. One preview/uploaded asset URL returns 200
4. One translation request reaches the configured model provider
```

- [ ] **Step 4: Check Zeabur logs for deployment-specific regressions**

Look for:

```text
Missing env vars
Database connection failures
Storage proxy credential errors
404s on frontend routes
404s on /uploads/*
```

- [ ] **Step 5: Commit any final deployment fixes**

```bash
git add .
git commit -m "fix: complete zeabur deployment readiness"
```

## Self-Review

**1. Spec coverage:** This plan covers deployability assessment, Zeabur service layout, production serving, storage, migrations, env setup, and post-deploy verification.

**2. Placeholder scan:** Replaced vague deployment advice with concrete files, commands, env vars, and verification steps.

**3. Type consistency:** The plan uses the existing repo entrypoints and env names: `server/_core/index.ts`, `server/storage.ts`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-zeabur-deployment.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
