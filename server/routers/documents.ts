import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  deleteDocument,
  getDocumentById,
  getTranslationJob,
  getTranslationJobsByDocument,
  listDocuments,
  listPublishedDocuments,
  updateDocumentPublished,
} from "../db";
import { segmentsToIR, translatedSegmentsToBlocks } from "../documentIr";
import { documentUploadInputSchema } from "../services/types";
import { ingestCourseSource } from "../services/courseIngestionService";
import {
  attachImageToBlock,
  createDocumentWithTranslationJobs,
  retryDocumentTranslationLanguage,
} from "../services/documentWorkflowService";

export const documentsRouter = router({
  list: adminProcedure
    .input(z.object({ page: z.number().min(1).default(1), pageSize: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      return listDocuments(input.page, input.pageSize);
    }),

  listPublished: publicProcedure
    .input(z.object({ search: z.string().optional(), language: z.string().optional() }))
    .query(async ({ input }) => {
      return listPublishedDocuments(input.search, input.language);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const doc = await getDocumentById(input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      return { ...doc, ir: segmentsToIR(((doc.segments as any[]) || []) as any, "zh") };
    }),

  getTranslations: publicProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return getTranslationJobsByDocument(input.documentId);
    }),

  getTranslation: publicProcedure
    .input(z.object({ documentId: z.number(), language: z.string() }))
    .query(async ({ input }) => {
      const job = await getTranslationJob(input.documentId, input.language);
      if (!job) return null;
      const doc = await getDocumentById(input.documentId);
      const sourceBlocks = segmentsToIR((((doc?.segments as any[]) || []) as any), "zh").blocks;
      return {
        ...job,
        translationBlocks: translatedSegmentsToBlocks(((job.translatedSegments as any[]) || []) as any, sourceBlocks),
        previewHtmlUrl: job.outputS3Url || null,
      };
    }),

  upload: adminProcedure
    .input(documentUploadInputSchema)
    .mutation(async ({ input, ctx }) => {
      const title = input.title || input.filename.replace(/\.[^.]+$/, "");
      const ingestion = await ingestCourseSource({
        title,
        file: {
          filename: input.filename,
          mimeType: input.mimeType,
          base64Content: input.base64Content,
        },
        storagePrefix: "documents/original",
      });

      const { documentId } = await createDocumentWithTranslationJobs({
        ingestion,
        targetLanguages: input.targetLanguages,
        uploadedBy: ctx.user!.id,
        metadata: {
          category: input.category,
          instructor: input.instructor,
          description: input.description,
          sortOrder: input.sortOrder,
        },
      });

      return {
        success: true,
        documentId,
        parseProvider: ingestion.parseProvider,
        irReady: ingestion.irReady,
      };
    }),

  setPublished: adminProcedure
    .input(z.object({ id: z.number(), isPublished: z.boolean() }))
    .mutation(async ({ input }) => {
      await updateDocumentPublished(input.id, input.isPublished ? "yes" : "no");
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteDocument(input.id);
      return { success: true };
    }),

  retryTranslation: adminProcedure
    .input(z.object({ documentId: z.number(), language: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await retryDocumentTranslationLanguage(input);
      } catch (error) {
        if (error instanceof Error && error.message === "Translation job not found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Translation job not found" });
        }
        throw error;
      }
    }),

  attachImageToBlock: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      blockId: z.string().min(1),
      filename: z.string().min(1),
      mimeType: z.string().min(1),
      base64Content: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      return attachImageToBlock({ ...input, storagePrefix: "documents" });
    }),
});
