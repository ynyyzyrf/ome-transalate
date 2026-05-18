/**
 * Dashboard Feedbacks Router
 * Admin feedback management via dashboard session (not OAuth).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { dashboardProcedure } from "../_core/dashboardAuth";
import {
  listAllFeedbacks,
  updateFeedbackStatus,
  getFeedbackById,
  listDocuments,
} from "../db";

export const dashboardFeedbacksRouter = router({
  // ── List feedbacks with filters ────────────────────────────────────────────
  list: dashboardProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(30),
        tutorialId: z.number().optional(),
        status: z.number().min(0).max(2).optional(),
      })
    )
    .query(async ({ input }: { input: { page: number; pageSize: number; tutorialId?: number; status?: number } }) => {
      return listAllFeedbacks({
        page: input.page,
        pageSize: input.pageSize,
        tutorialId: input.tutorialId,
        status: input.status,
      });
    }),

  // ── Get single feedback ────────────────────────────────────────────────────
  getById: dashboardProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }: { input: { id: number } }) => {
      const fb = await getFeedbackById(input.id);
      if (!fb) throw new TRPCError({ code: "NOT_FOUND", message: "反饋不存在" });
      return fb;
    }),

  // ── Update feedback status ─────────────────────────────────────────────────
  updateStatus: dashboardProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.number().min(0).max(2),
        adminNote: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input }: { input: { id: number; status: number; adminNote?: string } }) => {
      const existing = await getFeedbackById(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "反饋不存在" });
      }
      await updateFeedbackStatus(input.id, input.status, input.adminNote);
      return { success: true };
    }),

  // ── List courses for filter dropdown ──────────────────────────────────────
  listCourses: dashboardProcedure.query(async () => {
    const result = await listDocuments(1, 200);
    return result.items.map((d: any) => ({ id: d.id, title: d.title }));
  }),
});
