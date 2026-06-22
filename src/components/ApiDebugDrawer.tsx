import React, { useState, useEffect } from "react";
import { X, Settings, Info, RefreshCw, CheckCircle2, XCircle, Edit3, Save, FileText } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

interface ApiDebugDrawerProps {
  show: boolean;
  onClose: () => void;
  aiEntry: "smart-split" | "script-gen" | "app-code";
  title: string;
  iconColor?: string;
  model: string;
  defaultSystemPrompt: string;
  defaultUserPrompt: string;
  apiDebugInfo?: {
    status: "idle" | "calling" | "success" | "error";
    rawResponse: string;
    timestamp: string;
  };
}

const ApiDebugDrawer: React.FC<ApiDebugDrawerProps> = ({
  show,
  onClose,
  aiEntry,
  title,
  iconColor = "text-purple-400",
  model,
  defaultSystemPrompt,
  defaultUserPrompt,
  apiDebugInfo,
}) => {
  const { language } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editUserPrompt, setEditUserPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState<{ systemPrompt: string; userPrompt: string; note: string } | null>(null);
  const [lastCall, setLastCall] = useState<{ time: string; status: "success" | "error" } | null>(null);

  // Load saved prompt from DB when drawer opens
  useEffect(() => {
    if (show) {
      setEditing(false);
      fetch(`/api/prompt-templates?aiEntry=${aiEntry}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.length > 0) {
            const p = data[0];
            setSavedPrompt({ systemPrompt: p.systemPrompt || "", userPrompt: p.userPromptTemplate || "", note: p.note || "" });
          } else {
            setSavedPrompt(null);
          }
        })
        .catch(() => setSavedPrompt(null));
    }
  }, [show, aiEntry]);

  const effectiveSystemPrompt = savedPrompt?.systemPrompt || defaultSystemPrompt;
  const effectiveUserPrompt = savedPrompt?.userPrompt || defaultUserPrompt;

  const handleEdit = () => {
    setEditSystemPrompt(effectiveSystemPrompt);
    setEditUserPrompt(effectiveUserPrompt);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find existing prompts for this aiEntry
      const res = await fetch(`/api/prompt-templates?aiEntry=${aiEntry}`);
      const data = await res.json();
      
      const nameMap = {
        "smart-split": language === "en" ? "Smart Split Prompt" : "智能切片提示词",
        "script-gen": language === "en" ? "Script Generation Prompt" : "互动脚本生成提示词",
        "app-code": language === "en" ? "App Code Generation Prompt" : "场景游戏生成提示词",
      };
      
      // Deactivate all existing templates
      if (data && data.length > 0) {
        for (const template of data) {
          if (template.isActive) {
            await fetch(`/api/prompt-templates/${template.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: template.name,
                systemPrompt: template.systemPrompt,
                userPromptTemplate: template.userPromptTemplate,
                note: template.note,
                isActive: false,
              }),
            });
          }
        }
      }
      
      // Create a NEW active template (archive approach)
      const versionNum = data ? data.length + 1 : 1;
      const newName = `${nameMap[aiEntry]} v${versionNum}`;
      const createRes = await fetch("/api/prompt-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiEntry,
          name: newName,
          systemPrompt: editSystemPrompt,
          userPromptTemplate: editUserPrompt,
          isActive: true,
        }),
      });
      const newTemplate = await createRes.json();
      
      // Update state with the newly created template
      setSavedPrompt({ systemPrompt: editSystemPrompt, userPrompt: editUserPrompt, note: "" });
      setEditing(false);
    } catch (e) {
      console.error("Failed to save prompt:", e);
    }
    setSaving(false);
  };

  // Update last call info
  useEffect(() => {
    if (apiDebugInfo && (apiDebugInfo.status === "success" || apiDebugInfo.status === "error")) {
      setLastCall({
        time: apiDebugInfo.timestamp,
        status: apiDebugInfo.status === "success" ? "success" : "error",
      });
    }
  }, [apiDebugInfo?.status, apiDebugInfo?.timestamp]);

  if (!show) return null;

  const isCalling = apiDebugInfo?.status === "calling";
  const statusText = isCalling
    ? (language === "en" ? "AI Calling..." : "AI 调用中")
    : lastCall
      ? `${lastCall.time} ${lastCall.status === "success" ? (language === "en" ? "✓ Success" : "✓ 成功") : (language === "en" ? "✗ Failed" : "✗ 失败")}`
      : (language === "en" ? "Not called yet" : "尚未调用");

  const statusIcon = isCalling ? (
    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
  ) : lastCall?.status === "success" ? (
    <CheckCircle2 className="w-3.5 h-3.5" />
  ) : lastCall?.status === "error" ? (
    <XCircle className="w-3.5 h-3.5" />
  ) : (
    <Info className="w-3.5 h-3.5" />
  );

  const statusColor = isCalling
    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
    : lastCall?.status === "success"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : lastCall?.status === "error"
        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
        : "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[520px] bg-[#0a0a0f] border-l border-white/10 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className={`w-4 h-4 ${iconColor}`} />
            <h3 className="font-bold text-sm text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Model */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Calling Model" : "调用模型"}</label>
            <div className="bg-[#050508] border border-white/10 rounded-lg p-3 text-xs text-purple-400 font-mono font-bold">{model}</div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Call Status" : "调用状态"}</label>
            <div className={`rounded-lg p-3 text-xs font-bold flex items-center gap-2 ${statusColor} border`}>
              {statusIcon}
              {statusText}
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "System Prompt" : "系统指令"}</label>
            {editing ? (
              <textarea
                value={editSystemPrompt}
                onChange={e => setEditSystemPrompt(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-y"
              />
            ) : (
              <div className="bg-[#050508] border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-[10px] text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">{effectiveSystemPrompt}</pre>
              </div>
            )}
          </div>

          {/* User Prompt */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "User Prompt" : "用户指令"}</label>
            {editing ? (
              <textarea
                value={editUserPrompt}
                onChange={e => setEditUserPrompt(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-y"
              />
            ) : (
              <div className="bg-[#050508] border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-[10px] text-cyan-300 whitespace-pre-wrap leading-relaxed font-mono">{effectiveUserPrompt}</pre>
              </div>
            )}
          </div>

          {/* Note (read-only, from DB) */}
          {savedPrompt?.note && !editing && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Note" : "备注"}</label>
              <div className="bg-[#050508] border border-white/10 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 whitespace-pre-wrap">{savedPrompt.note}</p>
              </div>
            </div>
          )}

          {/* API Raw Response */}
          {apiDebugInfo && apiDebugInfo.rawResponse && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "API Raw Response" : "API 原始返回"}</label>
              <div className="bg-[#050508] border border-white/10 rounded-lg p-3 max-h-64 overflow-y-auto">
                <pre className="text-[10px] text-emerald-300 whitespace-pre-wrap leading-relaxed font-mono">{apiDebugInfo.rawResponse}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 shrink-0 flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-semibold hover:bg-white/10 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <X className="w-3.5 h-3.5" />
                {language === "en" ? "Cancel" : "取消"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-semibold hover:bg-purple-500/30 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? (language === "en" ? "Saving..." : "保存中...") : (language === "en" ? "Save" : "保存")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                className="flex-1 px-4 py-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {language === "en" ? "Edit Prompt" : "编辑指令"}
              </button>
              <button
                onClick={() => { onClose(); window.location.hash = "#settings"; }}
                className="px-4 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <FileText className="w-3.5 h-3.5" />
                {language === "en" ? "Prompt Mgmt" : "提示词管理"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ApiDebugDrawer;
