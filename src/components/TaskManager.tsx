import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Pause, X, RefreshCw, Download, ChevronRight, AlertCircle,
  CheckCircle2, Clock, Loader, FileText, Scissors, FileCode, Rocket,
  Layers, Eye, Edit3, Settings as SettingsIcon, Calendar,
  BookOpen, Database, Cpu, Minimize2
} from "lucide-react";
import { motion } from "motion/react";
import { useAutomationJob } from "../hooks/useAutomationJob";
import { useLanguage, type TranslationKey } from "../i18n/LanguageContext";
import type { BookModule, AutomationTask, ProjectInfo } from "../types";

// ==================== 类型 ====================

interface TaskManagerProps {
  projectId: string;
  bookTitle: string;
  modules: BookModule[];
  directoryItems: any[];
  projectInfo: ProjectInfo | null;
  jobId: string | null;
  onJobIdChange: (id: string | null) => void;
  onSwitchToManual: () => void;
  onEditSlice: (moduleId: string) => void;
  onMinimize: () => void;
  onRefreshProject: () => void;
}

type StageKey = "project" | "directory" | "slice" | "extract" | "script" | "build";

// 6 步流程定义（使用 i18n key）
const PIPELINE_STAGES: { key: StageKey; labelKey: TranslationKey; icon: any; stage: string }[] = [
  { key: "project", labelKey: "tmStageProject", icon: FileText, stage: "project" },
  { key: "directory", labelKey: "tmStageDirectory", icon: Layers, stage: "directory" },
  { key: "slice", labelKey: "tmStageSlice", icon: Scissors, stage: "slice" },
  { key: "extract", labelKey: "tmStageExtract", icon: FileText, stage: "extract" },
  { key: "script", labelKey: "tmStageScript", icon: FileCode, stage: "script" },
  { key: "build", labelKey: "tmStageBuild", icon: Rocket, stage: "app-code" },
];

// ==================== TaskManager ====================

export function TaskManager({
  projectId,
  bookTitle,
  modules,
  directoryItems,
  projectInfo,
  jobId,
  onJobIdChange,
  onSwitchToManual,
  onEditSlice,
  onMinimize,
  onRefreshProject,
}: TaskManagerProps) {
  const { t, language } = useLanguage();
  const { job, tasks, connected, error, start, pause, resume, cancel, retryTask, retryAll, refresh, parseBookDone } = useAutomationJob(jobId);
  const [starting, setStarting] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<StageKey>("project");

  // 切片生成完成后刷新项目数据（modules / projectInfo）
  // 使用 ref 保存 onRefreshProject，避免其引用每次渲染变化导致 useEffect 反复执行
  // （此前 onRefreshProject 为内联箭头函数，每次渲染引用都变，触发无限 loadProject → addAgentMessage → 灰屏）
  const onRefreshProjectRef = useRef(onRefreshProject);
  onRefreshProjectRef.current = onRefreshProject;

  useEffect(() => {
    if (parseBookDone) {
      onRefreshProjectRef.current();
    }
  }, [parseBookDone]);

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

  const isRunning = job?.status === "running";
  const isPaused = job?.status === "paused";
  const isActive = isRunning || isPaused;
  const isFinished = job && ["completed", "partial", "cancelled", "failed"].includes(job.status);
  const hasNoJob = !job;

  const completed = job?.completedSlices ?? 0;
  const failed = job?.failedSlices ?? 0;
  const total = job?.totalSlices ?? modules.length;
  const progressPct = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  // 统计数据
  const extractCount = tasks.filter(t => t.stage === "extract" && (t.status === "completed" || t.status === "skipped")).length;
  const scriptCount = tasks.filter(t => t.stage === "script" && (t.status === "completed" || t.status === "skipped")).length;
  const buildCount = tasks.filter(t => t.stage === "app-code" && (t.status === "completed" || t.status === "skipped")).length;

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

  // 计算流程阶段状态
  const getStageStatus = (stageKey: StageKey): "completed" | "running" | "pending" | "failed" => {
    if (!job) {
      if (stageKey === "project") return "completed";
      if (stageKey === "directory") return directoryItems.length > 0 ? "completed" : "pending";
      if (stageKey === "slice") return modules.length > 0 ? "completed" : "pending";
      return "pending";
    }
    if (stageKey === "project") return "completed";
    if (stageKey === "directory") return directoryItems.length > 0 ? "completed" : "running";
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

  const stageStatusText = (status: string): string => {
    switch (status) {
      case "completed": return t("tmStatusCompleted");
      case "running": return t("tmStatusRunning");
      case "failed": return t("tmStatusFailed");
      default: return t("tmStatusPending");
    }
  };

  const jobStatusText = (status?: string): string => {
    switch (status) {
      case "completed": return t("tmStatusAllDone");
      case "running": return t("tmStatusGenerating");
      case "paused": return t("tmStatusPaused");
      case "partial": return t("tmStatusPartial");
      case "failed": return t("tmStatusFailedJob");
      case "cancelled": return t("tmStatusCancelled");
      default: return t("tmStatusWaiting");
    }
  };

  const selectedModule = modules.find(m => m.id === selectedModuleId);
  const selectedTasks = selectedModuleId ? tasks.filter(t => t.moduleId === selectedModuleId) : [];

  // 当前阶段是否需要展示切片列表（slice/extract/script/build）
  const showSliceList = ["slice", "extract", "script", "build"].includes(activeStage);

  return (
    <div className="flex flex-col h-full bg-[#050508] overflow-hidden">
      {/* ============ 顶部工具栏 ============ */}
      <div className="shrink-0 bg-[#07070a] border-b border-white/10 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate flex items-center gap-2">
              <Rocket className="w-4 h-4 text-cyan-400 shrink-0" />
              {bookTitle || t("tmTitle")}
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
                  {jobStatusText(job.status)}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">{t("tmStatusNotStarted")}</span>
              )}
              {connected && <span className="text-[9px] text-emerald-500/60">{t("tmConnected")}</span>}
              {error && <span className="text-[9px] text-red-400/70 truncate">{error}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isRunning && (
            <button type="button" onClick={pause} className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <Pause className="w-3 h-3" /> {t("tmStatusPaused")}
            </button>
          )}
          {isPaused && (
            <button type="button" onClick={resume} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <Play className="w-3 h-3" /> {language === "en" ? "Resume" : "恢复"}
            </button>
          )}
          {isActive && (
            <button type="button" onClick={cancel} className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <X className="w-3 h-3" /> {language === "en" ? "Cancel" : "取消"}
            </button>
          )}
          {job?.status === "partial" && failed > 0 && (
            <button type="button" onClick={handleRetryAll} className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> {t("tmRetryAllFailed")}
            </button>
          )}
          {isFinished && completed > 0 && (
            <button type="button" onClick={handleDownloadAll} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <Download className="w-3 h-3" /> {t("tmDownloadAll")}
            </button>
          )}
          <button
            type="button"
            onClick={onSwitchToManual}
            disabled={isActive}
            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            title={t("tmSwitchManualHint")}
          >
            <SettingsIcon className="w-3 h-3" /> {t("tmSwitchManual")}
          </button>
          <button
            type="button"
            onClick={onMinimize}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1"
            title={language === "en" ? "Minimize to background (task keeps running)" : "最小化到后台执行（任务继续运行）"}
          >
            <Minimize2 className="w-3 h-3" /> {language === "en" ? "Minimize" : "最小化到后台"}
          </button>
        </div>
      </div>

      {/* 进度条 */}
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
            {failed > 0 && <span className="text-red-400"> ({failed} {language === "en" ? "failed" : "失败"})</span>}
            <span className="text-slate-600 ml-1">({progressPct}%)</span>
          </span>
        </div>
      )}

      {/* ============ 启动卡片 ============ */}
      {hasNoJob && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Rocket className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t("tmPrepareStart")}</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {t("tmPrepareDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold border border-cyan-400/30 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition cursor-pointer flex items-center gap-2 mx-auto"
            >
              {starting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> {t("tmStarting")}</>
              ) : (
                <><Play className="w-4 h-4" /> {t("tmStartAuto")}</>
              )}
            </button>
            {modules.length > 0 && (
              <p className="text-[10px] text-slate-500">{t("tmHasSlicesReuse")}</p>
            )}
          </div>
        </div>
      )}

      {/* ============ 三栏布局 ============ */}
      {job && (
        <div className="flex-1 flex min-h-0">
          {/* 左栏：流程时间线 */}
          <div className="w-48 shrink-0 border-r border-white/5 bg-[#07070a]/50 overflow-y-auto p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{t("tmPipeline")}</div>
            <div className="space-y-1">
              {PIPELINE_STAGES.map((stage, idx) => {
                const status = getStageStatus(stage.key);
                const Icon = stage.icon;
                const active = activeStage === stage.key;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => { setActiveStage(stage.key); setSelectedModuleId(null); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition cursor-pointer ${
                      active
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
                      <div className="text-[11px] font-semibold text-slate-200 truncate">{t(stage.labelKey)}</div>
                      <div className={`text-[9px] ${
                        status === "completed" ? "text-emerald-400" :
                        status === "running" ? "text-cyan-300" :
                        status === "failed" ? "text-red-400" :
                        "text-slate-600"
                      }`}>
                        {stageStatusText(status)}
                      </div>
                    </div>
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-700" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 中栏：切片列表（仅在切片相关阶段显示） */}
          {showSliceList ? (
            <div className="w-72 shrink-0 border-r border-white/5 bg-[#07070a]/30 overflow-y-auto">
              <div className="sticky top-0 bg-[#07070a] border-b border-white/5 px-3 py-2 flex items-center justify-between z-10">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t("tmSliceList")} ({modules.length})
                </span>
              </div>
              {modules.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-xs text-slate-500">{t("tmSliceGenInProgress")}</p>
                </div>
              ) : (
                <div className="p-1.5 space-y-1">
                  {modules.map((mod, idx) => (
                    <SliceCard
                      key={mod.id}
                      module={mod}
                      index={idx}
                      tasks={tasks.filter(t => t.moduleId === mod.id)}
                      selected={selectedModuleId === mod.id}
                      onSelect={() => setSelectedModuleId(mod.id)}
                      t={t}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* 右栏：阶段详情或切片详情 */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-[#050508]">
            {selectedModule ? (
              <SliceDetail
                module={selectedModule}
                tasks={selectedTasks}
                onRetryTask={retryTask}
                onEditSlice={(mid) => onEditSlice(mid)}
                t={t}
                language={language}
              />
            ) : (
              <StageDetail
                stage={activeStage}
                projectId={projectId}
                bookTitle={bookTitle}
                modules={modules}
                directoryItems={directoryItems}
                projectInfo={projectInfo}
                tasks={tasks}
                job={job}
                extractCount={extractCount}
                scriptCount={scriptCount}
                buildCount={buildCount}
                getStageStatus={getStageStatus}
                t={t}
                language={language}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== StageDetail：阶段详情面板 ====================

interface StageDetailProps {
  stage: StageKey;
  projectId: string;
  bookTitle: string;
  modules: BookModule[];
  directoryItems: any[];
  projectInfo: ProjectInfo | null;
  tasks: AutomationTask[];
  job: any;
  extractCount: number;
  scriptCount: number;
  buildCount: number;
  getStageStatus: (key: StageKey) => "completed" | "running" | "pending" | "failed";
  t: (key: TranslationKey) => string;
  language: "zh" | "en";
}

function StageDetail({
  stage, projectId, bookTitle, modules, directoryItems, projectInfo,
  tasks, job, extractCount, scriptCount, buildCount, getStageStatus, t, language,
}: StageDetailProps) {
  // 当前所处阶段（用于项目状态显示）
  const currentStageText = (): string => {
    if (!job) return t("tmStatusNotStarted");
    const order: StageKey[] = ["project", "directory", "slice", "extract", "script", "build"];
    for (const k of order) {
      const s = getStageStatus(k);
      if (s === "running") return t(`tmStage${k.charAt(0).toUpperCase() + k.slice(1)}` as TranslationKey);
      if (s === "pending" || s === "failed") return t(`tmStage${k.charAt(0).toUpperCase() + k.slice(1)}` as TranslationKey);
    }
    return t("tmStatusAllDone");
  };

  if (stage === "project") {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">{t("tmProjectInfo")}</h3>
        </div>
        <p className="text-xs text-slate-500 -mt-2">{t("tmStageProjectDesc")}</p>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <InfoRow icon={FileText} label={t("tmProjectName")} value={bookTitle || projectInfo?.name || "—"} />
          <InfoRow icon={BookOpen} label={t("tmPdfFile")} value={projectInfo?.pdfFileName || "—"} />
          <InfoRow icon={Calendar} label={t("tmCreatedAt")} value={projectInfo?.createdAt ? new Date(projectInfo.createdAt).toLocaleString(language === "en" ? "en-US" : "zh-CN") : "—"} />
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-cyan-300">{t("tmProjectStatus")}</h4>
          </div>
          <InfoRow label={t("tmCurrentStage")} value={currentStageText()} />
          <InfoRow label={t("tmSliceCount")} value={`${modules.length}`} />
          <InfoRow label={t("tmExtractedCount")} value={`${extractCount} / ${modules.length}`} />
          <InfoRow label={t("tmScriptCount")} value={`${scriptCount} / ${modules.length}`} />
          <InfoRow label={t("tmGameCount")} value={`${buildCount} / ${modules.length}`} />
        </div>
      </div>
    );
  }

  if (stage === "directory") {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">{t("tmStageDirectory")}</h3>
        </div>
        <p className="text-xs text-slate-500 -mt-2">{t("tmStageDirectoryDesc")}</p>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="text-[10px] text-slate-500 mb-2">{t("tmDirectoryCount")}：{directoryItems.length}</div>
          {directoryItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">{t("tmNoDirectory")}</p>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {directoryItems.map((item, idx) => (
                <div key={item.id || idx} className="text-xs px-2 py-1.5 rounded bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-600">{item.type === "chapter" ? "章" : "节"}</span>
                    <span className="text-slate-200 truncate">{item.title}</span>
                    {item.startPage && (
                      <span className="text-[9px] text-slate-600 ml-auto">p.{item.startPage}{item.endPage ? `-${item.endPage}` : ""}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (stage === "slice") {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Scissors className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">{t("tmSliceSummary")}</h3>
        </div>
        <p className="text-xs text-slate-500 -mt-2">{t("tmStageSliceDesc")}</p>

        <div className="grid grid-cols-3 gap-2">
          <StatBox label={t("tmSliceCount")} value={modules.length} color="cyan" />
          <StatBox label={t("tmExtractedCount")} value={`${extractCount}/${modules.length}`} color="emerald" />
          <StatBox label={t("tmBuiltCount")} value={`${buildCount}/${modules.length}`} color="purple" />
        </div>

        {modules.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">{t("tmSliceGenInProgress")}</p>
        ) : (
          <div className="space-y-1 max-h-[55vh] overflow-y-auto">
            {modules.map((mod, idx) => (
              <div key={mod.id} className="text-xs px-3 py-2 rounded bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-slate-600 w-6">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="text-[10px] font-mono text-cyan-400">{mod.sliceId || `S${idx + 1}`}</span>
                  <span className="text-slate-200 truncate flex-1">{mod.title}</span>
                </div>
                {mod.summary && (
                  <div className="text-[10px] text-slate-500 mt-1 ml-8 truncate">
                    {typeof mod.summary === "string" ? mod.summary : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // extract / script / build 阶段汇总
  const stageKeyMap: Record<string, "extract" | "script" | "app-code"> = {
    extract: "extract",
    script: "script",
    build: "app-code",
  };
  const stageKey = stageKeyMap[stage];
  const stageTasks = tasks.filter(t => t.stage === stageKey);
  const stageCompleted = stageTasks.filter(t => t.status === "completed" || t.status === "skipped").length;
  const stageFailed = stageTasks.filter(t => t.status === "failed").length;
  const stageRunning = stageTasks.filter(t => t.status === "running").length;

  const summaryLabel: Record<string, TranslationKey> = {
    extract: "tmExtractSummary",
    script: "tmScriptSummary",
    build: "tmBuildSummary",
  };
  const descLabel: Record<string, TranslationKey> = {
    extract: "tmStageExtractDesc",
    script: "tmStageScriptDesc",
    build: "tmStageBuildDesc",
  };
  const IconMap: Record<string, any> = { extract: FileText, script: FileCode, build: Rocket };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        {(() => { const Icon = IconMap[stage]; return <Icon className="w-4 h-4 text-cyan-400" />; })()}
        <h3 className="text-sm font-bold text-white">{t(summaryLabel[stage])}</h3>
      </div>
      <p className="text-xs text-slate-500 -mt-2">{t(descLabel[stage])}</p>

      <div className="grid grid-cols-4 gap-2">
        <StatBox label={t("tmSliceCount")} value={modules.length} color="cyan" />
        <StatBox label={t("tmStatusCompleted")} value={stageCompleted} color="emerald" />
        <StatBox label={t("tmStatusRunning")} value={stageRunning} color="blue" />
        <StatBox label={t("tmStatusFailed")} value={stageFailed} color="red" />
      </div>

      {modules.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">{t("tmSliceGenInProgress")}</p>
      ) : (
        <div className="space-y-1 max-h-[55vh] overflow-y-auto">
          {modules.map((mod, idx) => {
            const task = stageTasks.find(t => t.moduleId === mod.id);
            const status = task?.status || "pending";
            const statusColor =
              status === "completed" || status === "skipped" ? "text-emerald-400" :
              status === "running" ? "text-cyan-300" :
              status === "failed" ? "text-red-400" : "text-slate-500";
            const statusIcon =
              status === "completed" || status === "skipped" ? "✓" :
              status === "running" ? "⟳" :
              status === "failed" ? "✗" : "○";
            return (
              <div key={mod.id} className="text-xs px-3 py-2 rounded bg-white/[0.02] border border-white/5 flex items-center gap-2">
                <span className={`text-xs font-mono ${statusColor}`}>{statusIcon}</span>
                <span className="text-[9px] font-mono text-slate-600 w-6">{String(idx + 1).padStart(2, "0")}</span>
                <span className="text-slate-200 truncate flex-1">{mod.title}</span>
                <span className={`text-[9px] ${statusColor}`}>
                  {status === "completed" || status === "skipped" ? t("tmStatusCompleted") :
                   status === "running" ? t("tmStatusRunning") :
                   status === "failed" ? t("tmStatusFailed") : t("tmStatusPending")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== InfoRow ====================

function InfoRow({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
      <span className="text-slate-500 w-24 shrink-0">{label}</span>
      <span className="text-slate-200 font-semibold flex-1 truncate">{value}</span>
    </div>
  );
}

// ==================== StatBox ====================

function StatBox({ label, value, color }: { label: string; value: string | number; color: "cyan" | "emerald" | "purple" | "red" | "blue" }) {
  const colorMap = {
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
    purple: "border-purple-500/20 bg-purple-500/5 text-purple-300",
    red: "border-red-500/20 bg-red-500/5 text-red-300",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-300",
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
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
  t: (key: TranslationKey) => string;
  language: "zh" | "en";
}

function SliceCard({ module, index, tasks, selected, onSelect, t, language }: SliceCardProps) {
  const extractTask = tasks.find(t => t.stage === "extract");
  const scriptTask = tasks.find(t => t.stage === "script");
  const appTask = tasks.find(t => t.stage === "app-code");

  const hasAppCode = appTask?.status === "completed";
  const hasFailed = tasks.some(t => t.status === "failed");
  const isRunning = tasks.some(t => t.status === "running");

  const statusIcon = hasAppCode ? "✓" : hasFailed ? "✗" : isRunning ? "⟳" : "○";
  const statusColor = hasAppCode ? "text-emerald-400" : hasFailed ? "text-red-400" : isRunning ? "text-cyan-300" : "text-slate-500";

  const miniLabels = language === "en"
    ? { extract: "E", script: "S", build: "B" }
    : { extract: "提", script: "脚", build: "构" };

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
        <MiniStage label={miniLabels.extract} task={extractTask} />
        <MiniStage label={miniLabels.script} task={scriptTask} />
        <MiniStage label={miniLabels.build} task={appTask} />
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
  t: (key: TranslationKey) => string;
  language: "zh" | "en";
}

function SliceDetail({ module, tasks, onRetryTask, onEditSlice, t, language }: SliceDetailProps) {
  const stages: { key: "extract" | "script" | "app-code"; labelKey: TranslationKey; icon: any }[] = [
    { key: "extract", labelKey: "tmStageExtract", icon: FileText },
    { key: "script", labelKey: "tmStageScript", icon: FileCode },
    { key: "app-code", labelKey: "tmStageBuild", icon: Rocket },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-cyan-400">{module.sliceId || `S${module.id.slice(-3)}`}</span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-[10px] text-slate-500">{module.coveredChapters || (language === "en" ? "No chapter range" : "无章节范围")}</span>
          </div>
          <h3 className="text-base font-bold text-white">{module.title}</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {typeof module.summary === "string"
              ? module.summary
              : (module.summary as any)?.learnedPoints?.join("；") || "—"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onEditSlice(module.id)}
        className="w-full px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1.5"
      >
        <Edit3 className="w-3.5 h-3.5" /> {t("tmEditThisSlice")}
      </button>

      <div className="space-y-2">
        {stages.map(({ key, labelKey, icon: Icon }) => {
          const task = tasks.find(t => t.stage === key);
          return (
            <StageRow
              key={key}
              label={t(labelKey)}
              icon={Icon}
              task={task}
              onRetry={task ? () => onRetryTask(task.id) : undefined}
              t={t}
              language={language}
            />
          );
        })}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-8">
          <Clock className="w-6 h-6 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">{t("tmSliceNotStarted")}</p>
        </div>
      )}
    </div>
  );
}

// ==================== StageRow ====================

function StageRow({
  label, icon: Icon, task, onRetry, t, language,
}: {
  label: string;
  icon: any;
  task?: AutomationTask;
  onRetry?: () => void;
  t: (key: TranslationKey) => string;
  language: "zh" | "en";
}) {
  const status = task?.status || "pending";
  const statusConfig = {
    completed: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: t("tmStatusCompleted"), Icon: CheckCircle2 },
    skipped: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: t("tmStatusSkipped"), Icon: CheckCircle2 },
    running: { color: "text-cyan-300", bg: "bg-cyan-500/10 border-cyan-500/20", label: t("tmStatusRunning"), Icon: Loader },
    failed: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: t("tmStatusFailed"), Icon: AlertCircle },
    pending: { color: "text-slate-500", bg: "bg-white/5 border-white/10", label: t("tmStatusPending"), Icon: Clock },
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

      {task && (
        <div className="mt-2 ml-7 space-y-1 text-[10px] text-slate-400">
          {task.startedAt && (
            <div>{t("tmStartTime")}：{new Date(task.startedAt).toLocaleString(language === "en" ? "en-US" : "zh-CN")}</div>
          )}
          {task.finishedAt && (
            <div>{t("tmFinishTime")}：{new Date(task.finishedAt).toLocaleString(language === "en" ? "en-US" : "zh-CN")}</div>
          )}
          {task.attempts > 0 && (
            <div>{t("tmAttempts")}：{task.attempts} / {task.maxAttempts}</div>
          )}
          {task.error && (
            <div className="text-red-400/80 mt-1 p-2 bg-red-500/5 rounded border border-red-500/10 break-all">
              {task.error}
            </div>
          )}
        </div>
      )}

      {task?.status === "failed" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 ml-7 px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-semibold cursor-pointer transition flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> {t("tmRetryStage")}
        </button>
      )}
    </div>
  );
}
