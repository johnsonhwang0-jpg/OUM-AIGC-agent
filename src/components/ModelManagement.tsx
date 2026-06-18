import { useState, useEffect } from "react";
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

// Default prompts pre-populated from current system usage
const getDefaultPrompts = (): PromptTemplate[] => {
  const now = new Date().toISOString();
  return [
    {
      id: "prompt-simulation-blueprint",
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
    {
      id: "prompt-app-code-gen",
      name: "App Code Generation (HTML Scene Game)",
      systemPrompt: "你是一个顶级的全栈工程师，必须输出可直接运行的完整代码，注重UI美感和交互细节，如果代码被截断要主动重试。只需要输出代码，不需要解释文字。",
      userPromptTemplate: `根据以下要求，帮我实现一个web端的html。这是一个场景模拟游戏，让学生通过这个模拟游戏，将所学的知识进行应用，学以致用。我希望整体互动是沉浸式的，就是每个操作都有丰富的可视化的场景画面。并且我希望不要所有内容都是局限在一个页面上的，而是一个行为可能就是在一个页面上完成。完成这个行为可能就需要进入到新场景了。

以下是该章节的互动脚本内容，请根据脚本中的场景、角色、交互流程、反馈规则等来实现HTML场景模拟游戏：

{{scriptMarkdown}}`,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

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

// ==================== Prompt Tab ====================
function PromptTab({ language }: { language: "zh" | "en" }) {
  const [templates, setTemplates] = useState<PromptTemplate[]>(() => getDefaultPrompts());
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<PromptTemplate> | null>(null);
  const [versions, setVersions] = useState<Record<string, PromptVersion[]>>({});
  const [showVersions, setShowVersions] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [loading, setLoading] = useState(false);

  const templateVersions = selectedTemplate ? (versions[selectedTemplate.id] || []) : [];

  const handleCreate = () => {
    setEditingTemplate({
      name: language === "en" ? "New Prompt Template" : "新提示词模板",
      systemPrompt: "",
      userPromptTemplate: "",
      isActive: false,
    });
    setSelectedTemplate(null);
  };

  const handleEdit = (t: PromptTemplate) => {
    setEditingTemplate({ ...t });
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      if (editingTemplate.id) {
        // Update existing
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...editingTemplate, updatedAt: now } as PromptTemplate : t));
        if (selectedTemplate?.id === editingTemplate.id) {
          setSelectedTemplate(prev => prev ? { ...prev, ...editingTemplate, updatedAt: now } as PromptTemplate : null);
        }
      } else {
        // Create new
        const newTemplate: PromptTemplate = {
          id: `prompt-${Date.now()}`,
          name: editingTemplate.name || (language === "en" ? "Untitled" : "未命名"),
          systemPrompt: editingTemplate.systemPrompt || null,
          userPromptTemplate: editingTemplate.userPromptTemplate || null,
          isActive: editingTemplate.isActive || false,
          createdAt: now,
          updatedAt: now,
        };
        setTemplates(prev => [...prev, newTemplate]);
        setSelectedTemplate(newTemplate);
      }
      setEditingTemplate(null);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to delete this prompt template?" : "确定删除此提示词模板？")) return;
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  };

  const handleSaveVersion = () => {
    if (!selectedTemplate) return;
    const currentVersions = versions[selectedTemplate.id] || [];
    const nextVersion = currentVersions.length > 0 ? Math.max(...currentVersions.map(v => v.version)) + 1 : 1;
    const now = new Date().toISOString();
    const newVersion: PromptVersion = {
      id: `ver-${Date.now()}`,
      promptTemplateId: selectedTemplate.id,
      systemPrompt: selectedTemplate.systemPrompt,
      userPromptTemplate: selectedTemplate.userPromptTemplate,
      version: nextVersion,
      note: null,
      effectRating: null,
      createdAt: now,
    };
    setVersions(prev => ({
      ...prev,
      [selectedTemplate.id]: [...(prev[selectedTemplate.id] || []), newVersion],
    }));
  };

  const handleUpdateNote = (versionId: string) => {
    if (!selectedTemplate) return;
    setVersions(prev => ({
      ...prev,
      [selectedTemplate.id]: (prev[selectedTemplate.id] || []).map(v =>
        v.id === versionId ? { ...v, note: noteValue } : v
      ),
    }));
    setEditingNote(null);
  };

  const handleDeleteVersion = (versionId: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to delete this version?" : "确定删除此版本？")) return;
    if (!selectedTemplate) return;
    setVersions(prev => ({
      ...prev,
      [selectedTemplate.id]: (prev[selectedTemplate.id] || []).filter(v => v.id !== versionId),
    }));
  };

  const handleRestoreVersion = (v: PromptVersion) => {
    if (!selectedTemplate) return;
    setSelectedTemplate({ ...selectedTemplate, systemPrompt: v.systemPrompt, userPromptTemplate: v.userPromptTemplate });
  };

  const insertVariable = (variable: string) => {
    if (!editingTemplate) return;
    const current = editingTemplate.userPromptTemplate || "";
    setEditingTemplate({ ...editingTemplate, userPromptTemplate: current + variable });
  };

  return (
    <div className="flex h-full">
      {/* Left: Template list */}
      <div className="w-80 border-r border-white/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10">
          <button
            onClick={handleCreate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm font-semibold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {language === "en" ? "New Prompt Template" : "新建提示词模板"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => { setSelectedTemplate(t); setEditingTemplate(null); setShowVersions(false); }}
              className={`p-3 rounded-lg border cursor-pointer transition ${
                selectedTemplate?.id === t.id
                  ? "bg-purple-500/10 border-purple-500/30"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{t.name}</span>
                {t.isActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold shrink-0 ml-2">
                    {language === "en" ? "Active" : "使用中"}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {t.systemPrompt?.slice(0, 40) || (language === "en" ? "No system prompt" : "无系统指令")}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">{language === "en" ? "No prompt templates" : "暂无提示词模板"}</div>
          )}
        </div>
      </div>

      {/* Right: Detail / Edit */}
      <div className="flex-1 overflow-y-auto p-6">
        {editingTemplate ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Save className="w-5 h-5 text-purple-400" />
              {editingTemplate.id ? (language === "en" ? "Edit Prompt Template" : "编辑提示词模板") : (language === "en" ? "New Prompt Template" : "新建提示词模板")}
            </h2>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Template Name" : "模板名称"}</label>
              <input
                type="text"
                value={editingTemplate.name || ""}
                onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingTemplate.isActive || false}
                  onChange={e => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })}
                  className="w-4 h-4 accent-purple-500"
                />
                <span className="text-sm">{language === "en" ? "Set as active" : "设为使用中"}</span>
              </label>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "System Prompt" : "系统指令"}</label>
              <textarea
                value={editingTemplate.systemPrompt || ""}
                onChange={e => setEditingTemplate({ ...editingTemplate, systemPrompt: e.target.value })}
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
                value={editingTemplate.userPromptTemplate || ""}
                onChange={e => setEditingTemplate({ ...editingTemplate, userPromptTemplate: e.target.value })}
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
                onClick={() => setEditingTemplate(null)}
                className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
              >
                {language === "en" ? "Cancel" : "取消"}
              </button>
            </div>
          </div>
        ) : selectedTemplate ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{selectedTemplate.name}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(selectedTemplate)}
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
                  onClick={() => handleDelete(selectedTemplate.id)}
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
                  {selectedTemplate.systemPrompt || (language === "en" ? "(Not set)" : "（未设置）")}
                </pre>
              </div>
              <div>
                <span className="text-xs text-slate-400">{language === "en" ? "User Prompt Template" : "用户指令模板"}</span>
                <pre className="mt-1 text-sm font-mono text-slate-200 whitespace-pre-wrap bg-black/20 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {selectedTemplate.userPromptTemplate || (language === "en" ? "(Not set)" : "（未设置）")}
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
                              if (!selectedTemplate) return;
                              setVersions(prev => ({
                                ...prev,
                                [selectedTemplate.id]: (prev[selectedTemplate.id] || []).map(ver =>
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
          <div className="flex items-center justify-center h-full text-slate-500">
            {language === "en" ? "Select or create a prompt template" : "选择或创建一个提示词模板"}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Model Tab ====================
function ModelTab({ language }: { language: "zh" | "en" }) {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ModelConfig | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<ModelConfig> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConfigs();
    fetchTemplates();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch("/api/model-configs");
      if (res.ok) setConfigs(await res.json());
    } catch (e) {
      console.error("Failed to fetch configs:", e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/prompt-templates");
      if (res.ok) setTemplates(await res.json());
    } catch (e) {
      console.error("Failed to fetch templates:", e);
    }
  };

  const handleCreate = async () => {
    setEditingConfig({
      name: language === "en" ? "New Model Config" : "新模型配置",
      provider: "deepseek",
      modelId: "deepseek-v4-flash",
      apiKey: "",
      baseUrl: "",
      maxTokens: 16000,
      temperature: 0.7,
      topP: 0.9,
      promptTemplateId: null,
      isActive: false,
    });
    setSelectedConfig(null);
  };

  const handleEdit = (c: ModelConfig) => {
    setEditingConfig({ ...c });
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    setLoading(true);
    try {
      if (editingConfig.id) {
        await fetch(`/api/model-configs/${editingConfig.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingConfig),
        });
      } else {
        const res = await fetch("/api/model-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingConfig),
        });
        if (res.ok) {
          const created = await res.json();
          setSelectedConfig(created);
        }
      }
      await fetchConfigs();
      setEditingConfig(null);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to delete this model config?" : "确定删除此模型配置？")) return;
    try {
      await fetch(`/api/model-configs/${id}`, { method: "DELETE" });
      if (selectedConfig?.id === id) setSelectedConfig(null);
      await fetchConfigs();
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const selectedTemplateName = templates.find(t => t.id === selectedConfig?.promptTemplateId)?.name;

  return (
    <div className="flex h-full">
      {/* Left: Config list */}
      <div className="w-80 border-r border-white/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10">
          <button
            onClick={handleCreate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-sm font-semibold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {language === "en" ? "New Model Config" : "新建模型配置"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {configs.map((c) => (
            <div
              key={c.id}
              onClick={() => { setSelectedConfig(c); setEditingConfig(null); }}
              className={`p-3 rounded-lg border cursor-pointer transition ${
                selectedConfig?.id === c.id
                  ? "bg-cyan-500/10 border-cyan-500/30"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{c.name}</span>
                {c.isActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                    {language === "en" ? "Active" : "使用中"}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {PROVIDERS.find(p => p.value === c.provider)?.label || c.provider} · {c.modelId}
              </div>
            </div>
          ))}
          {configs.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">{language === "en" ? "No model configs" : "暂无模型配置"}</div>
          )}
        </div>
      </div>

      {/* Right: Detail / Edit */}
      <div className="flex-1 overflow-y-auto p-6">
        {editingConfig ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Save className="w-5 h-5 text-cyan-400" />
              {editingConfig.id ? (language === "en" ? "Edit Model Config" : "编辑模型配置") : (language === "en" ? "New Model Config" : "新建模型配置")}
            </h2>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{language === "en" ? "Basic Info" : "基本信息"}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Config Name" : "配置名称"}</label>
                  <input
                    type="text"
                    value={editingConfig.name || ""}
                    onChange={e => setEditingConfig({ ...editingConfig, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Model Provider" : "模型提供商"}</label>
                  <select
                    value={editingConfig.provider || "deepseek"}
                    onChange={e => setEditingConfig({ ...editingConfig, provider: e.target.value })}
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
                    value={editingConfig.modelId || ""}
                    onChange={e => setEditingConfig({ ...editingConfig, modelId: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">API Key</label>
                  <input
                    type="password"
                    value={editingConfig.apiKey || ""}
                    onChange={e => setEditingConfig({ ...editingConfig, apiKey: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Base URL</label>
                  <input
                    type="text"
                    value={editingConfig.baseUrl || ""}
                    onChange={e => setEditingConfig({ ...editingConfig, baseUrl: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingConfig.isActive || false}
                      onChange={e => setEditingConfig({ ...editingConfig, isActive: e.target.checked })}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <span className="text-sm">{language === "en" ? "Set as active" : "设为使用中"}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{language === "en" ? "Generation Params" : "生成参数"}</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Max Tokens</label>
                  <input
                    type="number"
                    value={editingConfig.maxTokens || 16000}
                    onChange={e => setEditingConfig({ ...editingConfig, maxTokens: parseInt(e.target.value) })}
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
                    value={editingConfig.temperature ?? 0.7}
                    onChange={e => setEditingConfig({ ...editingConfig, temperature: parseFloat(e.target.value) })}
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
                    value={editingConfig.topP ?? 0.9}
                    onChange={e => setEditingConfig({ ...editingConfig, topP: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{language === "en" ? "Linked Prompt Template" : "引用提示词模板"}</h3>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{language === "en" ? "Select Prompt Template (Optional)" : "选择提示词模板（可选）"}</label>
                <select
                  value={editingConfig.promptTemplateId || ""}
                  onChange={e => setEditingConfig({ ...editingConfig, promptTemplateId: e.target.value || null })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="">{language === "en" ? "None (Use custom prompts)" : "不引用（使用自定义指令）"}</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.isActive ? (language === "en" ? " (Active)" : " (使用中)") : ""}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {language === "en" ? "When linked, the model will use the selected prompt template's system and user prompts" : "引用后，模型将使用所选提示词模板的系统指令和用户指令"}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (language === "en" ? "Saving..." : "保存中...") : (language === "en" ? "Save" : "保存")}
              </button>
              <button
                onClick={() => setEditingConfig(null)}
                className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
              >
                {language === "en" ? "Cancel" : "取消"}
              </button>
            </div>
          </div>
        ) : selectedConfig ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{selectedConfig.name}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(selectedConfig)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
                >
                  {language === "en" ? "Edit" : "编辑"}
                </button>
                <button
                  onClick={() => handleDelete(selectedConfig.id)}
                  className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-sm transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-400 text-xs">{language === "en" ? "Provider" : "提供商"}</span>
                  <p className="text-white mt-0.5">{PROVIDERS.find(p => p.value === selectedConfig.provider)?.label || selectedConfig.provider}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">{language === "en" ? "Model ID" : "模型 ID"}</span>
                  <p className="text-white mt-0.5 font-mono">{selectedConfig.modelId}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">{language === "en" ? "Status" : "状态"}</span>
                  <p className="mt-0.5">
                    {selectedConfig.isActive ? (
                      <span className="text-emerald-400 font-bold">{language === "en" ? "Active" : "使用中"}</span>
                    ) : (
                      <span className="text-slate-500">{language === "en" ? "Not enabled" : "未启用"}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t border-white/5">
                <div>
                  <span className="text-slate-400 text-xs">Max Tokens</span>
                  <p className="text-white mt-0.5 font-mono">{selectedConfig.maxTokens}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">Temperature</span>
                  <p className="text-white mt-0.5 font-mono">{selectedConfig.temperature}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">Top P</span>
                  <p className="text-white mt-0.5 font-mono">{selectedConfig.topP}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className="text-slate-400 text-xs">{language === "en" ? "Linked Prompt Template" : "引用提示词模板"}</span>
                <p className="text-white mt-0.5">
                  {selectedTemplateName ? (
                    <span className="text-purple-400 font-semibold">{selectedTemplateName}</span>
                  ) : (
                    <span className="text-slate-500">{language === "en" ? "Not linked" : "未引用"}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            {language === "en" ? "Select or create a model config" : "选择或创建一个模型配置"}
          </div>
        )}
      </div>
    </div>
  );
}
