import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
}));

vi.mock("../_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
}));

import { translateSegments } from "../translationEngine";

function llmReply(json: unknown) {
  return { choices: [{ message: { content: JSON.stringify(json) } }] };
}

describe("translationEngine localization prompt", () => {
  beforeEach(() => {
    mocks.invokeLLM.mockReset();
  });

  it("asks the model to fully localize quoted slogans and English loanwords (no leftover English)", async () => {
    mocks.invokeLLM.mockResolvedValue(
      llmReply({ segments: [{ id: "s1", text: "dummy", type: "paragraph" }] })
    );

    const result = await translateSegments(
      [
        {
          id: "s1",
          type: "paragraph",
          text: '我的原文是从"要我CALL"到"我要CALL"，重塑CALL新客认知',
          order: 1,
        },
      ],
      "th"
    );

    // zh → en, then en → th
    expect(mocks.invokeLLM).toHaveBeenCalledTimes(2);

    const systemPrompts = mocks.invokeLLM.mock.calls.map(
      (call) =>
        call[0].messages.find((m: { role: string }) => m.role === "system")?.content as string
    );

    for (const sp of systemPrompts) {
      expect(sp).toContain("Translate ALL quoted text");
      expect(sp).toContain("transliterate it phonetically");
      expect(sp).toContain("NO Latin-script words");
    }

    // The second step targets Thai specifically.
    expect(systemPrompts[1]).toContain("Thai");

    // Plumbing intact: ids preserved, mock output flows through.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "s1", text: "dummy" });
  });
});
