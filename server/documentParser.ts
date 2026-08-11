/**
 * Document Parser Module
 * Extracts text and creates semantic segments from various file formats.
 */
import mammoth from "mammoth";
import * as pdfParseModule from "pdf-parse";
import * as XLSX from "xlsx";
import type { Segment } from "../drizzle/schema";
import { segmentsToIR, type DocumentIR, type IRBlock } from "./documentIr";
import type { MineruImageAsset } from "./mineruParser";

export interface ParseResult {
  extractedText: string;
  segments: Segment[];
  ir?: DocumentIR;
  parseProvider?: "local" | "mineru";
}

function decodeHtmlEntities(input: string): string {
  // Decode &amp; first so an escaped entity like `&amp;lt;` becomes `&lt;` and is then
  // decoded to `<` exactly once — the old order double-decoded it into `<` directly.
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, " "));
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function tableHtmlToText(html: string): string {
  const rows = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
  if (!rows.length) return normalizeWhitespace(stripHtml(html));
  const lines = rows.map((row) => {
    const cells = Array.from(row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi))
      .map((cell) => normalizeWhitespace(stripHtml(cell[1])))
      .filter(Boolean);
    return cells.join(" | ");
  }).filter(Boolean);
  return lines.join("\n");
}

function normalizeMarkdownBlockText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (/<table[\s>]/i.test(trimmed) || /<tr[\s>]/i.test(trimmed) || /<td[\s>]/i.test(trimmed)) {
    return tableHtmlToText(trimmed);
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return normalizeWhitespace(stripHtml(trimmed));
  }
  return trimmed;
}

/**
 * Match a Markdown image marker's referenced filename against the extracted image
 * assets by basename. MinerU emits markers like `![](img-2.png)` and the full zip
 * preserves the original filenames, so a basename match is reliable where the naive
 * positional cursor can misassign when the zip ordering differs from the markdown.
 * Falls back to the positional cursor for markers that carry no reference.
 */
function resolveImageForMarker(
  marker: RegExpMatchArray | null,
  images: MineruImageAsset[],
  fallbackIndex: number,
): MineruImageAsset | undefined {
  const referenced = marker?.[2]?.split("/").pop()?.split(/[?#]/)[0];
  if (referenced) {
    const byName = images.find((img) => (img.name.split("/").pop() || "") === referenced);
    if (byName) return byName;
  }
  return images[fallbackIndex];
}

export function markdownToIr(markdown: string, images: MineruImageAsset[] = []): DocumentIR {
  const blocks: IRBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let buf: string[] = [];
  let imageCursor = 0;

  const flushParagraph = () => {
    const text = normalizeMarkdownBlockText(buf.join("\n"));
    buf = [];
    if (!text) return;
    const type = detectSegmentType(text) === "heading"
      ? "heading"
      : detectSegmentType(text) === "list"
        ? "list"
        : detectSegmentType(text) === "table"
          ? "table"
          : "paragraph";
    blocks.push({
      id: `blk-${String(blocks.length + 1).padStart(4, "0")}`,
      type,
      text,
      meta: { order: blocks.length + 1 },
    });
  };

  for (const raw of lines) {
    const line = raw.trim();
    // Markdown headings — MinerU emits headings as "# Title" lines that the generic
    // detectSegmentType heuristic does not recognize. Catch them explicitly so the
    // heading level survives and the "#" marker is stripped from the text.
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        id: `blk-${String(blocks.length + 1).padStart(4, "0")}`,
        type: "heading",
        text: normalizeMarkdownBlockText(headingMatch[2]),
        meta: { order: blocks.length + 1 },
      });
      continue;
    }
    // Anchored marker detection: only a line that *is* an image marker is consumed as
    // one. The old unanchored regex treated any paragraph containing `![..](..)` as an
    // image marker and silently discarded the surrounding text. The alt text and any
    // trailing text on the same line are preserved as the block caption.
    const imageMarker = line.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\s+(.*))?$/);
    const isPlainImageMarker = /^<!--\s*image\s*-->$/i.test(line) || /^\[image\]$/i.test(line);
    if (imageMarker || isPlainImageMarker) {
      flushParagraph();
      const img = resolveImageForMarker(imageMarker, images, imageCursor);
      const caption = [imageMarker?.[1]?.trim() || "", imageMarker?.[3]?.trim() || ""]
        .filter(Boolean)
        .join(" ");
      blocks.push({
        id: `blk-${String(blocks.length + 1).padStart(4, "0")}`,
        type: "image",
        text: "[IMAGE]",
        meta: {
          order: blocks.length + 1,
          imageIndex: imageCursor,
          imageUrl: img?.url || null,
          imageName: img?.name || null,
          ...(caption ? { caption } : {}),
        },
      });
      imageCursor += 1;
      continue;
    }

    if (!line) {
      flushParagraph();
      continue;
    }
    buf.push(raw);
  }
  flushParagraph();
  return { sourceLang: "zh", blocks };
}

function irToParseResult(ir: DocumentIR): ParseResult {
  const segments: Segment[] = ir.blocks.map((b, idx) => ({
    id: b.id,
    order: Number(b.meta?.order) || idx + 1,
    type: b.type,
    text: b.type === "image" ? "[IMAGE]" : b.text,
    meta: b.meta,
  }));
  const extractedText = segments.map((s) => s.text).join("\n\n");
  return { extractedText, segments, ir };
}

/**
 * Parse a PDF buffer into text segments.
 */
async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const parser =
    (pdfParseModule as any)?.default ??
    (pdfParseModule as any)?.pdfParse ??
    (pdfParseModule as any);
  if (typeof parser !== "function") {
    // Keep local parser non-fatal so MinerU fallback can take over cleanly.
    return textToSegments("");
  }
  try {
    const data = await parser(buffer);
    const rawText = data.text || "";
    return textToSegments(rawText);
  } catch {
    // pdf-parse can fail on some PDFs or versions; fallback path will handle it.
    return textToSegments("");
  }
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
 * Heuristic: does this string look like human-readable text rather than a binary blob?
 * Used to guard the plain-text fallback for word-like files. Rejects inputs that are
 * dominated by control bytes or U+FFFD replacement characters (invalid UTF-8), which is
 * what a binary .doc decodes to.
 */
export function looksLikeText(input: string): boolean {
  if (!input) return false;
  const chars = input.length;
  if (chars === 0) return false;
  const control = (input.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g) || []).length;
  const replacement = (input.match(/\uFFFD/g) || []).length;
  const printable = (input.match(/[^\x00-\x1F\x7F]/g) || []).length;
  if (control / chars > 0.05) return false;
  if (replacement / chars > 0.05) return false;
  if (printable / chars < 0.6) return false;
  return true;
}
export function textToSegments(rawText: string): ParseResult {
  // Normalize line endings first: the old split regex missed Windows blank lines
  // (\r\n\r\n), collapsing whole documents into a single paragraph.
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
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
  // Structural table signals are tabs, pipes (the HTML-table path emits "a | b | c"),
  // or 4+ ASCII commas in Latin text (CSV exports). The comma rule must NOT fire on
  // Chinese text — Chinese prose uses full-width commas but mixed text can still carry
  // several ASCII commas and was being mislabelled as a table.
  const hasCjk = /[一-鿿]/.test(text);
  if (text.includes("\t") || text.includes("|") || (text.split(",").length > 3 && !hasCjk)) {
    return "table";
  }
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
  const isWordLike = ext === "docx" || ext === "doc";
  const maybeReturn = (result: ParseResult | null | undefined): ParseResult | null => {
    if (!result) return null;
    if (Array.isArray(result.segments) && result.segments.length > 0) return result;
    return null;
  };

  // Local-first extraction. If local parser returns empty text, fallback to MinerU below.
  try {
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      const local = maybeReturn(await parseDocx(buffer));
      if (local) return { ...local, ir: segmentsToIR(local.segments), parseProvider: "local" };
    }

    if (mimeType === "application/pdf" || ext === "pdf") {
      const local = maybeReturn(await parsePdf(buffer));
      if (local) return { ...local, ir: segmentsToIR(local.segments), parseProvider: "local" };
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      ext === "xlsx"
    ) {
      const local = maybeReturn(await parseXlsx(buffer));
      if (local) return { ...local, ir: segmentsToIR(local.segments), parseProvider: "local" };
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      ext === "pptx" || ext === "ppt"
    ) {
      const { parsePptx } = await import("./parsers/pptx");
      const local = maybeReturn(await parsePptx(buffer));
      if (local) return { ...local, ir: segmentsToIR(local.segments), parseProvider: "local" };
    }

    if (ext === "vsdx" || mimeType === "application/vnd.ms-visio.drawing") {
      const { parseVsdx } = await import("./parsers/vsdx");
      const local = maybeReturn(await parseVsdx(buffer));
      if (local) return { ...local, ir: segmentsToIR(local.segments), parseProvider: "local" };
    }

    if (ext === "xmind") {
      const { parseXmind } = await import("./parsers/xmind");
      const local = maybeReturn(await parseXmind(buffer));
      if (local) return { ...local, ir: segmentsToIR(local.segments), parseProvider: "local" };
    }

    if (["jpg", "jpeg", "png"].includes(ext) || mimeType.startsWith("image/")) {
      const { ocrImage } = await import("./ocr");
      const local = maybeReturn(await ocrImage(buffer, filename));
      if (local) return { ...local, ir: segmentsToIR(local.segments), parseProvider: "local" };
    }
  } catch (err) {
    console.error("[DocumentParser] Local parser failed:", err);
  }

  // For unsupported/complex formats, use MinerU extraction first.
  try {
    const { extractDocumentByMineru } = await import("./mineruParser");
    const extracted = await extractDocumentByMineru(filename, mimeType, buffer);
    const ir = markdownToIr(extracted.markdownText, extracted.images);
    const byMineru = irToParseResult(ir);
    if (byMineru.segments.length > 0) {
      return { ...byMineru, parseProvider: "mineru" };
    }
  } catch (err) {
    console.error("[DocumentParser] MinerU fallback failed:", err);
  }

  // Last fallback: only keep plain-text fallback for word-like formats, and only when
  // the bytes actually decode as readable text. Binary .doc blobs decode to garbage
  // (heavy U+FFFD replacement chars / control bytes) — emitting that as segments
  // silently corrupts documents, so reject it and let the caller surface the error.
  if (isWordLike) {
    const decoded = buffer.toString("utf-8");
    if (looksLikeText(decoded)) {
      const fallback = textToSegments(decoded);
      return { ...fallback, ir: segmentsToIR(fallback.segments), parseProvider: "local" };
    }
  }

  throw new Error("Unable to extract text from this file format");
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
