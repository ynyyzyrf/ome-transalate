/**
 * Document Parser Module
 * Extracts text and creates semantic segments from various file formats.
 */
import mammoth from "mammoth";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
import * as XLSX from "xlsx";
import type { Segment } from "../drizzle/schema";

export interface ParseResult {
  extractedText: string;
  segments: Segment[];
}

/**
 * Parse a PDF buffer into text segments.
 */
async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  const rawText = data.text || "";
  return textToSegments(rawText);
}

/**
 * Parse a DOCX buffer into text segments using mammoth.
 */
async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  return textToSegments(result.value || "");
}

/**
 * Parse an XLSX buffer into text segments.
 */
async function parseXlsx(buffer: Buffer): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    lines.push(`[Sheet: ${sheetName}]`);
    lines.push(...csv.split("\n").filter((l) => l.trim()));
  }
  return textToSegments(lines.join("\n"));
}

/**
 * Split raw text into semantic segments.
 * Each non-empty paragraph becomes a segment.
 */
export function textToSegments(rawText: string): ParseResult {
  const paragraphs = rawText
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\r?\n/g, " ").trim())
    .filter((p) => p.length > 0);

  const segments: Segment[] = paragraphs.map((text, index) => ({
    id: `seg-${String(index + 1).padStart(4, "0")}`,
    text,
    order: index + 1,
    type: detectSegmentType(text),
  }));

  return {
    extractedText: paragraphs.join("\n\n"),
    segments,
  };
}

function detectSegmentType(text: string): Segment["type"] {
  if (text.length < 80 && /^[一-龥\u4e00-\u9fff\s\d]+$/.test(text)) return "heading";
  if (text.startsWith("•") || text.startsWith("-") || text.startsWith("*")) return "list";
  if (text.includes("\t") || text.split(",").length > 3) return "table";
  return "paragraph";
}

/**
 * Main dispatcher: route file to appropriate parser based on MIME type or extension.
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ParseResult> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (mimeType === "application/pdf" || ext === "pdf") {
    return parsePdf(buffer);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return parseDocx(buffer);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xlsx"
  ) {
    return parseXlsx(buffer);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx" || ext === "ppt"
  ) {
    const { parsePptx } = await import("./parsers/pptx");
    return parsePptx(buffer);
  }
  if (ext === "vsdx" || mimeType === "application/vnd.ms-visio.drawing") {
    const { parseVsdx } = await import("./parsers/vsdx");
    return parseVsdx(buffer);
  }
  if (ext === "xmind") {
    const { parseXmind } = await import("./parsers/xmind");
    return parseXmind(buffer);
  }
  if (["jpg", "jpeg", "png"].includes(ext) || mimeType.startsWith("image/")) {
    const { ocrImage } = await import("./ocr");
    return ocrImage(buffer, filename);
  }
  // Fallback: try as plain text
  return textToSegments(buffer.toString("utf-8"));
}

/**
 * Detect file type enum value from filename/mime.
 */
export function detectFileType(
  filename: string,
  mimeType: string
): "pdf" | "docx" | "doc" | "xlsx" | "pptx" | "vsdx" | "xmind" | "jpg" | "png" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "vsdx" || mimeType === "application/vnd.ms-visio.drawing") return "vsdx";
  if (ext === "xmind") return "xmind";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png") return "png";
  return "other";
}
