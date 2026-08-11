import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../_core/context";

const mocks = vi.hoisted(() => ({
  createDocument: vi.fn(),
  createTranslationJob: vi.fn(),
  getDocumentById: vi.fn(),
  getTranslationJob: vi.fn(),
  getTranslationJobsByDocument: vi.fn(),
  getGlossaryForLanguage: vi.fn(),
  updateDocumentStatus: vi.fn(),
  updateTranslationJobStatus: vi.fn(),
  parseDocument: vi.fn(),
  storagePut: vi.fn(),
  translateBlocks: vi.fn(),
  renderTranslationPreviewHtml: vi.fn(),
}));

vi.mock("../../db", async () => {
  const actual = await vi.importActual<typeof import("../../db")>("../../db");
  return {
    ...actual,
    getDocumentById: mocks.getDocumentById,
    getTranslationJob: mocks.getTranslationJob,
    getTranslationJobsByDocument: mocks.getTranslationJobsByDocument,
  };
});

vi.mock("../../db/documents", async () => {
  const actual = await vi.importActual<typeof import("../../db/documents")>("../../db/documents");
  return {
    ...actual,
    createDocument: mocks.createDocument,
    getDocumentById: mocks.getDocumentById,
    updateDocumentStatus: mocks.updateDocumentStatus,
  };
});

vi.mock("../../db/translationJobs", async () => {
  const actual = await vi.importActual<typeof import("../../db/translationJobs")>("../../db/translationJobs");
  return {
    ...actual,
    createTranslationJob: mocks.createTranslationJob,
    getTranslationJob: mocks.getTranslationJob,
    getTranslationJobsByDocument: mocks.getTranslationJobsByDocument,
    updateTranslationJobStatus: mocks.updateTranslationJobStatus,
  };
});

vi.mock("../../db/glossary", async () => {
  const actual = await vi.importActual<typeof import("../../db/glossary")>("../../db/glossary");
  return {
    ...actual,
    getGlossaryForLanguage: mocks.getGlossaryForLanguage,
  };
});

vi.mock("../../documentParser", async () => {
  const actual = await vi.importActual<typeof import("../../documentParser")>("../../documentParser");
  return {
    ...actual,
    parseDocument: mocks.parseDocument,
  };
});

vi.mock("../../storage", () => ({
  storagePut: mocks.storagePut,
}));

vi.mock("../../translationEngine", () => ({
  translateBlocks: mocks.translateBlocks,
}));

vi.mock("../../previewHtml", () => ({
  renderTranslationPreviewHtml: mocks.renderTranslationPreviewHtml,
}));

import { appRouter } from "../../routers";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "admin-7",
      email: "admin@example.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    authSource: "oauth",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("documents.upload", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset());
    mocks.createDocument.mockResolvedValue(101);
    mocks.createTranslationJob.mockResolvedValue(undefined);
    mocks.parseDocument.mockResolvedValue({
      extractedText: "原始內容",
      segments: [
        {
          id: "seg-1",
          type: "paragraph",
          text: "原始內容",
          order: 1,
        },
      ],
      parseProvider: "local",
    });
    mocks.storagePut
      .mockResolvedValueOnce({ url: "https://cdn.example.com/documents/original.pdf" })
      .mockResolvedValueOnce({ url: "https://cdn.example.com/documents/preview/en.html" })
      .mockResolvedValueOnce({ url: "https://cdn.example.com/documents/preview/es.html" });
    mocks.getDocumentById.mockResolvedValue({
      id: 101,
      title: "產品教材",
      segments: [
        {
          id: "seg-1",
          type: "paragraph",
          text: "原始內容",
          order: 1,
        },
      ],
    });
    mocks.getTranslationJob.mockImplementation(async (_documentId: number, language: string) => ({
      id: language === "en" ? 201 : 202,
      targetLanguage: language,
      translatedSegments: [],
    }));
    mocks.getGlossaryForLanguage.mockResolvedValue([]);
    mocks.translateBlocks.mockImplementation(async (blocks: any[], language: string) =>
      blocks.map((block) => ({ ...block, text: `${block.text}-${language}` })),
    );
    mocks.renderTranslationPreviewHtml.mockReturnValue("<html>preview</html>");
    mocks.updateTranslationJobStatus.mockResolvedValue(undefined);
    mocks.updateDocumentStatus.mockResolvedValue(undefined);
    mocks.getTranslationJobsByDocument.mockResolvedValue([
      { id: 201, status: "completed", targetLanguage: "en" },
      { id: 202, status: "completed", targetLanguage: "es" },
    ]);
  });

  it("creates a document and translation jobs for the requested target languages", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const result = await caller.documents.upload({
      filename: "product-training.pdf",
      mimeType: "application/pdf",
      base64Content: Buffer.from("fake-pdf").toString("base64"),
      title: "產品教材",
      targetLanguages: ["en", "es"],
      category: "onboarding",
      instructor: "Alice",
      description: "課程說明",
      sortOrder: 3,
    });

    expect(result).toEqual({
      success: true,
      documentId: 101,
      parseProvider: "local",
      irReady: true,
    });
    expect(mocks.createDocument).toHaveBeenCalledOnce();
    expect(mocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "產品教材",
        originalFilename: "product-training.pdf",
        uploadedBy: 7,
        extractedText: "原始內容",
        category: "onboarding",
        instructor: "Alice",
        description: "課程說明",
        sortOrder: 3,
      }),
    );
    expect(mocks.createTranslationJob).toHaveBeenCalledTimes(2);
    expect(mocks.createTranslationJob).toHaveBeenNthCalledWith(1, {
      documentId: 101,
      targetLanguage: "en",
      status: "pending",
    });
    expect(mocks.createTranslationJob).toHaveBeenNthCalledWith(2, {
      documentId: 101,
      targetLanguage: "es",
      status: "pending",
    });
  });
});
