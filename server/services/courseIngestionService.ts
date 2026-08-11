import { blocksToSegments, segmentsToIR } from "../documentIr";
import { detectFileType, parseDocument } from "../documentParser";
import { storagePut } from "../storage";
import type { UploadedFileInput } from "./types";

export type CourseIngestionRequest = {
  title: string;
  file?: UploadedFileInput;
  originalContent?: string;
  storagePrefix: string;
};

export type CourseIngestionResult = {
  title: string;
  originalFilename: string;
  fileType: ReturnType<typeof detectFileType>;
  fileSize: number;
  s3Key: string;
  s3Url: string;
  extractedText: string;
  segments: any[];
  parseProvider: "local" | "mineru";
  irReady: boolean;
};

function createManualSegments(originalContent: string) {
  const lines = originalContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((text, idx) => ({
    id: `seg-${Date.now()}-${idx}`,
    type: idx === 0 ? ("heading" as const) : ("paragraph" as const),
    text,
    order: idx + 1,
  }));
}

function createManualStorageKey(title: string) {
  return `manual/${Date.now()}-${title.slice(0, 40).replace(/\s+/g, "-")}.txt`;
}

async function ingestUploadedFile(
  title: string,
  file: UploadedFileInput,
  storagePrefix: string,
): Promise<CourseIngestionResult> {
  const buffer = Buffer.from(file.base64Content, "base64");
  const fileType = detectFileType(file.filename, file.mimeType);
  const requestedKey = `${storagePrefix}/${Date.now()}-${file.filename}`;
  const uploaded = await storagePut(requestedKey, buffer, file.mimeType);

  let extractedText = "";
  let segments: any[] = [];
  let parseProvider: "local" | "mineru" = "local";

  try {
    const parsed = await parseDocument(buffer, file.filename, file.mimeType);
    extractedText = parsed.extractedText;
    const ir = parsed.ir ?? segmentsToIR(parsed.segments as any, "zh");
    segments = blocksToSegments(ir.blocks);
    parseProvider = parsed.parseProvider || "local";
  } catch (err) {
    console.error("[CourseIngestionService] Parse failed:", err);
  }

  return {
    title,
    originalFilename: file.filename,
    fileType,
    fileSize: buffer.length,
    s3Key: uploaded.key,
    s3Url: uploaded.url,
    extractedText,
    segments,
    parseProvider,
    irReady: segments.length > 0,
  };
}

async function ingestManualContent(
  title: string,
  originalContent: string,
): Promise<CourseIngestionResult> {
  const segments = createManualSegments(originalContent);

  return {
    title,
    originalFilename: `${title.slice(0, 40)}.txt`,
    fileType: "other",
    fileSize: Buffer.byteLength(originalContent, "utf8"),
    s3Key: createManualStorageKey(title),
    s3Url: "",
    extractedText: originalContent,
    segments,
    parseProvider: "local",
    irReady: segments.length > 0,
  };
}

export async function ingestCourseSource(
  request: CourseIngestionRequest,
): Promise<CourseIngestionResult> {
  const { title, file, originalContent, storagePrefix } = request;

  if (file) {
    return ingestUploadedFile(title, file, storagePrefix);
  }

  if (originalContent) {
    return ingestManualContent(title, originalContent);
  }

  throw new Error("Either file or originalContent is required");
}
