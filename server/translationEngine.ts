/**
 * Translation Engine
 * Two-step translation: Chinese → English (with glossary) → Target Language (with glossary)
 * This ensures consistent terminology and better translation quality.
 */
import { invokeLLM } from "./_core/llm";
import type { Segment, TranslatedSegment } from "../drizzle/schema";

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
      // Convert TranslatedSegment[] back to Segment[] for step 2
      const englishAsSegments: Segment[] = englishSegments.map((s) => ({
        id: s.id,
        text: s.text,
        order: 0,
        type: "paragraph",
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
    segments.map((s) => ({ id: s.id, text: s.text }))
  );

  const sourceLangName = sourceLang === "zh" ? "Chinese" : "English";

  const systemPrompt = `You are a professional enterprise training document translator. Translate ${sourceLangName} text into ${targetLangName} with high accuracy and professional terminology.${glossaryInstruction}

Rules:
1. Preserve the original meaning, tone, and structure exactly.
2. For technical or professional terms, follow the glossary strictly.
3. Return ONLY a valid JSON object with a "segments" array.
4. Each object must have "id" (unchanged from input) and "text" (translated) fields.
5. Do not add explanations or extra text outside the JSON.`;

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
    return segments.map((s) => ({ id: s.id, text: s.text }));
  }
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
        content: `You are a helpful learning assistant. Your task is to explain professional training content in simple, easy-to-understand ${langName}.
When explaining:
1. Use simple, everyday language that anyone can understand.
2. Break down technical terms with plain explanations.
3. Keep the explanation concise (2-4 sentences).
4. Respond in ${langName} only.`,
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
