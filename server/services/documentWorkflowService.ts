import { TRPCError } from "@trpc/server";
import { createDocument, updateDocumentMeta } from "../db/documents";
import {
  createTranslationJob,
  getTranslationJob,
  getTranslationJobsByDocument,
  updateTranslationJobStatus,
} from "../db/translationJobs";
import { getDocumentById } from "../db/documents";
import { blocksToSegments, segmentsToIR } from "../documentIr";
import { storagePut } from "../storage";
import { isImageLikeBlock } from "../../shared/imageBlocks";
import type { CourseIngestionResult } from "./courseIngestionService";
import { kickTranslationWorker } from "./translationQueue";

export type DocumentWorkflowMetadata = {
  category?: string;
  instructor?: string;
  description?: string;
  sortOrder?: number;
};

export async function createDocumentWithTranslationJobs(params: {
  ingestion: CourseIngestionResult;
  targetLanguages: string[];
  uploadedBy: number;
  metadata?: DocumentWorkflowMetadata;
}): Promise<{ documentId: number }> {
  const { ingestion, targetLanguages, uploadedBy, metadata } = params;

  const documentId = await createDocument({
    title: ingestion.title,
    originalFilename: ingestion.originalFilename,
    fileType: ingestion.fileType,
    fileSize: ingestion.fileSize,
    s3Key: ingestion.s3Key,
    s3Url: ingestion.s3Url,
    extractedText: ingestion.extractedText,
    segments: ingestion.segments,
    status: "pending",
    uploadedBy,
    isPublished: "no",
    category: metadata?.category,
    instructor: metadata?.instructor,
    description: metadata?.description,
    sortOrder: metadata?.sortOrder ?? 0,
  });

  for (const lang of targetLanguages) {
    await createTranslationJob({
      documentId,
      targetLanguage: lang,
      status: "pending",
    });
  }

  // Jobs are persisted as "pending" — wake the queue worker so translation
  // starts immediately instead of waiting for the next poll interval.
  kickTranslationWorker();

  return { documentId };
}

export async function retryDocumentTranslationLanguage(params: {
  documentId: number;
  language: string;
}): Promise<{ success: true }> {
  const job = await getTranslationJob(params.documentId, params.language);
  if (!job) {
    throw new Error("Translation job not found");
  }

  await updateTranslationJobStatus(job.id, "pending", { errorMessage: null });
  kickTranslationWorker();

  return { success: true };
}

export async function retryAllDocumentTranslations(params: {
  documentId: number;
}): Promise<{ success: true }> {
  const jobs = await getTranslationJobsByDocument(params.documentId);
  if (jobs.length === 0) {
    throw new Error("No translation jobs found");
  }

  const languages: string[] = [];
  for (const job of jobs) {
    languages.push(job.targetLanguage);
    await updateTranslationJobStatus(job.id, "pending", { errorMessage: null });
  }

  kickTranslationWorker();

  return { success: true };
}

export async function attachImageToBlock(params: {
  documentId: number;
  blockId: string;
  filename: string;
  mimeType: string;
  base64Content: string;
  storagePrefix: string;
}): Promise<{ success: true; imageUrl: string }> {
  const { documentId, blockId, filename, mimeType, base64Content, storagePrefix } = params;

  const doc = await getDocumentById(documentId);
  if (!doc) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
  }
  if (!mimeType.startsWith("image/")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only image files are supported" });
  }

  const sourceBlocks = segmentsToIR(((doc.segments as any[]) || []) as any, "zh").blocks;
  const target = sourceBlocks.find((b) => b.id === blockId);
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Block not found" });
  }
  if (!isImageLikeBlock(target)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Target block is not an image block" });
  }

  const buffer = Buffer.from(base64Content, "base64");
  const key = `${storagePrefix}/manual-images/${documentId}/${blockId}-${Date.now()}-${filename}`;
  const { url } = await storagePut(key, buffer, mimeType);

  const updatedBlocks = sourceBlocks.map((b) => {
    if (b.id !== blockId) return b;
    return {
      ...b,
      type: "image" as const,
      meta: {
        ...(b.meta || {}),
        imageUrl: url,
        imageName: filename,
        imageSource: "manual_upload",
      },
    };
  });

  await updateDocumentMeta(documentId, { segments: blocksToSegments(updatedBlocks) });
  return { success: true, imageUrl: url };
}
