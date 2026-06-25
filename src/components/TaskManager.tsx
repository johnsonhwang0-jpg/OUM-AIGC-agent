import { useState, useEffect, useCallback } from "react";
import {
  Play, Pause, X, RefreshCw, Download, ChevronRight, AlertCircle,
  CheckCircle2, Clock, Loader, FileText, Scissors, FileCode, Rocket,
  Layers, Eye, Edit3, ArrowLeft, Settings as SettingsIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAutomationJob } from "../hooks/useAutomationJob";
import type { BookModule, ExecutionMode, AutomationTask } from "../types";

// ==================== 类型 ====================

interface TaskManagerProps {
  projectId: string;
  bookTitle: string;
  modules: BookModule[];
  jobId: string | null;
  onJobIdChange: (id: string | null) => void;
  onSwitchToManual: () => void;
  onEditSlice: (moduleId: string) => void;
  onBack: () => void;
}

// 6 步流程定义
const PIPELINE_STAGES = [
  { key: "project", label: "新建项目", icon: FileText, stage: "project" },
  { key: "directory", label: "目录提取", icon: Layers, stage: "directory" },
  { key: "slice", label: "智能切片", icon: Scissors, stage: "slice" },
  { key: "extract", label: "提炼内容", icon: FileText, stage: "extract" },
  { key: "script", label: "互动脚本", icon: FileCode, stage: "script" },
  { key: "build", label: "生成游戏", icon: Rocket, stage: "app-code" },
] as const;

// ==================== TaskManager ====================

export function TaskManager({
  projectId,
  bookTitle,
  modules,
  jobId,
  onJobIdChange,
  onSwitchToManual,
  onEditSlice,
  onBack,
}: TaskManagerProps) {
  const { job, tasks, connected, error, start, pause, resume, cancel, retryTask, retryAll, refresh } = useAutomationJob(jobId);
  const [starting, setStarting] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all"); // all | extract | script | app-code | failed

  // 自动启动：如果项目已有 modules 但无 jobId，自动启动
  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      const newJobId = await start(projectId);
      onJobIdChange(newJobId);
    } catch (err: any) {
      console.error("启动自动化失败:", err);
    } finally {
      setStarting(false);
    }
  }, [projectId, start, onJobIdChange]);

  // 如果没有 job 且项目已有 modules（说明已加载项目但未启动），等待用户点击启动
  // 如果项目没有 modules（新建项目），也等待启动（orchestrator 会自动生成切片）

  const isRunning = job?.status === "running";
  const isPaused = job?.status === "paused";
  const isActive = isRunning || isPaused;
  const isFinished = job && ["completed", "partial", "cancelled", "failed"].includes(job.status);
  const hasNoJob = !job;

  const completed = job?.completedSlices ?? 0;
  const failed = job?.failedSlices ?? 0;
  const total = job?.totalSlices ?? modules.length;
  const progressPct = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  const handleDownloadAll = useCallback(async () => {
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
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) {
      console.error("下载失败:", err);
    }
  }, [projectId]);

  const handleRetryAll = useCallback(async () => {
    await retryAll();
    await refresh();
  }, [retryAll, refresh]);

  // 筛选切片
  const filteredModules = modules.filter(mod => {
    if (activeFilter === "all") return true;
    if (activeFilter === "failed") {
      return tasks.some(t => t.moduleId === mod.id && t.status === "failed");
    }
    return tasks.some(t => t.moduleId === mod.id && t.stage === activeFilter);
  });

  // 计算流程阶段状态
  const getStageStatus = (stageKey: string): "completed" | "running" | "pending" | "failed" => {
    if (!job) {
      // 无 job 时，project/directory 阶段根据数据判断
      if (stageKey === "project") return "completed";
      if (stageKey === "directory") return modules.length > 0 ? "completed" : "pending";
      return "pending";
    }
    if (stageKey === "project" || stageKey === "directory") return "completed";
    if (stageKey === "slice") {
      return modules.length > 0 ? "completed" : (isRunning ? "running" : "pending");
    }
    // extract / script / app-code
    const stageTasks = tasks.filter(t => t.stage === stageKey);
    if (stageTasks.length === 0) return "pending";
    if (stageTasks.every(t => t.status === "completed" || t.status === "skipped")) return "completed";
    if (stageTasks.some(t => t.status === "failed")) return "failed";
    if (stageTasks.some(t => t.status === "running")) return "running";
    return "pending";
  };

  const selectedModule = modules.find(m => m.id === selectedModuleId);
  const selectedTasks = selectedModuleId ? tasks.filter(t => t.moduleId === selectedModuleId) : [];

  return (
    <div className="flex flex-col h-full bg-[#050508] overflow-hidden">
      {/* ============ 顶部工具栏 ============ */}
      <div className="shrink-0 bg-[#07070a] border-b border-white/10 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer shrink-0"
            title="返回项目首页"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate flex items-center gap-2">
              <Rocket className="w-4 h-4 text-cyan-400 shrink-0" />
              {bookTitle || "自动模式任务管理器"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {job ? (
                <span className={`text-[10px] font-bold ${
                  job.status === "completed" ? "text-emerald-400" :
                  job.status === "running" ? "text-cyan-300" :
                  job.status === "paused" ? "text-amber-300" :
                  job.status === "partial" ? "text-orange-400" :
                  job.status === "failed" ? "text-red-400" :
                  "text-slate-400"
                }`}>
                  {job.status === "completed" ? "✓ 全部完成" :
                   job.status === "running" ? "⏳ 正在生成" :
                   job.status === "paused" ? "⏸ 已暂停" :
                   job.status === "partial" ? "⚠ 部分完成" :
                   job.status === "failed" ? "✗ 任务失败" :
                   job.status === "cancelled" ? "✗ 已取消" : "等待中"}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">未启动</span>
              )}
              {connected && <span className="text-[9px] text-emerald-500/60">● 已连接</span>}
              {error && <span className="text-[9px] text-red-400/70 truncate">{error}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 暂停 / 恢复 */}
          {isRunning && (
            <button type="button" onClick={pause} className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <Pause className="w-3 h-3" /> 暂停
            </button>
          )}
          {isPaused && (
            <button type="button" onClick={resume} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <Play className="w-3 h-3" /> 恢复
            </button>
          )}
          {/* 取消 */}
          {isActive && (
            <button type="button" onClick={cancel} className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <X className="w-3 h-3" /> 取消
            </button>
          )}
          {/* 重试全部失败 */}
          {job?.status === "partial" && failed > 0 && (
            <button type="button" onClick={handleRetryAll} className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> 重试全部失败
            </button>
          )}
          {/* 下载全部 */}
          {isFinished && completed > 0 && (
            <button type="button" onClick={handleDownloadAll} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <Download className="w-3 h-3" /> 下载全部
            </button>
          )}
          {/* 切换到校验模式 */}
          <button
            type="button"
            onClick={onSwitchToManual}
            disabled={isActive}
            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            title="切换到校验模式，可逐个编辑切片"
          >
            <SettingsIcon className="w-3 h-3" /> 切换校验模式
          </button>
        </div>
      </div>

      {/* 进度条（job 存在时） */}
      {job && (
        <div className="shrink-0 bg-[#07070a] border-b border-white/5 px-5 py-2 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
            <div className="h-full flex transition-all duration-500">
              <div className="bg-emerald-500/60 h-full" style={{ width: `${(completed / Math.max(total, 1)) * 100}%` }} />
              <div className="bg-red-500/60 h-full" style={{ width: `${(failed / Math.max(total, 1)) * 100}%` }} />
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
            {completed + failed}/{total}
            {failed > 0 && <span className="text-red-400"> ({failed} 失败)</span>}
            <span className="text-slate-600 ml-1">({progressPct}%)</span>
          </span>
        </div>
      )}

      {/* ============ 启动卡片（无 job 时） ============ */}
      {hasNoJob && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Rocket className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">准备启动自动化流程</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                点击下方按钮，系统将自动执行：
                <br />
                目录提取 → 智能切片 → 内容提炼 → 脚本生成 → 游戏构建
                <br />
                全程无需人工干预，完成后可逐个校验修改。
              </p>
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold border border-cyan-400/30 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition cursor-pointer flex items-center gap-2 mx-auto"
            >
              {starting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> 启动中...</>
              ) : (
                <><Play className="w-4 h-4" /> 启动自动生成</>
              )}
            </button>
            {modules.length > 0 && (
              <p className="text-[10px] text-slate-500">已有 {modules.length} 个切片，将复用并继续未完成的阶段</p>
            )}
          </div>
        </div>
      )}

      {/* ============ 三栏布局（有 job 时） ============ */}
      {job && (
        <div className="flex-1 flex min-h-0">
          {/* 左栏：流程时间线 */}
          <div className="w-48 shrink-0 border-r border-white/5 bg-[#07070a]/50 overflow-y-auto p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">流程时间线</div>
            <div className="space-y-1">
              {PIPELINE_STAGES.map((stage, idx) => {
                const status = getStageStatus(stage.key);
                const Icon = stage.icon;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => setActiveFilter(stage.key === "project" || stage.key === "directory" ? "all" : stage.key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition cursor-pointer ${
                      activeFilter === stage.key
                        ? "bg-cyan-500/10 border border-cyan-500/20"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
                      status === "completed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                      status === "running" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 animate-pulse" :
                      status === "failed" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                      "bg-white/5 text-slate-500 border-white/10"
                    }`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-slate-200 truncate">{stage.label}</div>
                      <div className={`text-[9px] ${
                        status === "completed" ? "text-emerald-400" :
                        status === "running" ? "text-cyan-300" :
                        status === "failed" ? "text-red-400" :
                        "text-slate-600"
                      }`}>
                        {status === "completed" ? "已完成" :
                         status === "running" ? "进行中" :
                         status === "failed" ? "有失败" :
                         "等待中"}
                      </div>
                    </div>
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-700" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 全部展开筛选 */}
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`mt-3 w-full px-2 py-1.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                activeFilter === "all" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "text-slate-400 hover:bg-white/5 border border-transparent"
              }`}
            >
              全部切片
            </button>
            {tasks.some(t => t.status === "failed") && (
              <button
                type="button"
                onClick={() => setActiveFilter("failed")}
                className={`mt-1 w-full px-2 py-1.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                  activeFilter === "failed" ? "bg-red-500/10 text-red-300 border border-red-500/20" : "text-slate-400 hover:bg-white/5 border border-transparent"
                }`}
              >
                仅看失败
              </button>
            )}
          </div>

          {/* 中栏：切片列表 */}
          <div className="w-72 shrink-0 border-r border-white/5 bg-[#07070a]/30 overflow-y-auto">
            <div className="sticky top-0 bg-[#07070a] border-b border-white/5 px-3 py-2 flex items-center justify-between z-10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                切片列表 ({filteredModules.length})
              </span>
              <span className="text-[9px] text-slate-600">{modules.length} 个</span>
            </div>
            {filteredModules.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-slate-500">
                  {modules.length === 0 ? "切片生成中..." : "无匹配切片"}
                </p>
              </div>
            ) : (
              <div className="p-1.5 space-y-1">
                {filteredModules.map((mod, idx) => (
                  <SliceCard
                    key={mod.id}
                    module={mod}
                    index={idx}
                    tasks={tasks.filter(t => t.moduleId === mod.id)}
                    selected={selectedModuleId === mod.id}
                    onSelect={() => setSelectedModuleId(mod.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 右栏：详情面板 */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-[#050508]">
            {selectedModule ? (
              <SliceDetail
                module={selectedModule}
                tasks={selectedTasks}
                onRetryTask={retryTask}
                onEditSlice={(mid) => onEditSlice(mid)}
                onClose={() => setSelectedModuleId(null)}
              />
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center space-y-2">
                  <Eye className="w-8 h-8 text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-500">选择左侧切片查看详情</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SliceCard ====================

interface SliceCardProps {
  module: BookModule;
  index: number;
  tasks: AutomationTask[];
  selected: boolean;
  onSelect: () => void;
}

function SliceCard({ module, index, tasks, selected, onSelect }: SliceCardProps) {
  const extractTask = tasks.find(t => t.stage === "extract");
  const scriptTask = tasks.find(t => t.stage === "script");
  const appTask = tasks.find(t => t.stage === "app-code");

  const hasAppCode = appTask?.status === "completed";
  const hasFailed = tasks.some(t => t.status === "failed");
  const isRunning = tasks.some(t => t.status === "running");

  const statusIcon = hasAppCode ? "✓" : hasFailed ? "✗" : isRunning ? "⟳" : "○";
  const statusColor = hasAppCode ? "text-emerald-400" : hasFailed ? "text-red-400" : isRunning ? "text-cyan-300" : "text-slate-500";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-2 py-1.5 rounded-lg border transition cursor-pointer ${
        selected
          ? "bg-cyan-500/10 border-cyan-500/30"
          : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-mono ${statusColor}`}>{statusIcon}</span>
        <span className="text-[9px] text-slate-600 font-mono w-5">{String(index + 1).padStart(2, "0")}</span>
        <span className="text-[11px] text-slate-200 flex-1 truncate">{module.sliceId || module.title}</span>
      </div>
      <div className="text-[10px] text-slate-500 truncate mt-0.5 ml-5">{module.title}</div>
      <div className="flex gap-1 mt-1 ml-5">
        <MiniStage label="提" task={extractTask} />
        <MiniStage label="脚" task={scriptTask} />
        <MiniStage label="构" task={appTask} />
      </div>
    </button>
  );
}

function MiniStage({ label, task }: { label: string; task?: AutomationTask }) {
  const color = !task
    ? "bg-slate-700/30 text-slate-600"
    : task.status === "completed" || task.status === "skipped"
      ? "bg-emerald-500/15 text-emerald-400"
      : task.status === "running"
        ? "bg-cyan-500/15 text-cyan-300 animate-pulse"
        : task.status === "failed"
          ? "bg-red-500/15 text-red-400"
          : "bg-slate-700/30 text-slate-500";
  return <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[8px] font-mono ${color}`}>{label}</span>;
}

// ==================== SliceDetail ====================

interface SliceDetailProps {
  module: BookModule;
  tasks: AutomationTask[];
  onRetryTask: (taskId: string) => void;
  onEditSlice: (moduleId: string) => void;
  onClose: () => void;
}

function SliceDetail({ module, tasks, onRetryTask, onEditSlice, onClose }: SliceDetailProps) {
  const stages: { key: "extract" | "script" | "app-code"; label: string; icon: any }[] = [
    { key: "extract", label: "内容提炼", icon: FileText },
    { key: "script", label: "互动脚本", icon: FileCode },
    { key: "app-code", label: "游戏构建", icon: Rocket },
  ];

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-cyan-400">{module.sliceId || `S${module.id.slice(-3)}`}</span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-[10px] text-slate-500">{module.coveredChapters || "无章节范围"}</span>
          </div>
          <h3 className="text-base font-bold text-white">{module.title}</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {typeof module.summary === "string"
              ? module.summary
              : (module.summary as any)?.learnedPoints?.join("；") || "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 切换到校验模式编辑 */}
      <button
        type="button"
        onClick={() => onEditSlice(module.id)}
        className="w-full px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1.5"
      >
        <Edit3 className="w-3.5 h-3.5" /> 切换到校验模式编辑此切片
      </button>

      {/* 三阶段详情 */}
      <div className="space-y-2">
        {stages.map(({ key, label, icon: Icon }) => {
          const task = tasks.find(t => t.stage === key);
          return (
            <StageRow
              key={key}
              label={label}
              icon={Icon}
              task={task}
              onRetry={task ? () => onRetryTask(task.id) : undefined}
            />
          );
        })}
      </div>

      {/* 全部任务为空 */}
      {tasks.length === 0 && (
        <div className="text-center py-8">
          <Clock className="w-6 h-6 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">此切片尚未开始处理</p>
        </div>
      )}
    </div>
  );
}

// ==================== StageRow ====================

function StageRow({
  label,
  icon: Icon,
  task,
  onRetry,
}: {
  label: string;
  icon: any;
  task?: AutomationTask;
  onRetry?: () => void;
}) {
  const status = task?.status || "pending";
  const statusConfig = {
    completed: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "已完成", Icon: CheckCircle2 },
    skipped: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: "已跳过", Icon: CheckCircle2 },
    running: { color: "text-cyan-300", bg: "bg-cyan-500/10 border-cyan-500/20", label: "运行中", Icon: Loader },
    failed: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "失败", Icon: AlertCircle },
    pending: { color: "text-slate-500", bg: "bg-white/5 border-white/10", label: "等待中", Icon: Clock },
  }[status];
  const StatusIcon = statusConfig.Icon;

  return (
    <div className={`rounded-lg border p-3 ${statusConfig.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-md ${statusConfig.bg} ${statusConfig.color}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-200">{label}</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-semibold ${statusConfig.color}`}>
          <StatusIcon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} />
          {statusConfig.label}
        </div>
      </div>

      {/* 详情 */}
      {task && (
        <div className="mt-2 ml-7 space-y-1 text-[10px] text-slate-400">
          {task.startedAt && (
            <div>开始：{new Date(task.startedAt).toLocaleString("zh-CN")}</div>
          )}
          {task.finishedAt && (
            <div>完成：{new Date(task.finishedAt).toLocaleString("zh-CN")}</div>
          )}
          {task.attempts > 0 && (
            <div>尝试：{task.attempts} / {task.maxAttempts}</div>
          )}
          {task.error && (
            <div className="text-red-400/80 mt-1 p-2 bg-red-500/5 rounded border border-red-500/10 break-all">
              {task.error}
            </div>
          )}
        </div>
      )}

      {/* 重试按钮 */}
      {task?.status === "failed" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 ml-7 px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> 重试此阶段
        </button>
      )}
    </div>
  );
}
