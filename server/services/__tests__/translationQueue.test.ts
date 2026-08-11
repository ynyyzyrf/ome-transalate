import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocumentById: vi.fn(),
  updateDocumentStatus: vi.fn(),
  getGlossaryForLanguage: vi.fn(),
  claimPendingTranslationJobs: vi.fn(),
  getDocumentIdsNeedingStatusRecompute: vi.fn(),
  getTranslationJobById: vi.fn(),
  getTranslationJobsByDocument: vi.fn(),
  resetStaleProcessingJobs: vi.fn(),
  updateTranslationJobStatus: vi.fn(),
  renderTranslationPreviewHtml: vi.fn(),
  storagePut: vi.fn(),
  translateBlocks: vi.fn(),
}));

vi.mock("../../db/documents", () => ({
  getDocumentById: mocks.getDocumentById,
  updateDocumentStatus: mocks.updateDocumentStatus,
}));

vi.mock("../../db/glossary", () => ({
  getGlossaryForLanguage: mocks.getGlossaryForLanguage,
}));

vi.mock("../../db/translationJobs", () => ({
  claimPendingTranslationJobs: mocks.claimPendingTranslationJobs,
  getDocumentIdsNeedingStatusRecompute: mocks.getDocumentIdsNeedingStatusRecompute,
  getTranslationJobById: mocks.getTranslationJobById,
  getTranslationJobsByDocument: mocks.getTranslationJobsByDocument,
  resetStaleProcessingJobs: mocks.resetStaleProcessingJobs,
  updateTranslationJobStatus: mocks.updateTranslationJobStatus,
}));

vi.mock("../../storage", () => ({
  storagePut: mocks.storagePut,
}));

vi.mock("../../translationEngine", () => ({
  translateBlocks: mocks.translateBlocks,
}));

vi.mock("../../previewHtml", () => ({
  renderTranslationPreviewHtml: mocks.renderTranslationPreviewHtml,
}));

import { processDueJobs, processTranslationJob, recoverStuckTranslationJobs } from "../translationQueue";

describe("translationQueue", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset());
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.resetStaleProcessingJobs.mockResolvedValue(undefined);
    mocks.updateTranslationJobStatus.mockResolvedValue(undefined);
    mocks.updateDocumentStatus.mockResolvedValue(undefined);
  });

  it("claims pending jobs and translates each to completion, recomputing document status", async () => {
    mocks.claimPendingTranslationJobs.mockResolvedValue([
      { id: 101, documentId: 55, targetLanguage: "en" },
      { id: 102, documentId: 55, targetLanguage: "es" },
    ]);
    mocks.getTranslationJobById.mockImplementation(async (id: number) => ({
      id,
      documentId: 55,
      targetLanguage: id === 101 ? "en" : "es",
    }));
    mocks.getDocumentById.mockResolvedValue({
      id: 55,
      title: "課程 A",
      segments: [{ id: "seg-1", type: "paragraph", text: "原文", order: 1 }],
    });
    mocks.getGlossaryForLanguage.mockResolvedValue([]);
    mocks.translateBlocks.mockImplementation(async (blocks: any[], language: string) =>
      blocks.map((block) => ({ ...block, text: `${block.text}-${language}` })),
    );
    mocks.renderTranslationPreviewHtml.mockReturnValue("<html>preview</html>");
    mocks.storagePut.mockResolvedValue({ url: "https://cdn.example.com/preview.html" });
    mocks.getTranslationJobsByDocument.mockResolvedValue([
      { id: 101, status: "completed", targetLanguage: "en" },
      { id: 102, status: "completed", targetLanguage: "es" },
    ]);

    await processDueJobs(3);

    // Claim used this process's worker id and the configured concurrency.
    expect(mocks.claimPendingTranslationJobs).toHaveBeenCalledWith(
      expect.stringMatching(/^worker-/),
      3
    );
    // Stale-claim cleanup runs on every pass.
    expect(mocks.resetStaleProcessingJobs).toHaveBeenCalledWith(600000);
    // Each job completed with preview output.
    expect(mocks.updateTranslationJobStatus).toHaveBeenCalledWith(
      101,
      "completed",
      expect.objectContaining({
        outputS3Url: "https://cdn.example.com/preview.html",
        completedAt: expect.any(Date),
      })
    );
    expect(mocks.updateTranslationJobStatus).toHaveBeenCalledWith(
      102,
      "completed",
      expect.objectContaining({ outputS3Url: "https://cdn.example.com/preview.html" })
    );
    // Document aggregated to completed only after all jobs are terminal.
    expect(mocks.updateDocumentStatus).toHaveBeenLastCalledWith(55, "completed");
  });

  it("marks a job failed when the translated output is empty", async () => {
    mocks.claimPendingTranslationJobs.mockResolvedValue([
      { id: 201, documentId: 77, targetLanguage: "en" },
    ]);
    mocks.getTranslationJobById.mockResolvedValue({
      id: 201,
      documentId: 77,
      targetLanguage: "en",
    });
    mocks.getDocumentById.mockResolvedValue({
      id: 77,
      title: "課程 B",
      segments: [{ id: "seg-1", type: "paragraph", text: "原文", order: 1 }],
    });
    mocks.getGlossaryForLanguage.mockResolvedValue([]);
    mocks.translateBlocks.mockResolvedValue([
      { id: "seg-1", type: "paragraph", text: "", meta: { order: 1 } },
    ]);
    mocks.getTranslationJobsByDocument.mockResolvedValue([
      { id: 201, status: "failed", targetLanguage: "en" },
    ]);

    await processDueJobs();

    expect(mocks.updateTranslationJobStatus).toHaveBeenCalledWith(
      201,
      "failed",
      expect.objectContaining({ errorMessage: "Translation output is empty" })
    );
    expect(mocks.updateDocumentStatus).toHaveBeenLastCalledWith(77, "failed");
  });

  it("marks the job and document failed when source segments are unavailable", async () => {
    mocks.claimPendingTranslationJobs.mockResolvedValue([
      { id: 301, documentId: 88, targetLanguage: "en" },
    ]);
    mocks.getTranslationJobById.mockResolvedValue({
      id: 301,
      documentId: 88,
      targetLanguage: "en",
    });
    mocks.getDocumentById.mockResolvedValue({ id: 88, title: "課程 C", segments: null });
    mocks.getTranslationJobsByDocument.mockResolvedValue([
      { id: 301, status: "failed", targetLanguage: "en" },
    ]);

    await processDueJobs();

    expect(mocks.updateTranslationJobStatus).toHaveBeenCalledWith(
      301,
      "failed",
      expect.objectContaining({ errorMessage: "Document segments unavailable" })
    );
    expect(mocks.updateDocumentStatus).toHaveBeenLastCalledWith(88, "failed");
    expect(mocks.translateBlocks).not.toHaveBeenCalled();
  });

  it("recoverStuckTranslationJobs releases all processing jobs and recomputes document statuses", async () => {
    mocks.getDocumentIdsNeedingStatusRecompute.mockResolvedValue([1, 2]);
    mocks.getTranslationJobsByDocument.mockResolvedValue([
      { id: 401, status: "completed", targetLanguage: "en" },
    ]);

    await recoverStuckTranslationJobs();

    // At boot nothing owns in-flight claims — release everything.
    expect(mocks.resetStaleProcessingJobs).toHaveBeenCalledWith(0);
    // Documents whose jobs are terminal get their aggregate status fixed.
    expect(mocks.updateDocumentStatus).toHaveBeenCalledWith(1, "completed");
    expect(mocks.updateDocumentStatus).toHaveBeenCalledWith(2, "completed");
  });
});
