/**
 * Document parser regression tests.
 * Guards the CRLF paragraph-split fix and the MinerU markdown-heading fix.
 */
import { describe, expect, it } from "vitest";
import { textToSegments, markdownToIr, looksLikeText } from "./documentParser";

describe("textToSegments line-ending normalization", () => {
  it("splits Windows documents (CRLF blank lines) into separate paragraphs", () => {
    const result = textToSegments("第一段\r\n\r\n第二段\r\n\r\n第三段");
    expect(result.segments.map((s) => s.text)).toEqual(["第一段", "第二段", "第三段"]);
  });

  it("collapses single CRLF line breaks inside a paragraph into spaces", () => {
    const result = textToSegments("第一行\r\n第二行\r\n\r\n下一段");
    expect(result.segments.map((s) => s.text)).toEqual(["第一行 第二行", "下一段"]);
  });

  it("still splits LF-only documents correctly", () => {
    const result = textToSegments("A\n\nB\n\nC");
    expect(result.segments.map((s) => s.text)).toEqual(["A", "B", "C"]);
  });
});

describe("markdownToIr markdown headings", () => {
  it("detects MinerU #-prefixed headings and strips the marker", () => {
    // Body text includes punctuation so the short-Chinese-is-heading heuristic does not
    // interfere — this test isolates the markdown-heading fix.
    const { blocks } = markdownToIr("# 第一章\n\n正文內容包含：開戶流程說明。");
    expect(blocks[0].type).toBe("heading");
    expect(blocks[0].text).toBe("第一章");
    expect(blocks[1].type).toBe("paragraph");
    expect(blocks[1].text).toBe("正文內容包含：開戶流程說明。");
  });

  it("keeps body paragraphs as paragraphs", () => {
    const { blocks } = markdownToIr("普通段落一，包含多個句子。\n\n普通段落二，也包含多個句子。");
    expect(blocks.every((b) => b.type === "paragraph")).toBe(true);
  });
});

describe("markdownToIr image markers", () => {
  it("does not swallow a paragraph that merely contains image-markdown syntax", () => {
    const { blocks } = markdownToIr("前文 ![x](y) 後文");
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[0].text).toBe("前文 ![x](y) 後文");
  });

  it("captures the alt text and trailing text of a real image marker as a caption", () => {
    const { blocks } = markdownToIr("![圖表](img.png) 補充說明");
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].meta?.caption).toBe("圖表 補充說明");
  });

  it("still recognizes a bare image marker without a caption", () => {
    const { blocks } = markdownToIr("![](img.png)");
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].meta?.caption).toBeUndefined();
  });

  it("still recognizes legacy plain markers", () => {
    const { blocks } = markdownToIr("[image]");
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].meta?.imageIndex).toBe(0);
  });
});

describe("markdownToIr image association", () => {
  it("resolves the marker filename against the extracted assets by basename", () => {
    const { blocks } = markdownToIr("![第一張](2.png)\n\n![第二張](1.png)", [
      { index: 0, name: "images/1.png", url: "https://cdn/1.png" },
      { index: 1, name: "images/2.png", url: "https://cdn/2.png" },
    ]);
    // blocks[0] references "2.png" → the asset whose basename is "2.png" (index 1),
    // NOT the positional first asset. Ordering in the zip differs from the markdown.
    expect(blocks[0].meta?.imageUrl).toBe("https://cdn/2.png");
    expect(blocks[1].meta?.imageUrl).toBe("https://cdn/1.png");
  });
});

describe("looksLikeText", () => {
  it("accepts readable text", () => {
    expect(looksLikeText("開戶流程說明")).toBe(true);
    expect(looksLikeText("hello world\nsecond line")).toBe(true);
  });

  it("rejects binary blobs (control-byte heavy / invalid UTF-8)", () => {
    const blob = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0xff, 0xfe]);
    expect(looksLikeText(blob.toString("utf-8"))).toBe(false);
  });

  it("rejects empty input", () => {
    expect(looksLikeText("")).toBe(false);
  });
});

describe("table heuristic", () => {
  it("does not label Chinese prose containing ASCII commas as a table", () => {
    const result = textToSegments("開戶需準備身份證,護照,駕照,印章,財力證明等五項文件。");
    expect(result.segments[0].type).toBe("paragraph");
  });

  it("still labels Latin CSV rows as tables", () => {
    const result = textToSegments("John,Doe,30,NY,2024");
    expect(result.segments[0].type).toBe("table");
  });

  it("labels pipe-separated rows as tables", () => {
    const result = textToSegments("姓名 | 年齡 | 城市");
    expect(result.segments[0].type).toBe("table");
  });
});
