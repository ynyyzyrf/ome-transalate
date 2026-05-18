/**
 * Courses Router (Dashboard Admin)
 * Course management: list with feedback count, edit metadata, delete.
 * Separate from the documents upload router; shares the same documents table.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { dashboardProcedure } from "../_core/dashboardAuth";
import {
  listDocuments,
  getDocumentById,
  updateDocumentMeta,
  deleteDocument,
  createDocument,
  createTranslationJob,
  getTranslationJob,
  getTranslationJobsByDocument,
  updateTranslationJobStatus,
  updateDocumentStatus,
  getGlossaryForLanguage,
} from "../db";
import { translateSegments } from "../translationEngine";
import { parseDocument, detectFileType } from "../documentParser";
import { storagePut } from "../storage";

export const coursesRouter = router({
  // ── Create a new course (text or file upload) ─────────────────────────────
  create: dashboardProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512),
        // Text mode: paste raw text content
        originalContent: z.string().optional(),
        // File mode: upload a file (base64 encoded)
        file: z.object({
          filename: z.string(),
          mimeType: z.string(),
          base64Content: z.string(),
        }).optional(),
        category: z.string().max(128).optional(),
        instructor: z.string().max(256).optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        targetLanguages: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }: { input: { title: string; originalContent?: string; file?: { filename: string; mimeType: string; base64Content: string }; category?: string; instructor?: string; description?: string; sortOrder?: number; targetLanguages?: string[] } }) => {
      let fileType: string = "other";
      let fileSize = 0;
      let s3Key = "";
      let s3Url = "";
      let originalFilename = "";
      let extractedText = "";
      let segments: any[] = [];

      if (input.file) {
        // ── File upload mode ──────────────────────────────────────────────
        const buffer = Buffer.from(input.file.base64Content, "base64");
        fileType = detectFileType(input.file.filename, input.file.mimeType);
        fileSize = buffer.length;
        originalFilename = input.file.filename;

        // Upload original file to S3
        s3Key = `courses/original/${Date.now()}-${input.file.filename}`;
        const uploaded = await storagePut(s3Key, buffer, input.file.mimeType);
        s3Url = uploaded.url;

        // Parse document
        try {
          const parsed = await parseDocument(buffer, input.file.filename, input.file.mimeType);
          extractedText = parsed.extractedText;
          segments = parsed.segments;
        } catch (err) {
          console.error("[Courses] Parse failed:", err);
        }

        if (!extractedText || segments.length === 0) {
          return { id: 0, success: false, error: "無法從文件中提取文本，請確認文件包含文字內容。" };
        }
      } else if (input.originalContent) {
        // ── Text mode (existing behavior) ─────────────────────────────────
        const lines = input.originalContent.split("\n").map((l) => l.trim()).filter(Boolean);
        segments = lines.map((text, idx) => ({
          id: `seg-${Date.now()}-${idx}`,
          type: idx === 0 ? "heading" as const : "paragraph" as const,
          text,
          order: idx,
        }));
        extractedText = input.originalContent;
        originalFilename = `${input.title.slice(0, 40)}.txt`;
        fileType = "other";
        fileSize = Buffer.byteLength(input.originalContent, "utf8");
        s3Key = `manual/${Date.now()}-${input.title.slice(0, 40).replace(/\s+/g, "-")}.txt`;
        s3Url = "";
      } else {
        return { id: 0, success: false, error: "請提供課程內容（文字或檔案上傳）。" };
      }

      const id = await createDocument({
        title: input.title,
        originalFilename,
        fileType: fileType as any,
        fileSize,
        s3Key,
        s3Url,
        status: "pending",
        uploadedBy: 0,
        isPublished: "no",
        extractedText,
        segments,
        category: input.category,
        instructor: input.instructor,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
      });

      // Create translation jobs and trigger translation
      const targetLanguages = input.targetLanguages?.length
        ? input.targetLanguages
        : ["en", "es", "th", "hi", "vi"];
      for (const lang of targetLanguages) {
        await createTranslationJob({
          documentId: id,
          targetLanguage: lang,
          status: "pending",
        });
      }
      triggerTranslation(id, targetLanguages).catch(async (err) => {
        console.error("[Courses] Translation failed:", err);
        await updateDocumentStatus(id, "failed");
      });

      return { id, success: true };
    }),

  // ── List all courses with feedback count ───────────────────────────────────
  list: dashboardProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }: { input: { page: number; pageSize: number } }) => {
      return listDocuments(input.page, input.pageSize);
    }),

  // ── Get single course detail ───────────────────────────────────────────────
  getById: dashboardProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }: { input: { id: number } }) => {
      const doc = await getDocumentById(input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "課程不存在" });
      return doc;
    }),

  // ── Update course metadata ─────────────────────────────────────────────────
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
      })
    )
    .mutation(async ({ input }: { input: { id: number; title?: string; originalContent?: string; instructor?: string; category?: string; description?: string; sortOrder?: number; isPublished?: "yes" | "no" } }) => {
      const { id, originalContent, ...data } = input;
      const existing = await getDocumentById(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "課程不存在" });

      const updateData: Record<string, unknown> = { ...data };
      if (originalContent !== undefined) {
        const lines = originalContent.split("\n").map((l) => l.trim()).filter(Boolean);
        const segments = lines.map((text, idx) => ({
          id: `seg-${Date.now()}-${idx}`,
          type: idx === 0 ? "heading" as const : "paragraph" as const,
          text,
          order: idx,
        }));
        updateData.extractedText = originalContent;
        updateData.segments = segments;
      }

      await updateDocumentMeta(id, updateData);
      return { success: true };
    }),

  // ── Retry failed translation ──────────────────────────────────────────────
  retryTranslation: dashboardProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      const jobs = await getTranslationJobsByDocument(input.documentId);
      if (jobs.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "沒有翻譯任務" });

      // Reset all failed/pending jobs and retry all languages
      const languages: string[] = [];
      for (const job of jobs) {
        languages.push(job.targetLanguage);
        await updateTranslationJobStatus(job.id, "pending", { errorMessage: null });
      }
      await updateDocumentStatus(input.documentId, "pending");
      triggerTranslation(input.documentId, languages).catch(async (err) => {
        console.error("[Courses] Retry translation failed:", err);
        await updateDocumentStatus(input.documentId, "failed");
      });
      return { success: true };
    }),

  // ── Delete course ──────────────────────────────────────────────────────────
  delete: dashboardProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }: { input: { id: number } }) => {
      const existing = await getDocumentById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "課程不存在" });
      await deleteDocument(input.id);
      return { success: true };
    }),
});

/**
 * Background translation trigger (non-blocking).
 */
async function triggerTranslation(
  documentId: number,
  targetLanguages: string[],
) {
  const doc = await getDocumentById(documentId);
  if (!doc || !doc.segments || !Array.isArray(doc.segments)) {
    await updateDocumentStatus(documentId, "failed");
    return;
  }

  await updateDocumentStatus(documentId, "processing");

  for (const lang of targetLanguages) {
    const job = await getTranslationJob(documentId, lang);
    if (!job) continue;

    try {
      await updateTranslationJobStatus(job.id, "processing", { startedAt: new Date() });

      const glossary = await getGlossaryForLanguage(lang);

      const translatedSegments = await translateSegments(
        doc.segments ?? [],
        lang,
        glossary,
      );

      const translatedText = translatedSegments.map((s) => s.text).join("\n\n");
      const outputBuffer = Buffer.from(translatedText, "utf-8");
      const outputKey = `documents/translated/${documentId}/${lang}-${Date.now()}.txt`;
      const { url: outputUrl } = await storagePut(outputKey, outputBuffer, "text/plain");

      await updateTranslationJobStatus(job.id, "completed", {
        translatedSegments,
        outputS3Key: outputKey,
        outputS3Url: outputUrl,
        completedAt: new Date(),
      });
    } catch (err: any) {
      console.error(`[Translation] Failed for doc ${documentId} lang ${lang}:`, err);
      await updateTranslationJobStatus(job.id, "failed", {
        errorMessage: err.message || "翻譯失敗",
      });
    }
  }

  const allJobs = await getTranslationJobsByDocument(documentId);
  const allDone = allJobs.every((j) => j.status === "completed" || j.status === "failed");
  const anySuccess = allJobs.some((j) => j.status === "completed");
  if (allDone) {
    await updateDocumentStatus(documentId, anySuccess ? "completed" : "failed");
  }
}
