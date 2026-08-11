import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import net from "net";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { closeDb, countPendingTranslationJobs, pingDb } from "../db";
import {
  recoverStuckTranslationJobs,
  startTranslationWorker,
  stopTranslationWorker,
} from "../services/translationQueue";
import { ENV } from "./env";
import { getLocalUploadsDir, resolveLocalStorageMode } from "../storage";
import {
  getProductionStaticDir,
  shouldExposeLocalUploads,
  shouldServeSpaFallback,
} from "./deployment";

// ─── Port Utilities ────────────────────────────────────────────────────────
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── Request Logger (replaces morgan) ──────────────────────────────────────
function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`;
    if (res.statusCode >= 500) {
      console.error(`[HTTP] ${line}`);
    } else if (res.statusCode >= 400) {
      console.warn(`[HTTP] ${line}`);
    } else {
      console.log(`[HTTP] ${line}`);
    }
  });
  next();
}

// ─── CORS Middleware ────────────────────────────────────────────────────────
function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  // Allow frontend origins (dev on 5173, prod configured via env)
  const allowedOrigins = [
    "http://localhost:5173",
    `http://localhost:${ENV.PORT}`,
    ENV.FRONTEND_URL,
  ].filter(Boolean) as string[];

  if (ENV.isDevelopment || !origin || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

// ─── Security Headers (lightweight helmet alternative) ─────────────────────
function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0"); // Deprecated but still set for older browsers
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!ENV.isDevelopment) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

// ─── Global Error Handler ──────────────────────────────────────────────────
function globalErrorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[Error]", err.message, err.stack);
  res.status(500).json({
    error: ENV.isProduction ? "Internal server error" : err.message,
    ...(ENV.isDevelopment ? { stack: err.stack } : {}),
  });
}

// ─── Server Startup ────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Middleware Stack ────────────────────────────────────────────────────────

  // 1. Request logging (first to capture all requests)
  app.use(requestLogger);

  // 2. CORS
  app.use(corsMiddleware);

  // 3. Security headers
  app.use(securityHeaders);

  // 4. Health check (before body parser to keep it lightweight)
  app.get("/api/health", async (_req, res) => {
    const dbOk = await pingDb();
    const queueDepth = dbOk ? await countPendingTranslationJobs().catch(() => null) : null;
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? "healthy" : "unavailable",
        translationQueue:
          queueDepth !== null ? `healthy (${queueDepth} pending)` : "unavailable",
      },
    });
  });

  // 5. Local uploads (development only — serves files from server/uploads/)
  const useLocalStorage = resolveLocalStorageMode({
    forgeApiUrl: ENV.forgeApiUrl,
    forgeApiKey: ENV.forgeApiKey,
    isDevelopment: ENV.isDevelopment,
    uploadsDir: ENV.UPLOADS_DIR,
  });

  if (shouldExposeLocalUploads({ isDevelopment: ENV.isDevelopment, useLocalStorage })) {
    const uploadsDir = getLocalUploadsDir();
    app.use("/uploads", express.static(uploadsDir));
    console.log(`[Server] Local uploads served from ${uploadsDir}`);
  }

  // 6. Body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // 7. OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // 8. tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (ENV.isProduction) {
    const distPublicDir = getProductionStaticDir();
    app.use(express.static(distPublicDir));
    app.get("*", (req, res, next) => {
      if (!shouldServeSpaFallback(req.path)) {
        return next();
      }
      res.sendFile(path.join(distPublicDir, "index.html"));
    });
  }

  // 9. Global error handler (last)
  app.use(globalErrorHandler);

  // ── Translation Queue (persistent, crash-recoverable) ─────────────────────
  // Self-heal jobs stuck from a previous process, then start the worker that
  // picks up "pending" translation jobs and translates them in the background.
  await recoverStuckTranslationJobs().catch((err) => {
    console.error("[Queue] startup recovery failed:", err);
  });
  startTranslationWorker();

  // ── Start Listening ─────────────────────────────────────────────────────────
  const preferredPort = ENV.PORT;
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`[Server] Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[Server] Running on http://localhost:${port}/ (${ENV.NODE_ENV})`);
  });

  // ── Graceful Shutdown ───────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
    stopTranslationWorker();
    server.close(async () => {
      console.log("[Server] HTTP server closed");
      await closeDb();
      console.log("[Server] Database pool closed");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[Server] Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
