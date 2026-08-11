import { beforeEach, describe, expect, it, vi } from "vitest";

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
  kickTranslationWorker: vi.fn(),
}));

vi.mock("../../db", async () => {
  const actual = await vi.importActual<typeof import("../../db")>("../../db");
  return {
    ...actual,
    getDocumentById: mocks.getDocumentById,
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

// Translation now runs asynchronously in the queue worker — mock the kick so
// the mutation only asserts enqueueing, not the (async) translation pipeline.
vi.mock("../../services/translationQueue", () => ({
  kickTranslationWorker: mocks.kickTranslationWorker,
}));

import { appRouter } from "../../routers";
import { signDashboardToken } from "../../_core/dashboardAuth";

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

describe("courses.create", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset());
    mocks.createDocument.mockResolvedValue(301);
    mocks.createTranslationJob.mockResolvedValue(undefined);
    mocks.parseDocument.mockResolvedValue({
      extractedText: "文件課程內容",
      segments: [
        {
          id: "seg-1",
          type: "paragraph",
          text: "文件課程內容",
          order: 1,
        },
      ],
      parseProvider: "local",
    });
    mocks.storagePut
      .mockResolvedValueOnce({ url: "https://cdn.example.com/courses/original.pdf" })
      .mockResolvedValueOnce({ url: "https://cdn.example.com/courses/preview/en.html" })
      .mockResolvedValueOnce({ url: "https://cdn.example.com/courses/preview/es.html" })
      .mockResolvedValueOnce({ url: "https://cdn.example.com/courses/preview/th.html" })
      .mockResolvedValueOnce({ url: "https://cdn.example.com/courses/preview/hi.html" })
      .mockResolvedValueOnce({ url: "https://cdn.example.com/courses/preview/vi.html" });
    mocks.getDocumentById.mockResolvedValue({
      id: 301,
      title: "文件型課程",
      segments: [
        {
          id: "seg-1",
          type: "paragraph",
          text: "文件課程內容",
          order: 1,
        },
      ],
    });
    mocks.getTranslationJob.mockImplementation(async (_documentId: number, language: string) => ({
      id: `job-${language}`,
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
    mocks.kickTranslationWorker.mockResolvedValue(undefined);
    mocks.getTranslationJobsByDocument.mockResolvedValue([
      { id: "job-en", status: "completed", targetLanguage: "en" },
      { id: "job-es", status: "completed", targetLanguage: "es" },
      { id: "job-th", status: "completed", targetLanguage: "th" },
      { id: "job-hi", status: "completed", targetLanguage: "hi" },
      { id: "job-vi", status: "completed", targetLanguage: "vi" },
    ]);
  });

  it("creates translation jobs for the dashboard default languages when a file is uploaded", async () => {
    const caller = appRouter.createCaller(await createDashboardContext());

    const result = await caller.courses.create({
      title: "文件型課程",
      file: {
        filename: "training.pdf",
        mimeType: "application/pdf",
        base64Content: Buffer.from("fake-pdf").toString("base64"),
      },
    });

    expect(result).toEqual({
      id: 301,
      success: true,
      parseProvider: "local",
      irReady: true,
    });
    expect(mocks.createTranslationJob).toHaveBeenCalledTimes(5);
    expect(mocks.createTranslationJob.mock.calls.map((call) => call[0].targetLanguage)).toEqual([
      "en",
      "es",
      "th",
      "hi",
      "vi",
    ]);
    expect(mocks.kickTranslationWorker).toHaveBeenCalled();
  });

  it("creates translation jobs from plain text content for the requested target languages", async () => {
    const caller = appRouter.createCaller(await createDashboardContext());

    const result = await caller.courses.create({
      title: "文字型課程",
      originalContent: "第一段\n第二段",
      targetLanguages: ["en", "vi"],
      category: "manual",
    });

    expect(result).toEqual({
      id: 301,
      success: true,
      parseProvider: "local",
      irReady: true,
    });
    expect(mocks.createDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "文字型課程",
        originalFilename: "文字型課程.txt",
        extractedText: "第一段\n第二段",
        category: "manual",
        s3Url: "",
      }),
    );
    // Preview generation happens asynchronously in the queue worker, not in the
    // create mutation — assert the worker was notified instead.
    expect(mocks.kickTranslationWorker).toHaveBeenCalled();
    expect(mocks.createDocument.mock.calls.at(-1)?.[0].segments).toEqual([
      expect.objectContaining({ type: "heading", text: "第一段", order: 1 }),
      expect.objectContaining({ type: "paragraph", text: "第二段", order: 2 }),
    ]);
    expect(mocks.createTranslationJob).toHaveBeenCalledTimes(2);
    expect(mocks.createTranslationJob).toHaveBeenNthCalledWith(1, {
      documentId: 301,
      targetLanguage: "en",
      status: "pending",
    });
    expect(mocks.createTranslationJob).toHaveBeenNthCalledWith(2, {
      documentId: 301,
      targetLanguage: "vi",
      status: "pending",
    });
  });
});
