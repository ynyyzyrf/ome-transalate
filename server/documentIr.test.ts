import { describe, expect, it } from "vitest";
import { translatedSegmentsToBlocks, type IRBlock } from "./documentIr";

const sourceBlocks: IRBlock[] = [
  { id: "a", type: "paragraph", text: "中文一" },
  { id: "b", type: "paragraph", text: "中文二" },
  { id: "c", type: "paragraph", text: "中文三" },
];

describe("translatedSegmentsToBlocks", () => {
  it("matches translations by block id", () => {
    const result = translatedSegmentsToBlocks(
      [
        { id: "a", text: "EN one" },
        { id: "b", text: "EN two" },
        { id: "c", text: "EN three" },
      ],
      sourceBlocks,
    );
    expect(result.map((b) => b.text)).toEqual(["EN one", "EN two", "EN three"]);
  });

  it("falls back positionally for same-length legacy jobs whose ids do not match", () => {
    const result = translatedSegmentsToBlocks(
      [
        { id: "legacy-1", text: "EN one" },
        { id: "legacy-2", text: "EN two" },
        { id: "legacy-3", text: "EN three" },
      ],
      sourceBlocks,
    );
    expect(result.map((b) => b.text)).toEqual(["EN one", "EN two", "EN three"]);
  });

  it("keeps source text instead of stitching the wrong translation when lengths differ", () => {
    const result = translatedSegmentsToBlocks(
      [{ id: "only-one", text: "EN partial" }],
      sourceBlocks,
    );
    expect(result.map((b) => b.text)).toEqual(["中文一", "中文二", "中文三"]);
  });

  it("keeps source text when there is no translation data", () => {
    const result = translatedSegmentsToBlocks([], sourceBlocks);
    expect(result.map((b) => b.text)).toEqual(["中文一", "中文二", "中文三"]);
  });
});
