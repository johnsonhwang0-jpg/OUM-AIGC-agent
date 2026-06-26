import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Pause, X, RefreshCw, Download, AlertCircle,
  CheckCircle2, Clock, Loader, FileText, Scissors, FileCode, Rocket,
  Layers, Eye, Edit3, Calendar,
  BookOpen, Database, Cpu, Minimize2, CornerDownRight
} from "lucide-react";
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
  onEditSlice: (moduleId: string) => void;
  onMinimize: () => void;
  onRefreshProject: () => void;
  appCount: number;
  onViewBuild: () => void;
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
  onEditSlice,
  onMinimize,
  onRefreshProject,
  appCount,
  onViewBuild,
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

  const failed = job?.failedSlices ?? 0;

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
    // extract / script / app-code（build 阶段对应 app-code 任务）
    const taskStage = stageKey === "build" ? "app-code" : stageKey;
    const stageTasks = tasks.filter(t => t.stage === taskStage);
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

  const selectedModule = modules.find(m => m.id === selectedModuleId);
  const selectedTasks = selectedModuleId ? tasks.filter(t => t.moduleId === selectedModuleId) : [];

  // 当前阶段是否需要展示切片列表（slice/extract/script/build）
  const showSliceList = ["slice", "extract", "script", "build"].includes(activeStage);

  // 顶部 bar 4 种状态判断（优先级：全部完成 > 执行中 > 已暂停 > 未启用）
  // app 是最后一步，appCount >= modules.length 意味着所有任务已完成（无论自动还是手工）
  const allCompleted = modules.length > 0 && appCount >= modules.length;
  const tmStatus: "not-started" | "paused" | "running" | "all-done" = allCompleted
    ? "all-done"
    : job?.status === "running" ? "running"
    : job?.status === "paused" ? "paused"
    : "not-started";

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
              <span className={`text-[10px] font-bold ${
                tmStatus === "all-done" ? "text-emerald-400" :
                tmStatus === "running" ? "text-cyan-300" :
                tmStatus === "paused" ? "text-amber-300" :
                "text-slate-500"
              }`}>
                {tmStatus === "all-done" ? t("tmStatusAllTasksDone") :
                 tmStatus === "running" ? t("tmStatusGenerating") :
                 tmStatus === "paused" ? t("tmStatusPaused") :
                 t("tmStatusNotActive")}
              </span>
              {connected && <span className="text-[9px] text-emerald-500/60">{t("tmConnected")}</span>}
              {error && <span className="text-[9px] text-red-400/70 truncate">{error}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 状态1：未启用 → 启用自动模式 */}
          {tmStatus === "not-started" && (
            <button type="button" onClick={handleStart} disabled={starting} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {starting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {t("tmStartAutomation")}
            </button>
          )}
          {/* 状态2：已暂停 → 恢复 / 取消 */}
          {tmStatus === "paused" && (
            <>
              <button type="button" onClick={resume} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
                <Play className="w-3 h-3" /> {language === "en" ? "Resume" : "恢复"}
              </button>
              <button type="button" onClick={cancel} className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
                <X className="w-3 h-3" /> {language === "en" ? "Cancel" : "取消"}
              </button>
            </>
          )}
          {/* 状态3：执行中 → 暂停 / 取消 */}
          {tmStatus === "running" && (
            <>
              <button type="button" onClick={pause} className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
                <Pause className="w-3 h-3" /> {language === "en" ? "Pause" : "暂停"}
              </button>
              <button type="button" onClick={cancel} className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
                <X className="w-3 h-3" /> {language === "en" ? "Cancel" : "取消"}
              </button>
            </>
          )}
          {/* 状态4：全部完成 → 查看详情（进入 build app 步骤） */}
          {tmStatus === "all-done" && (
            <>
              <button type="button" onClick={onViewBuild} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
                <Rocket className="w-3 h-3" /> {t("tmViewBuildDetails")}
              </button>
              <button type="button" onClick={handleDownloadAll} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
                <Download className="w-3 h-3" /> {t("tmDownloadAll")}
              </button>
            </>
          )}
          {/* partial 状态：重试全部失败 */}
          {job?.status === "partial" && failed > 0 && tmStatus !== "all-done" && (
            <button type="button" onClick={handleRetryAll} className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-semibold cursor-pointer transition flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> {t("tmRetryAllFailed")}
            </button>
          )}
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

      {/* 状态提示 alert（替代原进度条） */}
      <div className={`shrink-0 border-b px-5 py-2 flex items-center gap-2.5 ${
        tmStatus === "running" ? "bg-cyan-500/[0.04] border-cyan-500/15" :
        tmStatus === "paused" ? "bg-amber-500/[0.04] border-amber-500/15" :
        tmStatus === "all-done" ? "bg-emerald-500/[0.04] border-emerald-500/15" :
        "bg-white/[0.02] border-white/5"
      }`}>
        <p className="text-[11px] text-slate-300 leading-snug flex-1 min-w-0 text-right">
          {tmStatus === "running" && (language === "en"
            ? <><span className="font-bold text-cyan-300 animate-pulse">Automation running</span> — generating all interactive HTML takes ~30 min. Feel free to minimize and come back to review when done.</>
            : <><span className="font-bold text-cyan-300 animate-pulse">自动模式执行中</span>——生成全部互动 HTML 约需 30 分钟。你可以最小化看板去做别的事，完成后回来验收即可。</>)}
          {tmStatus === "paused" && (language === "en"
            ? <><span className="font-bold text-amber-300">Paused</span> — Click Resume to continue, or Cancel to stop the task.</>
            : <><span className="font-bold text-amber-300">已暂停</span>——点击「恢复」继续执行，或「取消」结束任务。</>)}
          {tmStatus === "all-done" && (language === "en"
            ? <><span className="font-bold text-emerald-300">All tasks completed</span> — Click View Details to review each interactive HTML.</>
            : <><span className="font-bold text-emerald-300">全部任务已完成</span>——点击「查看详情」开始验收每个互动 HTML。</>)}
          {tmStatus === "not-started" && (projectInfo?.executionMode === "auto"
            ? (language === "en"
                ? <><span className="font-bold text-slate-200">Auto mode</span> — will generate all interactive HTML in ~30 min. Click Start Automation to begin — you can minimize and come back later.</>
                : <><span className="font-bold text-slate-200">自动模式</span>——可一键生成全部互动 HTML，约 30 分钟。点击「启用自动模式」启动，期间可最小化去做别的事，完成后再回来验收。</>)
            : (language === "en"
                ? <><span className="font-bold text-slate-200">Manual mode</span> — You can minimize this board and continue in the manual editor, or start automation here and come back when it's done.</>
                : <><span className="font-bold text-slate-200">手工模式</span>——你可以最小化当前看板返回操作界面继续手工操作，或直接在这里开启自动化流程，等执行完成后再来验收。</>))}
        </p>
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          tmStatus === "running" ? "bg-cyan-400 animate-pulse" :
          tmStatus === "paused" ? "bg-amber-400" :
          tmStatus === "all-done" ? "bg-emerald-400" :
          "bg-slate-500"
        }`} />
      </div>

      {/* ============ 三栏布局（始终显示，不管有无 job） ============ */}
      <div className="flex-1 flex min-h-0">
          {/* 左栏：流程时间线（竖向 stepper，节点+连接线占满高度） */}
          <div className="w-48 shrink-0 border-r border-white/5 bg-[#07070a]/50 overflow-y-auto p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{t("tmPipeline")}</div>
            <div className="flex flex-col h-[calc(100%-1.5rem)]">
              {PIPELINE_STAGES.map((stage, idx) => {
                const status = getStageStatus(stage.key);
                const isLast = idx === PIPELINE_STAGES.length - 1;
                const active = activeStage === stage.key;

                // 进行中节点的任务计数
                let runningCount = "";
                if (status === "running") {
                  if (stage.key === "directory") {
                    runningCount = directoryItems.length > 0 ? `✓ ${directoryItems.length}` : "";
                  } else if (stage.key === "slice") {
                    runningCount = modules.length > 0 ? `✓ ${modules.length}` : "";
                  } else if (stage.key === "extract") {
                    runningCount = `${extractCount}/${modules.length}`;
                  } else if (stage.key === "script") {
                    runningCount = `${scriptCount}/${modules.length}`;
                  } else if (stage.key === "build") {
                    runningCount = `${buildCount}/${modules.length}`;
                  }
                }

                // 节点状态颜色
                const dotColor = status === "completed"
                  ? "bg-emerald-400 border-emerald-400"
                  : status === "running"
                  ? "bg-cyan-400 border-cyan-400 animate-pulse"
                  : status === "failed"
                  ? "bg-red-400 border-red-400"
                  : "bg-[#07070a] border-slate-600";
                // 连接线颜色（线在节点下方，颜色取该节点状态：completed/running 染色，其他灰）
                const lineColor = status === "completed"
                  ? "bg-emerald-400/40"
                  : status === "running"
                  ? "bg-gradient-to-b from-cyan-400/40 to-slate-700/40"
                  : "bg-slate-700/40";

                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => { setActiveStage(stage.key); setSelectedModuleId(null); }}
                    className={`flex-1 flex items-stretch gap-2.5 px-1.5 rounded-lg text-left transition cursor-pointer min-h-0 ${
                      status === "running"
                        ? "tm-stage-running"
                        : active ? "bg-cyan-500/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* 节点 + 连接线列 */}
                    <div className="flex flex-col items-center pt-1.5 w-3 shrink-0">
                      <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${dotColor}`} />
                      {!isLast && (
                        <div className={`w-0.5 flex-1 mt-1 rounded-full ${lineColor}`} />
                      )}
                    </div>
                    {/* 标签 + 状态 */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className={`text-[11px] font-semibold truncate ${
                        active ? "text-cyan-200" :
                        status === "completed" ? "text-slate-200" :
                        status === "running" ? "text-cyan-100" :
                        status === "failed" ? "text-red-300" :
                        "text-slate-400"
                      }`}>{t(stage.labelKey)}</div>
                      <div className={`text-[9px] mt-0.5 font-mono ${
                        status === "completed" ? "text-emerald-400" :
                        status === "running" ? "text-cyan-300" :
                        status === "failed" ? "text-red-400" :
                        "text-slate-600"
                      }`}>
                        {status === "running" && runningCount
                          ? `${stageStatusText(status)} · ${runningCount}`
                          : stageStatusText(status)}
                      </div>
                    </div>
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
                      activeStage={activeStage}
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
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {directoryItems.map((item, idx) => {
                const isCh = item.type === "chapter";
                const isSec = item.type === "section";
                const pageLabel = item.startPage
                  ? `p.${item.startPage}${item.endPage ? `-${item.endPage}` : ""}`
                  : item.page || "";
                return (
                  <div
                    key={item.id || idx}
                    className={`flex items-center gap-2.5 rounded-lg transition ${
                      isCh
                        ? "bg-cyan-500/5 border border-cyan-500/20 p-2.5 pl-3"
                        : isSec
                        ? "bg-white/[0.02] border border-white/10 border-dashed p-2 pl-3 ml-6 relative"
                        : "bg-white/[0.01] border border-white/5 border-dashed p-2 pl-3 ml-12 relative"
                    }`}
                  >
                    {!isCh && (
                      <div className={`absolute -left-4 top-1/2 -translate-y-1/2 w-4 h-4 border-l-2 border-b-2 rounded-bl-lg pointer-events-none ${
                        isSec ? "border-white/10" : "border-white/5"
                      }`}></div>
                    )}
                    {isCh ? (
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : isSec ? (
                      <CornerDownRight className="w-3 h-3 text-slate-500 shrink-0" />
                    ) : (
                      <CornerDownRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                    )}
                    <span className={`truncate flex-1 ${
                      isCh ? "text-sm font-bold text-slate-100" : isSec ? "text-xs text-slate-300" : "text-xs text-slate-400"
                    }`}>{item.title}</span>
                    {pageLabel && (
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">{pageLabel}</span>
                    )}
                  </div>
                );
              })}
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
  activeStage: StageKey;
}

function SliceCard({ module, index, tasks, selected, onSelect, t, language, activeStage }: SliceCardProps) {
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

  // 当前阶段对应的 task.stage：只有当前阶段的 completed 才显示绿色完成标志，
  // 非当前阶段的 completed 用中性色（已就绪但不强调），避免 build 阶段 script 就绪变绿误导用户
  const currentTaskStage = activeStage === "extract" ? "extract" : activeStage === "script" ? "script" : activeStage === "build" ? "app-code" : null;

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
        <MiniStage label={miniLabels.extract} task={extractTask} isCurrent={currentTaskStage === "extract"} />
        <MiniStage label={miniLabels.script} task={scriptTask} isCurrent={currentTaskStage === "script"} />
        <MiniStage label={miniLabels.build} task={appTask} isCurrent={currentTaskStage === "app-code"} />
      </div>
    </button>
  );
}

function MiniStage({ label, task, isCurrent }: { label: string; task?: AutomationTask; isCurrent: boolean }) {
  const color = !task
    ? "bg-slate-700/30 text-slate-600"
    : task.status === "completed" || task.status === "skipped"
      ? isCurrent
        ? "bg-emerald-500/15 text-emerald-400"
        : "bg-slate-600/20 text-slate-400"
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
  // skipped 复用 completed 的样式，仅用 from history 小标签区分
  const isFromHistory = status === "skipped";
  const statusConfig = {
    completed: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: t("tmStatusCompleted"), Icon: CheckCircle2 },
    skipped: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: t("tmStatusCompleted"), Icon: CheckCircle2 },
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
            <div className="flex items-center gap-2 flex-wrap">
              <span>{t("tmFinishTime")}：{new Date(task.finishedAt).toLocaleString(language === "en" ? "en-US" : "zh-CN")}</span>
              {isFromHistory && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-500/15 text-slate-400 border border-slate-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {t("tmFromHistory")}
                </span>
              )}
            </div>
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
