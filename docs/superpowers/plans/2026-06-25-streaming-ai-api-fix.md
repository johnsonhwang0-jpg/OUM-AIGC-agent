# Streaming AI API Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Slice, Script, and Build App survive overseas long-response connections by consuming upstream SSE streams, while preventing fallback data from being presented as AI success.

**Architecture:** Add a focused OpenAI-compatible streaming client that consumes SSE events and returns accumulated content plus finish reason. Keep the browser-facing Express endpoints JSON-compatible so the current React UI does not need a streaming protocol rewrite. Treat slice fallback as a degraded response and reject it in the frontend success path.

**Tech Stack:** TypeScript, Node.js fetch/Web Streams, Express, React, `node:test`, tsx.

---

### Task 1: Streaming client regression tests

**Files:**
- Create: `tests/ai-stream.test.ts`
- Create: `ai-stream.ts`

- [ ] Write failing tests proving split SSE frames are reconstructed and upstream requests set `stream: true`.
- [ ] Run `npx tsx --test tests/ai-stream.test.ts` and verify failure because `ai-stream.ts` is missing.
- [ ] Implement the minimal streaming parser/client.
- [ ] Re-run the test and verify all cases pass.

### Task 2: Use streaming for all OpenAI-compatible providers

**Files:**
- Modify: `server.ts`

- [ ] Replace DeepSeek non-streaming response reads with the tested streaming client.
- [ ] Replace DashScope non-streaming response reads with the tested streaming client.
- [ ] Preserve continuation behavior when `finish_reason` is `length`.
- [ ] Fix the Script DashScope argument order so `max_tokens` is numeric.
- [ ] Run the focused tests and TypeScript check.

### Task 3: Make fallback visible

**Files:**
- Modify: `server.ts`
- Modify: `src/App.tsx`

- [ ] Return an explicit degraded marker for heuristic slice fallback.
- [ ] Reject responses containing `_meta.error` or degraded status before setting modules or saving the project.
- [ ] Surface the real upstream error in the existing API debug panel.

### Task 4: End-to-end verification

**Files:**
- Modify: `MEMORY.md`

- [ ] Restart the local server so the new networking code is active.
- [ ] Run the focused automated test, `npm run lint`, and `npm run build`.
- [ ] Re-run the real 171-node Slice request on the current overseas route and verify `_meta.error` is absent.
- [ ] Verify the browser reaches Phase 2 with non-template slice content and no relevant console error.
- [ ] Record the verified behavior and any remaining limitation in `MEMORY.md`.
