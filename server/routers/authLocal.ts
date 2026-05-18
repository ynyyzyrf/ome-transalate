import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { ENV } from "../_core/env";
import * as db from "../db";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

// ─── Password Hashing (using Node crypto) ──────────────────────────────────
// Note: In Phase 2, this will be upgraded to bcrypt.

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return computed === hash;
}

// ─── JWT Helpers ────────────────────────────────────────────────────────────

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "multilingual-training-platform";
const ACCESS_TOKEN_EXPIRY = "8h";
const REFRESH_TOKEN_EXPIRY = "7d";

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(ENV.JWT_SECRET);
}

export type LocalTokenPayload = {
  userId: number;
  email: string;
  role: string;
  type: "access" | "refresh";
};

async function signToken(payload: Omit<LocalTokenPayload, "type">, expiresIn: string): Promise<string> {
  return new SignJWT({ ...payload, type: "access" } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

async function signRefreshToken(payload: Omit<LocalTokenPayload, "type">): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyLocalToken(token: string): Promise<LocalTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { issuer: JWT_ISSUER });
    if (!payload.userId || !payload.email) return null;
    return payload as unknown as LocalTokenPayload;
  } catch {
    return null;
  }
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
  name: z.string().min(1, "Name is required").max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Router ─────────────────────────────────────────────────────────────────

export const authLocalRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ input }) => {
    const { email, password, name } = input;

    // Check if email already exists
    const existing = await db.getUserByEmail(email);
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account with this email already exists",
      });
    }

    // Create user
    const passwordHash = hashPassword(password);
    const userId = await db.createLocalUser({ email, passwordHash, name });

    // Sign tokens
    const user = await db.getUserByEmail(email);
    const payload = { userId, email, role: user?.role || "user" };
    const accessToken = await signToken(payload, ACCESS_TOKEN_EXPIRY);
    const refreshToken = await signRefreshToken(payload);

    return {
      user: { id: userId, email, name: name || email.split("@")[0], role: "user" },
      accessToken,
      refreshToken,
    };
  }),

  login: publicProcedure.input(loginSchema).mutation(async ({ input }) => {
    const { email, password } = input;

    const user = await db.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    // Update last signed in
    await db.updateUserLastSignedIn(user.id);

    const payload = { userId: user.id, email: user.email!, role: user.role };
    const accessToken = await signToken(payload, ACCESS_TOKEN_EXPIRY);
    const refreshToken = await signRefreshToken(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || email.split("@")[0],
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }),

  refresh: publicProcedure.input(refreshSchema).mutation(async ({ input }) => {
    const payload = await verifyLocalToken(input.refreshToken);
    if (!payload || payload.type !== "refresh") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired refresh token",
      });
    }

    // Verify user still exists
    const user = await db.getUserByEmail(payload.email);
    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User no longer exists",
      });
    }

    const tokenPayload = { userId: user.id, email: user.email!, role: user.role };
    const accessToken = await signToken(tokenPayload, ACCESS_TOKEN_EXPIRY);
    const refreshToken = await signRefreshToken(tokenPayload);

    return { accessToken, refreshToken };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
      preferredLanguage: ctx.user.preferredLanguage,
    };
  }),
});
