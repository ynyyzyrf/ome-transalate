import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../_core/context";

const mocks = vi.hoisted(() => ({
  getDocumentById: vi.fn(),
  getGlossaryForLanguage: vi.fn(),
  getTranslationJob: vi.fn(),
  getTranslationJobsByDocument: vi.fn(),
  renderTranslationPreviewHtml: vi.fn(),
  storagePut: vi.fn(),
  translateBlocks: vi.fn(),
  updateDocumentStatus: vi.fn(),
  updateTranslationJobStatus: vi.fn(),
  kickTranslationWorker: vi.fn(),
}));

vi.mock("../../db", async () => {
  const actual = await vi.importActual<typeof import("../../db")>("../../db");
  return {
    ...actual,
    updateDocumentStatus: mocks.updateDocumentStatus,
  };
});

vi.mock("../../db/documents", async () => {
  const actual = await vi.importActual<typeof import("../../db/documents")>("../../db/documents");
  return {
    ...actual,
    getDocumentById: mocks.getDocumentById,
    updateDocumentStatus: mocks.updateDocumentStatus,
  };
});

vi.mock("../../db/translationJobs", async () => {
  const actual = await vi.importActual<typeof import("../../db/translationJobs")>("../../db/translationJobs");
  return {
    ...actual,
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

vi.mock("../../storage", () => ({
  storagePut: mocks.storagePut,
}));

vi.mock("../../translationEngine", () => ({
  translateBlocks: mocks.translateBlocks,
}));

vi.mock("../../previewHtml", () => ({
  renderTranslationPreviewHtml: mocks.renderTranslationPreviewHtml,
}));

// Retry only enqueues — translation itself runs in the queue worker.
vi.mock("../../services/translationQueue", () => ({
  kickTranslationWorker: mocks.kickTranslationWorker,
}));

import { appRouter } from "../../routers";
import { signDashboardToken } from "../../_core/dashboardAuth";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 9,
      openId: "admin-9",
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

async function createDashboardContext() {
  const token = await signDashboardToken({
    adminId: 1,
    username: "admin",
    displayName: "Admin",
  });

  return {
    user: null,
    authSource: null,
    req: {
      protocol: "https",
      headers: {
        cookie: `dashboard_session=${token}`,
      },
    },
    res: {},
  } as any;
}

describe("translation retry entry flows", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset());
    mocks.getDocumentById.mockResolvedValue({
      id: 88,
      title: "課程",
      segments: [
        {
          id: "seg-1",
          type: "paragraph",
          text: "原始內容",
          order: 1,
        },
      ],
    });
    mocks.getGlossaryForLanguage.mockResolvedValue([]);
    mocks.getTranslationJob.mockImplementation(async (_documentId: number, language: string) => ({
      id: language === "es" ? 901 : 902,
      targetLanguage: language,
      translatedSegments: [],
    }));
    mocks.translateBlocks.mockImplementation(async (blocks: any[], language: string) =>
      blocks.map((block) => ({ ...block, text: `${block.text}-${language}` })),
    );
    mocks.renderTranslationPreviewHtml.mockReturnValue("<html>preview</html>");
    mocks.storagePut.mockResolvedValue({ url: "https://cdn.example.com/preview.html" });
    mocks.updateTranslationJobStatus.mockResolvedValue(undefined);
    mocks.updateDocumentStatus.mockResolvedValue(undefined);
  });

  it("resets the requested document translation job to pending before retriggering it", async () => {
    mocks.getTranslationJobsByDocument.mockResolvedValue([
      { id: 901, status: "completed", targetLanguage: "es" },
    ]);

    const caller = appRouter.createCaller(createAdminContext());

    const result = await caller.documents.retryTranslation({
      documentId: 88,
      language: "es",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.updateTranslationJobStatus).toHaveBeenCalledWith(901, "pending", {
      errorMessage: null,
    });
  });

  it("resets all dashboard course translation jobs to pending before retriggering them", async () => {
    mocks.getTranslationJobsByDocument
      .mockResolvedValueOnce([
        { id: 901, status: "failed", targetLanguage: "en" },
        { id: 902, status: "failed", targetLanguage: "es" },
      ])
      .mockResolvedValueOnce([
        { id: 901, status: "completed", targetLanguage: "en" },
        { id: 902, status: "completed", targetLanguage: "es" },
      ]);

    const caller = appRouter.createCaller(await createDashboardContext());

    const result = await caller.courses.retryTranslation({
      documentId: 88,
    });

    expect(result).toEqual({ success: true });
    expect(mocks.updateDocumentStatus).toHaveBeenCalledWith(88, "pending");
    expect(mocks.updateTranslationJobStatus).toHaveBeenNthCalledWith(1, 901, "pending", {
      errorMessage: null,
    });
    expect(mocks.updateTranslationJobStatus).toHaveBeenNthCalledWith(2, 902, "pending", {
      errorMessage: null,
    });
  });
});
