import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorker: vi.fn(),
}));

vi.mock("tesseract.js", () => ({
  default: { createWorker: mocks.createWorker },
}));

import { ocrImage, shutdownOcr } from "./ocr";

describe("OCR singleton worker", () => {
  afterEach(async () => {
    await shutdownOcr();
    mocks.createWorker.mockReset();
  });

  it("creates a single worker for concurrent recognition calls", async () => {
    let resolveWorker!: (w: unknown) => void;
    mocks.createWorker.mockReturnValue(new Promise((r) => { resolveWorker = r; }));
    const recognize = vi.fn().mockResolvedValue({ data: { text: "Hello OCR" } });

    // Both calls race while the worker is still being created.
    const p1 = ocrImage(Buffer.from("a"), "a.png");
    const p2 = ocrImage(Buffer.from("b"), "b.png");

    resolveWorker!({ recognize, terminate: vi.fn().mockResolvedValue(undefined) });

    const [r1, r2] = await Promise.all([p1, p2]);
    // Only ONE worker is created for both concurrent callers.
    expect(mocks.createWorker).toHaveBeenCalledTimes(1);
    expect(r1.segments[0].text).toBe("Hello OCR");
    expect(r2.segments[0].text).toBe("Hello OCR");
    expect(recognize).toHaveBeenCalledTimes(2);
    // First load of the documentParser dynamic import (mammoth/xlsx/pdf-parse) is slow.
  }, 20000);

  it("recovers after a failed worker creation", async () => {
    mocks.createWorker.mockRejectedValueOnce(new Error("tesseract unavailable"));
    const recognize = vi.fn().mockResolvedValue({ data: { text: "OK" } });

    const failed = await ocrImage(Buffer.from("a"), "a.png");
    expect(failed.segments[0].text).toContain("OCR 處理失敗");

    mocks.createWorker.mockResolvedValue({ recognize, terminate: vi.fn().mockResolvedValue(undefined) });
    const ok = await ocrImage(Buffer.from("b"), "b.png");
    expect(ok.segments[0].text).toBe("OK");
    expect(mocks.createWorker).toHaveBeenCalledTimes(2);
  });
});
