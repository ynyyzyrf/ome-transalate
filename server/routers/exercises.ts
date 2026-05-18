import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { exercises as exercisesTable } from "../../drizzle/schema";

export const exercisesRouter = router({
  // Get exercises for a document
  list: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return db.getExercisesByDocument(input.documentId);
    }),

  // Submit an answer attempt
  submit: protectedProcedure
    .input(
      z.object({
        exerciseId: z.number(),
        answer: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const drizzle = await db.getDb();
      if (!drizzle) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [exercise] = await drizzle
        .select()
        .from(exercisesTable)
        .where(eq(exercisesTable.id, input.exerciseId))
        .limit(1);

      if (!exercise) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exercise not found" });
      }

      const isCorrect = exercise.correctAnswer.trim().toLowerCase() === input.answer.trim().toLowerCase();

      await db.createExerciseAttempt({
        exerciseId: input.exerciseId,
        userId: ctx.user.id,
        answer: input.answer,
        isCorrect: isCorrect ? 1 : 0,
      });

      return {
        isCorrect,
        correctAnswer: isCorrect ? undefined : exercise.correctAnswer,
      };
    }),

  // Get attempts for an exercise
  myAttempts: protectedProcedure
    .input(z.object({ exerciseId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getExerciseAttempts(ctx.user.id, input.exerciseId);
    }),

  // Admin: create new exercise
  create: adminProcedure
    .input(
      z.object({
        documentId: z.number(),
        segmentId: z.string().optional(),
        question: z.string().min(1),
        options: z.array(z.string()).min(1).optional(),
        correctAnswer: z.string().min(1),
        type: z.enum(["choice", "true_false", "fill"]).default("choice"),
        order: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.createExercise({
        documentId: input.documentId,
        segmentId: input.segmentId || null,
        question: input.question,
        options: input.options || [],
        correctAnswer: input.correctAnswer,
        type: input.type,
        order: input.order,
        createdBy: ctx.user.id,
      });
      return { success: true, id };
    }),

  // Admin: delete exercise
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteExercise(input.id);
      return { success: true };
    }),
});
