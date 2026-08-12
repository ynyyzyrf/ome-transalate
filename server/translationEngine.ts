/**
 * Translation Engine
 * Two-step translation: Chinese → English (with glossary) → Target Language (with glossary)
 * This ensures consistent terminology and better translation quality.
 */
import { invokeLLM } from "./_core/llm";
import type { Segment, TranslatedSegment } from "../drizzle/schema";
import type { IRBlock } from "./documentIr";

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish (Español)",
  th: "Thai (ภาษาไทย)",
  hi: "Hindi (हिन्दी)",
  vi: "Vietnamese (Tiếng Việt)",
};

export interface GlossaryTerm {
  sourceTerm: string;   // Chinese source term
  englishTerm: string;  // English base translation
  targetTerm: string;   // Target language translation
}

/**
 * Build glossary instruction block for Chinese → English step.
 */
function buildEnglishGlossaryInstruction(glossary: GlossaryTerm[]): string {
  if (!glossary.length) return "";
  const termList = glossary
    .map((g) => `  - "${g.sourceTerm}" → "${g.englishTerm}"`)
    .join("\n");
  return `\n\n## Terminology Reference (MUST follow strictly)\nWhen translating, strictly use these term mappings:\n${termList}\n`;
}

/**
 * Build glossary instruction block for English → Target Language step.
 */
function buildTargetGlossaryInstruction(glossary: GlossaryTerm[], langName: string): string {
  if (!glossary.length) return "";
  const termList = glossary
    .map((g) => `  - "${g.englishTerm}" → "${g.targetTerm}"`)
    .join("\n");
  return `\n\n## Terminology Reference for ${langName} (MUST follow strictly)\nWhen translating, strictly use these term mappings:\n${termList}\n`;
}

/**
 * Translate a batch of segments using two-step LLM translation.
 * Step 1: Chinese → English (with Chinese→English glossary)
 * Step 2: English → Target Language (with English→Target glossary)
 * For English target, only Step 1 is performed.
 */
export async function translateSegments(
  segments: Segment[],
  targetLanguage: string,
  glossary: GlossaryTerm[] = [],
  onProgress?: (completed: number, total: number) => void
): Promise<TranslatedSegment[]> {
  const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  const results: TranslatedSegment[] = [];
  const CHUNK_SIZE = 10;

  for (let i = 0; i < segments.length; i += CHUNK_SIZE) {
    const chunk = segments.slice(i, i + CHUNK_SIZE);

    // Step 1: Chinese → English
    const englishInstruction = buildEnglishGlossaryInstruction(glossary);
    const englishSegments = await translateChunk(chunk, "English", englishInstruction, "zh", "en");

    let finalSegments: TranslatedSegment[];

    if (targetLanguage === "en") {
      // For English target, step 1 is the final result
      finalSegments = englishSegments;
    } else {
      // Step 2: English → Target Language
      const targetInstruction = buildTargetGlossaryInstruction(glossary, langName);
      // Convert TranslatedSegment[] back to Segment[] for step 2, preserving the
      // original block type so the model still knows headings from lists/tables.
      const englishAsSegments: Segment[] = englishSegments.map((s, idx) => ({
        id: s.id,
        text: s.text,
        order: 0,
        type: chunk[idx].type,
      }));
      finalSegments = await translateChunk(englishAsSegments, langName, targetInstruction, "en", targetLanguage);
    }

    results.push(...finalSegments);
    onProgress?.(Math.min(i + CHUNK_SIZE, segments.length), segments.length);
  }

  return results;
}

async function translateChunk(
  segments: Segment[],
  targetLangName: string,
  glossaryInstruction: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslatedSegment[]> {
  const inputJson = JSON.stringify(
    segments.map((s) => ({ id: s.id, text: s.text, ...(s.type ? { type: s.type } : {}) }))
  );

  const sourceLangName = sourceLang === "zh" ? "Chinese" : "English";

  const systemPrompt = `You are a professional enterprise training document translator. Translate ${sourceLangName} training material into ${targetLangName} with high accuracy and professional terminology.${glossaryInstruction}

Style & tone:
1. Preserve the original meaning, tone, and structure exactly. Do not add, omit, or summarize content.
2. For technical or professional terms, follow the glossary strictly.
3. Headings must stay short, clear, and parallel in form. Keep numbers, codes, and identifiers exactly as-is.
4. Lists and tables must keep their format. Do not merge list items or table cells.
5. Translate ALL quoted text — slogans, catchphrases, and short phrases inside quotation marks — fully into ${targetLangName}. Never leave English phrases untranslated just because they are quoted.
6. When the source mixes in English loanwords (e.g. "CALL"), translate them into ${targetLangName} too. The output must read as natural ${targetLangName} with no leftover English. Keep unchanged ONLY genuine brand/product names, company names, person names, URLs, email addresses, numbers, codes, and identifiers.

Output format:
5. Return ONLY a valid JSON object with a "segments" array.
6. Each object must have "id" (unchanged from input), "text" (translated), and "type" (unchanged from input) fields.
7. Do not add explanations or extra text outside the JSON.`;

  const userPrompt = `Translate the following ${sourceLangName} training document segments to ${targetLangName}. Return a JSON object with a "segments" array:

${inputJson}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_object",
      },
    }, "translate");

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty LLM response");
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    const parsed = JSON.parse(content);
    const translated: TranslatedSegment[] = parsed.segments || [];

    // Ensure all input segments have a translation (fallback to original)
    return segments.map((seg) => {
      const found = translated.find((t: TranslatedSegment) => t.id === seg.id);
      return found || { id: seg.id, text: seg.text };
    });
  } catch (err) {
    console.error(`[TranslationEngine] Chunk translation failed (${sourceLang}→${targetLang}):`, err);
    throw err;
  }
}

export async function translateBlocks(
  blocks: IRBlock[],
  targetLanguage: string,
  glossary: GlossaryTerm[] = [],
  onProgress?: (completed: number, total: number) => void
): Promise<IRBlock[]> {
  const textBlocks = blocks.filter(
    (b): b is IRBlock & { type: "heading" | "paragraph" | "list" | "table" } => b.type !== "image"
  );
  const segments: Segment[] = textBlocks.map((b, idx) => ({
    id: b.id,
    text: b.text || "",
    order: Number(b.meta?.order) || idx + 1,
    type: b.type,
  }));

  const translated = await translateSegments(segments, targetLanguage, glossary, onProgress);
  const byId = new Map(translated.map((t) => [t.id, t.text]));
  return blocks.map((b) => {
    if (b.type === "image") {
      return { ...b };
    }
    return { ...b, text: byId.get(b.id) ?? "" };
  });
}

/**
 * Context window for AI explanation — provides surrounding segments
 * so the model can understand the full context of the target paragraph.
 */
export interface ExplainContext {
  /** Segments that appear before the target paragraph (max ~3) */
  precedingSegments?: Array<{ original: string; translated: string }>;
  /** Segments that appear after the target paragraph (max ~2) */
  followingSegments?: Array<{ original: string; translated: string }>;
}

/**
 * AI Explanation: Re-explain a paragraph in simpler language.
 * When `context` is provided, the surrounding segments are included
 * in the prompt so the AI understands the broader context.
 */
export async function explainSegment(
  originalText: string,
  translatedText: string,
  targetLanguage: string,
  context?: ExplainContext
): Promise<string> {
  const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  // Build context window block
  let contextBlock = "";
  if (context?.precedingSegments?.length) {
    contextBlock += "\n\nPreceding context (earlier in the same document):\n";
    contextBlock += context.precedingSegments
      .map((s) => `- Original: "${s.original}" → Translation: "${s.translated}"`)
      .join("\n");
  }
  if (context?.followingSegments?.length) {
    contextBlock += "\n\nFollowing context (later in the same document):\n";
    contextBlock += context.followingSegments
      .map((s) => `- Original: "${s.original}" → Translation: "${s.translated}"`)
      .join("\n");
  }

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a friendly learning assistant for enterprise training materials. Your job is to help a learner with limited background knowledge understand a paragraph of translated content.

Style rules:
1. Use simple, everyday ${langName} — as if explaining to a colleague who is new to the topic.
2. Explain any technical terms or jargon in plain language.
3. Be concise: 2-4 sentences.
4. Respond in ${langName} only. Do not quote or restate the full original text.`,
      },
      {
        role: "user",
        content: `Original Chinese text: "${originalText}"

Current ${langName} translation: "${translatedText}"
${contextBlock}
Please re-explain this content in simpler ${langName} that is easy to understand for someone unfamiliar with the topic. Also explain any technical terms used.

Note: The surrounding context (if provided) is for reference only — focus your explanation on the target paragraph above.`,
      },
    ],
  }, "explain");

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) return translatedText;
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}
