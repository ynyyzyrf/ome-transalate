import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseDocument: vi.fn(),
  storagePut: vi.fn(),
}));

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

import {
  ingestCourseSource,
  type CourseIngestionRequest,
} from "../courseIngestionService";

describe("courseIngestionService", () => {
  beforeEach(() => {
    mocks.parseDocument.mockReset();
    mocks.storagePut.mockReset();
  });

  it("persists and parses uploaded files into a normalized ingestion payload", async () => {
    mocks.storagePut.mockResolvedValue({
      key: "documents/original/uploaded.pdf",
      url: "https://cdn.example.com/uploaded.pdf",
    });
    mocks.parseDocument.mockResolvedValue({
      extractedText: "檔案內容",
      segments: [
        {
          id: "seg-1",
          type: "paragraph",
          text: "檔案內容",
          order: 1,
        },
      ],
      parseProvider: "local",
    });

    const result = await ingestCourseSource({
      title: "檔案課程",
      file: {
        filename: "training.pdf",
        mimeType: "application/pdf",
        base64Content: Buffer.from("fake-pdf").toString("base64"),
      },
      storagePrefix: "courses/original",
    });

    expect(result).toMatchObject({
      title: "檔案課程",
      originalFilename: "training.pdf",
      fileType: "pdf",
      extractedText: "檔案內容",
      parseProvider: "local",
      s3Key: "documents/original/uploaded.pdf",
      s3Url: "https://cdn.example.com/uploaded.pdf",
      irReady: true,
    });
    expect(result.fileSize).toBe(Buffer.from("fake-pdf").length);
    expect(result.segments).toEqual([
      expect.objectContaining({
        id: "seg-1",
        type: "paragraph",
        text: "檔案內容",
        order: 1,
      }),
    ]);
    expect(mocks.storagePut).toHaveBeenCalledOnce();
    expect(mocks.parseDocument).toHaveBeenCalledOnce();
  });

  it("normalizes manual text input without touching storage", async () => {
    const result = await ingestCourseSource({
      title: "文字課程",
      originalContent: "第一段\n第二段",
      storagePrefix: "manual",
    });

    expect(result).toMatchObject({
      title: "文字課程",
      originalFilename: "文字課程.txt",
      fileType: "other",
      extractedText: "第一段\n第二段",
      s3Url: "",
      parseProvider: "local",
      irReady: true,
    });
    expect(result.s3Key).toMatch(/^manual\//);
    expect(result.fileSize).toBe(Buffer.byteLength("第一段\n第二段", "utf8"));
    expect(result.segments).toEqual([
      expect.objectContaining({ type: "heading", text: "第一段", order: 1 }),
      expect.objectContaining({ type: "paragraph", text: "第二段", order: 2 }),
    ]);
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.parseDocument).not.toHaveBeenCalled();
  });

  it("rejects requests that provide neither file nor manual text", async () => {
    const request = {
      title: "空課程",
      storagePrefix: "manual",
    } as CourseIngestionRequest;

    await expect(ingestCourseSource(request)).rejects.toThrow(
      "Either file or originalContent is required",
    );
  });
});
