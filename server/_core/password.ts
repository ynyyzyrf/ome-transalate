import crypto from "crypto";

/**
 * scrypt password hashing, shared by admin accounts (dashboard) and local users.
 * Format: `${salt}:${hash}` — salt is 16 random bytes hex, hash is 64 bytes hex.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return computed === hash;
}
