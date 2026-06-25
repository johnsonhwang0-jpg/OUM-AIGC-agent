/**
 * 自动化任务编排器
 *
 * 职责：
 *  - 创建 Job 与 Task 记录
 *  - 串行驱动每个切片的 extract → script → app-code 三阶段
 *  - 通过内部 HTTP 复用现有 /api/* 路由（零重复 AI 逻辑）
 *  - 推送 SSE 事件给前端
 *  - 失败重试（退避 10s/30s/60s）
 *  - 断点续传（服务重启后恢复未完成任务）
 */
import type { Response } from "express";
import {
  getProject,
  createAutomationJob,
  getAutomationJob,
  getLatestAutomationJob,
  updateAutomationJob,
  createAutomationTask,
  getAutomationTasksByJob,
  getAutomationTask,
  updateAutomationTask,
  getPendingTasksForSlice,
  saveExtractedContent,
  saveModuleScript,
  saveGeneratedAppCode,
  type AutomationJob,
  type AutomationTask,
  type AutomationTaskStage,
} from "./database.js";

// ==================== 类型 ====================

export interface SseEvent {
  event: string;
  data: any;
}

// ==================== SSE 事件总线 ====================

// jobId → 连接的 SSE 响应集合
const sseClients = new Map<string, Set<Response>>();

export function registerSseClient(jobId: string, res: Response): void {
  if (!sseClients.has(jobId)) sseClients.set(jobId, new Set());
  sseClients.get(jobId)!.add(res);
}

export function unregisterSseClient(jobId: string, res: Response): void {
  const clients = sseClients.get(jobId);
  if (!clients) return;
  clients.delete(res);
  if (clients.size === 0) sseClients.delete(jobId);
}

function emit(jobId: string, event: SseEvent): void {
  const clients = sseClients.get(jobId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      // 客户端已断开，忽略
    }
  }
}

// ==================== 内部 HTTP 调用 ====================

async function internalPost(path: string, body: any): Promise<any> {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
  const url = `http://localhost:${port}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    throw new Error(json.error || `Internal ${path} failed: ${res.status}`);
  }
  return json;
}

// ==================== 页码范围计算 ====================

interface SimpleDirItem {
  title: string;
  page?: string;
  level: number;
}

/**
 * 从 coveredChapters 与目录条目推算切片的 PDF 起止页码。
 * coveredChapters 形如 "1.1-1.3" / "1.1.1-1.1.5" / "3.5"。
 */
function computePageRange(
  coveredChapters: string,
  directoryItems: SimpleDirItem[]
): { startPage: number; endPage: number } {
  if (!coveredChapters || directoryItems.length === 0) {
    return { startPage: 1, endPage: 10 };
  }

  // 解析 coveredChapters 得到起始与结束章节 token
  const parts = coveredChapters.split(/[-–—/]/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return { startPage: 1, endPage: 10 };

  const startToken = parts[0];
  const endToken = parts[parts.length - 1];

  // 在目录中查找匹配的条目页码
  const findPage = (token: string): number | null => {
    for (const item of directoryItems) {
      const title = item.title || "";
      // 标题以章节编号开头，如 "1.1 星际介质..." 或 "1.1.1 xxx"
      if (title.startsWith(token + " ") || title.startsWith(token + "：") || title.startsWith(token + ":") || title === token) {
        const p = parseInt(item.page || "", 10);
        if (!isNaN(p) && p > 0) return p;
      }
    }
    return null;
  };

  const startPage = findPage(startToken);
  if (startPage == null) return { startPage: 1, endPage: 10 };

  // 结束页：优先用结束章节的下一章页码 - 1，否则用结束章节自身页 + 15
  const endPageFound = findPage(endToken);
  let endPage: number;
  if (endPageFound != null && endToken !== startToken) {
    // 找结束章节之后第一个同级或更高级条目的页码
    const endIdx = directoryItems.findIndex(i => {
      const t = i.title || "";
      return t.startsWith(endToken + " ") || t.startsWith(endToken + "：") || t.startsWith(endToken + ":") || t === endToken;
    });
    if (endIdx >= 0 && endIdx + 1 < directoryItems.length) {
      const nextItem = directoryItems[endIdx + 1];
      const nextP = parseInt(nextItem.page || "", 10);
      endPage = !isNaN(nextP) && nextP > endPageFound ? nextP - 1 : endPageFound + 14;
    } else {
      endPage = endPageFound + 14;
    }
  } else {
    endPage = startPage + 14;
  }

  return { startPage: Math.max(1, startPage), endPage: Math.max(startPage, endPage) };
}

// ==================== 模块辅助 ====================

interface SliceMeta {
  id: string;
  sliceId?: string;
  title: string;
  coveredChapters?: string;
  pageRange?: string;
  summary?: any;
  infoDensity?: any;
  cohesionDetail?: any;
  designRationale?: any;
}

function parseModules(modulesJson: string): SliceMeta[] {
  try {
    const parsed = JSON.parse(modulesJson);
    const arr = Array.isArray(parsed) ? parsed : (parsed.slices || parsed.modules || []);
    return arr as SliceMeta[];
  } catch {
    return [];
  }
}

function parseDirectoryItems(dirJson: string): SimpleDirItem[] {
  try {
    return JSON.parse(dirJson) as SimpleDirItem[];
  } catch {
    return [];
  }
}

// ==================== 单切片执行 ====================

async function runTaskWithRetry(
  jobId: string,
  projectId: string,
  slice: SliceMeta,
  stage: AutomationTaskStage,
  existingTask: AutomationTask | null,
  runOnce: () => Promise<void>
): Promise<AutomationTask | null> {
  // 复用已有任务或创建新任务
  let task = existingTask;
  if (!task) {
    task = await createAutomationTask({
      jobId,
      projectId,
      moduleId: slice.id,
      sliceId: slice.sliceId || null,
      sliceTitle: slice.title,
      stage,
    });
  }

  // 已完成的任务直接跳过（断点续传）
  if (task.status === "completed") return task;
  if (task.status === "skipped") return task;

  const maxAttempts = task.maxAttempts || 3;
  const backoffs = [0, 10_000, 30_000]; // 第 1 次立即，第 2 次等 10s，第 3 次等 30s

  for (let attempt = task.attempts; attempt < maxAttempts; attempt++) {
    const idx = Math.min(attempt, backoffs.length - 1);
    const waitMs = backoffs[idx] ?? 60_000;
    if (waitMs > 0) {
      await new Promise(r => setTimeout(r, waitMs));
    }

    await updateAutomationTask(task.id, {
      status: "running",
      attempts: attempt + 1,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    });

    emit(jobId, {
      event: "task_update",
      data: { taskId: task.id, moduleId: slice.id, sliceId: slice.sliceId, stage, status: "running", attempt: attempt + 1 },
    });

    try {
      await runOnce();
      await updateAutomationTask(task.id, { status: "completed", finishedAt: new Date().toISOString(), error: null });
      emit(jobId, {
        event: "task_complete",
        data: { taskId: task.id, moduleId: slice.id, sliceId: slice.sliceId, stage, status: "completed" },
      });
      return task;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[orchestrator] task ${task.id} (${slice.sliceId || slice.id} / ${stage}) attempt ${attempt + 1} failed:`, errMsg);
      await updateAutomationTask(task.id, { status: "failed", error: errMsg });
      emit(jobId, {
        event: "task_failed",
        data: { taskId: task.id, moduleId: slice.id, sliceId: slice.sliceId, stage, status: "failed", error: errMsg, attempt: attempt + 1, retryable: attempt + 1 < maxAttempts },
      });
      if (attempt + 1 >= maxAttempts) {
        return task;
      }
    }
  }

  return task;
}

async function runSliceExtract(
  jobId: string,
  projectId: string,
  bookTitle: string,
  slice: SliceMeta,
  directoryItems: SimpleDirItem[],
  hasPdf: boolean,
  model: string
): Promise<{ extracted: boolean; content: string }> {
  const job = await getAutomationJob(jobId);
  if (job && (job.status === "cancelled" || job.status === "paused")) {
    return { extracted: false, content: "" };
  }

  const project = await getProject(projectId);

  // ---- 阶段 1: extract ----
  let extractedContent = "";
  if (hasPdf && project?.pdfData) {
    // 断点续传：检查数据库是否已有该切片的提取内容
    const { getExtractedContents: queryExtracted } = await import("./database.js");
    const existingExtracts = await queryExtracted(projectId);
    const matchedExtract0 = existingExtracts.find(e => e.moduleId === slice.id);
    if (matchedExtract0?.content) {
      extractedContent = matchedExtract0.content;
      emit(jobId, { event: "task_complete", data: { moduleId: slice.id, sliceId: slice.sliceId, stage: "extract", status: "skipped" } });
    } else {
      const existingExtractTasks = await getPendingTasksForSlice(jobId, slice.id);
      const extractTask = existingExtractTasks.find(t => t.stage === "extract") || null;

      await runTaskWithRetry(jobId, projectId, slice, "extract", extractTask, async () => {
      // 优先使用模块 pageRange，否则按 coveredChapters 推算
      let startPage = 1;
      let endPage = 10;
      if (slice.pageRange) {
        const m = slice.pageRange.match(/(\d+)\s*[-–—]\s*(\d+)/);
        if (m) {
          startPage = parseInt(m[1], 10);
          endPage = parseInt(m[2], 10);
        }
      } else if (slice.coveredChapters) {
        const range = computePageRange(slice.coveredChapters, directoryItems);
        startPage = range.startPage;
        endPage = range.endPage;
      }

      const result = await internalPost(`/api/projects/${projectId}/extract-pages`, {
        startPage,
        endPage,
      });

      // 拼接所有页面内容
      const pages = result.pages || [];
      extractedContent = pages.map((p: any) => p.content || "").filter(Boolean).join("\n\n");

      if (!extractedContent) {
        throw new Error("PDF 提取内容为空");
      }

      await saveExtractedContent(projectId, slice.id, extractedContent);
      });
    }
  } else {
    // 无 PDF（模板书），跳过提取，使用默认内容
    const skipTask = await createAutomationTask({
      jobId, projectId, moduleId: slice.id, sliceId: slice.sliceId || null, sliceTitle: slice.title, stage: "extract",
    });
    await updateAutomationTask(skipTask.id, { status: "skipped", finishedAt: new Date().toISOString() });
    emit(jobId, { event: "task_complete", data: { taskId: skipTask.id, moduleId: slice.id, sliceId: slice.sliceId, stage: "extract", status: "skipped" } });
  }

  return { extracted: true, content: extractedContent };
}

async function runSliceScript(
  jobId: string,
  projectId: string,
  bookTitle: string,
  slice: SliceMeta,
  extractedContent: string,
  model: string
): Promise<{ scripted: boolean; markdown: string }> {
  const job = await getAutomationJob(jobId);
  if (job && (job.status === "cancelled" || job.status === "paused")) {
    return { scripted: false, markdown: "" };
  }

  // ---- 阶段 2: script ----
  // 读取已保存的提取内容（可能来自本任务或之前手动提取）
  let scriptMarkdown = "";
  const { getExtractedContents } = await import("./database.js");
  const extractedRows = await getExtractedContents(projectId);
  const matchedExtract = extractedRows.find(e => e.moduleId === slice.id);
  const contentForScript = matchedExtract?.content || extractedContent || `General academic curriculum rules relative to ${slice.title}`;

  const existingScriptTasks = await getPendingTasksForSlice(jobId, slice.id);
  const scriptTask = existingScriptTasks.find(t => t.stage === "script") || null;

  await runTaskWithRetry(jobId, projectId, slice, "script", scriptTask, async () => {
    const result = await internalPost("/api/generate-script", {
      bookTitle,
      chapterTitle: slice.title,
      chapterIndex: slice.sliceId || slice.coveredChapters || "",
      coveredChapters: slice.coveredChapters || "",
      summary: slice.summary,
      infoDensity: slice.infoDensity,
      cohesionDetail: slice.cohesionDetail,
      designRationale: slice.designRationale,
      extractedContent: contentForScript.substring(0, 8000),
    });

    scriptMarkdown = result.markdown || "";
    if (!scriptMarkdown) throw new Error("AI 未返回脚本内容");

    // 检查降级标记
    if (result._meta?.error || result._meta?.degraded) {
      throw new Error(result._meta?.error || "AI 返回降级结果");
    }

    await saveModuleScript(projectId, slice.id, {
      id: slice.id,
      moduleId: slice.id,
      kind: "simulation_blueprint_markdown",
      markdown: scriptMarkdown,
      generatedAt: new Date().toISOString(),
    });
  });

  return { scripted: true, markdown: scriptMarkdown };
}

async function runSliceAppCode(
  jobId: string,
  projectId: string,
  bookTitle: string,
  slice: SliceMeta,
  scriptMarkdown: string,
  model: string
): Promise<{ built: boolean }> {
  const job = await getAutomationJob(jobId);
  if (job && (job.status === "cancelled" || job.status === "paused")) {
    return { built: false };
  }

  // ---- 阶段 3: app-code ----
  // 读取已保存的脚本（可能来自本任务或之前手动生成）
  const { getModuleScripts } = await import("./database.js");
  const scripts = await getModuleScripts(projectId);
  const matchedScript = scripts.find(s => s.moduleId === slice.id);
  let finalMarkdown = scriptMarkdown;
  if (!finalMarkdown && matchedScript) {
    try {
      const parsed = JSON.parse(matchedScript.script);
      finalMarkdown = parsed.markdown || "";
    } catch {
      finalMarkdown = matchedScript.script;
    }
  }

  if (!finalMarkdown) {
    // 脚本生成失败则跳过 app-code
    const skipTask = await createAutomationTask({
      jobId, projectId, moduleId: slice.id, sliceId: slice.sliceId || null, sliceTitle: slice.title, stage: "app-code",
    });
    await updateAutomationTask(skipTask.id, { status: "skipped", finishedAt: new Date().toISOString(), error: "无可用脚本" });
    emit(jobId, { event: "task_complete", data: { taskId: skipTask.id, moduleId: slice.id, sliceId: slice.sliceId, stage: "app-code", status: "skipped" } });
    return { built: false };
  }

  const existingAppTasks = await getPendingTasksForSlice(jobId, slice.id);
  const appTask = existingAppTasks.find(t => t.stage === "app-code") || null;

  await runTaskWithRetry(jobId, projectId, slice, "app-code", appTask, async () => {
    const result = await internalPost("/api/generate-app-code", {
      bookTitle,
      chapterTitle: slice.title,
      coveredChapters: slice.coveredChapters || "",
      scriptMarkdown: finalMarkdown,
      model,
    });

    const code = result.code || "";
    if (!code) throw new Error("AI 未返回 HTML 代码");

    await saveGeneratedAppCode(projectId, slice.id, code);
  });

  return { built: true };
}

/**
 * @deprecated 旧版逐切片全流程，保留以兼容 retry 入口。
 * 新自动流程使用 runJobLoop 的阶段间串行模式。
 */
async function runSlicePipeline(
  jobId: string,
  projectId: string,
  bookTitle: string,
  slice: SliceMeta,
  directoryItems: SimpleDirItem[],
  hasPdf: boolean,
  model: string
): Promise<{ extracted: boolean; scripted: boolean; built: boolean }> {
  const job = await getAutomationJob(jobId);
  if (job && (job.status === "cancelled" || job.status === "paused")) {
    return { extracted: false, scripted: false, built: false };
  }

  const { extracted, content } = await runSliceExtract(jobId, projectId, bookTitle, slice, directoryItems, hasPdf, model);
  if (!extracted) return { extracted: false, scripted: false, built: false };

  const job2 = await getAutomationJob(jobId);
  if (job2 && (job2.status === "cancelled" || job2.status === "paused")) {
    return { extracted: true, scripted: false, built: false };
  }

  const { scripted, markdown } = await runSliceScript(jobId, projectId, bookTitle, slice, content, model);
  if (!scripted) return { extracted: true, scripted: false, built: false };

  const job3 = await getAutomationJob(jobId);
  if (job3 && (job3.status === "cancelled" || job3.status === "paused")) {
    return { extracted: true, scripted: true, built: false };
  }

  const { built } = await runSliceAppCode(jobId, projectId, bookTitle, slice, markdown, model);
  return { extracted: true, scripted: true, built };
}

// ==================== Job 主循环 ====================

/**
 * 如果项目尚无切片，自动调用 /api/parse-book 生成并保存到数据库。
 * 在自动模式下作为流水线的第 0 步执行。
 */
async function ensureModulesGenerated(
  projectId: string,
  jobId: string
): Promise<SliceMeta[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error("项目不存在");

  // 已有切片，直接返回
  const existing = parseModules(project.modules);
  if (existing.length > 0) return existing;

  // 无切片，需要 directoryItems
  const directoryItems = parseDirectoryItems(project.directoryItems);
  if (directoryItems.length === 0) {
    throw new Error("项目无目录数据，无法自动切片");
  }

  emit(jobId, { event: "parse_book_start", data: { projectId, status: "running" } });

  // 调用 parse-book 生成切片
  const result = await internalPost("/api/parse-book", {
    title: project.bookTitle || project.name || "未命名教材",
    fullText: project.bookContentText || "",
    directoryStructure: directoryItems,
  });

  // 检查是否降级
  if (result._meta?.error || result._meta?.degraded) {
    throw new Error(result._meta?.error || "AI 切片降级，请重试");
  }

  const rawSlices = result.slices || result.modules || [];
  if (rawSlices.length === 0) {
    throw new Error("AI 未返回切片");
  }

  // 转为 BookModule 格式并保存（简化版，保留必要字段）
  const { updateProject } = await import("./database.js");
  const modules = rawSlices.map((mod: any, index: number) => ({
    ...mod,
    id: mod.id || `mod-${index + 1}-${Date.now()}`,
    sliceId: mod.sliceId || `S${index + 1}`,
    chapterIndex: mod.chapterIndex || mod.sliceId || `S${index + 1}`,
    scriptStatus: "pending",
  }));
  await updateProject(projectId, { modules: JSON.stringify(modules), rawBlueprintData: JSON.stringify(result) });

  emit(jobId, { event: "parse_book_complete", data: { projectId, sliceCount: modules.length, status: "completed" } });

  return modules as SliceMeta[];
}

export async function startAutomationJob(
  projectId: string,
  options: { concurrency?: number; model?: string } = {}
): Promise<AutomationJob> {
  const project = await getProject(projectId);
  if (!project) throw new Error("项目不存在");

  const directoryItems = parseDirectoryItems(project.directoryItems);
  const hasPdf = !!(project.pdfFileName && project.pdfData);
  const model = options.model || "deepseek-v4-flash";

  // 复用最近一个未完成的 Job（断点续传），否则创建新 Job
  let job = await getLatestAutomationJob(projectId);
  if (!job || (job.status !== "running" && job.status !== "paused")) {
    // 切片数量未知，先创建占位 Job（totalSlices 后续更新）
    job = await createAutomationJob(projectId, 0, options.concurrency || 1);
  }

  // 异步执行：先确保切片已生成，再进入主循环
  (async () => {
    try {
      const slices = await ensureModulesGenerated(projectId, job!.id);

      // 更新 Job 的 totalSlices
      await updateAutomationJob(job!.id, { totalSlices: slices.length });

      await runJobLoop(job!.id, projectId, project.bookTitle, slices, directoryItems, hasPdf, model);
    } catch (err: any) {
      console.error(`[orchestrator] job ${job!.id} crashed:`, err);
      await updateAutomationJob(job!.id, {
        status: "failed",
        error: err?.message || String(err),
        finishedAt: new Date().toISOString(),
      });
      emit(job!.id, { event: "job_failed", data: { jobId: job!.id, error: err?.message || String(err) } });
    }
  })();

  return job;
}

async function runJobLoop(
  jobId: string,
  projectId: string,
  bookTitle: string,
  slices: SliceMeta[],
  directoryItems: SimpleDirItem[],
  hasPdf: boolean,
  model: string
): Promise<void> {
  const job = await getAutomationJob(jobId);
  if (!job) return;

  await updateAutomationJob(jobId, {
    status: "running",
    startedAt: job.startedAt || new Date().toISOString(),
  });

  emit(jobId, { event: "job_progress", data: { jobId, completed: job.completedSlices, total: job.totalSlices, status: "running" } });

  // 阶段间串行：所有切片 extract → 所有切片 script → 所有切片 app-code
  // 每个阶段内部对切片逐个执行；某切片失败不影响其他切片，但失败切片不进入下一阶段
  const succeededExtract: { slice: SliceMeta; content: string }[] = [];
  const succeededScript: { slice: SliceMeta; markdown: string }[] = [];
  let completed = 0;
  let failed = 0;

  // 检查暂停/取消的辅助函数
  const checkStatus = async (): Promise<"continue" | "paused" | "cancelled"> => {
    const current = await getAutomationJob(jobId);
    if (!current || current.status === "cancelled") return "cancelled";
    if (current.status === "paused") return "paused";
    return "continue";
  };

  // ============ 阶段 1: extract（所有切片） ============
  for (const slice of slices) {
    const status = await checkStatus();
    if (status === "cancelled") break;
    if (status === "paused") {
      emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, status: "paused" } });
      return;
    }

    // 断点续传：检查数据库是否已有该切片的提取内容（视为已完成）
    const { getExtractedContents: queryExtracted } = await import("./database.js");
    const existingExtracts = await queryExtracted(projectId);
    const matchedExtract = existingExtracts.find(e => e.moduleId === slice.id);

    emit(jobId, { event: "slice_start", data: { jobId, moduleId: slice.id, sliceId: slice.sliceId, title: slice.title, stage: "extract" } });

    try {
      const { extracted, content } = await runSliceExtract(jobId, projectId, bookTitle, slice, directoryItems, hasPdf, model);
      if (extracted) {
        succeededExtract.push({ slice, content: content || matchedExtract?.content || "" });
      } else {
        failed += 1;
      }
    } catch (err: any) {
      console.error(`[orchestrator] extract slice ${slice.sliceId || slice.id} failed:`, err);
      failed += 1;
    }
    await updateAutomationJob(jobId, { failedSlices: failed });
    emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, failed, status: "running", stage: "extract" } });
  }

  // ============ 阶段 2: script（仅对 extract 成功的切片） ============
  for (const { slice, content } of succeededExtract) {
    const status = await checkStatus();
    if (status === "cancelled") break;
    if (status === "paused") {
      emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, status: "paused" } });
      return;
    }

    emit(jobId, { event: "slice_start", data: { jobId, moduleId: slice.id, sliceId: slice.sliceId, title: slice.title, stage: "script" } });

    try {
      const { scripted, markdown } = await runSliceScript(jobId, projectId, bookTitle, slice, content, model);
      if (scripted) {
        succeededScript.push({ slice, markdown });
      } else {
        // script 失败不立即计入 failed，将在 app-code 阶段未完成时计入
      }
    } catch (err: any) {
      console.error(`[orchestrator] script slice ${slice.sliceId || slice.id} failed:`, err);
    }
    emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, failed, status: "running", stage: "script" } });
  }

  // ============ 阶段 3: app-code（仅对 script 成功的切片） ============
  for (const { slice, markdown } of succeededScript) {
    const status = await checkStatus();
    if (status === "cancelled") break;
    if (status === "paused") {
      emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, status: "paused" } });
      return;
    }

    emit(jobId, { event: "slice_start", data: { jobId, moduleId: slice.id, sliceId: slice.sliceId, title: slice.title, stage: "app-code" } });

    try {
      const { built } = await runSliceAppCode(jobId, projectId, bookTitle, slice, markdown, model);
      if (built) {
        completed += 1;
      } else {
        failed += 1;
      }
    } catch (err: any) {
      console.error(`[orchestrator] app-code slice ${slice.sliceId || slice.id} failed:`, err);
      failed += 1;
    }

    await updateAutomationJob(jobId, { completedSlices: completed, failedSlices: failed });
    emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, failed, status: "running", stage: "app-code" } });
  }

  // 收尾
  const finalJob = await getAutomationJob(jobId);
  const allFailed = failed === slices.length && slices.length > 0;
  let finalStatus: AutomationJob["status"];
  if (finalJob?.status === "cancelled") {
    finalStatus = "cancelled";
  } else if (failed === 0) {
    finalStatus = "completed";
  } else if (completed > 0) {
    finalStatus = "partial";
  } else {
    finalStatus = allFailed ? "partial" : "completed";
  }

  await updateAutomationJob(jobId, {
    status: finalStatus,
    completedSlices: completed,
    failedSlices: failed,
    finishedAt: new Date().toISOString(),
  });

  emit(jobId, {
    event: finalStatus === "completed" ? "job_complete" : "job_finished",
    data: { jobId, completed, failed, total: slices.length, status: finalStatus },
  });
}

// ==================== 控制操作 ====================

export async function pauseJob(jobId: string): Promise<void> {
  await updateAutomationJob(jobId, { status: "paused" });
  emit(jobId, { event: "job_progress", data: { jobId, status: "paused" } });
}

export async function resumeJob(jobId: string): Promise<void> {
  const job = await getAutomationJob(jobId);
  if (!job) throw new Error("Job 不存在");
  if (job.status !== "paused" && job.status !== "partial") {
    throw new Error(`当前状态 ${job.status} 不可恢复`);
  }

  const project = await getProject(job.projectId);
  if (!project) throw new Error("项目不存在");

  const slices = parseModules(project.modules);
  const directoryItems = parseDirectoryItems(project.directoryItems);
  const hasPdf = !!(project.pdfFileName && project.pdfData);

  await updateAutomationJob(jobId, { status: "running", finishedAt: null });

  runJobLoop(jobId, job.projectId, project.bookTitle, slices, directoryItems, hasPdf, "deepseek-v4-flash").catch(err => {
    console.error(`[orchestrator] job ${jobId} resume crashed:`, err);
  });
}

export async function cancelJob(jobId: string): Promise<void> {
  await updateAutomationJob(jobId, { status: "cancelled", finishedAt: new Date().toISOString() });
  emit(jobId, { event: "job_progress", data: { jobId, status: "cancelled" } });
}

export async function retryTask(taskId: string): Promise<void> {
  const task = await getAutomationTask(taskId);
  if (!task) throw new Error("任务不存在");

  const job = await getAutomationJob(task.jobId);
  if (!job) throw new Error("Job 不存在");

  const project = await getProject(task.projectId);
  if (!project) throw new Error("项目不存在");

  const slices = parseModules(project.modules);
  const slice = slices.find(s => s.id === task.moduleId);
  if (!slice) throw new Error("切片不存在");

  const directoryItems = parseDirectoryItems(project.directoryItems);
  const hasPdf = !!(project.pdfFileName && project.pdfData);

  // 重置任务状态为 pending
  await updateAutomationTask(taskId, { status: "pending", attempts: 0, error: null, startedAt: null, finishedAt: null });

  // 单切片重跑（从失败阶段开始）
  runSlicePipeline(task.jobId, task.projectId, project.bookTitle, slice, directoryItems, hasPdf, "deepseek-v4-flash")
    .then(async () => {
      // 重新统计
      const tasks = await getAutomationTasksByJob(task.jobId);
      const moduleTasks = tasks.filter(t => t.moduleId === slice.id);
      const allDone = moduleTasks.every(t => t.status === "completed" || t.status === "skipped");
      if (allDone) {
        const freshJob = await getAutomationJob(task.jobId);
        if (freshJob) {
          await updateAutomationJob(task.jobId, {
            completedSlices: freshJob.completedSlices + 1,
            failedSlices: Math.max(0, freshJob.failedSlices - 1),
          });
        }
      }
      emit(task.jobId, { event: "task_complete", data: { taskId, moduleId: slice.id, stage: task.stage, status: "completed" } });
    })
    .catch(err => {
      console.error(`[orchestrator] retry task ${taskId} failed:`, err);
      emit(task.jobId, { event: "task_failed", data: { taskId, error: err.message } });
    });
}

export async function retryAllFailed(jobId: string): Promise<void> {
  const tasks = await getAutomationTasksByJob(jobId);
  const failed = tasks.filter(t => t.status === "failed");
  for (const t of failed) {
    await retryTask(t.id);
  }
}

export async function getJobSnapshot(jobId: string): Promise<{ job: AutomationJob | null; tasks: AutomationTask[] }> {
  const job = await getAutomationJob(jobId);
  const tasks = await getAutomationTasksByJob(jobId);
  return { job, tasks };
}
