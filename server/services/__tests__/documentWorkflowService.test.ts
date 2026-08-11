import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDocument: vi.fn(),
  createTranslationJob: vi.fn(),
  getTranslationJob: vi.fn(),
  getTranslationJobsByDocument: vi.fn(),
  updateTranslationJobStatus: vi.fn(),
  kickTranslationWorker: vi.fn(),
}));

vi.mock("../../db/documents", () => ({
  createDocument: mocks.createDocument,
  getDocumentById: vi.fn(),
  updateDocumentMeta: vi.fn(),
}));

vi.mock("../../db/translationJobs", () => ({
  createTranslationJob: mocks.createTranslationJob,
  getTranslationJob: mocks.getTranslationJob,
  getTranslationJobsByDocument: mocks.getTranslationJobsByDocument,
  updateTranslationJobStatus: mocks.updateTranslationJobStatus,
}));

vi.mock("../translationQueue", () => ({
  kickTranslationWorker: mocks.kickTranslationWorker,
}));

import {
  createDocumentWithTranslationJobs,
  retryAllDocumentTranslations,
  retryDocumentTranslationLanguage,
} from "../documentWorkflowService";

describe("documentWorkflowService", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset());
    mocks.createDocument.mockResolvedValue(501);
    mocks.createTranslationJob.mockResolvedValue(undefined);
    mocks.updateTranslationJobStatus.mockResolvedValue(undefined);
    mocks.kickTranslationWorker.mockResolvedValue(undefined);
    mocks.getTranslationJobsByDocument.mockResolvedValue([]);
  });

  it("creates a document, creates target-language jobs, and wakes the queue worker", async () => {
    const result = await createDocumentWithTranslationJobs({
      ingestion: {
        title: "文件課程",
        originalFilename: "training.pdf",
        fileType: "pdf",
        fileSize: 42,
        s3Key: "documents/original/training.pdf",
        s3Url: "https://cdn.example.com/training.pdf",
        extractedText: "內容",
        segments: [{ id: "seg-1", type: "paragraph", text: "內容", order: 1 }],
        parseProvider: "local",
        irReady: true,
      },
      targetLanguages: ["en", "es"],
      uploadedBy: 9,
      metadata: {
        category: "onboarding",
        instructor: "Alice",
        description: "desc",
        sortOrder: 3,
      },
    });

    expect(result).toEqual({ documentId: 501 });
    expect(mocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "文件課程",
        uploadedBy: 9,
        category: "onboarding",
        instructor: "Alice",
        description: "desc",
        sortOrder: 3,
      }),
    );
    expect(mocks.createTranslationJob).toHaveBeenNthCalledWith(1, {
      documentId: 501,
      targetLanguage: "en",
      status: "pending",
    });
    expect(mocks.createTranslationJob).toHaveBeenNthCalledWith(2, {
      documentId: 501,
      targetLanguage: "es",
      status: "pending",
    });
    expect(mocks.kickTranslationWorker).toHaveBeenCalled();
  });

  it("resets a specific translation job to pending and retriggers that language", async () => {
    mocks.getTranslationJob.mockResolvedValue({
      id: 701,
      documentId: 88,
      targetLanguage: "es",
    });

    const result = await retryDocumentTranslationLanguage({
      documentId: 88,
      language: "es",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.updateTranslationJobStatus).toHaveBeenCalledWith(701, "pending", {
      errorMessage: null,
    });
    expect(mocks.kickTranslationWorker).toHaveBeenCalled();
  });

  it("resets all translation jobs to pending and retriggers all languages", async () => {
    mocks.getTranslationJobsByDocument.mockResolvedValue([
      { id: 801, documentId: 99, targetLanguage: "en" },
      { id: 802, documentId: 99, targetLanguage: "vi" },
    ]);

    const result = await retryAllDocumentTranslations({
      documentId: 99,
    });

    expect(result).toEqual({ success: true });
    expect(mocks.updateTranslationJobStatus).toHaveBeenNthCalledWith(1, 801, "pending", {
      errorMessage: null,
    });
    expect(mocks.updateTranslationJobStatus).toHaveBeenNthCalledWith(2, 802, "pending", {
      errorMessage: null,
    });
    expect(mocks.kickTranslationWorker).toHaveBeenCalled();
  });

  it("throws when retry-all is requested for a document with no translation jobs", async () => {
    mocks.getTranslationJobsByDocument.mockResolvedValue([]);

    await expect(
      retryAllDocumentTranslations({
        documentId: 123,
      }),
    ).rejects.toThrow("No translation jobs found");
  });
});
