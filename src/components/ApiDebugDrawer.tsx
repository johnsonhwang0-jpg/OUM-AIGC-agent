import React, { useState, useEffect } from "react";
import { X, Settings, Info, RefreshCw, CheckCircle2, XCircle, Edit3, Save, FileText, Bot, Copy } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { ModelSelectorInline, type ModelSelection } from "./ModelSelector";

interface ApiDebugDrawerProps {
  show: boolean;
  onClose: () => void;
  aiEntry: "smart-split" | "script-gen" | "app-code" | "codex-build";
  title: string;
  iconColor?: string;
  /** 调用入口标识，用于模型选择记忆 */
  callSite: "slice" | "script" | "build";
  /** 当前 provider */
  provider: string;
  /** 当前 model */
  model: string;
  /** 模型选择变化回调 */
  onModelChange?: (value: ModelSelection) => void;
  defaultSystemPrompt: string;
  defaultUserPrompt: string;
  apiDebugInfo?: {
    status: "idle" | "calling" | "success" | "error";
    rawResponse: string;
    timestamp: string;
  };
  /** Codex 模式专用调试信息 */
  codexDebug?: {
    runId: string;
    runStatus: string;
    runElapsed: number;
    events: any[];
    artifacts: any[];
    artifactName: string;
    rawResponse: string;
  };
}

const ApiDebugDrawer: React.FC<ApiDebugDrawerProps> = ({
  show,
  onClose,
  aiEntry,
  title,
  iconColor = "text-purple-400",
  callSite,
  provider,
  model,
  onModelChange,
  defaultSystemPrompt,
  defaultUserPrompt,
  apiDebugInfo,
  codexDebug,
}) => {
  const isCodex = aiEntry === "codex-build";
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
            const p = data.find((t: any) => t.isActive) || data[0];
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

      const nameMap: Record<string, string> = {
        "smart-split": language === "en" ? "Smart Split Prompt" : "智能切片提示词",
        "script-gen": language === "en" ? "Script Generation Prompt" : "互动脚本生成提示词",
        "app-code": language === "en" ? "App Code Generation Prompt" : "场景游戏生成提示词",
        "codex-build": language === "en" ? "Codex Agent Build Prompt" : "Codex Agent 构建提示词",
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

  // Update last call info (API 模式)
  useEffect(() => {
    if (!isCodex && apiDebugInfo && (apiDebugInfo.status === "success" || apiDebugInfo.status === "error")) {
      setLastCall({
        time: apiDebugInfo.timestamp,
        status: apiDebugInfo.status === "success" ? "success" : "error",
      });
    }
  }, [apiDebugInfo?.status, apiDebugInfo?.timestamp, isCodex]);

  if (!show) return null;

  // Codex 模式状态
  const codexStatus = codexDebug?.runStatus || '';
  const isCodexRunning = codexStatus === 'queued' || codexStatus === 'running';
  const isCodexDone = codexStatus === 'completed';
  const isCodexFailed = codexStatus === 'failed' || codexStatus === 'stopped';

  // API 模式状态
  const isCalling = !isCodex && apiDebugInfo?.status === "calling";
  const statusText = isCodex
    ? (isCodexRunning
        ? `${codexStatus}${codexDebug && codexDebug.runElapsed > 0 ? ` · ${codexDebug.runElapsed}s` : ''}`
        : isCodexDone ? (language === "en" ? "Done" : "完成") : isCodexFailed ? (language === "en" ? "Error" : "错误") : (language === "en" ? "Not started" : "未启动"))
    : isCalling
      ? (language === "en" ? "AI Calling..." : "AI 调用中")
      : lastCall
        ? `${lastCall.time} ${lastCall.status === "success" ? (language === "en" ? "✓ Success" : "✓ 成功") : (language === "en" ? "✗ Failed" : "✗ 失败")}`
        : (language === "en" ? "Not called yet" : "尚未调用");

  const statusIcon = isCodex
    ? (isCodexRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isCodexDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : isCodexFailed ? <XCircle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />)
    : isCalling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
    : lastCall?.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5" />
    : lastCall?.status === "error" ? <XCircle className="w-3.5 h-3.5" />
    : <Info className="w-3.5 h-3.5" />;

  const statusColor = isCodex
    ? (isCodexRunning ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
       : isCodexDone ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
       : isCodexFailed ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
       : "bg-slate-500/10 text-slate-400 border-slate-500/20")
    : isCalling ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
    : lastCall?.status === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : lastCall?.status === "error" ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
    : "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[520px] bg-[#0a0a0f] border-l border-white/10 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            {isCodex ? <Bot className={`w-4 h-4 ${iconColor}`} /> : <Settings className={`w-4 h-4 ${iconColor}`} />}
            <h3 className="font-bold text-sm text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Model - 仅 API 模式显示 */}
          {!isCodex && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Calling Model" : "调用模型"}</label>
              <div className="bg-[#050508] border border-white/10 rounded-lg p-3">
                <ModelSelectorInline
                  callSite={callSite}
                  value={{ provider, model }}
                  onChange={onModelChange!}
                />
              </div>
            </div>
          )}

          {/* Codex Run ID - 仅 Codex 模式 */}
          {isCodex && codexDebug?.runId && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Run ID" : "Run ID"}</label>
              <div className="bg-[#050508] border border-white/10 rounded-lg p-3 flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-400/80 truncate flex-1">{codexDebug.runId}</span>
                <button
                  onClick={() => { try { navigator.clipboard.writeText(codexDebug.runId); } catch {} }}
                  className="text-slate-500 hover:text-slate-300 cursor-pointer shrink-0"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Status" : "状态"}</label>
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

          {/* Codex Agent 事件流 - 仅 Codex 模式 */}
          {isCodex && codexDebug && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Agent Events" : "Agent 事件流"}</label>
                <span className="text-[9px] text-slate-600">{codexDebug.events.length} {language === "en" ? "events" : "条"}</span>
              </div>
              {codexDebug.events.length > 0 ? (
                <div className="text-[10px] font-mono bg-black/30 border border-white/5 rounded-lg p-2 max-h-40 overflow-auto space-y-0.5">
                  {codexDebug.events.slice(-30).map((ev: any, i: number) => (
                    <div key={i} className="text-slate-400 leading-relaxed flex gap-1">
                      <span className="text-slate-600 shrink-0">{typeof ev.type === 'string' ? ev.type.slice(0, 12) : 'evt'}</span>
                      <span className="truncate">{typeof ev.message === 'string' ? ev.message.slice(0, 120) : typeof ev.text === 'string' ? ev.text.slice(0, 120) : JSON.stringify(ev).slice(0, 120)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-slate-600 italic py-2 text-center">{language === "en" ? "No events yet." : "暂无事件。"}</div>
              )}
            </div>
          )}

          {/* Codex 产物列表 - 仅 Codex 模式 */}
          {isCodex && codexDebug && codexDebug.artifacts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Artifacts" : "产物文件"}</label>
                <span className="text-[9px] text-slate-600">{codexDebug.artifacts.length} {language === "en" ? "files" : "个"}</span>
              </div>
              <div className="space-y-1">
                {codexDebug.artifacts.map((art: any, i: number) => (
                  <div key={i} className="text-[10px] font-mono bg-black/30 border border-white/5 rounded px-2 py-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-1 py-0.5 rounded shrink-0 ${art.name === codexDebug.artifactName ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>{art.name === codexDebug.artifactName ? 'used' : 'file'}</span>
                      <span className="truncate text-slate-400">{art.name}</span>
                    </div>
                    <span className="text-slate-600 shrink-0">{art.size ? `${(art.size / 1024).toFixed(1)}KB` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Codex 原始返回 */}
          {isCodex && codexDebug && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === "en" ? "Codex Raw Response" : "Codex 原始返回"}</label>
                {codexDebug.rawResponse && (
                  <button
                    onClick={() => { try { navigator.clipboard.writeText(codexDebug.rawResponse); } catch {} }}
                    className="text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Copy className="w-2.5 h-2.5" /> {language === "en" ? "Copy" : "复制"}
                  </button>
                )}
              </div>
              {codexDebug.rawResponse ? (
                <div className="bg-[#050508] border border-white/10 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <pre className="text-[10px] text-emerald-300 whitespace-pre-wrap leading-relaxed font-mono">{codexDebug.rawResponse.slice(0, 3000)}{codexDebug.rawResponse.length > 3000 ? `\n\n... (${codexDebug.rawResponse.length - 3000} ${language === "en" ? "more chars" : "字符剩余"})` : ''}</pre>
                </div>
              ) : (
                <div className="text-[10px] text-slate-600 italic py-2 text-center">{language === "en" ? "No response yet." : "暂无返回。"}</div>
              )}
              {codexDebug.artifactName && (
                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="px-1 py-0.5 rounded bg-emerald-500/15">artifact</span>
                  <span className="truncate">{codexDebug.artifactName}</span>
                  <span className="text-slate-500">{language === "en" ? "(HTML downloaded)" : "(已下载 HTML)"}</span>
                </div>
              )}
            </div>
          )}

          {/* API Raw Response - 仅 API 模式 */}
          {!isCodex && apiDebugInfo && apiDebugInfo.rawResponse && (
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
                {saving ? (language === "en" ? "Saving..." : "保存中...") : (language === "en" ? "Save as New Version" : "保存为新版本")}
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
