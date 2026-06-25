export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatCompletionOptions {
  url: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  jsonMode?: boolean;
  thinking?: "enabled" | "disabled";
  temperature?: number;
  fetchImpl?: typeof fetch;
}

export interface StreamChatCompletionResult {
  content: string;
  finishReason: string | null;
  interrupted: boolean;
}

function getErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.message || raw;
  } catch {
    return raw;
  }
}

export function isCompleteJsonContent(raw: string): boolean {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned) return false;
  try {
    JSON.parse(cleaned);
    return true;
  } catch {
    return false;
  }
}

export function extractCompleteJsonContent(raw: string): string | null {
  const normalized = raw.trim().replace(/\s*```\s*$/i, "").trim();

  for (let index = 0; index < normalized.length; index++) {
    if (normalized[index] !== "{") continue;
    const candidate = normalized.slice(index).trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Keep scanning: a later restart may contain a complete JSON object.
    }
  }

  return null;
}

export async function collectOpenAIStream(response: Response): Promise<StreamChatCompletionResult> {
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`AI API error: ${response.status} - ${getErrorMessage(raw)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("AI API streaming response has no body");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | null = null;

  const processEvent = (event: string): boolean => {
    const data = event
      .split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trimStart())
      .join("\n")
      .trim();

    if (!data) return false;
    if (data === "[DONE]") return true;

    const parsed = JSON.parse(data);
    const choice = parsed?.choices?.[0];
    content += choice?.delta?.content || "";
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";

      for (const event of events) {
        if (processEvent(event)) {
          await reader.cancel();
          return { content, finishReason, interrupted: false };
        }
      }
    }
  } catch (error) {
    if (buffer.trim()) {
      try {
        processEvent(buffer);
      } catch {
        // The final SSE frame may itself be truncated. Keep previously parsed content.
      }
    }
    if (!content) throw error;
    return { content, finishReason, interrupted: true };
  }

  buffer += decoder.decode();
  if (buffer.trim()) processEvent(buffer);

  return { content, finishReason, interrupted: false };
}

export async function streamChatCompletion(
  options: StreamChatCompletionOptions
): Promise<StreamChatCompletionResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(options.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stop: null,
      stream: true,
      stream_options: { include_usage: true },
      ...(options.thinking ? { thinking: { type: options.thinking } } : {}),
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  });

  return collectOpenAIStream(response);
}
