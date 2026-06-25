import assert from "node:assert/strict";
import test from "node:test";
import {
  collectOpenAIStream,
  extractCompleteJsonContent,
  isCompleteJsonContent,
  streamChatCompletion
} from "../ai-stream.ts";

function responseFromChunks(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });

  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream" }
  });
}

test("collectOpenAIStream reconstructs content split across network chunks", async () => {
  const response = responseFromChunks([
    'data: {"choices":[{"delta":{"content":"Hel',
    'lo"},"finish_reason":null}]}\n\n',
    'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n',
    "data: [DONE]\n\n"
  ]);

  const result = await collectOpenAIStream(response);

  assert.equal(result.content, "Hello world");
  assert.equal(result.finishReason, "stop");
});

test("streamChatCompletion requests SSE streaming and returns accumulated content", async () => {
  let capturedBody: any;
  const fakeFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return responseFromChunks([
      'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n"
    ]);
  };

  const result = await streamChatCompletion({
    url: "https://example.test/chat/completions",
    apiKey: "test-key",
    model: "test-model",
    messages: [{ role: "user", content: "ping" }],
    maxTokens: 123,
    jsonMode: true,
    fetchImpl: fakeFetch
  });

  assert.equal(capturedBody.stream, true);
  assert.equal(capturedBody.stream_options.include_usage, true);
  assert.deepEqual(capturedBody.response_format, { type: "json_object" });
  assert.equal(capturedBody.max_tokens, 123);
  assert.equal(result.content, "OK");
});

test("streamChatCompletion can disable reasoning for long structured outputs", async () => {
  let capturedBody: any;
  const fakeFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return responseFromChunks([
      'data: {"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n"
    ]);
  };

  await streamChatCompletion({
    url: "https://example.test/chat/completions",
    apiKey: "test-key",
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "return JSON" }],
    maxTokens: 1024,
    thinking: "disabled",
    fetchImpl: fakeFetch
  });

  assert.deepEqual(capturedBody.thinking, { type: "disabled" });
});

test("streamChatCompletion exposes upstream errors", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response('{"error":{"message":"bad request"}}', { status: 400 });

  await assert.rejects(
    () =>
      streamChatCompletion({
        url: "https://example.test/chat/completions",
        apiKey: "test-key",
        model: "test-model",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 123,
        fetchImpl: fakeFetch
      }),
    /400.*bad request/
  );
});

test("collectOpenAIStream preserves partial content when the socket closes mid-stream", async () => {
  const encoder = new TextEncoder();
  let pullCount = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pullCount += 1;
      if (pullCount === 1) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n')
        );
      } else {
        controller.error(new Error("other side closed"));
      }
    }
  });

  const result = await collectOpenAIStream(
    new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })
  );

  assert.equal(result.content, "partial");
  assert.equal(result.interrupted, true);
});

test("isCompleteJsonContent detects completed fenced JSON", () => {
  assert.equal(isCompleteJsonContent('```json\n{"slices":[{"id":"S1"}]}\n```'), true);
  assert.equal(isCompleteJsonContent('{"slices":[{"id":"S1"}'), false);
});

test("extractCompleteJsonContent recovers a restarted full JSON response after a partial prefix", () => {
  const partialThenRestarted =
    '{"slices":[{"id":"S1","title":"incomplete' +
    '```json\n{"slices":[{"id":"S1","title":"complete"}]}\n```';

  assert.equal(
    extractCompleteJsonContent(partialThenRestarted),
    '{"slices":[{"id":"S1","title":"complete"}]}'
  );
});
