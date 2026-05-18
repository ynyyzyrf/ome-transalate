import {
  type InvokeParams,
  type InvokeResult,
  type LLMProvider,
  type LLMProviderConfig,
  type TextContent,
  type ImageContent,
  type FileContent,
  type Message,
  LLMError,
} from "./provider";

/**
 * Convert our internal Message format to Anthropic Messages API format.
 */
function toAnthropicMessages(messages: Message[]) {
  const systemMessages: string[] = [];
  const apiMessages: Array<{
    role: "user" | "assistant";
    content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;
  }> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      // Anthropic uses a separate "system" parameter
      const text = typeof msg.content === "string"
        ? msg.content
        : msg.content.map(c => typeof c === "string" ? c : c.type === "text" ? c.text : "").filter(Boolean).join("\n");
      systemMessages.push(text);
      continue;
    }

    const content = Array.isArray(msg.content) ? msg.content : [msg.content];
    const apiContent: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];

    for (const part of content) {
      if (typeof part === "string") {
        apiContent.push({ type: "text", text: part });
      } else if (part.type === "text") {
        apiContent.push({ type: "text", text: part.text });
      } else if (part.type === "image_url") {
        // Anthropic expects base64-encoded images. We'll pass the URL and let the API handle it.
        // For now, convert image_url to text noting the URL
        apiContent.push({ type: "text", text: `[Image: ${part.image_url.url}]` });
      }
    }

    if (msg.role === "user" || msg.role === "assistant") {
      apiMessages.push({ role: msg.role, content: apiContent });
    } else {
      // Map tool/function roles to "user" for Anthropic
      const text = apiContent.map(c => c.text || "").filter(Boolean).join("\n");
      apiMessages.push({ role: "user", content: [{ type: "text", text: `[${msg.role}]: ${text}` }] });
    }
  }

  return { system: systemMessages.join("\n"), messages: apiMessages };
}

/**
 * Convert Anthropic response back to our InvokeResult format.
 */
function fromAnthropicResponse(antResponse: any): InvokeResult {
  return {
    id: antResponse.id,
    created: Date.now(),
    model: antResponse.model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: antResponse.content?.[0]?.text || "",
      },
      finish_reason: antResponse.stop_reason === "end_turn" ? "stop" : antResponse.stop_reason,
    }],
    usage: antResponse.usage ? {
      prompt_tokens: antResponse.usage.input_tokens,
      completion_tokens: antResponse.usage.output_tokens,
      total_tokens: antResponse.usage.input_tokens + antResponse.usage.output_tokens,
    } : undefined,
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";

  private anthropicVersion = "2023-06-01";

  constructor(private config: LLMProviderConfig) {}

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    const baseUrl = this.config.baseUrl || "https://api.anthropic.com";
    const url = `${baseUrl.replace(/\/$/, "")}/v1/messages`;

    const { system, messages } = toAnthropicMessages(params.messages);

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: params.maxTokens || params.max_tokens || 4096,
      messages,
    };

    if (system) {
      body.system = system;
    }

    // Structured output via Anthropic's extended thinking or tools
    if (params.responseFormat?.type === "json_schema" || params.response_format?.type === "json_schema") {
      const schema = params.responseFormat?.type === "json_schema"
        ? params.responseFormat.json_schema
        : (params.response_format?.type === "json_schema" ? params.response_format.json_schema : undefined);

      if (schema) {
        body.tools = [{
          name: schema.name || "structured_output",
          description: "Output structured data according to the schema",
          input_schema: schema.schema,
        }];
        body.tool_choice = { type: "tool", name: schema.name || "structured_output" };
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": this.anthropicVersion,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMError(
        `Anthropic API error: ${response.status} ${response.statusText} – ${errorText}`,
        this.name,
        response.status
      );
    }

    const antResponse = await response.json();

    // Handle tool use for structured output
    if (antResponse.content?.[0]?.type === "tool_use") {
      const toolContent = antResponse.content[0].input;
      return {
        id: antResponse.id,
        created: Date.now(),
        model: antResponse.model,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify(toolContent),
          },
          finish_reason: "stop",
        }],
        usage: antResponse.usage ? {
          prompt_tokens: antResponse.usage.input_tokens,
          completion_tokens: antResponse.usage.output_tokens,
          total_tokens: antResponse.usage.input_tokens + antResponse.usage.output_tokens,
        } : undefined,
      };
    }

    return fromAnthropicResponse(antResponse);
  }
}
