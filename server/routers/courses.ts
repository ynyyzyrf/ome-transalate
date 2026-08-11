import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { dashboardProcedure } from "../_core/dashboardAuth";
import {
  listDocuments,
  getDocumentById,
  updateDocumentMeta,
  deleteDocument,
  updateDocumentStatus,
} from "../db";
import { segmentsToIR } from "../documentIr";
import { isImageLikeBlock } from "../../shared/imageBlocks";
import type { Segment } from "../../drizzle/schema";
import { courseCreateInputSchema, DASHBOARD_DEFAULT_TARGET_LANGUAGES, resolveTargetLanguages } from "../services/types";
import { ingestCourseSource } from "../services/courseIngestionService";
import {
  attachImageToBlock,
  createDocumentWithTranslationJobs,
  retryAllDocumentTranslations,
} from "../services/documentWorkflowService";

/**
 * Interleave preserved image segments through freshly re-split text segments so that
 * attached images survive a text edit. Images keep their relative order and are spread
 * proportionally across the new text, staying near their original position in the flow.
 */
function mergeImageSegments(textSegments: Segment[], imageSegments: Segment[]): Segment[] {
  if (!imageSegments.length) return textSegments;
  const sorted = [...imageSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const result: Segment[] = [];
  const total = textSegments.length + sorted.length;
  let imageIdx = 0;
  for (let i = 0; i < total; i++) {
    const targetSlot = Math.round(((imageIdx + 1) / sorted.length) * total) - 1;
    if (i === targetSlot) {
      const img = sorted[imageIdx];
      img.order = result.length + 1;
      result.push(img);
      imageIdx++;
    } else {
      const text = textSegments[i - imageIdx];
      text.order = result.length + 1;
      result.push(text);
    }
  }
  return result;
}

export const coursesRouter = router({
  create: dashboardProcedure
    .input(courseCreateInputSchema)
    .mutation(async ({ input }) => {
      if (!input.file && !input.originalContent) {
        return { id: 0, success: false, error: "請提供課程內容（文字或檔案上傳）。" };
      }

      const ingestion = await ingestCourseSource({
        title: input.title,
        file: input.file,
        originalContent: input.originalContent,
        storagePrefix: "courses/original",
      });

      if (input.file && (!ingestion.extractedText || ingestion.segments.length === 0)) {
        return { id: 0, success: false, error: "檔案解析失敗，請確認文件格式正確或嘗試重新上傳。" };
      }

      const targetLanguages = resolveTargetLanguages(input.targetLanguages, DASHBOARD_DEFAULT_TARGET_LANGUAGES);
      const { documentId } = await createDocumentWithTranslationJobs({
        ingestion,
        targetLanguages,
        uploadedBy: 0,
        metadata: {
          category: input.category,
          instructor: input.instructor,
          description: input.description,
          sortOrder: input.sortOrder,
        },
      });

      return {
        id: documentId,
        success: true,
        parseProvider: ingestion.parseProvider,
        irReady: ingestion.irReady,
      };
    }),

  list: dashboardProcedure
    .input(z.object({ page: z.number().min(1).default(1), pageSize: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => listDocuments(input.page, input.pageSize)),

  getById: dashboardProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const doc = await getDocumentById(input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "課程不存在" });
      return { ...doc, ir: segmentsToIR(((doc.segments as any[]) || []) as any, "zh") };
    }),

  update: dashboardProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(512).optional(),
        originalContent: z.string().optional(),
        instructor: z.string().max(256).optional(),
        category: z.string().max(128).optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        isPublished: z.enum(["yes", "no"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, originalContent, ...data } = input;
      const existing = await getDocumentById(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "課程不存在" });
      const updateData: Record<string, unknown> = { ...data };

      // Only rebuild the source segments when the admin actually changed the text content —
      // an unchanged save must never touch segments. When content changes, preserve any
      // attached image blocks (and their uploaded image URLs) so an edit does not
      // silently destroy images.
      if (originalContent !== undefined && originalContent !== (existing.extractedText ?? "")) {
        const imageSegments = ((existing.segments as Segment[] | null) ?? []).filter(
          (s) => isImageLikeBlock(s) || s.type === "image",
        );
        const lines = originalContent.split("\n").map((l) => l.trim()).filter(Boolean);
        const textSegments: Segment[] = lines.map((text, idx) => ({
          id: `seg-${Date.now()}-${idx}`,
          type: idx === 0 ? ("heading" as const) : ("paragraph" as const),
          text,
          order: idx + 1,
          meta: {},
        }));
        updateData.extractedText = originalContent;
        updateData.segments = mergeImageSegments(textSegments, imageSegments);
      }

      await updateDocumentMeta(id, updateData as any);
      return { success: true };
    }),

  retryTranslation: dashboardProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await updateDocumentStatus(input.documentId, "pending");
        return await retryAllDocumentTranslations(input);
      } catch (error) {
        if (error instanceof Error && error.message === "No translation jobs found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "沒有翻譯任務" });
        }
        throw error;
      }
    }),

  attachImageToBlock: dashboardProcedure
    .input(z.object({
      documentId: z.number(),
      blockId: z.string().min(1),
      filename: z.string().min(1),
      mimeType: z.string().min(1),
      base64Content: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      return attachImageToBlock({ ...input, storagePrefix: "courses" });
    }),

  delete: dashboardProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const existing = await getDocumentById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "課程不存在" });
      await deleteDocument(input.id);
      return { success: true };
    }),
});
