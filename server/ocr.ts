/**
 * OCR module using Tesseract.js.
 * Extracts text from image buffers (PNG, JPG) with Chinese + English support.
 */
import Tesseract from "tesseract.js";
import type { ParseResult } from "./documentParser";

let workerPromise: Promise<Tesseract.Worker> | null = null;

/**
 * Get or create a singleton Tesseract worker.
 * Using a single worker to avoid memory bloat.
 *
 * The singleton is a promise, not a worker instance: if two calls race while the
 * worker is still being created, both await the SAME creation promise instead of
 * each spawning a worker (the old code leaked a worker on every concurrent pair).
 */
async function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("chi_sim+eng", 1, {
      logger: () => {
        // Progress logging; silenced.
      },
    }).catch((err: unknown) => {
      // Reset on failure so a later call can retry creation.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Run OCR on an image buffer and return ParseResult.
 * @param buffer - Image file buffer (PNG or JPG)
 * @param filename - Original filename (used as fallback text)
 */
export async function ocrImage(
  buffer: Buffer,
  filename: string,
): Promise<ParseResult> {
  const { textToSegments } = await import("./documentParser");

  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(buffer);

    const cleanText = text.trim();
    if (!cleanText) {
      return textToSegments(`[圖片文件: ${filename}]\n未能識別到文字內容。`);
    }

    return textToSegments(cleanText);
  } catch (err: any) {
    console.error(`[OCR] Failed for ${filename}:`, err);
    return textToSegments(
      `[圖片文件: ${filename}]\nOCR 處理失敗：${err.message || "未知錯誤"}`,
    );
  }
}

/**
 * Terminate the OCR worker to free resources.
 * Call this during server shutdown.
 */
export async function shutdownOcr(): Promise<void> {
  const worker = workerPromise ? await workerPromise.catch(() => null) : null;
  workerPromise = null;
  if (worker) {
    await worker.terminate();
  }
}
