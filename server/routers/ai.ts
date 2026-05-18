/**
 * AI Router
 * Handles AI explanation requests and translation job management.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { listAllTranslationJobs, listUsers, updateUserLanguage, updateUserRole } from "../db";
import { explainSegment, type ExplainContext } from "../translationEngine";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "管理員權限才能執行此操作" });
  }
  return next({ ctx });
});

export const aiRouter = router({
  // ── AI Explain segment ─────────────────────────────────────────────────────
  explain: publicProcedure
    .input(
      z.object({
        originalText: z.string().min(1).max(2000),
        translatedText: z.string().min(1).max(2000),
        targetLanguage: z.string().min(1),
        context: z
          .object({
            precedingSegments: z
              .array(z.object({ original: z.string(), translated: z.string() }))
              .max(3)
              .optional(),
            followingSegments: z
              .array(z.object({ original: z.string(), translated: z.string() }))
              .max(2)
              .optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const explanation = await explainSegment(
        input.originalText,
        input.translatedText,
        input.targetLanguage,
        input.context as ExplainContext | undefined
      );
      return { explanation };
    }),
});

export const translationJobsRouter = router({
  // ── Admin: List all translation jobs ──────────────────────────────────────
  listAll: adminProcedure
    .input(z.object({ page: z.number().min(1).default(1), pageSize: z.number().default(30) }))
    .query(async ({ input }) => {
      return listAllTranslationJobs(input.page, input.pageSize);
    }),
});

export const userRouter = router({
  // ── Update preferred language ──────────────────────────────────────────────
  setLanguage: protectedProcedure
    .input(z.object({ language: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      await updateUserLanguage(ctx.user.id, input.language);
      return { success: true };
    }),
});

export const usersAdminRouter = router({
  // ── Admin: List all users ─────────────────────────────────────────────────
  list: adminProcedure
    .input(z.object({ page: z.number().min(1).default(1), pageSize: z.number().default(30) }))
    .query(async ({ input }) => {
      return listUsers(input.page, input.pageSize);
    }),

  // ── Admin: Update user role ───────────────────────────────────────────────
  setRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["admin", "user"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Prevent self-demotion to avoid locking out the only admin
      if (input.userId === ctx.user.id && input.role === "user") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "無法降級自己的管理員權限，請由其他管理員操作",
        });
      }
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),
});
