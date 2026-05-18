/**
 * OCR module using Tesseract.js.
 * Extracts text from image buffers (PNG, JPG) with Chinese + English support.
 */
import Tesseract from "tesseract.js";
import type { ParseResult } from "./documentParser";

let workerInstance: Tesseract.Worker | null = null;

/**
 * Get or create a singleton Tesseract worker.
 * Using a single worker to avoid memory bloat.
 */
async function getWorker(): Promise<Tesseract.Worker> {
  if (!workerInstance) {
    workerInstance = await Tesseract.createWorker("chi_sim+eng", 1, {
      logger: (info) => {
        if (info.status === "recognizing text") {
          // Progress logging, can be silenced in production
        }
      },
    });
  }
  return workerInstance;
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
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}
