import {
  type InvokeParams,
  type InvokeResult,
  type LLMProvider,
  type LLMProviderConfig,
  type Message,
  type MessageContent,
  type TextContent,
  type ImageContent,
  type FileContent,
  type ToolChoice,
  type ToolChoiceExplicit,
  type ResponseFormat,
  type OutputSchema,
  type JsonSchema,
  LLMError,
} from "./provider";

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }

  return { role, name, content: contentParts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: import("./provider").Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }

    if (tools.length > 1) {
      throw new Error("tool_choice 'required' needs a single tool or specify the tool name explicitly");
    }

    return { type: "function", function: { name: tools[0].function.name } };
  }

  if ("name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }

  return toolChoice;
};

const normalizeResponseFormat = (params: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}): { type: "json_schema"; json_schema: JsonSchema } | { type: "text" } | { type: "json_object" } | undefined => {
  const explicitFormat = params.responseFormat || params.response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return explicitFormat;
  }

  const schema = params.outputSchema || params.output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";

  constructor(private config: LLMProviderConfig) {}

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: params.messages.map(normalizeMessage),
    };

    if (params.tools && params.tools.length > 0) {
      payload.tools = params.tools;
    }

    const normalizedToolChoice = normalizeToolChoice(
      params.toolChoice || params.tool_choice,
      params.tools
    );
    if (normalizedToolChoice) {
      payload.tool_choice = normalizedToolChoice;
    }

    if (params.maxTokens || params.max_tokens) {
      payload.max_tokens = params.maxTokens || params.max_tokens;
    }

    const normalizedResponseFormat = normalizeResponseFormat({
      responseFormat: params.responseFormat,
      response_format: params.response_format,
      outputSchema: params.outputSchema,
      output_schema: params.output_schema,
    });

    if (normalizedResponseFormat) {
      payload.response_format = normalizedResponseFormat;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMError(
        `OpenAI API error: ${response.status} ${response.statusText} – ${errorText}`,
        this.name,
        response.status
      );
    }

    return (await response.json()) as InvokeResult;
  }
}
