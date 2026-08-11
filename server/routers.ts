import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  DASHBOARD_COOKIE,
  signDashboardToken,
} from "./_core/dashboardAuth";
import { LOCAL_SESSION_COOKIE, signLocalSessionToken } from "./_core/localAuth";
import { hashPassword, verifyPassword } from "./_core/password";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createLocalUser, getAdminByUsername, getUserByEmail, updateUserLastSignedIn } from "./db";
import { documentsRouter } from "./routers/documents";
import { glossaryRouter } from "./routers/glossary";
import { aiRouter, translationJobsRouter, userRouter, usersAdminRouter } from "./routers/ai";
import { feedbacksRouter } from "./routers/feedbacks";
import { dashboardRouter } from "./routers/dashboard";
import { coursesRouter } from "./routers/courses";
import { authLocalRouter } from "./routers/authLocal";
import { authOidcRouter } from "./routers/authOidc";
import { progressRouter } from "./routers/progress";
import { exercisesRouter } from "./routers/exercises";

/** Cookie options for the local (learner) session cookie. */
function getLocalCookieOptions(req: any) {
  const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: 8 * 60 * 60 * 1000, // 8 hours (milliseconds)
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    /**
     * Unified login: accepts either a dashboard admin username or a learner email.
     * - Matches admin_accounts by username → sets dashboard_session cookie → admin.
     * - Otherwise matches users by email (with passwordHash) → sets local_session cookie → user.
     * Returns the role so the client routes admin→/dashboard, user→/learn.
     */
    login: publicProcedure
      .input(
        z.object({
          identifier: z.string().min(1).max(320),
          password: z.string().min(1).max(256),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const identifier = input.identifier.trim();

        // 1) Dashboard admin (username)
        const admin = await getAdminByUsername(identifier);
        if (admin) {
          if (!verifyPassword(input.password, admin.passwordHash)) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號或密碼錯誤" });
          }
          const token = await signDashboardToken({
            adminId: admin.id,
            username: admin.username,
            displayName: admin.displayName,
          });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(DASHBOARD_COOKIE, token, {
            ...cookieOptions,
            maxAge: 8 * 60 * 60 * 1000,
          });
          return {
            role: "admin" as const,
            redirect: "/dashboard",
            admin: {
              id: admin.id,
              username: admin.username,
              displayName: admin.displayName,
            },
          };
        }

        // 2) Learner (email, local loginMethod)
        const user = await getUserByEmail(identifier);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號或密碼錯誤" });
        }
        if (!verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號或密碼錯誤" });
        }

        await updateUserLastSignedIn(user.id);

        const token = await signLocalSessionToken({
          userId: user.id,
          email: user.email ?? identifier,
          role: user.role,
        });
        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, getLocalCookieOptions(ctx.req));

        return {
          role: user.role,
          redirect: user.role === "admin" ? "/dashboard" : "/learn",
          user: {
            id: user.id,
            email: user.email,
            name: user.name || user.email || identifier,
            role: user.role,
          },
        };
      }),

    /**
     * Learner registration (email + password).
     * Creates a local learner account (role=user) and signs them in immediately
     * with the same local_session cookie as auth.login, then routes to /learn.
     */
    register: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email(),
          password: z.string().min(6).max(256),
          name: z.string().min(1).max(100).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const existing = await getUserByEmail(email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "此郵箱已被註冊" });
        }

        const passwordHash = hashPassword(input.password);
        const userId = await createLocalUser({ email, passwordHash, name: input.name });

        const token = await signLocalSessionToken({
          userId,
          email,
          role: "user",
        });
        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, getLocalCookieOptions(ctx.req));

        return {
          role: "user" as const,
          redirect: "/learn",
          user: {
            id: userId,
            email,
            name: input.name || email.split("@")[0] || email,
            role: "user",
          },
        };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      // Clear the local session cookie too so learners can sign out.
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 });
      // Clear the dashboard admin session cookie so admins can sign out from any page.
      ctx.res.clearCookie(DASHBOARD_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  documents: documentsRouter,
  glossary: glossaryRouter,
  ai: aiRouter,
  translationJobs: translationJobsRouter,
  user: userRouter,
  usersAdmin: usersAdminRouter,
  // New modules
  feedbacks: feedbacksRouter,
  dashboard: dashboardRouter,
  courses: coursesRouter,
  // Local email+password authentication
  authLocal: authLocalRouter,
  // OIDC SSO login (placeholder — see authOidc.ts for implementation guide)
  authOidc: authOidcRouter,
  // Learning progress tracking
  progress: progressRouter,
  // Exercises / quizzes
  exercises: exercisesRouter,
});

export type AppRouter = typeof appRouter;
