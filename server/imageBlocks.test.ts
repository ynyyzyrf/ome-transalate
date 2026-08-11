import { describe, expect, it } from "vitest";
import { isImagePlaceholderText, isImageLikeBlock } from "../shared/imageBlocks";

describe("image block helpers", () => {
  it("treats [IMAGE] placeholder text as an image-like block", () => {
    expect(isImagePlaceholderText("[IMAGE]")).toBe(true);
    expect(isImagePlaceholderText(" [image] ")).toBe(true);
    expect(isImageLikeBlock({ text: "[IMAGE]" })).toBe(true);
  });

  it("treats explicit image blocks as image-like blocks", () => {
    expect(isImageLikeBlock({ type: "image", text: "" })).toBe(true);
  });

  it("does not treat normal text blocks as image-like blocks", () => {
    expect(isImagePlaceholderText("hello")).toBe(false);
    expect(isImageLikeBlock({ type: "paragraph", text: "hello" })).toBe(false);
  });
});
