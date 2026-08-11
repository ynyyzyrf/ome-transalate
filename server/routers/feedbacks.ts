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
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createFeedback,
  getFeedbackById,
  getFeedbacksByUser,
  listAllFeedbacks,
  listDocuments,
  updateFeedbackStatus,
} from "../db";

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
  submit: protectedProcedure
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
        userId: ctx.user.id,
        userName: ctx.user.name ?? "匿名用户",
        originalText: input.originalText,
        translatedText: input.translatedText,
        targetLanguage: input.targetLanguage,
        feedbackType: input.feedbackType,
        feedbackContent: input.feedbackContent,
        status: 0,
      });
      return { id, success: true };
    }),

  myFeedbacks: protectedProcedure
    .input(z.object({ tutorialId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      return getFeedbacksByUser(ctx.user.id, input.tutorialId);
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
