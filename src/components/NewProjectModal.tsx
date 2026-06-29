import { useState, useCallback, useRef } from "react";
import { FileText, X, RefreshCw, Check, Sparkles, Rocket, ClipboardCheck } from "lucide-react";
import { parseTextToDirectory } from "../utils/directoryParser";
import { calculateAutoPageOffset } from "../utils/textbookMatcher";
import { useLanguage, type TranslationKey } from "../i18n/LanguageContext";

export type NewProjectInitialMode = "managed" | "review";

export interface NewProjectResult {
  projectId: string;
  projectName: string;
  bookTitle: string;
  bookContentText: string;
  directoryItems: any[];
  pdfFileName: string;
  pdfData: string;
  pdfPagesText: string[];
  pdfPageOffset: number;
  /** 用户在弹窗选择的初始工作模式（仅作初始路径用，不写 DB） */
  initialMode: NewProjectInitialMode;
}

interface NewProjectModalProps {
  onClose: () => void;
  onCreated?: (result: NewProjectResult) => void;
  /** 编辑模式：传入则只允许修改项目名称 */
  editProject?: { id: string; name: string };
  /** 编辑模式保存成功回调 */
  onSaved?: (id: string, name: string) => void;
}

/**
 * 新建项目弹窗
 * 流程：上传 PDF → 自动提取名称 → 创建并开始
 * 编辑模式（传入 editProject）：仅修改项目名称
 */
export function NewProjectModal({ onClose, onCreated, editProject, onSaved }: NewProjectModalProps) {
  const { t } = useLanguage();
  // 支持参数插值的本地 helper
  const tf = useCallback((key: TranslationKey, params?: Record<string, string | number>) => {
    const s = t(key);
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  }, [t]);

  const isEdit = !!editProject;
  const [stage, setStage] = useState<"upload" | "configure">(isEdit ? "configure" : "upload");
  const [projectName, setProjectName] = useState(isEdit ? editProject!.name : "");
  const [initialMode, setInitialMode] = useState<NewProjectInitialMode>("managed");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfData, setPdfData] = useState("");
  const [bookContentText, setBookContentText] = useState("");
  const [directoryItems, setDirectoryItems] = useState<any[]>([]);
  const [pdfPagesText, setPdfPagesText] = useState<string[]>([]);
  const [pdfPageOffset, setPdfPageOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError(tf("npmInvalidPdf"));
      return;
    }

    setError("");
    setLoading(true);
    setPdfFileName(file.name);
    setProgress(tf("npmMounting"));

    try {
      const typedarray = await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(new Uint8Array(e.target?.result as ArrayBuffer));
        reader.onerror = () => reject(new Error(tf("npmReadFail")));
        reader.readAsArrayBuffer(file);
      });

      const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"];
      if (!pdfjsLib) {
        throw new Error(tf("npmScriptMissing"));
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

      const loadingTask = pdfjsLib.getDocument({ data: typedarray });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      const pageLimit = Math.min(totalPages, 150);

      setProgress(tf("npmParsing", { total: totalPages }));

      let extractedText = "";
      const pagesTextList: string[] = [];

      for (let i = 1; i <= pageLimit; i++) {
        setProgress(tf("npmExtracting", { i, total: pageLimit }));
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        pagesTextList.push(pageText);
        extractedText += pageText + "\n";
      }

      if (!extractedText.trim()) {
        throw new Error(tf("npmNoText"));
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
        reader.onerror = () => reject(new Error(tf("npmBase64Fail")));
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
  }, [tf]);

  const handleCreate = useCallback(async () => {
    if (!projectName.trim()) {
      setError(tf("npmNameRequired"));
      return;
    }
    // 编辑模式：仅更新项目名称
    if (isEdit && editProject) {
      setCreating(true);
      setError("");
      try {
        const res = await fetch(`/api/projects/${editProject.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: projectName.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || tf("npmSaveFail"));
        }
        onSaved?.(editProject.id, projectName.trim());
      } catch (err: any) {
        setError(err?.message || String(err));
        setCreating(false);
      }
      return;
    }
    if (!pdfData || !bookContentText) {
      setError(tf("npmPdfMissing"));
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
        throw new Error(err?.error || tf("npmCreateFail"));
      }
      const project = await response.json();

      onCreated({
        projectId: project.id,
        projectName: projectName.trim(),
        bookTitle: projectName.trim(),
        bookContentText,
        directoryItems,
        pdfFileName,
        pdfData,
        pdfPagesText,
        pdfPageOffset,
        initialMode,
      });
    } catch (err: any) {
      setError(err?.message || String(err));
      setCreating(false);
    }
  }, [projectName, pdfData, bookContentText, directoryItems, pdfFileName, pdfPagesText, pdfPageOffset, onCreated, isEdit, editProject, onSaved, tf, initialMode]);

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
              <h3 className="font-semibold text-white text-sm">{isEdit ? t("npmEditTitle") : t("npmNewTitle")}</h3>
              <p className="text-[10px] text-slate-500">
                {isEdit ? t("npmEditSubtitle") : stage === "upload" ? t("npmUploadSubtitle") : t("npmConfirmSubtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            aria-label={t("close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 上传区域（编辑模式隐藏） */}
          {!isEdit && (
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-2">
              {stage === "upload" ? t("npmStep1Upload") : t("npmStep1Uploaded")}
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
                  <p className="text-[11px] text-slate-500">{t("npmReplaceHint")}</p>
                </div>
              ) : loading ? (
                <div className="flex items-center gap-2 text-cyan-300">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-medium">{progress}</span>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-white">{t("npmDragHint")}</p>
                  <p className="text-xs text-slate-500 mt-1">{t("npmParseHint")}</p>
                </div>
              )}
            </div>
            {error && !isEdit && (
              <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1">
                <X className="w-3 h-3" /> {error}
              </p>
            )}
          </div>
          )}

          {/* 项目名称（仅在上传完成后显示） */}
          {stage === "configure" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2">{isEdit ? t("projectName") : t("npmStep2Name")}</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={t("npmNamePlaceholder")}
                  className="w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500 outline-none rounded-lg px-3.5 py-2 text-sm text-slate-100 transition"
                  disabled={creating}
                  autoFocus
                />
                {!isEdit && (
                <p className="text-[10px] text-slate-500 mt-1">
                  {tf("npmRecognizedChapters", { count: directoryItems.length })}
                </p>
                )}
                {error && isEdit && (
                  <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1">
                    <X className="w-3 h-3" /> {error}
                  </p>
                )}
              </div>

              {/* 工作模式选择（仅新建模式显示，作初始路径引导用，不写 DB） */}
              {!isEdit && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-2">{t("npmModeLabel")}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInitialMode("managed")}
                      disabled={creating}
                      className={`text-left p-3 rounded-xl border transition cursor-pointer ${
                        initialMode === "managed"
                          ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                          : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`p-1.5 rounded-lg border ${initialMode === "managed" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-white/5 text-slate-400 border-white/10"}`}>
                          <Rocket className="w-3.5 h-3.5" />
                        </div>
                        <span className={`text-xs font-bold ${initialMode === "managed" ? "text-cyan-300" : "text-slate-200"}`}>
                          {t("npmModeManaged")}
                        </span>
                        {initialMode === "managed" && <Check className="w-3 h-3 text-cyan-400 ml-auto" />}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{t("npmModeManagedDesc")}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInitialMode("review")}
                      disabled={creating}
                      className={`text-left p-3 rounded-xl border transition cursor-pointer ${
                        initialMode === "review"
                          ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                          : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`p-1.5 rounded-lg border ${initialMode === "review" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-white/5 text-slate-400 border-white/10"}`}>
                          <ClipboardCheck className="w-3.5 h-3.5" />
                        </div>
                        <span className={`text-xs font-bold ${initialMode === "review" ? "text-cyan-300" : "text-slate-200"}`}>
                          {t("npmModeReview")}
                        </span>
                        {initialMode === "review" && <Check className="w-3 h-3 text-cyan-400 ml-auto" />}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{t("npmModeReviewDesc")}</p>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-white/10 bg-black/30">
          <div className="text-[10px] text-slate-500">
            {isEdit
              ? t("npmEditOnlyName")
              : stage === "configure"
                ? (initialMode === "managed" ? t("npmModeManagedHint") : t("npmModeReviewHint"))
                : t("npmUploadHint")}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition cursor-pointer"
              disabled={creating}
            >
              {t("cancel")}
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
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {isEdit ? t("npmSaving") : t("npmCreating")}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> {isEdit ? t("npmSave") : t("npmCreateStart")}
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
