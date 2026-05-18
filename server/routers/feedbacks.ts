/**
 * Feedbacks Router
 * Handles user feedback submission, personal history, and admin management.
 * Status: 0=未接收, 1=處理中, 2=已處理
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createFeedback,
  getFeedbacksByUser,
  listAllFeedbacks,
  updateFeedbackStatus,
  getFeedbackById,
} from "../db";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "管理員權限才能執行此操作" });
  }
  return next({ ctx });
});

export const feedbacksRouter = router({
  // ── Submit feedback (authenticated users) ─────────────────────────────────
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
        userName: ctx.user.name ?? "匿名用戶",
        originalText: input.originalText,
        translatedText: input.translatedText,
        targetLanguage: input.targetLanguage,
        feedbackType: input.feedbackType,
        feedbackContent: input.feedbackContent,
        status: 0, // 未接收
      });
      return { id, success: true };
    }),

  // ── Get current user's feedbacks ───────────────────────────────────────────
  myFeedbacks: protectedProcedure
    .input(z.object({ tutorialId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      return getFeedbacksByUser(ctx.user.id, input.tutorialId);
    }),

  // ── Admin: list all feedbacks with filters ─────────────────────────────────
  adminList: adminProcedure
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

  // ── Admin: update feedback status ──────────────────────────────────────────
  updateStatus: adminProcedure
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
        throw new TRPCError({ code: "NOT_FOUND", message: "反饋不存在" });
      }
      await updateFeedbackStatus(input.id, input.status, input.adminNote);
      return { success: true };
    }),

  // ── Admin: get single feedback detail ─────────────────────────────────────
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const fb = await getFeedbackById(input.id);
      if (!fb) throw new TRPCError({ code: "NOT_FOUND", message: "反饋不存在" });
      return fb;
    }),
});
