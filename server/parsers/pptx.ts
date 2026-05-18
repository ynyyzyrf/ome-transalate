/**
 * PPTX text extraction via ZIP + XML parsing.
 * PPTX files are ZIP archives containing slide XMLs at ppt/slides/slide*.xml
 * with text content inside <a:t> elements.
 */
import JSZip from "jszip";
import type { ParseResult } from "../documentParser";

export async function parsePptx(buffer: Buffer): Promise<ParseResult> {
  const { textToSegments } = await import("../documentParser");
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/i))
    .sort();

  if (slideFiles.length === 0) {
    return textToSegments("[PPT 文件]\n無法提取文本內容。");
  }

  const slideTexts: string[] = [];

  for (const slidePath of slideFiles) {
    const xmlContent = await zip.files[slidePath]!.async("text");
    const texts = extractTextFromPptxXml(xmlContent);
    if (texts.length > 0) {
      slideTexts.push(texts.join("\n"));
    }
  }

  const fullText = slideTexts.join("\n\n");
  return textToSegments(fullText || "[PPT 文件]\n無文字內容。");
}

/**
 * Extract text from PPTX slide XML.
 * Text is inside <a:t> elements. <a:p> elements represent paragraphs.
 */
function extractTextFromPptxXml(xml: string): string[] {
  const results: string[] = [];

  // Match <a:p>...</a:p> paragraph blocks
  const paragraphRegex = /<a:p[ >][\s\S]*?<\/a:p>/g;
  let paraMatch: RegExpExecArray | null;

  while ((paraMatch = paragraphRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    const texts: string[] = [];
    let textMatch: RegExpExecArray | null;

    while ((textMatch = textRegex.exec(paraXml)) !== null) {
      const t = textMatch[1]?.trim();
      if (t) texts.push(t);
    }

    if (texts.length > 0) {
      results.push(texts.join(""));
    }
  }

  return results;
}
