import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const progressRouter = router({
  // Get progress for a specific document
  get: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const progress = await db.getProgress(ctx.user.id, input.documentId);
      return progress || { status: "not_started", lastSegmentId: null, completedSegments: [] };
    }),

  // Update progress (upsert)
  update: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        lastSegmentId: z.string().optional(),
        completedSegments: z.array(z.string()).optional(),
        status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getProgress(ctx.user.id, input.documentId);

      const data = {
        userId: ctx.user.id,
        documentId: input.documentId,
        lastSegmentId: input.lastSegmentId ?? existing?.lastSegmentId ?? null,
        completedSegments: input.completedSegments ?? existing?.completedSegments ?? [],
        status: input.status ?? existing?.status ?? "in_progress",
        completedAt: input.status === "completed" ? new Date() : existing?.completedAt ?? null,
      };

      await db.upsertProgress(data);
      return { success: true };
    }),

  // Get all progress for current user (for the course list page)
  listMyProgress: protectedProcedure.query(async ({ ctx }) => {
    const items = await db.listUserProgress(ctx.user.id);
    return items;
  }),
});
