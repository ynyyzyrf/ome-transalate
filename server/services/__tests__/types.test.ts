import { describe, expect, it } from "vitest";
import {
  DASHBOARD_DEFAULT_TARGET_LANGUAGES,
  documentUploadInputSchema,
  courseCreateInputSchema,
  resolveTargetLanguages,
} from "../types";

describe("ingestion shared types", () => {
  it("defaults document upload target languages to English", () => {
    const result = documentUploadInputSchema.parse({
      filename: "training.pdf",
      mimeType: "application/pdf",
      base64Content: "ZmFrZQ==",
    });

    expect(result.targetLanguages).toEqual(["en"]);
  });

  it("keeps dashboard default target languages when no explicit languages are provided", () => {
    expect(resolveTargetLanguages(undefined, DASHBOARD_DEFAULT_TARGET_LANGUAGES)).toEqual([
      "en",
      "es",
      "th",
      "hi",
      "vi",
    ]);
    expect(resolveTargetLanguages([], DASHBOARD_DEFAULT_TARGET_LANGUAGES)).toEqual([
      "en",
      "es",
      "th",
      "hi",
      "vi",
    ]);
  });

  it("preserves explicit target languages instead of replacing them with defaults", () => {
    expect(resolveTargetLanguages(["en", "vi"], DASHBOARD_DEFAULT_TARGET_LANGUAGES)).toEqual([
      "en",
      "vi",
    ]);
  });

  it("parses dashboard file-based course creation input", () => {
    const result = courseCreateInputSchema.parse({
      title: "File course",
      file: {
        filename: "training.pdf",
        mimeType: "application/pdf",
        base64Content: "ZmFrZQ==",
      },
    });

    expect(result.title).toBe("File course");
    expect(result.file?.filename).toBe("training.pdf");
  });

  it("parses dashboard manual-text course creation input", () => {
    const result = courseCreateInputSchema.parse({
      title: "Manual course",
      originalContent: "第一段\n第二段",
      targetLanguages: ["en", "es"],
    });

    expect(result.originalContent).toBe("第一段\n第二段");
    expect(result.targetLanguages).toEqual(["en", "es"]);
  });
});
