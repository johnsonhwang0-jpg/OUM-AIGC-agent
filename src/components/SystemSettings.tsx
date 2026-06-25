import { useState, useEffect } from "react";
import { ArrowLeft, Settings, Globe, FileText, Brain, History, GitCommit, Copy, Check } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { PromptTab } from "./ModelManagement";
import { APP_VERSION, VERSION_UPDATED_AT, VERSION_HISTORY } from "../version";

type SettingsTab = "models" | "prompts" | "language" | "version";

interface SystemSettingsProps {
  onBack: () => void;
}

export default function SystemSettings({ onBack }: SystemSettingsProps) {
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>("models");

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0f]/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            <h1 className="text-lg font-bold">{t("systemSettings")}</h1>
          </div>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("models")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "models" ? "bg-cyan-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            {t("modelManagement")}
          </button>
          <button
            onClick={() => setActiveTab("prompts")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "prompts" ? "bg-purple-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {t("promptManagement")}
          </button>
          <button
            onClick={() => setActiveTab("language")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "language" ? "bg-green-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            {t("languageSettings")}
          </button>
          <button
            onClick={() => setActiveTab("version")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "version" ? "bg-amber-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            {language === "en" ? "Version" : "版本说明"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "models" && <ModelsTab />}
        {activeTab === "prompts" && <PromptTab language={language} />}
        {activeTab === "language" && <LanguageTab />}
        {activeTab === "version" && <VersionTab />}
      </div>
    </div>
  );
}

// Models Tab
function ModelsTab() {
  const { t } = useLanguage();
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-cyan-400" />
          {t("modelConfig")}
        </h2>
        <p className="text-sm text-slate-400 mb-6">{t("modelConfigDesc")}</p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-slate-400">
          <p>{t("modelConfigDev")}</p>
          <p className="text-xs mt-2">{t("modelConfigEnv")}</p>
        </div>
      </div>
    </div>
  );
}

// Language Tab
function LanguageTab() {
  const { t, language, setLanguage } = useLanguage();

  const languages = [
    { value: "zh" as const, label: t("simplifiedChinese"), flag: "🇨🇳" },
    { value: "en" as const, label: t("english"), flag: "🇬🇧" },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-green-400" />
          {t("languageSetting")}
        </h2>
        <p className="text-sm text-slate-400 mb-6">{t("languageSettingDesc")}</p>
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {languages.map((lang, idx) => (
            <button
              key={lang.value}
              onClick={() => setLanguage(lang.value)}
              className={`w-full flex items-center justify-between px-5 py-4 transition cursor-pointer ${
                idx > 0 ? "border-t border-white/10" : ""
              } ${language === lang.value ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{lang.flag}</span>
                <span className="font-medium">{lang.label}</span>
              </div>
              {language === lang.value && (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4 text-center">{t("languageTip")}</p>
      </div>
    </div>
  );
}

// Version Tab
function VersionTab() {
  const { language } = useLanguage();
  // notesMap: version → note（用户编辑的额外备注，独立于 VERSION_HISTORY.changes）
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  // draftMap: 本地草稿，避免每次按键都触发保存
  const [draftMap, setDraftMap] = useState<Record<string, string>>({});
  const [savingVersion, setSavingVersion] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // 当前 git 仓库状态（HEAD hash + 是否有未提交更改 + 分支名）
  const [gitInfo, setGitInfo] = useState<{ headHash: string; dirty: boolean; branch: string } | null>(null);
  // 复制回滚命令的反馈：version → "copied" | null
  const [copiedVersion, setCopiedVersion] = useState<string | null>(null);

  // 加载用户已保存的备注 + 当前 git 状态
  useEffect(() => {
    fetch("/api/version-notes")
      .then((r) => r.json())
      .then((notes: Array<{ version: string; note: string }>) => {
        const map: Record<string, string> = {};
        for (const n of notes) map[n.version] = n.note;
        setNotesMap(map);
        setDraftMap(map);
      })
      .catch((err) => console.error("Failed to load version notes:", err));

    fetch("/api/git-info")
      .then((r) => r.json())
      .then((info) => setGitInfo(info))
      .catch((err) => console.error("Failed to load git info:", err));
  }, []);

  const handleBlurSave = async (version: string) => {
    const draft = draftMap[version] ?? "";
    const original = notesMap[version] ?? "";
    // 没有变化则不保存
    if (draft === original) return;
    setSavingVersion(version);
    setSaveError(null);
    try {
      const res = await fetch(`/api/version-notes/${encodeURIComponent(version)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: draft }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNotesMap((prev) => ({ ...prev, [version]: draft }));
    } catch (err: any) {
      setSaveError(err.message || String(err));
      // 回滚 draft
      setDraftMap((prev) => ({ ...prev, [version]: original }));
    } finally {
      setSavingVersion(null);
    }
  };

  // 复制回滚命令到剪贴板：git reset --hard <hash>
  const handleCopyRollback = async (version: string, hash: string) => {
    const cmd = `git reset --hard ${hash}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedVersion(version);
      setTimeout(() => setCopiedVersion(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          {language === "en" ? "Version History" : "版本说明"}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400 mb-2">
          <span>
            {language === "en" ? "Current version" : "当前版本"}{" "}
            <span className="text-amber-300 font-mono font-bold">v{APP_VERSION}</span>
            {" · "}
            <span className="text-slate-500">{VERSION_UPDATED_AT}</span>
          </span>
        </div>
        {/* 当前 git 状态 */}
        {gitInfo && (
          <div className="flex flex-wrap items-center gap-2 text-xs mb-4 px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10">
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">{language === "en" ? "Git HEAD" : "Git HEAD"}</span>
            {gitInfo.headHash ? (
              <span className="font-mono text-emerald-300">{gitInfo.headHash}</span>
            ) : (
              <span className="text-slate-500 italic">{language === "en" ? "n/a" : "不可用"}</span>
            )}
            {gitInfo.branch && (
              <span className="text-slate-500">({gitInfo.branch})</span>
            )}
            {gitInfo.dirty ? (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                {language === "en" ? "uncommitted changes" : "有未提交改动"}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {language === "en" ? "clean" : "已提交"}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500 mb-6">
          {language === "en"
            ? "Each version has an editable notes field for your additional remarks (saved automatically on blur). Click the commit hash to copy the rollback command. The change list is maintained in code."
            : "每个版本下方有可编辑的备注框（失焦自动保存）。点击 commit hash 可复制回滚命令。上方的变更列表由代码维护。"}
        </p>

        {saveError && (
          <div className="mb-4 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            {language === "en" ? "Save failed: " : "保存失败："}
            {saveError}
          </div>
        )}

        <div className="space-y-4">
          {VERSION_HISTORY.map((entry) => {
            const draft = draftMap[entry.version] ?? "";
            const isSaving = savingVersion === entry.version;
            const hasCommit = !!entry.gitCommit;
            const isCopied = copiedVersion === entry.version;
            const isCurrentGit = gitInfo?.headHash && entry.gitCommit === gitInfo.headHash;
            return (
              <div
                key={entry.version}
                className="bg-white/5 border border-white/10 rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 text-xs font-mono font-bold">
                      v{entry.version}
                    </span>
                    <span className="text-xs text-slate-500">{entry.updatedAt}</span>
                  </div>
                  {/* git commit hash + 回滚复制按钮 */}
                  {hasCommit ? (
                    <button
                      onClick={() => handleCopyRollback(entry.version, entry.gitCommit!)}
                      title={language === "en" ? "Copy rollback command" : "复制回滚命令"}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                        isCurrentGit
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "bg-slate-800/60 text-slate-300 border border-white/10 hover:bg-slate-700/60"
                      }`}
                    >
                      <GitCommit className="w-3 h-3" />
                      {entry.gitCommit}
                      {isCurrentGit && (
                        <span className="text-[10px] text-emerald-400 ml-1">
                          {language === "en" ? "HEAD" : "当前"}
                        </span>
                      )}
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-400 ml-1" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-50 ml-1" />
                      )}
                    </button>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-mono bg-slate-800/40 text-slate-500 border border-white/5">
                      {language === "en" ? "uncommitted" : "未提交"}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5 mb-3">
                  {entry.changes.map((change, idx) => (
                    <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400/60 mt-0.5">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>

                {/* 用户备注：可编辑、失焦自动保存 */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                    <History className="w-3 h-3" />
                    {language === "en" ? "My Notes" : "我的备注"}
                    {isSaving && (
                      <span className="text-slate-500 italic">
                        {language === "en" ? "saving…" : "保存中…"}
                      </span>
                    )}
                  </label>
                  <textarea
                    value={draft}
                    onChange={(e) =>
                      setDraftMap((prev) => ({ ...prev, [entry.version]: e.target.value }))
                    }
                    onBlur={() => handleBlurSave(entry.version)}
                    placeholder={
                      language === "en"
                        ? "Add your own remarks about this version…"
                        : "在此添加你对该版本的额外备注…"
                    }
                    rows={2}
                    className="w-full text-sm bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-y"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
