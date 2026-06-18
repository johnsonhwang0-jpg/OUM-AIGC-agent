import { useState } from "react";
import { ArrowLeft, Settings, Globe, FileText, Brain } from "lucide-react";

type SettingsTab = "models" | "prompts" | "language";

interface SystemSettingsProps {
  onBack: () => void;
}

export default function SystemSettings({ onBack }: SystemSettingsProps) {
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
            <h1 className="text-lg font-bold">系统设置</h1>
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
            模型管理
          </button>
          <button
            onClick={() => setActiveTab("prompts")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "prompts" ? "bg-purple-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            提示词管理
          </button>
          <button
            onClick={() => setActiveTab("language")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "language" ? "bg-green-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            语言设置
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "models" && <ModelsTab />}
        {activeTab === "prompts" && <PromptsTab />}
        {activeTab === "language" && <LanguageTab />}
      </div>
    </div>
  );
}

// Models Tab
function ModelsTab() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-cyan-400" />
          模型配置
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          管理 AI 模型的 API 密钥、基础 URL 和参数配置。当前核心功能（切片、脚本生成、App构建）使用环境变量中的配置。
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-slate-400">
          <p>模型管理功能开发中...</p>
          <p className="text-xs mt-2">当前使用 .env 中的 AI_PROVIDER 和 API 密钥</p>
        </div>
      </div>
    </div>
  );
}

// Prompts Tab
function PromptsTab() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          提示词模板
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          管理各阶段 AI 调用的提示词模板，包括课程切片、脚本生成、App 构建等。
        </p>
        <div className="space-y-4">
          <PromptCard
            title="课程切片提示词"
            description="用于将教材目录解析为结构化切片数据"
            endpoint="/api/parse-book"
          />
          <PromptCard
            title="互动脚本生成提示词"
            description="根据切片内容生成互动教学脚本"
            endpoint="/api/generate-script"
          />
          <PromptCard
            title="App 构建提示词"
            description="将脚本转换为可运行的 HTML 游戏应用"
            endpoint="/api/generate-app-code"
          />
        </div>
      </div>
    </div>
  );
}

function PromptCard({ title, description, endpoint }: { title: string; description: string; endpoint: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-purple-500/30 transition">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-white">{title}</h3>
        <code className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-slate-400">{endpoint}</code>
      </div>
      <p className="text-sm text-slate-400 mb-3">{description}</p>
      <div className="flex gap-2">
        <button className="text-xs px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition cursor-pointer">
          编辑
        </button>
        <button className="text-xs px-3 py-1.5 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 hover:text-white transition cursor-pointer">
          查看历史版本
        </button>
      </div>
    </div>
  );
}

// Language Tab
function LanguageTab() {
  const [language, setLanguage] = useState("zh-CN");

  const languages = [
    { value: "zh-CN", label: "简体中文", flag: "🇨🇳" },
    { value: "zh-TW", label: "繁體中文", flag: "🇹🇼" },
    { value: "en", label: "English", flag: "🇬🇧" },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-green-400" />
          语言设置
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          选择界面显示语言。当前仅支持中文界面，其他语言开发中。
        </p>
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
        <p className="text-xs text-slate-500 mt-4 text-center">
          提示：AI 输出语言由提示词中的语言指令控制，不受此设置影响
        </p>
      </div>
    </div>
  );
}
