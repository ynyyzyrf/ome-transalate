/**
 * Feedbacks Router
 * Handles user feedback submission, personal history, and admin management.
 *
 * Admin endpoints accept both platform admin sessions and dashboard admin sessions
 * via a shared mixed-auth procedure (same pattern as the glossary router).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  canManageGlossary,
  resolvePrincipal,
} from "../_core/authz";
import type { AuthPrincipal } from "../_core/authTypes";
import { publicProcedure, router } from "../_core/trpc";
import {
  createFeedback,
  getFeedbackById,
  getFeedbacksByUser,
  listAllFeedbacks,
  listDocuments,
  updateFeedbackStatus,
} from "../db";

/**
 * Map a resolved principal to a feedbacks.userId value.
 *
 * Learners and platform admins carry a users.id (positive). Dashboard admins
 * live in `admin_accounts`, not `users` — store their feedback under a negative
 * sentinel (-adminId) so the id can never collide with a learner's users.id,
 * and `getFeedbacksByUser(-adminId)` retrieves exactly their own records.
 */
function feedbackUserId(principal: Exclude<AuthPrincipal, { kind: "anonymous" }>): number {
  if (principal.kind === "dashboard_admin") return -principal.adminId;
  return principal.userId;
}

function feedbackUserName(
  principal: Exclude<AuthPrincipal, { kind: "anonymous" }>,
  fallback: string
): string {
  if (principal.kind === "dashboard_admin") {
    return principal.displayName ?? principal.username ?? fallback;
  }
  return fallback;
}

/**
 * Mixed-auth middleware that accepts either a learner / platform admin
 * (ctx.user) or a dashboard admin (ctx.dashboardSession), so front-end
 * learners AND dashboard admins can submit feedback without an extra login.
 */
const feedbackSubmitProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const principal = resolvePrincipal(ctx);
  if (principal.kind === "anonymous") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
  }
  return next({ ctx: { ...ctx, principal } });
});

/**
 * Mixed-auth middleware that accepts either platform admins or dashboard admins.
 * This mirrors the glossary router's approach so both the old admin path and the
 * new dashboard path can manage feedbacks through a single set of endpoints.
 */
const feedbackAdminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const principal = resolvePrincipal(ctx);
  if (!canManageGlossary(principal)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
  }
  return next({ ctx });
});

export const feedbacksRouter = router({
  submit: feedbackSubmitProcedure
    .input(
      z.object({
        tutorialId: z.number(),
        tutorialTitle: z.string().max(512),
        originalText: z.string().min(1),
        translatedText: z.string().min(1),
        targetLanguage: z.string().max(16),
        feedbackType: z.enum(["suggestion", "question"]).default("suggestion"),
        feedbackContent: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await createFeedback({
        tutorialId: input.tutorialId,
        tutorialTitle: input.tutorialTitle,
        userId: feedbackUserId(ctx.principal),
        userName: feedbackUserName(ctx.principal, ctx.user?.name ?? "匿名用户"),
        originalText: input.originalText,
        translatedText: input.translatedText,
        targetLanguage: input.targetLanguage,
        feedbackType: input.feedbackType,
        feedbackContent: input.feedbackContent,
        status: 0,
      });
      return { id, success: true };
    }),

  myFeedbacks: feedbackSubmitProcedure
    .input(z.object({ tutorialId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      return getFeedbacksByUser(feedbackUserId(ctx.principal), input.tutorialId);
    }),

  adminList: feedbackAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(30),
        tutorialId: z.number().optional(),
        status: z.number().min(0).max(2).optional(),
      })
    )
    .query(async ({ input }) => {
      return listAllFeedbacks({
        page: input.page,
        pageSize: input.pageSize,
        tutorialId: input.tutorialId,
        status: input.status,
      });
    }),

  updateStatus: feedbackAdminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.number().min(0).max(2),
        adminNote: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await getFeedbackById(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "反馈不存在" });
      }

      await updateFeedbackStatus(input.id, input.status, input.adminNote);
      return { success: true };
    }),

  getById: feedbackAdminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const feedback = await getFeedbackById(input.id);
      if (!feedback) {
        throw new TRPCError({ code: "NOT_FOUND", message: "反馈不存在" });
      }

      return feedback;
    }),

  listCourses: feedbackAdminProcedure.query(async () => {
    const result = await listDocuments(1, 200);
    return result.items.map((d: any) => ({ id: d.id, title: d.title }));
  }),
});
