/**
 * VSDX text extraction via ZIP + XML parsing.
 * VSDX files are OpenXML ZIP archives. Text lives in visio/pages/page*.xml
 * inside <t> elements (plain text content of shapes).
 */
import JSZip from "jszip";
import type { ParseResult } from "../documentParser";

export async function parseVsdx(buffer: Buffer): Promise<ParseResult> {
  const { textToSegments } = await import("../documentParser");
  const zip = await JSZip.loadAsync(buffer);

  const pageFiles = Object.keys(zip.files)
    .filter((name) => name.match(/^visio\/pages\/page\d+\.xml$/i))
    .sort();

  if (pageFiles.length === 0) {
    return textToSegments("[Visio 文件]\n無法提取文本內容。");
  }

  const pageTexts: string[] = [];

  for (const pagePath of pageFiles) {
    const xmlContent = await zip.files[pagePath]!.async("text");
    const texts = extractTextFromVsdxXml(xmlContent);
    if (texts.length > 0) {
      pageTexts.push(texts.join("\n"));
    }
  }

  const fullText = pageTexts.join("\n\n");
  return textToSegments(fullText || "[Visio 文件]\n無文字內容。");
}

/**
 * Extract text from VSDX page XML.
 * Text in VSDX shapes is inside <t> or <t ...> elements.
 */
function extractTextFromVsdxXml(xml: string): string[] {
  const results: string[] = [];
  const textRegex = /<t[^>]*>([^<]*)<\/t>/g;
  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(xml)) !== null) {
    const t = match[1]?.trim();
    if (t) results.push(t);
  }

  return results;
}
