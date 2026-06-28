import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response, NextFunction } from "express";
import { createProjectWriteLock } from "../middleware/projectLock.ts";

// 构造最小 Express 请求/响应 mock，验证中间件行为
function mockReq(params: Record<string, string> = {}): Partial<Request> {
  return { params } as Partial<Request>;
}

function mockRes(): { res: Response; state: { statusCode: number; body: any } } {
  const state = { statusCode: 200, body: undefined as any };
  const res: Partial<Response> = {
    status(code: number) {
      state.statusCode = code;
      return res as Response;
    },
    json(data: any) {
      state.body = data;
      return res as Response;
    },
  };
  return { res: res as Response, state };
}

test("projectWriteLock: 有活跃 job 时返回 409 且不调用 next", async () => {
  const lock = createProjectWriteLock(async () => ({
    id: "job-1",
    status: "running",
  }));
  const { res, state } = mockRes();
  let nextCalled = false;
  const next: NextFunction = () => { nextCalled = true; };

  await lock(mockReq({ id: "p1" }) as Request, res, next);

  assert.equal(state.statusCode, 409);
  assert.equal(state.body.jobId, "job-1");
  assert.equal(state.body.jobStatus, "running");
  assert.equal(nextCalled, false, "有活跃 job 时不应调用 next");
});

test("projectWriteLock: 无活跃 job 时调用 next 放行", async () => {
  const lock = createProjectWriteLock(async () => null);
  const { res, state } = mockRes();
  let nextCalled = false;
  const next: NextFunction = () => { nextCalled = true; };

  await lock(mockReq({ id: "p1" }) as Request, res, next);

  assert.equal(state.statusCode, 200, "无活跃 job 不应改状态码");
  assert.equal(nextCalled, true, "应调用 next 放行");
});

test("projectWriteLock: 无 projectId 参数时直接放行", async () => {
  let getJobCalled = false;
  const lock = createProjectWriteLock(async () => { getJobCalled = true; return null; });
  const { res } = mockRes();
  let nextCalled = false;

  // params 中无 id
  await lock(mockReq() as Request, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "无 id 应直接放行");
  assert.equal(getJobCalled, false, "无 id 不应查询 job");
});

test("projectWriteLock: getActiveJob 抛错时不阻塞，调用 next 放行", async () => {
  const lock = createProjectWriteLock(async () => { throw new Error("DB down"); });
  const { res, state } = mockRes();
  let nextCalled = false;

  await lock(mockReq({ id: "p1" }) as Request, res, () => { nextCalled = true; });

  // 锁检查失败不阻塞业务（容错放行），避免 DB 故障导致所有写入不可用
  assert.equal(nextCalled, true, "异常时应容错放行");
  assert.equal(state.statusCode, 200);
});

test("projectWriteLock: paused 状态也视为活跃并锁定", async () => {
  const lock = createProjectWriteLock(async () => ({
    id: "job-2",
    status: "paused",
  }));
  const { res, state } = mockRes();

  await lock(mockReq({ id: "p1" }) as Request, res, () => {});

  assert.equal(state.statusCode, 409);
  assert.equal(state.body.jobStatus, "paused");
});
