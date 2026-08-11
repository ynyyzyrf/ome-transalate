import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "../_core/env";

// ─── Connection Pool ───────────────────────────────────────────────────────
let _pool: mysql.Pool | null = null;
let _db: any = null;

export class DatabaseError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class DatabaseNotAvailableError extends DatabaseError {
  constructor() {
    super("Database is not available");
    this.name = "DatabaseNotAvailableError";
  }
}

function createPool(): mysql.Pool {
  const url = new URL(ENV.databaseUrl);
  const pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
  return pool;
}

export async function getPool(): Promise<mysql.Pool> {
  if (!_pool) {
    _pool = createPool();
    _db = drizzle(_pool);
  }
  return _pool;
}

export async function getDb() {
  if (!_db) {
    const pool = await getPool();
    _db = drizzle(pool);
  }
  return _db;
}

export function getInsertId(result: unknown): number {
  const first = Array.isArray(result) ? result[0] : undefined;
  const id = (first as { insertId?: unknown } | undefined)?.insertId;
  return typeof id === "number" ? id : Number(id ?? 0);
}

/**
 * Helper that wraps DB operations with consistent error handling.
 * Throws DatabaseNotAvailableError if DB is down.
 * Wraps unexpected errors in DatabaseError.
 */
export async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await getPool();
    if (!_db) throw new DatabaseNotAvailableError();
    return await fn();
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    // Check for connection-related errors
    if (err instanceof Error && (
      err.message?.includes("ECONNREFUSED") ||
      err.message?.includes("ETIMEDOUT") ||
      err.message?.includes("getaddrinfo") ||
      err.message?.includes("Pool is closed")
    )) {
      throw new DatabaseError("Database connection failed", err);
    }
    throw err; // Re-throw unexpected errors as-is
  }
}

/**
 * Check if database is reachable (used by health check).
 */
export async function pingDb(): Promise<boolean> {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the database pool (used during graceful shutdown).
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
