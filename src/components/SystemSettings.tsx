import { useState } from "react";
import { ArrowLeft, Settings, Globe, FileText, Brain } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { PromptTab } from "./ModelManagement";

type SettingsTab = "models" | "prompts" | "language";

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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "models" && <ModelsTab />}
        {activeTab === "prompts" && <PromptTab language={language} />}
        {activeTab === "language" && <LanguageTab />}
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
