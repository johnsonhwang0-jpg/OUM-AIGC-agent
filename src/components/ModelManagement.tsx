import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Save, Trash2, Copy, GitBranch, Star } from "lucide-react";

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
  { value: "dashscope", label: "DashScope (通义千问)" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "ollama", label: "Ollama" },
  { value: "huggingface", label: "Hugging Face" },
];

const AVAILABLE_VARS = [
  { var: "{{bookTitle}}", desc: "教材名称" },
  { var: "{{chapterTitle}}", desc: "切片标题" },
  { var: "{{chapterIndex}}", desc: "切片索引" },
  { var: "{{summary}}", desc: "切片学习目标" },
  { var: "{{scriptMarkdown}}", desc: "互动脚本内容" },
  { var: "{{extractedContent}}", desc: "教材原文" },
];

type TabKey = "models" | "prompts";

export default function ModelManagement({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>("prompts");

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0f]/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">模型与提示词管理</h1>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("prompts")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "prompts" ? "bg-purple-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            提示词管理
          </button>
          <button
            onClick={() => setActiveTab("models")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "models" ? "bg-cyan-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            模型管理
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "prompts" ? <PromptTab /> : <ModelTab />}
      </div>
    </div>
  );
}

// ==================== Prompt Tab ====================
function PromptTab() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<PromptTemplate> | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      fetchVersions(selectedTemplate.id);
    }
  }, [selectedTemplate]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/prompt-templates");
      if (res.ok) setTemplates(await res.json());
    } catch (e) {
      console.error("Failed to fetch templates:", e);
    }
  };

  const fetchVersions = async (templateId: string) => {
    try {
      const res = await fetch(`/api/prompt-templates/${templateId}/versions`);
      if (res.ok) setVersions(await res.json());
    } catch (e) {
      console.error("Failed to fetch versions:", e);
    }
  };

  const handleCreate = async () => {
    setEditingTemplate({
      name: "新提示词模板",
      systemPrompt: "",
      userPromptTemplate: "",
      isActive: false,
    });
    setSelectedTemplate(null);
  };

  const handleEdit = (t: PromptTemplate) => {
    setEditingTemplate({ ...t });
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    setLoading(true);
    try {
      if (editingTemplate.id) {
        await fetch(`/api/prompt-templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingTemplate),
        });
      } else {
        const res = await fetch("/api/prompt-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingTemplate),
        });
        if (res.ok) {
          const created = await res.json();
          setSelectedTemplate(created);
        }
      }
      await fetchTemplates();
      setEditingTemplate(null);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此提示词模板？")) return;
    try {
      await fetch(`/api/prompt-templates/${id}`, { method: "DELETE" });
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
      await fetchTemplates();
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const handleSaveVersion = async () => {
    if (!selectedTemplate) return;
    const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
    setLoading(true);
    try {
      await fetch(`/api/prompt-templates/${selectedTemplate.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: selectedTemplate.systemPrompt,
          userPromptTemplate: selectedTemplate.userPromptTemplate,
          version: nextVersion,
        }),
      });
      await fetchVersions(selectedTemplate.id);
    } catch (e) {
      console.error("Failed to save version:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNote = async (versionId: string) => {
    setLoading(true);
    try {
      await fetch(`/api/prompt-versions/${versionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteValue }),
      });
      setEditingNote(null);
      if (selectedTemplate) await fetchVersions(selectedTemplate.id);
    } catch (e) {
      console.error("Failed to update note:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!confirm("确定删除此版本？")) return;
    try {
      await fetch(`/api/prompt-versions/${versionId}`, { method: "DELETE" });
      if (selectedTemplate) await fetchVersions(selectedTemplate.id);
    } catch (e) {
      console.error("Failed to delete version:", e);
    }
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
            新建提示词模板
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
                    使用中
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {t.systemPrompt?.slice(0, 40) || "无系统指令"}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">暂无提示词模板</div>
          )}
        </div>
      </div>

      {/* Right: Detail / Edit */}
      <div className="flex-1 overflow-y-auto p-6">
        {editingTemplate ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Save className="w-5 h-5 text-purple-400" />
              {editingTemplate.id ? "编辑提示词模板" : "新建提示词模板"}
            </h2>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">模板名称</label>
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
                <span className="text-sm">设为使用中</span>
              </label>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">系统指令</label>
              <textarea
                value={editingTemplate.systemPrompt || ""}
                onChange={e => setEditingTemplate({ ...editingTemplate, systemPrompt: e.target.value })}
                rows={6}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500/50 resize-y"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                用户指令模板
                <span className="ml-2 text-[10px] text-slate-500">支持变量：点击插入</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {AVAILABLE_VARS.map(v => (
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
                {loading ? "保存中..." : "保存"}
              </button>
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
              >
                取消
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
                  编辑
                </button>
                <button
                  onClick={handleSaveVersion}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 text-purple-300 text-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  保存版本
                </button>
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className={`px-4 py-2 rounded-lg text-sm transition cursor-pointer flex items-center gap-1.5 ${
                    showVersions ? "bg-purple-500/20 border border-purple-500/30" : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  历史版本 ({versions.length})
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
                <span className="text-xs text-slate-400">系统指令</span>
                <pre className="mt-1 text-sm font-mono text-slate-200 whitespace-pre-wrap bg-black/20 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {selectedTemplate.systemPrompt || "（未设置）"}
                </pre>
              </div>
              <div>
                <span className="text-xs text-slate-400">用户指令模板</span>
                <pre className="mt-1 text-sm font-mono text-slate-200 whitespace-pre-wrap bg-black/20 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {selectedTemplate.userPromptTemplate || "（未设置）"}
                </pre>
              </div>
            </div>

            {/* Versions */}
            {showVersions && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">历史版本</h3>
                {versions.map(v => (
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
                          恢复到当前
                        </button>
                        <button
                          onClick={() => { setEditingNote(v.id); setNoteValue(v.note || ""); }}
                          className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                        >
                          {v.note ? "编辑备注" : "添加备注"}
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
                              fetch(`/api/prompt-versions/${v.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ effectRating: rating || undefined }),
                              }).then(() => {
                                if (selectedTemplate) fetchVersions(selectedTemplate.id);
                              });
                            }}
                            defaultValue={v.effectRating || ""}
                          >
                            <option value="">效果评级</option>
                            <option value="优秀">优秀</option>
                            <option value="良好">良好</option>
                            <option value="一般">一般</option>
                            <option value="较差">较差</option>
                          </select>
                          <input
                            type="text"
                            value={noteValue}
                            onChange={e => setNoteValue(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                            placeholder="备注说明..."
                          />
                          <button
                            onClick={() => handleUpdateNote(v.id)}
                            className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs cursor-pointer"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingNote(null)}
                            className="px-2 py-1 rounded bg-white/5 text-slate-400 text-xs cursor-pointer"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      v.note && (
                        <div className="text-xs text-slate-400 bg-white/5 rounded p-2 border border-white/5">
                          备注：{v.note}
                        </div>
                      )
                    )}
                  </div>
                ))}
                {versions.length === 0 && (
                  <div className="text-center text-slate-500 text-sm py-4">暂无历史版本</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            选择或创建一个提示词模板
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Model Tab ====================
function ModelTab() {
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
      name: "新模型配置",
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
    if (!confirm("确定删除此模型配置？")) return;
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
            新建模型配置
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
                    使用中
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {PROVIDERS.find(p => p.value === c.provider)?.label || c.provider} · {c.modelId}
              </div>
            </div>
          ))}
          {configs.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">暂无模型配置</div>
          )}
        </div>
      </div>

      {/* Right: Detail / Edit */}
      <div className="flex-1 overflow-y-auto p-6">
        {editingConfig ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Save className="w-5 h-5 text-cyan-400" />
              {editingConfig.id ? "编辑模型配置" : "新建模型配置"}
            </h2>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">配置名称</label>
                  <input
                    type="text"
                    value={editingConfig.name || ""}
                    onChange={e => setEditingConfig({ ...editingConfig, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">模型提供商</label>
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
                  <label className="text-xs text-slate-400 mb-1 block">模型 ID</label>
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
                    <span className="text-sm">设为使用中</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">生成参数</h3>
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
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">引用提示词模板</h3>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">选择提示词模板（可选）</label>
                <select
                  value={editingConfig.promptTemplateId || ""}
                  onChange={e => setEditingConfig({ ...editingConfig, promptTemplateId: e.target.value || null })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="">不引用（使用自定义指令）</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.isActive ? " (使用中)" : ""}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  引用后，模型将使用所选提示词模板的系统指令和用户指令
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? "保存中..." : "保存"}
              </button>
              <button
                onClick={() => setEditingConfig(null)}
                className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
              >
                取消
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
                  编辑
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
                  <span className="text-slate-400 text-xs">提供商</span>
                  <p className="text-white mt-0.5">{PROVIDERS.find(p => p.value === selectedConfig.provider)?.label || selectedConfig.provider}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">模型 ID</span>
                  <p className="text-white mt-0.5 font-mono">{selectedConfig.modelId}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">状态</span>
                  <p className="mt-0.5">
                    {selectedConfig.isActive ? (
                      <span className="text-emerald-400 font-bold">使用中</span>
                    ) : (
                      <span className="text-slate-500">未启用</span>
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
                <span className="text-slate-400 text-xs">引用提示词模板</span>
                <p className="text-white mt-0.5">
                  {selectedTemplateName ? (
                    <span className="text-purple-400 font-semibold">{selectedTemplateName}</span>
                  ) : (
                    <span className="text-slate-500">未引用</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            选择或创建一个模型配置
          </div>
        )}
      </div>
    </div>
  );
}
