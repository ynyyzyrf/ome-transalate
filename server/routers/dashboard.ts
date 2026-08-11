/**
 * Dashboard Router
 * Handles independent admin dashboard authentication (username/password).
 * Separate from the main Manus OAuth flow.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { dashboardProcedure, signDashboardToken, DASHBOARD_COOKIE, getDashboardSessionFromCookieHeader } from "../_core/dashboardAuth";
import { ENV } from "../_core/env";
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
  // Resolves the dashboard session from the cookie directly (publicProcedure, not
  // dashboardProcedure): a missing dashboard session is a normal state (anonymous
  // / learner), not an error. Returns the session or null, mirroring auth.me's
  // behavior for ctx.user. Guarding admin endpoints stays on dashboardProcedure;
  // callers here just check `data`.
  me: publicProcedure.query(async ({ ctx }) => {
    return (
      ctx.dashboardSession ??
      (await getDashboardSessionFromCookieHeader(ctx.req.headers.cookie as string | undefined)) ??
      null
    );
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
      // Setup key comes from the environment (DASHBOARD_SETUP_KEY). The endpoint is
      // disabled entirely when no key is configured, and only works before the first
      // admin account exists — never as a backdoor after bootstrap.
      const configuredKey = ENV.DASHBOARD_SETUP_KEY;
      if (!configuredKey) {
        throw new TRPCError({ code: "FORBIDDEN", message: "設定功能未啟用" });
      }
      if (input.setupKey !== configuredKey) {
        throw new TRPCError({ code: "FORBIDDEN", message: "無效的設置密鑰" });
      }

      const admins = await listAdminAccounts();
      if (admins.length > 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "系統已配置管理員" });
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
