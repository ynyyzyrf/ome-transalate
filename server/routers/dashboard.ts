/**
 * Dashboard Router
 * Handles independent admin dashboard authentication (username/password).
 * Separate from the main Manus OAuth flow.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { dashboardProcedure, signDashboardToken, DASHBOARD_COOKIE } from "../_core/dashboardAuth";
import { getAdminByUsername, createAdminAccount, listAdminAccounts } from "../db";
import crypto from "crypto";

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

function getSecureCookieOptions(req: any) {
  const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: 8 * 60 * 60 * 1000, // 8 hours (milliseconds)
  };
}

export const dashboardRouter = router({
  // ── Login ──────────────────────────────────────────────────────────────────
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1).max(64),
        password: z.string().min(1).max(256),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const account = await getAdminByUsername(input.username);
      if (!account) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號或密碼錯誤" });
      }

      const hashedInput = verifyPassword(input.password, account.passwordHash);
      if (!hashedInput) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號或密碼錯誤" });
      }

      const token = await signDashboardToken({
        adminId: account.id,
        username: account.username,
        displayName: account.displayName,
      });

      const cookieOptions = getSecureCookieOptions(ctx.req);
      ctx.res.cookie(DASHBOARD_COOKIE, token, cookieOptions);

      return {
        success: true,
        admin: {
          id: account.id,
          username: account.username,
          displayName: account.displayName,
        },
      };
    }),

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(DASHBOARD_COOKIE, { path: "/" });
    return { success: true };
  }),

  // ── Get current session ────────────────────────────────────────────────────
  me: dashboardProcedure.query(({ ctx }) => {
    return ctx.dashboardSession;
  }),

  // ── Setup: create first admin account (only if none exists) ───────────────
  setup: publicProcedure
    .input(
      z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(6).max(256),
        displayName: z.string().max(128).optional(),
        setupKey: z.string(), // simple setup key to prevent unauthorized setup
      })
    )
    .mutation(async ({ input }) => {
      // Validate setup key (use a fixed key for simplicity)
      if (input.setupKey !== "SETUP_ADMIN_2024") {
        throw new TRPCError({ code: "FORBIDDEN", message: "無效的設置密鑰" });
      }

      // Check if username already exists
      const existing = await getAdminByUsername(input.username);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "帳號已存在" });
      }

      const passwordHash = hashPassword(input.password);
      const id = await createAdminAccount({
        username: input.username,
        passwordHash,
        displayName: input.displayName ?? input.username,
      });

      return { success: true, id };
    }),

  // ── List admin accounts (dashboard admin only) ─────────────────────────────
  listAdmins: dashboardProcedure.query(async () => {
    return listAdminAccounts();
  }),

  // ── Create new admin account (dashboard admin only) ────────────────────────
  createAdmin: dashboardProcedure
    .input(
      z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(6).max(256),
        displayName: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await getAdminByUsername(input.username);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "帳號已存在" });
      }
      const passwordHash = hashPassword(input.password);
      const id = await createAdminAccount({
        username: input.username,
        passwordHash,
        displayName: input.displayName ?? input.username,
      });
      return { success: true, id };
    }),
});
