import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, RefreshCw, Check, Sparkles, Rocket, Settings as SettingsIcon } from "lucide-react";
import { parseTextToDirectory } from "../utils/directoryParser";
import { calculateAutoPageOffset } from "../utils/textbookMatcher";
import type { ExecutionMode } from "../types";

export interface NewProjectResult {
  projectId: string;
  projectName: string;
  mode: ExecutionMode;
  bookTitle: string;
  bookContentText: string;
  directoryItems: any[];
  pdfFileName: string;
  pdfData: string;
  pdfPagesText: string[];
  pdfPageOffset: number;
}

interface NewProjectModalProps {
  onClose: () => void;
  onCreated: (result: NewProjectResult) => void;
}

/**
 * 新建项目弹窗
 * 流程：上传 PDF → 自动提取名称 → 选模式 → 创建并开始
 */
export function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const [stage, setStage] = useState<"upload" | "configure">("upload");
  const [projectName, setProjectName] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfData, setPdfData] = useState("");
  const [bookContentText, setBookContentText] = useState("");
  const [directoryItems, setDirectoryItems] = useState<any[]>([]);
  const [pdfPagesText, setPdfPagesText] = useState<string[]>([]);
  const [pdfPageOffset, setPdfPageOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [mode, setMode] = useState<ExecutionMode>("auto");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("请上传有效的 PDF 格式文档");
      return;
    }

    setError("");
    setLoading(true);
    setPdfFileName(file.name);
    setProgress("正在挂载 PDF 解析器并提取文本数据...");

    try {
      const typedarray = await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(new Uint8Array(e.target?.result as ArrayBuffer));
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsArrayBuffer(file);
      });

      const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"];
      if (!pdfjsLib) {
        throw new Error("PDF.js 脚本未加载，请刷新页面后重试");
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

      const loadingTask = pdfjsLib.getDocument({ data: typedarray });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      const pageLimit = Math.min(totalPages, 150);

      setProgress(`正在解析 PDF (共 ${totalPages} 页)...`);

      let extractedText = "";
      const pagesTextList: string[] = [];

      for (let i = 1; i <= pageLimit; i++) {
        setProgress(`正在逐页提取文本 (${i} / ${pageLimit})...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        pagesTextList.push(pageText);
        extractedText += pageText + "\n";
      }

      if (!extractedText.trim()) {
        throw new Error("该 PDF 是扫描版或图片文档，未能提取到文本");
      }

      setPdfPagesText(pagesTextList);
      setBookContentText(extractedText);
      const parsedOutline = parseTextToDirectory(extractedText);
      setDirectoryItems(parsedOutline);
      const autoOffset = calculateAutoPageOffset(parsedOutline, pagesTextList);
      setPdfPageOffset(autoOffset);

      // 读取 base64
      const base64Pdf = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("PDF 转 base64 失败"));
        reader.readAsDataURL(file);
      });
      setPdfData(base64Pdf);

      // 自动填充项目名称（去掉扩展名）
      const name = file.name.replace(/\.[^/.]+$/, "");
      setProjectName(name);

      setStage("configure");
      setLoading(false);
      setProgress("");
    } catch (err: any) {
      console.error("PDF 解析失败:", err);
      setError(err?.message || String(err));
      setLoading(false);
      setProgress("");
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!projectName.trim()) {
      setError("请填写项目名称");
      return;
    }
    if (!pdfData || !bookContentText) {
      setError("PDF 数据缺失，请重新上传");
      return;
    }

    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          pdfFileName,
          pdfData,
          bookTitle: projectName.trim(),
          bookContentText,
          directoryItems: JSON.stringify(directoryItems),
          modules: "",
          aiMeta: "",
          rawBlueprintData: "",
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "项目创建失败");
      }
      const project = await response.json();

      // 同步设置 executionMode
      await fetch(`/api/projects/${project.id}/execution-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionMode: mode }),
      });

      onCreated({
        projectId: project.id,
        projectName: projectName.trim(),
        mode,
        bookTitle: projectName.trim(),
        bookContentText,
        directoryItems,
        pdfFileName,
        pdfData,
        pdfPagesText,
        pdfPageOffset,
      });
    } catch (err: any) {
      setError(err?.message || String(err));
      setCreating(false);
    }
  }, [projectName, pdfData, bookContentText, directoryItems, pdfFileName, pdfPagesText, pdfPageOffset, mode, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/30 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">新建项目</h3>
              <p className="text-[10px] text-slate-500">
                {stage === "upload" ? "上传 PDF 教材，选择后续流程模式" : "确认项目信息并选择模式"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 上传区域 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-2">
              {stage === "upload" ? "① 上传 PDF 教材" : "① 已上传 PDF"}
            </label>
            <div className="border border-dashed border-white/20 rounded-xl bg-white/5 p-6 flex flex-col items-center justify-center text-center relative hover:border-cyan-500 hover:bg-white/10 transition">
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                disabled={loading || creating}
              />
              <div className="p-3 bg-white/5 rounded-full text-slate-300 mb-3 border border-white/10">
                <FileText className="w-8 h-8" />
              </div>
              {pdfFileName && !loading ? (
                <div className="space-y-1">
                  <span className="text-sm font-medium text-emerald-400 flex items-center gap-1.5 justify-center">
                    <Check className="w-4 h-4" /> {pdfFileName}
                  </span>
                  <p className="text-[11px] text-slate-500">点击重新上传可替换</p>
                </div>
              ) : loading ? (
                <div className="flex items-center gap-2 text-cyan-300">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-medium">{progress}</span>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-white">将 PDF 拖拽至此，或点此浏览上传</p>
                  <p className="text-xs text-slate-500 mt-1">客户端自动提取文本与目录</p>
                </div>
              )}
            </div>
            {error && (
              <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1">
                <X className="w-3 h-3" /> {error}
              </p>
            )}
          </div>

          {/* 项目名称 + 模式选择（仅在上传完成后显示） */}
          {stage === "configure" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2">② 项目名称</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="输入项目名称"
                  className="w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500 outline-none rounded-lg px-3.5 py-2 text-sm text-slate-100 transition"
                  disabled={creating}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  已识别 {directoryItems.length} 个目录章节
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2">③ 选择后续流程模式</label>
                <div className="grid grid-cols-2 gap-3">
                  <ModeOption
                    selected={mode === "auto"}
                    onClick={() => setMode("auto")}
                    icon={<Rocket className="w-5 h-5" />}
                    title="自动模式"
                    subtitle="全书自动生成互动内容，基于结果可校验修改"
                    accent="cyan"
                    disabled={creating}
                  />
                  <ModeOption
                    selected={mode === "manual"}
                    onClick={() => setMode("manual")}
                    icon={<SettingsIcon className="w-5 h-5" />}
                    title="校验模式"
                    subtitle="先进行人工校验，通过校验后 AI 生成内容"
                    accent="amber"
                    disabled={creating}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-white/10 bg-black/30">
          <div className="text-[10px] text-slate-500">
            {stage === "configure" ? "自动模式将进入任务管理器页面" : "上传后可选择模式"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition cursor-pointer"
              disabled={creating}
            >
              取消
            </button>
            {stage === "configure" && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !projectName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-400/30 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> 创建中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> 创建并开始
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ModeOption ====================

interface ModeOptionProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: "cyan" | "amber";
  disabled?: boolean;
}

function ModeOption({ selected, onClick, icon, title, subtitle, accent, disabled }: ModeOptionProps) {
  const colors = {
    cyan: {
      border: selected ? "border-cyan-500/60" : "border-white/10",
      bg: selected ? "bg-cyan-500/10" : "bg-white/5",
      text: selected ? "text-cyan-300" : "text-slate-300",
      iconBg: selected ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-white/5 text-slate-400 border-white/10",
      glow: selected ? "shadow-[0_0_15px_rgba(6,182,212,0.2)]" : "",
    },
    amber: {
      border: selected ? "border-amber-500/60" : "border-white/10",
      bg: selected ? "bg-amber-500/10" : "bg-white/5",
      text: selected ? "text-amber-300" : "text-slate-300",
      iconBg: selected ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-white/5 text-slate-400 border-white/10",
      glow: selected ? "shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "",
    },
  }[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-3 rounded-xl border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colors.border} ${colors.bg} ${colors.glow} hover:border-white/30`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`p-1.5 rounded-lg border ${colors.iconBg}`}>{icon}</div>
        <span className={`text-sm font-bold ${colors.text}`}>{title}</span>
        {selected && (
          <div className={`ml-auto p-0.5 rounded-full ${accent === "cyan" ? "bg-cyan-500" : "bg-amber-500"}`}>
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">{subtitle}</p>
    </button>
  );
}
