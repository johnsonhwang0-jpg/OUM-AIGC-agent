# Codex API Frontend Integration Guide

Audience: frontend engineers and AI coding agents implementing a client integration.

Base URL:

```text
https://codex-api.tangyinx.com
```

Authentication:

```http
Authorization: Bearer <TOKEN>
```

Do not put the token in browser-visible code for public websites. Prefer calling this API from your own backend/BFF, or from a trusted internal tool where the token exposure risk is acceptable.

## Integration Goal

Build a UI that lets a user submit a Codex prompt, watches the run progress, and displays the final response or error.

Minimum user flow:

1. User enters a prompt.
2. Frontend sends `POST /runs`.
3. Frontend receives `run.id`.
4. Frontend polls `GET /runs/{run_id}` until `status` is `completed` or `failed`.
5. Frontend calls `GET /runs/{run_id}/result`.
6. Frontend renders `final_response` or `error`.

## Important Behavior

- Runs are asynchronous.
- Current worker concurrency is `1`, so runs may stay `queued` before becoming `running`.
- Treat `queued` and `running` as in-progress states.
- Treat `completed` as success.
- Treat `failed` as terminal failure.
- Poll every `2-5` seconds. Do not poll faster than once per second.
- Each token can only access its own runs. If a run belongs to another token, the API returns `404`.
- For untrusted users, use `sandbox: "read-only"`.

## Request Headers

Use these headers for authenticated JSON requests:

```http
Authorization: Bearer <TOKEN>
Content-Type: application/json
Accept: application/json
```

## Endpoints

### `GET /healthz`

Public health check. No token required.

```bash
curl -sS https://codex-api.tangyinx.com/healthz
```

Response:

```json
{
  "ok": true,
  "queue_depth": 0
}
```

### `GET /me`

Validate the token and identify the current client.

```bash
curl -sS https://codex-api.tangyinx.com/me \
  -H "Authorization: Bearer <TOKEN>"
```

Response:

```json
{
  "id": "partner-demo",
  "name": "Partner demo client"
}
```

### `POST /runs`

Create a Codex run.

Request body:

```json
{
  "prompt": "Reply exactly: HELLO_CODEX",
  "sandbox": "read-only",
  "timeout_seconds": 120
}
```

Fields:

```text
prompt            required string, max 20000 characters
sandbox           optional string, "read-only" or "workspace-write"; use "read-only" by default
timeout_seconds   optional integer, min 30, max 1800
```

Example:

```bash
curl -sS https://codex-api.tangyinx.com/runs \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Reply exactly: HELLO_CODEX",
    "sandbox": "read-only",
    "timeout_seconds": 120
  }'
```

Response:

```json
{
  "run": {
    "id": "234b6bc9eb6740d2b88f44cd5a808249",
    "client_id": "partner-demo",
    "status": "queued",
    "sandbox": "read-only",
    "timeout_seconds": 120,
    "created_at": "2026-06-26T12:14:54.320709+00:00",
    "updated_at": "2026-06-26T12:14:54.320709+00:00",
    "started_at": null,
    "completed_at": null,
    "exit_code": null,
    "final_response": null,
    "error": null,
    "workdir": "/var/lib/tangyinx-codex/workspaces/234b6bc9eb6740d2b88f44cd5a808249",
    "events_path": "/var/lib/tangyinx-codex/events/234b6bc9eb6740d2b88f44cd5a808249.jsonl"
  }
}
```

Frontend note: do not display `workdir` or `events_path` to ordinary users. They are server internals.

### `GET /runs`

List recent runs for the current token only.

```bash
curl -sS https://codex-api.tangyinx.com/runs \
  -H "Authorization: Bearer <TOKEN>"
```

Response:

```json
{
  "runs": [
    {
      "id": "234b6bc9eb6740d2b88f44cd5a808249",
      "client_id": "partner-demo",
      "status": "completed",
      "sandbox": "read-only",
      "timeout_seconds": 120,
      "created_at": "2026-06-26T12:14:54.320709+00:00",
      "updated_at": "2026-06-26T12:15:12.000000+00:00",
      "started_at": "2026-06-26T12:14:55.000000+00:00",
      "completed_at": "2026-06-26T12:15:12.000000+00:00",
      "exit_code": 0,
      "error": null
    }
  ]
}
```

### `GET /runs/{run_id}`

Get one run's status.

```bash
curl -sS https://codex-api.tangyinx.com/runs/<run_id> \
  -H "Authorization: Bearer <TOKEN>"
```

Use this endpoint for polling.

### `GET /runs/{run_id}/result`

Get final result.

```bash
curl -sS https://codex-api.tangyinx.com/runs/<run_id>/result \
  -H "Authorization: Bearer <TOKEN>"
```

Completed response:

```json
{
  "id": "234b6bc9eb6740d2b88f44cd5a808249",
  "status": "completed",
  "final_response": "HELLO_CODEX",
  "error": null
}
```

Failed response:

```json
{
  "id": "234b6bc9eb6740d2b88f44cd5a808249",
  "status": "failed",
  "final_response": null,
  "error": "Codex run timed out"
}
```

### `GET /runs/{run_id}/events`

Get recent raw Codex event records.

```bash
curl -sS https://codex-api.tangyinx.com/runs/<run_id>/events \
  -H "Authorization: Bearer <TOKEN>"
```

Use this for debugging or advanced progress displays. The basic UI can ignore it.

## Status State Machine

```text
queued -> running -> completed
queued -> running -> failed
```

Terminal states:

```text
completed
failed
```

Recommended UI copy:

```text
queued: Waiting in queue
running: Codex is working
completed: Completed
failed: Failed
```

## Error Handling

Expected HTTP status codes:

```text
200 OK                 successful GET
202 Accepted           run created
400 Bad Request        invalid JSON, missing prompt, invalid sandbox, invalid timeout
401 Unauthorized       missing or invalid token
404 Not Found          run not found, or belongs to another token
413 Payload Too Large  prompt/body too large
```

Error response shape:

```json
{
  "error": "unauthorized"
}
```

Frontend behavior:

- `401`: ask operator to check token configuration.
- `404`: show "Run not found" and do not reveal tenant details.
- `400` or `413`: show the validation message to the user.
- `failed` run status: show `error` from `/result`.
- Network error: allow retry; do not create repeated runs automatically unless the user confirms.

## TypeScript Types

```ts
export type CodexRunStatus = "queued" | "running" | "completed" | "failed";

export type CodexSandbox = "read-only" | "workspace-write";

export interface CodexRun {
  id: string;
  client_id: string;
  status: CodexRunStatus;
  sandbox: CodexSandbox;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  final_response?: string | null;
  error: string | null;
  workdir?: string;
  events_path?: string;
}

export interface CreateRunRequest {
  prompt: string;
  sandbox?: CodexSandbox;
  timeout_seconds?: number;
}

export interface CreateRunResponse {
  run: CodexRun;
}

export interface GetRunResponse {
  run: CodexRun;
}

export interface GetResultResponse {
  id: string;
  status: CodexRunStatus;
  final_response: string | null;
  error: string | null;
}

export interface CodexApiError {
  error: string;
}
```

## TypeScript Client Example

Use this from a backend route, server action, internal admin app, or trusted environment. For a public browser app, proxy through your backend so the token is not exposed.

```ts
const CODEX_API_BASE_URL = "https://codex-api.tangyinx.com";

export class CodexApiClient {
  constructor(private readonly token: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${this.token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${CODEX_API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = data?.error ?? `Codex API request failed: ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  createRun(input: CreateRunRequest): Promise<CreateRunResponse> {
    return this.request<CreateRunResponse>("/runs", {
      method: "POST",
      body: JSON.stringify({
        sandbox: "read-only",
        timeout_seconds: 120,
        ...input,
      }),
    });
  }

  getRun(runId: string): Promise<GetRunResponse> {
    return this.request<GetRunResponse>(`/runs/${runId}`);
  }

  getResult(runId: string): Promise<GetResultResponse> {
    return this.request<GetResultResponse>(`/runs/${runId}/result`);
  }
}
```

## Polling Helper Example

```ts
export async function waitForCodexRun(
  client: CodexApiClient,
  runId: string,
  options: {
    intervalMs?: number;
    timeoutMs?: number;
    onStatus?: (run: CodexRun) => void;
  } = {},
): Promise<GetResultResponse> {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { run } = await client.getRun(runId);
    options.onStatus?.(run);

    if (run.status === "completed" || run.status === "failed") {
      return client.getResult(runId);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for Codex run");
}
```

## React Usage Sketch

```tsx
async function submitPrompt(prompt: string) {
  setLoading(true);
  setError(null);
  setResult(null);

  try {
    const client = new CodexApiClient(token);
    const created = await client.createRun({
      prompt,
      sandbox: "read-only",
      timeout_seconds: 120,
    });

    setRunId(created.run.id);

    const result = await waitForCodexRun(client, created.run.id, {
      onStatus: (run) => setStatus(run.status),
    });

    if (result.status === "failed") {
      setError(result.error ?? "Codex run failed");
    } else {
      setResult(result.final_response ?? "");
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unknown error");
  } finally {
    setLoading(false);
  }
}
```

## AI Coding Agent Instructions

If an AI coding agent implements this integration, give it this task:

```text
Implement a Codex API client using the service described in this document.

Requirements:
- Store the API token only in server-side environment variables.
- Do not hardcode the token in browser code.
- Add a typed client wrapper for:
  - POST /runs
  - GET /runs/{run_id}
  - GET /runs/{run_id}/result
  - GET /me
- Add a polling helper that checks run status every 3 seconds until completed or failed.
- Default sandbox must be "read-only".
- Default timeout_seconds must be 120.
- Show queued/running/completed/failed states in the UI.
- Display final_response on completion.
- Display error on failed status or failed HTTP request.
- Treat 401 as a configuration error.
- Treat 404 as run not found.
- Add tests for the client wrapper with mocked fetch responses.
- Never expose Authorization token in logs, UI, query params, localStorage, or client-side source.
```

Acceptance tests for the AI coding agent:

```text
1. A prompt submission calls POST /runs with sandbox read-only.
2. The returned run id is stored in UI state.
3. Polling calls GET /runs/{run_id} until status is completed.
4. The final response is loaded from GET /runs/{run_id}/result.
5. A failed run displays the API error message.
6. 401 responses display a configuration error.
7. No token appears in rendered HTML, URL query params, console logs, or client-side storage.
```

## Example End-To-End Test With Curl

```bash
TOKEN="<TOKEN>"

RUN_JSON=$(curl -sS https://codex-api.tangyinx.com/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Reply exactly: FRONTEND_INTEGRATION_OK",
    "sandbox": "read-only",
    "timeout_seconds": 120
  }')

RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])' <<< "$RUN_JSON")

while true; do
  STATUS_JSON=$(curl -sS "https://codex-api.tangyinx.com/runs/$RUN_ID" \
    -H "Authorization: Bearer $TOKEN")
  STATUS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run"]["status"])' <<< "$STATUS_JSON")
  echo "$STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 3
done

curl -sS "https://codex-api.tangyinx.com/runs/$RUN_ID/result" \
  -H "Authorization: Bearer $TOKEN"
```

Expected final response:

```json
{
  "status": "completed",
  "final_response": "FRONTEND_INTEGRATION_OK",
  "error": null
}
```

## Security Checklist Before Sharing With A Frontend Team

- Create a dedicated token for that team or environment.
- Share the token through a secure channel, not in this document.
- Use a backend proxy if the frontend is public.
- Keep `sandbox` as `read-only` unless write access is explicitly required.
- Add product-level rate limiting if exposing this to many users.
- Do not send secrets, credentials, private keys, or production database dumps in prompts.
