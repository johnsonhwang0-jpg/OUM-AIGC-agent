import { useState, useEffect, useCallback, useRef } from "react";
import type {
  AutomationJob,
  AutomationTask,
  AutomationJobSnapshot,
} from "../types";

interface UseAutomationJobResult {
  job: AutomationJob | null;
  tasks: AutomationTask[];
  connected: boolean;
  error: string | null;
  parseBookDone: boolean;
  start: (projectId: string, opts?: { concurrency?: number; model?: string }) => Promise<string>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  retryAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * 封装自动化任务的 SSE 监听与控制操作。
 * 传入 jobId 后自动连接实时事件流；jobId 为 null 时仅做控制操作。
 */
export function useAutomationJob(jobId: string | null): UseAutomationJobResult {
  const [job, setJob] = useState<AutomationJob | null>(null);
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseBookDone, setParseBookDone] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  // 防抖 fetchSnapshot 标记：SSE 事件引用前端未持有的 taskId 时合并为一次拉取
  const pendingSnapshotRef = useRef(false);

  // 拉取初始快照
  const fetchSnapshot = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/automation/${id}/status`);
      if (!res.ok) return;
      const snap: AutomationJobSnapshot = await res.json();
      if (snap.job) setJob(snap.job);
      if (snap.tasks) setTasks(snap.tasks);
    } catch {
      /* ignore */
    }
  }, []);

  // 防抖 fetchSnapshot：N 个事件引用未知 taskId 时只拉一次，避免 setTasks 风暴 → 灰屏
  const scheduleSnapshot = useCallback((id: string) => {
    if (pendingSnapshotRef.current) return;
    pendingSnapshotRef.current = true;
    setTimeout(() => {
      pendingSnapshotRef.current = false;
      fetchSnapshot(id);
    }, 300);
  }, [fetchSnapshot]);

  // SSE 连接
  // 延迟创建 EventSource（setTimeout 0），避免 React StrictMode 开发模式双重挂载
  // 导致 EventSource 在 CONNECTING 状态被 es.close() 中止，浏览器报 ERR_ABORTED。
  // StrictMode 双重挂载是同步的（挂载→卸载→重挂），setTimeout 0 在下一个事件循环执行，
  // 第一次的 timer 会被 cleanup 的 clearTimeout 取消，只有第二次真正创建连接。
  useEffect(() => {
    if (!jobId) {
      setConnected(false);
      return;
    }

    // 重置 parseBookDone（新 jobId 时重新等待切片完成事件）
    setParseBookDone(false);

    // 先拉取一次快照
    fetchSnapshot(jobId);

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;

      const es = new EventSource(`/api/automation/${jobId}/stream`);
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        setError("SSE 连接断开，正在重连...");
      };

      const applySnapshot = (snap: AutomationJobSnapshot) => {
        if (snap.job) setJob(snap.job);
        if (snap.tasks) setTasks(snap.tasks);
      };

      es.addEventListener("snapshot", (e) => {
        try { applySnapshot(JSON.parse((e as MessageEvent).data)); } catch { /* */ }
      });

      es.addEventListener("job_progress", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setJob(prev => prev ? { ...prev, ...data, status: data.status || prev.status } : prev);
        } catch { /* */ }
      });

      es.addEventListener("slice_start", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setError(null);
          void data;
        } catch { /* */ }
      });

      es.addEventListener("parse_book_complete", () => {
        setParseBookDone(true);
        fetchSnapshot(jobId);
      });

      es.addEventListener("task_update", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === data.taskId);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], status: data.status, attempts: data.attempt ?? copy[idx].attempts };
              return copy;
            }
            scheduleSnapshot(jobId);
            return prev;
          });
        } catch { /* */ }
      });

      es.addEventListener("task_complete", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === data.taskId);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], status: data.status, finishedAt: new Date().toISOString(), error: null };
              return copy;
            }
            scheduleSnapshot(jobId);
            return prev;
          });
        } catch { /* */ }
      });

      es.addEventListener("task_failed", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === data.taskId);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], status: "failed", error: data.error, attempts: data.attempt ?? copy[idx].attempts };
              return copy;
            }
            scheduleSnapshot(jobId);
            return prev;
          });
        } catch { /* */ }
      });

      es.addEventListener("job_complete", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setJob(prev => prev ? { ...prev, status: "completed", completedSlices: data.completed, failedSlices: data.failed, finishedAt: new Date().toISOString() } : prev);
          fetchSnapshot(jobId);
        } catch { /* */ }
      });

      es.addEventListener("job_finished", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setJob(prev => prev ? { ...prev, status: data.status, completedSlices: data.completed, failedSlices: data.failed, finishedAt: new Date().toISOString() } : prev);
          fetchSnapshot(jobId);
        } catch { /* */ }
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const es = eventSourceRef.current;
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
      setConnected(false);
    };
  }, [jobId, fetchSnapshot, scheduleSnapshot]);

  // 控制操作
  const start = useCallback(async (projectId: string, opts?: { concurrency?: number; model?: string }): Promise<string> => {
    setError(null);
    const res = await fetch("/api/automation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...opts }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "启动失败");
    }
    const data = await res.json();
    setJob(data.job);
    return data.job.id as string;
  }, []);

  const pause = useCallback(async () => {
    if (!jobId) return;
    // 乐观更新：立即反映到 UI，不等 SSE 回程（此前要等 orchestrator 当前 task 跑完才响应）
    setJob(prev => prev ? { ...prev, status: "paused" } : prev);
    await fetch(`/api/automation/${jobId}/pause`, { method: "POST" });
  }, [jobId]);

  const resume = useCallback(async () => {
    if (!jobId) return;
    setJob(prev => prev ? { ...prev, status: "running" } : prev);
    await fetch(`/api/automation/${jobId}/resume`, { method: "POST" });
  }, [jobId]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    setJob(prev => prev ? { ...prev, status: "cancelled" } : prev);
    await fetch(`/api/automation/${jobId}/cancel`, { method: "POST" });
  }, [jobId]);

  const retryTask = useCallback(async (taskId: string) => {
    await fetch(`/api/automation/task/${taskId}/retry`, { method: "POST" });
  }, []);

  const retryAll = useCallback(async () => {
    if (!jobId) return;
    await fetch(`/api/automation/${jobId}/retry-all`, { method: "POST" });
  }, [jobId]);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    await fetchSnapshot(jobId);
  }, [jobId, fetchSnapshot]);

  return { job, tasks, connected, error, parseBookDone, start, pause, resume, cancel, retryTask, retryAll, refresh };
}
