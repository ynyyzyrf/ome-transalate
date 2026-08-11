import type { Segment, TranslatedSegment } from "../drizzle/schema";
import { isImageLikeBlock } from "../shared/imageBlocks";

export type IRBlockType = "heading" | "paragraph" | "list" | "table" | "image";

export interface IRBlock {
  id: string;
  type: IRBlockType;
  text: string;
  meta?: Record<string, unknown>;
}

export interface DocumentIR {
  docId?: number;
  sourceLang: string;
  blocks: IRBlock[];
}

export interface DocumentTranslation {
  language: string;
  blocks: IRBlock[];
}

export function segmentsToIR(segments: Segment[], sourceLang = "zh"): DocumentIR {
  const blocks: IRBlock[] = (segments || []).map((seg, idx) => ({
    id: seg.id || `blk-${idx + 1}`,
    type: normalizeType(seg),
    text: seg.text || "",
    meta: { ...(seg.meta || {}), order: seg.order ?? idx + 1 },
  }));
  return { sourceLang, blocks };
}

export function blocksToSegments(blocks: IRBlock[]): Segment[] {
  return (blocks || []).map((b, idx) => ({
    id: b.id || `seg-${String(idx + 1).padStart(4, "0")}`,
    text: b.text || "",
    order: Number(b.meta?.order) || idx + 1,
    type: toSegmentType(b.type),
    meta: b.meta || {},
  }));
}

export function translatedSegmentsToBlocks(translated: TranslatedSegment[], sourceBlocks: IRBlock[]): IRBlock[] {
  const byId = new Map((translated || []).map((t) => [t.id, t.text]));
  const sameLength = (translated || []).length === sourceBlocks.length;
  return sourceBlocks.map((b, idx) => {
    const matched = byId.get(b.id);
    if (matched !== undefined) return { ...b, text: matched };
    // Legacy jobs stored translations positionally (same order as source). Only fall
    // back to that when lengths agree — otherwise keep the source text instead of
    // stitching a wrong-language translation onto the block or blanking it.
    if (sameLength && translated[idx]) return { ...b, text: translated[idx].text };
    if (translated && translated.length > 0) {
      console.warn(
        `[documentIr] translatedSegmentsToBlocks: no translation for block "${b.id}" ` +
          `(translated=${translated.length}, source=${sourceBlocks.length}); keeping source text`,
      );
    }
    return b;
  });
}

export function blocksToTranslatedSegments(blocks: IRBlock[]): TranslatedSegment[] {
  return (blocks || []).map((b) => ({ id: b.id, text: b.text || "" }));
}

function normalizeType(seg: Segment): IRBlockType {
  const type = seg.type;
  if (type === "heading" || type === "paragraph" || type === "list" || type === "table" || type === "image") {
    return type;
  }
  if (isImageLikeBlock(seg)) {
    return "image";
  }
  return "paragraph";
}

function toSegmentType(type: IRBlockType): Segment["type"] {
  if (type === "image") return "image";
  return type;
}
