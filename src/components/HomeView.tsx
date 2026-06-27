import { useMemo, useState } from "react";
import {
  BookOpen, Scissors, FileText, FileCode, Rocket,
  Plus, Trash2, RefreshCw, Edit3,
} from "lucide-react";

export interface HomeAutomationStatus {
  status: string;
  jobId: string;
  completedSlices: number;
  failedSlices: number;
  totalSlices: number;
}

export interface HomeProject {
  id: string;
  name: string;
  bookTitle?: string;
  pdfFileName?: string;
  executionMode?: "auto" | "manual";
  createdAt?: string;
  updatedAt?: string;
  sliceCount: number;
  scriptCount: number;
  appCount: number;
  automationStatus?: HomeAutomationStatus | null;
}

interface HomeViewProps {
  projects: HomeProject[];
  language: "zh" | "en";
  loading?: boolean;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onEditProject: (projectId: string, projectName: string) => void;
  onBatchDelete: (projectIds: string[]) => Promise<void>;
  onNewProject: () => void;
  onRefresh: () => void;
}

const StepIcon = ({ icon: Icon }: { icon: typeof BookOpen }) => (
  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
    <Icon className="w-5 h-5" />
  </div>
);

const ProgressPill = ({ value, total, color }: { value: number; total: number; color: string }) => {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 min-w-[64px]">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-slate-300 tabular-nums w-9 text-right">
        {value}/{total}
      </span>
    </div>
  );
};

// 首页内容：使用说明 + 项目列表
// 作为右侧工作区内容渲染，不包含独立顶栏（左侧 AI 面板由 App.tsx 提供）
export function HomeView({
  projects, language, loading,
  onSelectProject, onDeleteProject, onEditProject, onBatchDelete, onNewProject, onRefresh,
}: HomeViewProps) {
  const isEn = language === "en";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const steps = useMemo(() => ([
    { icon: BookOpen,  label: isEn ? "Preview"  : "预览目录",   desc: isEn ? "TOC view"  : "目录预览" },
    { icon: Scissors,  label: isEn ? "Slice"     : "智能切片",   desc: isEn ? "AI split"  : "AI拆分" },
    { icon: FileText,  label: isEn ? "Extract"   : "提炼内容",   desc: isEn ? "Key points": "知识点" },
    { icon: FileCode,  label: isEn ? "Script"    : "互动脚本",   desc: isEn ? "Scenario" : "场景设计" },
    { icon: Rocket,    label: isEn ? "Build App" : "生成游戏",  desc: isEn ? "HTML game" : "HTML游戏" },
  ]), [isEn]);

  const allSelected = projects.length > 0 && selectedIds.size === projects.length;
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(projects.map(p => p.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleBatchDeleteClick = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await onBatchDelete(ids);
    setSelectedIds(new Set());
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full animate-fadeIn z-10 overflow-hidden">
      {/* 滚动区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 space-y-6">

          {/* 使用说明 - 5 Steps 卡片 */}
          <section className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base font-display text-white">
                {isEn ? "5 Steps: Textbook → Interactive Games" : "5 步：教材变互动游戏"}
              </h3>
            </div>
            <div className="flex items-center justify-between gap-1">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <StepIcon icon={step.icon} />
                    <span className="text-xs font-semibold text-white text-center">{step.label}</span>
                    <span className="text-[10px] text-slate-500 text-center">{step.desc}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex items-center text-cyan-500/30 shrink-0 px-1">
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 项目列表 */}
          <section className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-2xl shadow-lg backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  {isEn ? "My Projects" : "我的项目"}
                </h3>
                <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  {projects.length} {isEn ? "items" : "项"}
                </span>
                {selectedIds.size > 0 && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {isEn ? `Selected ${selectedIds.size}` : `已选 ${selectedIds.size} 项`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBatchDeleteClick}
                    className="text-[10px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/20 transition cursor-pointer flex items-center gap-1"
                    title={isEn ? "Batch Delete" : "批量删除"}
                  >
                    <Trash2 className="w-3 h-3" />
                    {isEn ? "Batch Delete" : "批量删除"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRefresh}
                  className="text-xs px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition cursor-pointer flex items-center gap-1"
                  title={isEn ? "Refresh" : "刷新"}
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={onNewProject}
                  className="text-xs px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)] hover:shadow-[0_0_16px_rgba(6,182,212,0.6)] transition-all flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  {isEn ? "New Project" : "新增项目"}
                </button>
              </div>
            </div>

            {/* 表头 */}
            <div className="grid grid-cols-[auto_3fr_repeat(3,minmax(0,1fr))_auto] gap-4 px-6 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-white/5 bg-white/[0.02] items-center">
              <div className="w-5">
                {projects.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition cursor-pointer ${
                      allSelected ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-white/20 hover:border-white/40'
                    }`}
                    title={allSelected ? (isEn ? "Deselect All" : "取消全选") : (isEn ? "Select All" : "全选")}
                  >
                    {allSelected && (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <div>{isEn ? "Project Name" : "项目名称"}</div>
              <div className="text-center">{isEn ? "Slices" : "切片"}</div>
              <div className="text-center">{isEn ? "Scripts" : "脚本"}</div>
              <div className="text-center">{isEn ? "Apps" : "应用"}</div>
              <div className="w-8 text-center">·</div>
            </div>

            {/* 列表 */}
            {projects.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen className="w-10 h-10 mx-auto text-slate-700 mb-3 stroke-1" />
                <p className="text-sm text-slate-400 font-medium">
                  {isEn ? "No projects yet" : "暂无项目"}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {isEn ? "Click \"New Project\" to start" : "点击右上角「新增项目」开始"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {projects.map(project => {
                  const sliceTotal = project.sliceCount || 0;
                  const checked = selectedIds.has(project.id);
                  return (
                    <div
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      className={`grid grid-cols-[auto_3fr_repeat(3,minmax(0,1fr))_auto] gap-4 px-6 py-3.5 items-center transition-all duration-200 cursor-pointer group ${
                        checked ? 'bg-cyan-500/10' : 'hover:bg-white/[0.04] active:scale-[0.995]'
                      }`}
                    >
                      {/* 多选 checkbox */}
                      <div className="w-5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOne(project.id);
                          }}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition cursor-pointer ${
                            checked ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-white/20 hover:border-white/40'
                          }`}
                        >
                          {checked && (
                            <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* 项目名称 */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate leading-tight">
                              {project.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-500 truncate font-mono">
                                {project.id}
                              </span>
                              {project.automationStatus && (project.automationStatus.status === "running" || project.automationStatus.status === "paused") && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                                  project.automationStatus.status === "running"
                                    ? "text-cyan-300 bg-cyan-500/15 border-cyan-500/30"
                                    : "text-amber-300 bg-amber-500/15 border-amber-500/30"
                                }`}>
                                  <span className="relative flex h-1.5 w-1.5">
                                    {project.automationStatus.status === "running" && (
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                                    )}
                                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${project.automationStatus.status === "running" ? "bg-cyan-400" : "bg-amber-400"}`} />
                                  </span>
                                  {project.automationStatus.status === "running" ? (isEn ? "Running" : "自动处理中") : (isEn ? "Paused" : "已暂停")}
                                  {project.automationStatus.totalSlices > 0 && (
                                    <span className="font-mono tabular-nums">
                                      {project.automationStatus.completedSlices + project.automationStatus.failedSlices}/{project.automationStatus.totalSlices}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 切片进度 */}
                      <div className="flex justify-center">
                        <ProgressPill
                          value={sliceTotal}
                          total={Math.max(sliceTotal, 1)}
                          color="bg-cyan-400"
                        />
                      </div>

                      {/* 脚本进度 */}
                      <div className="flex justify-center">
                        <ProgressPill
                          value={project.scriptCount || 0}
                          total={Math.max(sliceTotal, 1)}
                          color="bg-emerald-400"
                        />
                      </div>

                      {/* App 进度 */}
                      <div className="flex justify-center">
                        <ProgressPill
                          value={project.appCount || 0}
                          total={Math.max(sliceTotal, 1)}
                          color="bg-violet-400"
                        />
                      </div>

                      {/* 操作 */}
                      <div className="w-16 flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProject(project.id, project.name);
                          }}
                          className="p-1.5 text-slate-600 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title={isEn ? "Edit" : "编辑"}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject(project.id);
                          }}
                          className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title={isEn ? "Delete" : "删除"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
