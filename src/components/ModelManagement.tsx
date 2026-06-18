import { useState } from "react";
import { ArrowLeft, Plus, Save, Trash2, GitBranch, Star } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptVersion {
  id: string;
  promptTemplateId: string;
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  version: number;
  note: string | null;
  effectRating: string | null;
  createdAt: string;
}

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  apiKey: string | null;
  baseUrl: string | null;
  maxTokens: number;
  temperature: number;
  topP: number;
  promptTemplateId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const PROVIDERS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "dashscope", label: "DashScope (Qwen)" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "ollama", label: "Ollama" },
  { value: "huggingface", label: "Hugging Face" },
];

const getAvailableVars = (language: "zh" | "en") => [
  { var: "{{bookTitle}}", desc: language === "en" ? "Book title" : "教材名称" },
  { var: "{{chapterTitle}}", desc: language === "en" ? "Slice title" : "切片标题" },
  { var: "{{chapterIndex}}", desc: language === "en" ? "Slice index" : "切片索引" },
  { var: "{{summary}}", desc: language === "en" ? "Slice learning objective" : "切片学习目标" },
  { var: "{{scriptMarkdown}}", desc: language === "en" ? "Interactive script content" : "互动脚本内容" },
  { var: "{{extractedContent}}", desc: language === "en" ? "Textbook original text" : "教材原文" },
];

// ==================== 3 AI Entry Points ====================
type AIEntryKey = "smart-split" | "script-gen" | "app-code";

interface AIEntryDef {
  key: AIEntryKey;
  name: string;
  nameEn: string;
  desc: string;
  descEn: string;
  endpoint: string;
  icon: string;
  color: "cyan" | "purple" | "emerald";
  defaultPrompt: PromptTemplate;
}

const getAIEntryDefs = (): AIEntryDef[] => {
  const now = new Date().toISOString();
  return [
    {
      key: "smart-split",
      name: "智能切片",
      nameEn: "Smart Slicing",
      desc: "将教材PDF智能切分为教学单元",
      descEn: "Split textbook PDF into teaching units",
      endpoint: "/api/parse-book",
      icon: "📄",
      color: "cyan",
      defaultPrompt: {
        id: "prompt-smart-split",
        name: "Smart Slicing Prompt",
        systemPrompt: `你是一名"教材内容分析专家 + 教学设计架构师"。

你的任务是阅读教材内容，将其智能切分为多个教学切片。

切分原则：
1. 每个切片应围绕一个完整的学习主题或知识点集群
2. 切片大小适中，既不能太大（信息过载）也不能太小（缺乏上下文）
3. 考虑知识点的信息密度和连贯性
4. 为每个切片生成学习目标和内容摘要

输出要求：
- 输出结构化 JSON 格式
- 每个切片包含：章节索引、标题、学习目标摘要、信息密度评级、连贯性评级、设计理由、提取的原文内容`,
        userPromptTemplate: `Book: {{bookTitle}}
PDF Content: {{pdfContent}}`,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      key: "script-gen",
      name: "互动脚本生成",
      nameEn: "Interactive Script Generation",
      desc: "将教学切片转化为互动模拟器脚本",
      descEn: "Transform teaching slices into interactive simulator scripts",
      endpoint: "/api/generate-script",
      icon: "🎬",
      color: "purple",
      defaultPrompt: {
        id: "prompt-script-gen",
        name: "Simulation Blueprint (Interactive Script)",
        systemPrompt: `你是一名"教学模拟产品设计师 + 互动学习脚本架构师"。

你的任务不是生成 quiz、选择题、判断题、填空题、题库、剧情问答或换皮闯关。
你的任务是把一个教学切片转化为一份可交给 AI coding agent 实现的"可视化、沉浸式、问题驱动的互动模拟器生成脚本"。

核心原则：
1. 每个模拟必须围绕一个综合问题场景。学生进入具体情境，扮演具体角色，面对必须使用本切片知识才能解决的任务。
2. 互动必须是"应用知识干预场景"，不是"回忆知识回答问题"。学生应观察场景、调整变量、选择策略、安排步骤、诊断原因、分配资源、预测后果或优化方案。
3. 知识点必须变成场景机制。切片中的概念、关系、流程、判断标准必须映射为可观察对象、状态变量、用户操作、反馈规则、成功/失败条件。
4. 反馈必须体现因果。每次操作后的反馈要说明场景发生了什么变化、为什么会这样、对应教材中的哪个机制、下一步应如何调整。
5. 视觉设计要服务教学内容。不同学科应生成不同模拟形态，例如应急处置、课堂/角色实践、变量实验室、诊断决策、系统优化、流程搭建、情境推理、证据研判等。不要套用固定玩法模板。

输出要求：
- 使用中文。
- 输出结构化 Markdown，不要输出 JSON，不要输出代码。
- 这份 Markdown 将被 AI coding agent 直接用来生成网页应用，所以必须具体、可实现、可渲染、可编辑。
- 必须包含页面布局、主要组件、场景对象、状态变量、交互阶段、操作反馈、知识机制解释和完成条件。`,
        userPromptTemplate: `Book: {{bookTitle}}
Chapter: {{chapterIndex}} - {{chapterTitle}}
Summary: {{summary}}
Info Density: {{infoDensity}}
Cohesion: {{cohesion}}
Design Rationale: {{designRationale}}
Extracted Content: {{extractedContent}}`,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      key: "app-code",
      name: "场景游戏生成",
      nameEn: "Scene Game Generation",
      desc: "根据互动脚本生成HTML场景模拟游戏",
      descEn: "Generate HTML scene simulation games from interactive scripts",
      endpoint: "/api/generate-app-code",
      icon: "🎮",
      color: "emerald",
      defaultPrompt: {
        id: "prompt-app-code",
        name: "App Code Generation (HTML Scene Game)",
        systemPrompt: "你是一个顶级的全栈工程师，必须输出可直接运行的完整代码，注重UI美感和交互细节，如果代码被截断要主动重试。只需要输出代码，不需要解释文字。",
        userPromptTemplate: `根据以下要求，帮我实现一个web端的html。这是一个场景模拟游戏，让学生通过这个模拟游戏，将所学的知识进行应用，学以致用。我希望整体互动是沉浸式的，就是每个操作都有丰富的可视化的场景画面。并且我希望不要所有内容都是局限在一个页面上的，而是一个行为可能就是在一个页面上完成。完成这个行为可能就需要进入到新场景了。

以下是该章节的互动脚本内容，请根据脚本中的场景、角色、交互流程、反馈规则等来实现HTML场景模拟游戏：

{{scriptMarkdown}}`,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  ];
};

type TabKey = "models" | "prompts";

export default function ModelManagement({ onBack }: { onBack: () => void }) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>("prompts");

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0f]/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{language === "en" ? "Model & Prompt Management" : "模型与提示词管理"}</h1>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("prompts")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "prompts" ? "bg-purple-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {language === "en" ? "Prompt Management" : "提示词管理"}
          </button>
          <button
            onClick={() => setActiveTab("models")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "models" ? "bg-cyan-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {language === "en" ? "Model Management" : "模型管理"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "prompts" ? <PromptTab language={language} /> : <ModelTab language={language} />}
      </div>
    </div>
  );
}

// ==================== Prompt Tab (3 AI Entry Points) ====================
export function PromptTab({ language }: { language: "zh" | "en" }) {
  const aiEntries = getAIEntryDefs();
  const [selectedEntry, setSelectedEntry] = useState<AIEntryKey>("smart-split");

  const [prompts, setPrompts] = useState<Record<AIEntryKey, PromptTemplate[]>>(() => {
    const defs = getAIEntryDefs();
    return {
      "smart-split": [defs[0].defaultPrompt],
      "script-gen": [defs[1].defaultPrompt],
      "app-code": [defs[2].defaultPrompt],
    };
  });
  const [versions, setVersions] = useState<Record<string, PromptVersion[]>>({});
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Partial<PromptTemplate> | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [loading, setLoading] = useState(false);

  const currentPrompts = prompts[selectedEntry];
  const currentEntry = aiEntries.find(e => e.key === selectedEntry)!;

  const colorMap = {
    cyan: { bg: "from-cyan-500/20", border: "border-cyan-500/30", text: "text-cyan-400", hover: "hover:border-cyan-500/50", active: "bg-cyan-500/10 border-cyan-500/40" },
    purple: { bg: "from-purple-500/20", border: "border-purple-500/30", text: "text-purple-400", hover: "hover:border-purple-500/50", active: "bg-purple-500/10 border-purple-500/40" },
    emerald: { bg: "from-emerald-500/20", border: "border-emerald-500/30", text: "text-emerald-400", hover: "hover:border-emerald-500/50", active: "bg-emerald-500/10 border-emerald-500/40" },
  };

  const handleCreate = () => {
    setEditingPrompt({
      name: language === "en" ? "New Prompt" : "新提示词",
      systemPrompt: "",
      userPromptTemplate: "",
      isActive: false,
    });
    setSelectedPrompt(null);
  };

  const handleEdit = (p: PromptTemplate) => {
    setEditingPrompt({ ...p });
  };

  const handleSave = () => {
    if (!editingPrompt) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      if (editingPrompt.id) {
        setPrompts(prev => ({
          ...prev,
          [selectedEntry]: prev[selectedEntry].map(p => p.id === editingPrompt.id ? { ...p, ...editingPrompt, updatedAt: now } as PromptTemplate : p),
        }));
        if (selectedPrompt?.id === editingPrompt.id) {
          setSelectedPrompt(prev => prev ? { ...prev, ...editingPrompt, updatedAt: now } as PromptTemplate : null);
        }
      } else {
        const newPrompt: PromptTemplate = {
          id: `prompt-${selectedEntry}-${Date.now()}`,
          name: editingPrompt.name || (language === "en" ? "Untitled" : "未命名"),
          systemPrompt: editingPrompt.systemPrompt || null,
          userPromptTemplate: editingPrompt.userPromptTemplate || null,
          isActive: editingPrompt.isActive || false,
          createdAt: now,
          updatedAt: now,
        };
        setPrompts(prev => ({
          ...prev,
          [selectedEntry]: [...prev[selectedEntry], newPrompt],
        }));
        setSelectedPrompt(newPrompt);
      }
      setEditingPrompt(null);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to delete this prompt?" : "确定删除此提示词？")) return;
    setPrompts(prev => ({
      ...prev,
      [selectedEntry]: prev[selectedEntry].filter(p => p.id !== id),
    }));
    if (selectedPrompt?.id === id) setSelectedPrompt(null);
  };

  const handleSaveVersion = () => {
    if (!selectedPrompt) return;
    const currentVersions = versions[selectedPrompt.id] || [];
    const nextVersion = currentVersions.length > 0 ? Math.max(...currentVersions.map(v => v.version)) + 1 : 1;
    const now = new Date().toISOString();
    const newVersion: PromptVersion = {
      id: `ver-${Date.now()}`,
      promptTemplateId: selectedPrompt.id,
      systemPrompt: selectedPrompt.systemPrompt,
      userPromptTemplate: selectedPrompt.userPromptTemplate,
      version: nextVersion,
      note: null,
      effectRating: null,
      createdAt: now,
    };
    setVersions(prev => ({
      ...prev,
      [selectedPrompt.id]: [...(prev[selectedPrompt.id] || []), newVersion],
    }));
  };

  const handleUpdateNote = (versionId: string) => {
    if (!selectedPrompt) return;
    setVersions(prev => ({
      ...prev,
      [selectedPrompt.id]: (prev[selectedPrompt.id] || []).map(v =>
        v.id === versionId ? { ...v, note: noteValue } : v
      ),
    }));
    setEditingNote(null);
  };

  const handleDeleteVersion = (versionId: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to delete this version?" : "确定删除此版本？")) return;
    if (!selectedPrompt) return;
    setVersions(prev => ({
      ...prev,
      [selectedPrompt.id]: (prev[selectedPrompt.id] || []).filter(v => v.id !== versionId),
    }));
  };

  const handleRestoreVersion = (v: PromptVersion) => {
    if (!selectedPrompt) return;
    setSelectedPrompt({ ...selectedPrompt, systemPrompt: v.systemPrompt, userPromptTemplate: v.userPromptTemplate });
  };

  const insertVariable = (variable: string) => {
    if (!editingPrompt) return;
    const current = editingPrompt.userPromptTemplate || "";
    setEditingPrompt({ ...editingPrompt, userPromptTemplate: current + variable });
  };

  const templateVersions = selectedPrompt ? (versions[selectedPrompt.id] || []) : [];

  return (
    <div className="flex h-full">
      {/* Left: AI Entry selector + Prompt list */}
      <div className="w-80 border-r border-white/10 flex flex-col shrink-0">
        {/* AI Entry selector */}
        <div className="p-3 space-y-1.5 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">
            {language === "en" ? "AI Entry Point" : "AI 入口"}
          </div>
          {aiEntries.map(entry => {
            const c = colorMap[entry.color];
            const isActive = selectedEntry === entry.key;
            const activePrompt = prompts[entry.key].find(p => p.isActive);
            return (
              <button
                key={entry.key}
                onClick={() => { setSelectedEntry(entry.key); setSelectedPrompt(null); setEditingPrompt(null); setShowVersions(false); }}
                className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer ${
                  isActive ? c.active : `bg-white/5 border-white/10 ${c.hover}`
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{entry.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {language === "en" ? entry.nameEn : entry.name}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {language === "en" ? entry.descEn : entry.desc}
                    </div>
                  </div>
                  {activePrompt && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold shrink-0">
                      {language === "en" ? "Active" : "使用中"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Prompt list for selected entry */}
        <div className="p-3 border-b border-white/10">
          <button
            onClick={handleCreate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm font-semibold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {language === "en" ? "New Prompt" : "新建提示词"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {currentPrompts.map((p) => {
            const c = colorMap[currentEntry.color];
            return (
              <div
                key={p.id}
                onClick={() => { setSelectedPrompt(p); setEditingPrompt(null); setShowVersions(false); }}
                className={`p-3 rounded-lg border cursor-pointer transition ${
                  selectedPrompt?.id === p.id
                    ? c.active
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold truncate">{p.name}</span>
                  {p.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold shrink-0 ml-2">
                      {language === "en" ? "Active" : "使用中"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">
                  {p.systemPrompt?.slice(0, 40) || (language === "en" ? "No system prompt" : "无系统指令")}
                </div>
              </div>
            );
          })}
          {currentPrompts.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              {language === "en" ? "No prompts for this entry" : "此入口暂无提示词"}
            </div>
          )}
        </div>
      </div>

      {/* Right: Detail / Edit */}
      <div className="flex-1 overflow-y-auto p-6">
        {editingPrompt ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Save className="w-5 h-5 text-purple-400" />
              {editingPrompt.id ? (language === "en" ? "Edit Prompt" : "编辑提示词") : (language === "en" ? "New Prompt" : "新建提示词")}
              <span className={`text-xs px-2 py-0.5 rounded ${colorMap[currentEntry.color].bg} ${colorMap[currentEntry.color].text}`}>
                {currentEntry.icon} {language === "en" ? currentEntry.nameEn : currentEntry.name}
              </span>
            </h2>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Prompt Name" : "提示词名称"}</label>
              <input
                type="text"
                value={editingPrompt.name || ""}
                onChange={e => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "System Prompt" : "系统指令"}</label>
              <textarea
                value={editingPrompt.systemPrompt || ""}
                onChange={e => setEditingPrompt({ ...editingPrompt, systemPrompt: e.target.value })}
                rows={6}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500/50 resize-y"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                {language === "en" ? "User Prompt Template" : "用户指令模板"}
                <span className="ml-2 text-[10px] text-slate-500">{language === "en" ? "Variables: click to insert" : "支持变量：点击插入"}</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {getAvailableVars(language).map(v => (
                  <button
                    key={v.var}
                    onClick={() => insertVariable(v.var)}
                    className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition cursor-pointer"
                    title={v.desc}
                  >
                    {v.var}
                  </button>
                ))}
              </div>
              <textarea
                value={editingPrompt.userPromptTemplate || ""}
                onChange={e => setEditingPrompt({ ...editingPrompt, userPromptTemplate: e.target.value })}
                rows={10}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500/50 resize-y"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (language === "en" ? "Saving..." : "保存中...") : (language === "en" ? "Save" : "保存")}
              </button>
              <button
                onClick={() => setEditingPrompt(null)}
                className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
              >
                {language === "en" ? "Cancel" : "取消"}
              </button>
            </div>
          </div>
        ) : selectedPrompt ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{selectedPrompt.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded ${colorMap[currentEntry.color].bg} ${colorMap[currentEntry.color].text}`}>
                  {currentEntry.icon} {language === "en" ? currentEntry.nameEn : currentEntry.name}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(selectedPrompt)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
                >
                  {language === "en" ? "Edit" : "编辑"}
                </button>
                <button
                  onClick={handleSaveVersion}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 text-purple-300 text-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {language === "en" ? "Save Version" : "保存版本"}
                </button>
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className={`px-4 py-2 rounded-lg text-sm transition cursor-pointer flex items-center gap-1.5 ${
                    showVersions ? "bg-purple-500/20 border border-purple-500/30" : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {language === "en" ? "History" : "历史版本"} ({templateVersions.length})
                </button>
                <button
                  onClick={() => handleDelete(selectedPrompt.id)}
                  className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-sm transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Detail */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div>
                <span className="text-xs text-slate-400">{language === "en" ? "System Prompt" : "系统指令"}</span>
                <pre className="mt-1 text-sm font-mono text-slate-200 whitespace-pre-wrap bg-black/20 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {selectedPrompt.systemPrompt || (language === "en" ? "(Not set)" : "（未设置）")}
                </pre>
              </div>
              <div>
                <span className="text-xs text-slate-400">{language === "en" ? "User Prompt Template" : "用户指令模板"}</span>
                <pre className="mt-1 text-sm font-mono text-slate-200 whitespace-pre-wrap bg-black/20 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {selectedPrompt.userPromptTemplate || (language === "en" ? "(Not set)" : "（未设置）")}
                </pre>
              </div>
            </div>

            {/* Versions */}
            {showVersions && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">{language === "en" ? "History Versions" : "历史版本"}</h3>
                {templateVersions.map(v => (
                  <div key={v.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                          v{v.version}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreVersion(v)}
                          className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition cursor-pointer"
                        >
                          {language === "en" ? "Restore" : "恢复到当前"}
                        </button>
                        <button
                          onClick={() => { setEditingNote(v.id); setNoteValue(v.note || ""); }}
                          className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                        >
                          {v.note ? (language === "en" ? "Edit Note" : "编辑备注") : (language === "en" ? "Add Note" : "添加备注")}
                        </button>
                        <button
                          onClick={() => handleDeleteVersion(v.id)}
                          className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {v.effectRating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-amber-400">{v.effectRating}</span>
                      </div>
                    )}

                    {editingNote === v.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <select
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                            onChange={e => {
                              const rating = e.target.value;
                              if (!selectedPrompt) return;
                              setVersions(prev => ({
                                ...prev,
                                [selectedPrompt.id]: (prev[selectedPrompt.id] || []).map(ver =>
                                  ver.id === v.id ? { ...ver, effectRating: rating || null } : ver
                                ),
                              }));
                            }}
                            defaultValue={v.effectRating || ""}
                          >
                            <option value="">{language === "en" ? "Effect Rating" : "效果评级"}</option>
                            <option value="优秀">{language === "en" ? "Excellent" : "优秀"}</option>
                            <option value="良好">{language === "en" ? "Good" : "良好"}</option>
                            <option value="一般">{language === "en" ? "Average" : "一般"}</option>
                            <option value="较差">{language === "en" ? "Poor" : "较差"}</option>
                          </select>
                          <input
                            type="text"
                            value={noteValue}
                            onChange={e => setNoteValue(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                            placeholder={language === "en" ? "Note..." : "备注说明..."}
                          />
                          <button
                            onClick={() => handleUpdateNote(v.id)}
                            className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs cursor-pointer"
                          >
                            {language === "en" ? "Save" : "保存"}
                          </button>
                          <button
                            onClick={() => setEditingNote(null)}
                            className="px-2 py-1 rounded bg-white/5 text-slate-400 text-xs cursor-pointer"
                          >
                            {language === "en" ? "Cancel" : "取消"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      v.note && (
                        <div className="text-xs text-slate-400 bg-white/5 rounded p-2 border border-white/5">
                          {language === "en" ? "Note" : "备注"}：{v.note}
                        </div>
                      )
                    )}
                  </div>
                ))}
                {templateVersions.length === 0 && (
                  <div className="text-center text-slate-500 text-sm py-4">{language === "en" ? "No history versions" : "暂无历史版本"}</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-slate-500">
              <div className="text-4xl mb-3">{currentEntry.icon}</div>
              <p className="text-sm">{language === "en" ? "Select a prompt from the left, or create a new one" : "从左侧选择一个提示词，或新建提示词"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Model Tab ====================
function ModelTab({ language }: { language: "zh" | "en" }) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [editingModel, setEditingModel] = useState<Partial<ModelConfig> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    setEditingModel({
      name: language === "en" ? "New Model" : "新模型",
      provider: "deepseek",
      modelId: "",
      apiKey: null,
      baseUrl: null,
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
      promptTemplateId: null,
      isActive: false,
    });
  };

  const handleSave = () => {
    if (!editingModel) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      if (editingModel.id) {
        setModels(prev => prev.map(m => m.id === editingModel.id ? { ...m, ...editingModel, updatedAt: now } as ModelConfig : m));
      } else {
        const newModel: ModelConfig = {
          id: `model-${Date.now()}`,
          name: editingModel.name || (language === "en" ? "Untitled" : "未命名"),
          provider: editingModel.provider || "deepseek",
          modelId: editingModel.modelId || "",
          apiKey: editingModel.apiKey || null,
          baseUrl: editingModel.baseUrl || null,
          maxTokens: editingModel.maxTokens || 4096,
          temperature: editingModel.temperature ?? 0.7,
          topP: editingModel.topP ?? 0.9,
          promptTemplateId: editingModel.promptTemplateId || null,
          isActive: editingModel.isActive || false,
          createdAt: now,
          updatedAt: now,
        };
        setModels(prev => [...prev, newModel]);
      }
      setEditingModel(null);
    } catch (e) {
      console.error("Failed to save model:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to delete this model?" : "确定删除此模型？")) return;
    setModels(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="flex h-full">
      {/* Left: Model list */}
      <div className="w-80 border-r border-white/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10">
          <button
            onClick={handleCreate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white text-sm font-semibold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {language === "en" ? "New Model" : "新建模型"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {models.map((m) => (
            <div
              key={m.id}
              onClick={() => setEditingModel({ ...m })}
              className={`p-3 rounded-lg border cursor-pointer transition ${
                editingModel?.id === m.id
                  ? "bg-cyan-500/10 border-cyan-500/30"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{m.name}</span>
                {m.isActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold shrink-0 ml-2">
                    {language === "en" ? "Active" : "使用中"}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {PROVIDERS.find(p => p.value === m.provider)?.label || m.provider} / {m.modelId}
              </div>
            </div>
          ))}
          {models.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">{language === "en" ? "No models configured" : "暂无模型配置"}</div>
          )}
        </div>
      </div>

      {/* Right: Edit */}
      <div className="flex-1 overflow-y-auto p-6">
        {editingModel ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Save className="w-5 h-5 text-cyan-400" />
              {editingModel.id ? (language === "en" ? "Edit Model" : "编辑模型") : (language === "en" ? "New Model" : "新建模型")}
            </h2>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Model Name" : "模型名称"}</label>
              <input
                type="text"
                value={editingModel.name || ""}
                onChange={e => setEditingModel({ ...editingModel, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Provider" : "提供商"}</label>
              <select
                value={editingModel.provider || "deepseek"}
                onChange={e => setEditingModel({ ...editingModel, provider: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Model ID" : "模型 ID"}</label>
              <input
                type="text"
                value={editingModel.modelId || ""}
                onChange={e => setEditingModel({ ...editingModel, modelId: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "API Key" : "API 密钥"}</label>
              <input
                type="password"
                value={editingModel.apiKey || ""}
                onChange={e => setEditingModel({ ...editingModel, apiKey: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Base URL (optional)" : "Base URL（可选）"}</label>
              <input
                type="text"
                value={editingModel.baseUrl || ""}
                onChange={e => setEditingModel({ ...editingModel, baseUrl: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Max Tokens" : "最大 Token"}</label>
                <input
                  type="number"
                  value={editingModel.maxTokens || 4096}
                  onChange={e => setEditingModel({ ...editingModel, maxTokens: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={editingModel.temperature ?? 0.7}
                  onChange={e => setEditingModel({ ...editingModel, temperature: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Top P</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={editingModel.topP ?? 0.9}
                  onChange={e => setEditingModel({ ...editingModel, topP: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (language === "en" ? "Saving..." : "保存中...") : (language === "en" ? "Save" : "保存")}
              </button>
              <button
                onClick={() => {
                  if (editingModel.id) {
                    setEditingModel(null);
                  } else {
                    setEditingModel(null);
                  }
                }}
                className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
              >
                {language === "en" ? "Cancel" : "取消"}
              </button>
              {editingModel.id && (
                <button
                  onClick={() => handleDelete(editingModel.id!)}
                  className="px-6 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-sm transition cursor-pointer"
                >
                  {language === "en" ? "Delete" : "删除"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-slate-500">
              <p className="text-sm">{language === "en" ? "Select a model from the left, or create a new one" : "从左侧选择一个模型，或新建模型"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
