/**
 * XMind text extraction via ZIP + XML parsing.
 * XMind files (.xmind) are ZIP archives. The main content is in content.xml
 * or content.json (newer formats). Topics form a tree structure.
 */
import JSZip from "jszip";
import type { ParseResult } from "../documentParser";

export async function parseXmind(buffer: Buffer): Promise<ParseResult> {
  const { textToSegments } = await import("../documentParser");
  const zip = await JSZip.loadAsync(buffer);

  if (zip.files["content.xml"]) {
    const raw = await zip.files["content.xml"].async("text");
    const text = extractFromXml(raw);
    return textToSegments(text || "[XMind 文件]\n無內容。");
  }

  if (zip.files["content.json"]) {
    const raw = await zip.files["content.json"].async("text");
    try {
      const json = JSON.parse(raw);
      const text = extractFromJson(json);
      return textToSegments(text || "[XMind 文件]\n無內容。");
    } catch {
      return textToSegments("[XMind 文件]\n無法解析 content.json。");
    }
  }

  return textToSegments("[XMind 文件]\n無法找到 content.xml 或 content.json。");
}

// ── XML helpers (no regex for nested tags) ───────────────────────────────

/**
 * Find the next opening tag (NOT a closing tag or a longer tag name).
 * Ensures the character after `<tag` is `>`, whitespace, or `/` (self-closing),
 * but NOT a letter/digit (tag name extension like `<topics` matching `<topic`),
 * and NOT `/` (closing tag like `</topic>`).
 */
function findOpenTag(xml: string, tag: string, start: number): number {
  const prefix = `<${tag}`;
  let pos = start;
  while (pos < xml.length) {
    const idx = xml.indexOf(prefix, pos);
    if (idx === -1) return -1;
    const after = xml[idx + prefix.length];
    // Valid terminators for a tag name: '>', ' ', '\t', '\n', '\r', '/'
    // Letters and digits mean this is a longer tag (e.g. <topics != <topic)
    if (after === ">" || after === " " || after === "\t" || after === "\n" || after === "\r") {
      return idx;
    }
    // If it's '/', it might be self-closing (<topic/>) — we still want to match
    // But NOT if followed by more name chars
    // For simplicity: only '>' and whitespace are valid endings
    pos = idx + 1;
  }
  return -1;
}

/**
 * Find the next closing tag </tag> from start.
 */
function findCloseTag(xml: string, tag: string, start: number): number {
  return xml.indexOf(`</${tag}>`, start);
}

/**
 * Find a child element's content by matching balanced open/close tags.
 * Returns the inner XML string or null.
 */
function balancedInner(xml: string, tag: string): string | null {
  const openIdx = findOpenTag(xml, tag, 0);
  if (openIdx === -1) return null;

  const tagEnd = xml.indexOf(">", openIdx);
  if (tagEnd === -1) return null;

  let depth = 1;
  let searchFrom = tagEnd + 1;

  while (depth > 0 && searchFrom < xml.length) {
    const nextOpen = findOpenTag(xml, tag, searchFrom);
    const nextClose = findCloseTag(xml, tag, searchFrom);

    if (nextClose === -1) return null;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      const nestedEnd = xml.indexOf(">", nextOpen);
      searchFrom = nestedEnd !== -1 ? nestedEnd + 1 : nextOpen + 1;
    } else {
      depth--;
      if (depth === 0) {
        return xml.substring(tagEnd + 1, nextClose);
      }
      searchFrom = nextClose + `</${tag}>`.length;
    }
  }

  return null;
}

/**
 * Get all direct children of a tag, correctly handling nesting.
 */
function allBalancedChildren(xml: string, tag: string): string[] {
  const results: string[] = [];

  let pos = 0;
  while (pos < xml.length) {
    const openIdx = findOpenTag(xml, tag, pos);
    if (openIdx === -1) break;

    const tagEnd = xml.indexOf(">", openIdx);
    if (tagEnd === -1) break;

    let depth = 1;
    let searchFrom = tagEnd + 1;

    while (depth > 0 && searchFrom < xml.length) {
      const nextOpen = findOpenTag(xml, tag, searchFrom);
      const nextClose = findCloseTag(xml, tag, searchFrom);

      if (nextClose === -1) {
        pos = xml.length;
        break;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        const nestedEnd = xml.indexOf(">", nextOpen);
        searchFrom = nestedEnd !== -1 ? nestedEnd + 1 : nextOpen + 1;
      } else {
        depth--;
        if (depth === 0) {
          results.push(xml.substring(tagEnd + 1, nextClose));
          pos = nextClose + `</${tag}>`.length;
        } else {
          searchFrom = nextClose + `</${tag}>`.length;
        }
      }
    }

    if (depth > 0) break;
  }

  return results;
}

/** Simple tag inner text (no child elements). */
function simpleTagText(xml: string, tag: string): string {
  // Try <tag>content</tag>
  const openSimple = `<${tag}>`;
  const closeSimple = `</${tag}>`;
  const idx = xml.indexOf(openSimple);
  if (idx !== -1) {
    const endIdx = xml.indexOf(closeSimple, idx + openSimple.length);
    if (endIdx !== -1) return xml.substring(idx + openSimple.length, endIdx).trim();
  }

  // Try <tag ...attributes...>content</tag>
  const openWithAttrs = `<${tag}`;
  const idx2 = findOpenTag(xml, tag, 0);
  if (idx2 === -1) return "";
  const tagEnd = xml.indexOf(">", idx2);
  if (tagEnd === -1) return "";
  const endIdx = xml.indexOf(closeSimple, tagEnd);
  if (endIdx === -1) return "";
  return xml.substring(tagEnd + 1, endIdx).trim();
}

// ── XMind XML traversal ──────────────────────────────────────────────────

function extractFromXml(xml: string): string {
  const lines: string[] = [];
  const sheets = allBalancedChildren(xml, "sheet");

  for (const sheet of sheets) {
    const rootTopics = allBalancedChildren(sheet, "topic");
    for (const rootTopic of rootTopics) {
      traverseXmlTopic(rootTopic, 0, lines);
    }
  }

  return lines.join("\n");
}

function traverseXmlTopic(topicBody: string, depth: number, out: string[]): void {
  const title = simpleTagText(topicBody, "title");
  if (title) {
    const indent = "  ".repeat(depth);
    const prefix = depth === 0 ? "" : "- ";
    out.push(`${indent}${prefix}${title}`);
  }

  // Find <children> -> <topics> -> <topic>*
  const childrenXml = balancedInner(topicBody, "children");
  if (childrenXml) {
    const topicsXml = balancedInner(childrenXml, "topics");
    if (topicsXml) {
      const childTopics = allBalancedChildren(topicsXml, "topic");
      for (const child of childTopics) {
        traverseXmlTopic(child, depth + 1, out);
      }
    }
  }
}

// ── XMind JSON traversal (Zen format) ───────────────────────────────────

function extractFromJson(json: any): string {
  const lines: string[] = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      traverseTopicJson(item, 0, lines);
    }
  } else if (json?.rootTopic) {
    traverseTopicJson(json.rootTopic, 0, lines);
  }

  return lines.join("\n");
}

function traverseTopicJson(topic: any, depth: number, out: string[]): void {
  if (!topic) return;

  const title = topic.title || topic.text || "";
  if (title) {
    const indent = "  ".repeat(depth);
    const prefix = depth === 0 ? "" : "- ";
    out.push(`${indent}${prefix}${title}`);
  }

  const children = topic.children?.attached || topic.children || [];
  for (const child of children) {
    traverseTopicJson(child, depth + 1, out);
  }
}
