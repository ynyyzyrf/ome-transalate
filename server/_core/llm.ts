/**
 * Backward-compatibility re-export.
 * New code should import from ./llm/index.js directly.
 */
export { invokeLLM, getLLMProvider, LLMError } from "./llm/index";
export type {
  InvokeParams,
  InvokeResult,
  Message,
  Tool,
  ToolCall,
  ResponseFormat,
  OutputSchema,
  JsonSchema,
} from "./llm/provider";
