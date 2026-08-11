import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocumentById: vi.fn(),
  updateDocumentMeta: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDocumentById: mocks.getDocumentById,
    updateDocumentMeta: mocks.updateDocumentMeta,
  };
});

vi.mock("./db/documents", async () => {
  const actual = await vi.importActual<typeof import("./db/documents")>("./db/documents");
  return {
    ...actual,
    getDocumentById: mocks.getDocumentById,
    updateDocumentMeta: mocks.updateDocumentMeta,
  };
});

vi.mock("./storage", () => ({
  storagePut: mocks.storagePut,
}));

import { appRouter } from "./routers";
import { signDashboardToken } from "./_core/dashboardAuth";

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

describe("courses.attachImageToBlock", () => {
  beforeEach(() => {
    mocks.getDocumentById.mockReset();
    mocks.updateDocumentMeta.mockReset();
    mocks.storagePut.mockReset();
  });

  it("attaches a manual image to an image-like block for dashboard admins", async () => {
    mocks.getDocumentById.mockResolvedValue({
      id: 6,
      segments: [
        {
          id: "seg-image-1",
          type: "image",
          text: "[IMAGE]",
          order: 1,
          meta: {},
        },
      ],
    });
    mocks.storagePut.mockResolvedValue({ url: "https://cdn.example.com/manual-image.png" });
    mocks.updateDocumentMeta.mockResolvedValue(undefined);

    const caller = appRouter.createCaller(await createDashboardContext());

    const result = await caller.courses.attachImageToBlock({
      documentId: 6,
      blockId: "seg-image-1",
      filename: "manual-image.png",
      mimeType: "image/png",
      base64Content: "ZmFrZS1pbWFnZQ==",
    });

    expect(result).toEqual({
      success: true,
      imageUrl: "https://cdn.example.com/manual-image.png",
    });
    expect(mocks.storagePut).toHaveBeenCalledOnce();
    expect(mocks.updateDocumentMeta).toHaveBeenCalledOnce();
    expect(mocks.updateDocumentMeta.mock.calls[0][0]).toBe(6);
    expect(mocks.updateDocumentMeta.mock.calls[0][1]).toMatchObject({
      segments: [
        expect.objectContaining({
          id: "seg-image-1",
          type: "image",
          meta: expect.objectContaining({
            imageUrl: "https://cdn.example.com/manual-image.png",
            imageName: "manual-image.png",
            imageSource: "manual_upload",
          }),
        }),
      ],
    });
  });
});

describe("courses.update preserves attached images", () => {
  const docWithImage = {
    id: 7,
    title: "開戶課程",
    extractedText: "第一段文字\n第二段文字",
    segments: [
      { id: "seg-1", type: "heading", text: "第一段文字", order: 1, meta: {} },
      {
        id: "seg-2",
        type: "image",
        text: "[IMAGE]",
        order: 2,
        meta: { imageUrl: "https://cdn.example.com/uploaded.png", imageName: "diagram.png" },
      },
      { id: "seg-3", type: "paragraph", text: "第二段文字", order: 3, meta: {} },
    ],
  };

  beforeEach(() => {
    mocks.getDocumentById.mockReset();
    mocks.updateDocumentMeta.mockReset();
  });

  it("does not touch segments when the content is unchanged", async () => {
    mocks.getDocumentById.mockResolvedValue(docWithImage);

    const caller = appRouter.createCaller(await createDashboardContext());
    const result = await caller.courses.update({
      id: 7,
      title: "改名",
      originalContent: "第一段文字\n第二段文字",
    });

    expect(result).toEqual({ success: true });
    // Only the title update is persisted; segments must not be re-split.
    expect(mocks.updateDocumentMeta).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: "改名" }),
    );
    expect(mocks.updateDocumentMeta.mock.calls[0][1]).not.toHaveProperty("segments");
  });

  it("keeps image blocks (and their image URLs) when the text content changes", async () => {
    mocks.getDocumentById.mockResolvedValue(docWithImage);

    const caller = appRouter.createCaller(await createDashboardContext());
    const result = await caller.courses.update({
      id: 7,
      originalContent: "新的第一段\n新的第二段",
    });

    expect(result).toEqual({ success: true });
    const payload = mocks.updateDocumentMeta.mock.calls[0][1];
    expect(payload).toHaveProperty("segments");
    const imageSegs = (payload.segments as any[]).filter(
      (s: any) => s.type === "image" || s.text === "[IMAGE]",
    );
    expect(imageSegs.length).toBe(1);
    expect(imageSegs[0].meta.imageUrl).toBe("https://cdn.example.com/uploaded.png");
    // Both edited text lines survive.
    expect((payload.segments as any[]).filter((s: any) => s.type !== "image").length).toBe(2);
  });

  it("does not wipe an empty-content course when saving without changes", async () => {
    mocks.getDocumentById.mockResolvedValue({
      ...docWithImage,
      extractedText: null,
    });

    const caller = appRouter.createCaller(await createDashboardContext());
    await caller.courses.update({ id: 7, title: "僅改名" });

    expect(mocks.updateDocumentMeta.mock.calls[0][1]).not.toHaveProperty("segments");
  });
});
