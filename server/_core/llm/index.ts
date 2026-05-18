import {
  type LLMProvider,
  type LLMProviderConfig,
  type LLMProviderRecord,
  type LLMTask,
  LLMError,
  LLM_TASKS,
} from "./provider";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { ENV } from "../env";

// Re-export all types for backward compatibility
export * from "./provider";

// ─── Provider Registry ────────────────────────────────────────────────────
// Lazy-initialized per-task providers. Each task resolves to its configured
// provider (or falls back to the default).

let _providers: Partial<LLMProviderRecord> = {};

function createProvider(providerName: string, model: string): LLMProvider {
  switch (providerName) {
    case "openai": {
      const apiKey = ENV.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required for OpenAI provider");
      }
      const config: LLMProviderConfig = {
        apiKey,
        baseUrl: ENV.OPENAI_BASE_URL,
        model,
      };
      return new OpenAIProvider(config);
    }

    case "anthropic": {
      const apiKey = ENV.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is required for Anthropic provider");
      }
      const config: LLMProviderConfig = {
        apiKey,
        model,
      };
      return new AnthropicProvider(config);
    }

    case "deepseek": {
      const apiKey = ENV.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error("DEEPSEEK_API_KEY is required for DeepSeek provider");
      }
      const config: LLMProviderConfig = {
        apiKey,
        baseUrl: "https://api.deepseek.com",
        model,
      };
      return new OpenAIProvider(config);
    }

    default:
      throw new Error(`Unsupported LLM provider: ${providerName}`);
  }
}

function getDefaultProvider(): LLMProvider {
  if (!_providers.default) {
    _providers.default = createProvider(ENV.LLM_PROVIDER, ENV.LLM_MODEL);
    console.log(`[LLM] Default provider: ${ENV.LLM_PROVIDER} (model: ${ENV.LLM_MODEL})`);
  }
  return _providers.default;
}

/**
 * Get or create a provider for a specific task.
 * Falls back to the default provider if no task-specific config.
 */
function getProviderForTask(task: LLMTask): LLMProvider {
  if (_providers[task]) return _providers[task]!;

  // Resolve task-specific config from env
  let providerName: string | undefined;
  let model: string | undefined;

  switch (task) {
    case "translate":
      providerName = ENV.LLM_TRANSLATE_PROVIDER;
      model = ENV.LLM_TRANSLATE_MODEL;
      break;
    case "explain":
      providerName = ENV.LLM_EXPLAIN_PROVIDER;
      model = ENV.LLM_EXPLAIN_MODEL;
      break;
  }

  if (providerName) {
    _providers[task] = createProvider(providerName, model || ENV.LLM_MODEL);
    console.log(`[LLM] Task "${task}" → ${providerName} (model: ${model || ENV.LLM_MODEL})`);
  } else {
    // No task-specific config — share the default provider
    _providers[task] = getDefaultProvider();
  }

  return _providers[task]!;
}

/**
 * Get the default LLM provider (for programmatic access).
 */
export function getLLMProvider(): LLMProvider {
  return getDefaultProvider();
}

/**
 * Get the provider for a specific task type.
 */
export function getProvider(task: LLMTask): LLMProvider {
  return getProviderForTask(task);
}

/**
 * Invoke LLM with optional task routing.
 * When `task` is provided, routes to the task-specific provider/model.
 *
 * Usage:
 *   // Uses default provider (backward compatible)
 *   await invokeLLM({ messages: [...] })
 *
 *   // Uses task-specific provider
 *   await invokeLLM({ messages: [...] }, "translate")
 *   await invokeLLM({ messages: [...] }, "explain")
 */
export async function invokeLLM(
  params: import("./provider").InvokeParams,
  task?: LLMTask,
): Promise<import("./provider").InvokeResult> {
  const provider = task ? getProviderForTask(task) : getDefaultProvider();
  return provider.invoke(params);
}

export { LLMError } from "./provider";
