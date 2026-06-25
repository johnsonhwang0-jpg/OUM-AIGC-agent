import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAutomationJob } from "../hooks/useAutomationJob";
import type {
  AutomationTask,
  ExecutionMode,
  BookModule,
} from "../types";

// ==================== ModeToggle ====================

interface ModeToggleProps {
  mode: ExecutionMode;
  onChange: (mode: ExecutionMode) => void;
  disabled?: boolean;
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-black/40 border border-white/10 rounded-full p-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("auto")}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          mode === "auto"
            ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        自动模式
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("manual")}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          mode === "manual"
            ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        校验模式
      </button>
    </div>
  );
}

// ==================== TaskStageIcon ====================

function StageBadge({ stage, status }: { stage: string; status: string }) {
  const stageLabel = stage === "extract" ? "提取" : stage === "script" ? "脚本" : "生成";
  const color =
    status === "completed"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : status === "running"
        ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 animate-pulse"
        : status === "failed"
          ? "bg-red-500/15 text-red-400 border-red-500/30"
          : status === "skipped"
            ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
            : "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${color}`}>
      {stageLabel}
    </span>
  );
}

// ==================== SliceRow ====================

interface SliceRowProps {
  module: BookModule;
  tasks: AutomationTask[];
  index: number;
  onEditSlice: (moduleId: string) => void;
  onRetryTask: (taskId: string) => void;
}

function SliceRow({ module, tasks, index, onEditSlice, onRetryTask }: SliceRowProps) {
  const [expanded, setExpanded] = useState(false);
  const moduleTasks = tasks.filter(t => t.moduleId === module.id);
  const hasAppCode = moduleTasks.some(t => t.stage === "app-code" && t.status === "completed");
  const hasFailed = moduleTasks.some(t => t.status === "failed");
  const isRunning = moduleTasks.some(t => t.status === "running");

  const statusIcon = hasAppCode ? "✓" : hasFailed ? "✗" : isRunning ? "⟳" : "○";
  const statusColor = hasAppCode ? "text-emerald-400" : hasFailed ? "text-red-400" : isRunning ? "text-cyan-300" : "text-slate-500";

  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition text-left"
      >
        <span className={`text-sm font-mono ${statusColor}`}>{statusIcon}</span>
        <span className="text-[10px] text-slate-500 font-mono w-6">{String(index + 1).padStart(2, "0")}</span>
        <span className="text-xs text-slate-200 flex-1 truncate">{module.sliceId || module.title}</span>
        <div className="flex gap-1">
          {["extract", "script", "app-code"].map(stage => {
            const task = moduleTasks.find(t => t.stage === stage);
            return task ? (
              <StageBadge key={stage} stage={stage} status={task.status} />
            ) : (
              <span key={stage} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border bg-slate-500/10 text-slate-600 border-slate-500/10">
                {stage === "extract" ? "提取" : stage === "script" ? "脚本" : "生成"}
              </span>
            );
          })}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-3 py-2 space-y-1.5 bg-black/20">
              {moduleTasks.length === 0 && (
                <p className="text-[10px] text-slate-500">暂无任务记录</p>
              )}
              {moduleTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 text-[10px]">
                  <StageBadge stage={task.stage} status={task.status} />
                  <span className="text-slate-400 flex-1 truncate">
                    {task.error ? `错误: ${task.error}` : `尝试 ${task.attempts}/${task.maxAttempts}`}
                  </span>
                  {task.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => onRetryTask(task.id)}
                      className="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[9px] font-semibold cursor-pointer"
                    >
                      重试
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onEditSlice(module.id)}
                  className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[9px] font-semibold cursor-pointer"
                >
                  编辑此切片
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==================== AutomationPanel ====================

interface AutomationPanelProps {
  projectId: string;
  modules: BookModule[];
  executionMode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
  onEditSlice: (moduleId: string) => void;
  jobId: string | null;
  onJobIdChange: (id: string | null) => void;
  /** 第一阶段（无切片时）只显示模式切换 + 启动 + 进度看板 */
  compact?: boolean;
}

export function AutomationPanel({
  projectId,
  modules,
  executionMode,
  onModeChange,
  onEditSlice,
  jobId,
  onJobIdChange,
  compact,
}: AutomationPanelProps) {
  const { job, tasks, connected, error, start, pause, resume, cancel, retryTask, retryAll } = useAutomationJob(jobId);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      // 先切换到 auto 模式
      await fetch(`/api/projects/${projectId}/execution-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionMode: "auto" }),
      });
      onModeChange("auto");

      // 启动任务并获取 jobId
      const newJobId = await start(projectId);
      onJobIdChange(newJobId);
    } catch (err: any) {
      console.error("启动自动化失败:", err);
    } finally {
      setStarting(false);
    }
  };

  const completed = job?.completedSlices ?? 0;
  const failed = job?.failedSlices ?? 0;
  const total = job?.totalSlices ?? modules.length;

  const isRunning = job?.status === "running";
  const isPaused = job?.status === "paused";
  const isActive = isRunning || isPaused;
  const isFinished = job && ["completed", "partial", "cancelled"].includes(job.status);

  const handleModeChange = async (mode: ExecutionMode) => {
    await fetch(`/api/projects/${projectId}/execution-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionMode: mode }),
    });
    onModeChange(mode);
  };

  const handleDownloadAll = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/app-codes`);
      const data = await res.json();
      const items = data.items || [];
      for (const item of items) {
        const blob = new Blob([item.code], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${item.title || item.moduleId}.html`;
        a.click();
        URL.revokeObjectURL(url);
        // 间隔下载避免浏览器拦截
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) {
      console.error("下载失败:", err);
    }
  };

  return (
    <div className="space-y-3">
      {/* 模式切换 */}
      <div className="flex items-center justify-between">
        <ModeToggle mode={executionMode} onChange={handleModeChange} disabled={isRunning} />
        {executionMode === "auto" && !isActive && !isFinished && (
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
          >
            {starting ? "启动中..." : "▶ 开始自动生成"}
          </button>
        )}
        {isFinished && (
          <button
            type="button"
            onClick={handleDownloadAll}
            className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer transition"
          >
            ⬇ 下载全部 HTML
          </button>
        )}
      </div>

      {/* 进度看板 */}
      {job && (
        <div className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${
                job.status === "completed" ? "text-emerald-400" :
                job.status === "running" ? "text-cyan-300" :
                job.status === "paused" ? "text-amber-300" :
                job.status === "partial" ? "text-orange-400" :
                job.status === "cancelled" ? "text-red-400" :
                "text-slate-400"
              }`}>
                {job.status === "completed" ? "✓ 全部完成" :
                 job.status === "running" ? "⏳ 正在生成" :
                 job.status === "paused" ? "⏸ 已暂停" :
                 job.status === "partial" ? "⚠ 部分完成" :
                 job.status === "cancelled" ? "✗ 已取消" :
                 "等待中"}
              </span>
              {connected && <span className="text-[9px] text-emerald-500/60">● 已连接</span>}
            </div>
            <div className="flex gap-1.5">
              {isRunning && (
                <button type="button" onClick={pause} className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10px] font-semibold cursor-pointer">暂停</button>
              )}
              {isPaused && (
                <button type="button" onClick={resume} className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[10px] font-semibold cursor-pointer">恢复</button>
              )}
              {isActive && (
                <button type="button" onClick={cancel} className="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-semibold cursor-pointer">取消</button>
              )}
              {job.status === "partial" && failed > 0 && (
                <button type="button" onClick={retryAll} className="px-2 py-0.5 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-[10px] font-semibold cursor-pointer">重试全部失败</button>
              )}
            </div>
          </div>

          {/* 进度条 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div className="bg-emerald-500/60 h-full" style={{ width: `${(completed / total) * 100}%` }} />
                <div className="bg-red-500/60 h-full" style={{ width: `${(failed / total) * 100}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
              {completed + failed}/{total}
              {failed > 0 && <span className="text-red-400"> ({failed} 失败)</span>}
            </span>
          </div>

          {error && <p className="text-[10px] text-red-400/70">{error}</p>}
        </div>
      )}

      {/* 切片列表（compact 模式或无切片时不显示） */}
      {executionMode === "auto" && !compact && modules.length > 0 && (jobId || isFinished) && (
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {modules.map((mod, idx) => (
            <SliceRow
              key={mod.id}
              module={mod}
              tasks={tasks}
              index={idx}
              onEditSlice={onEditSlice}
              onRetryTask={retryTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}
