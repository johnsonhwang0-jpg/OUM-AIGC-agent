import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Cpu, RefreshCw, AlertCircle, Check } from "lucide-react";
import { PROVIDERS, getProvider } from "../providers";
import { useLanguage } from "../i18n/LanguageContext";

export interface ModelSelection {
  provider: string;
  model: string;
}

interface ApiKeyInfo {
  id: string;
  provider: string;
  apiKey: string;
  baseUrl: string | null;
}

interface ModelSelectorProps {
  /** 调用入口标识，用于 localStorage 隔离 */
  callSite: "slice" | "script" | "build";
  /** 当前选中值 */
  value: ModelSelection;
  /** 选择变化回调 */
  onChange: (value: ModelSelection) => void;
  /** 紧凑模式（用于按钮旁的小图标） */
  compact?: boolean;
}

const STORAGE_PREFIX = "booktogame:model:";

/** 从 localStorage 读取上次选择 */
export function loadStoredSelection(callSite: string): ModelSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + callSite);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.provider === "string" && typeof parsed.model === "string") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/** 保存选择到 localStorage */
function saveSelection(callSite: string, selection: ModelSelection) {
  try {
    localStorage.setItem(STORAGE_PREFIX + callSite, JSON.stringify(selection));
  } catch {
    // ignore
  }
}

export function ModelSelector({ callSite, value, onChange, compact = false }: ModelSelectorProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [keysLoading, setKeysLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const modelsCacheRef = useRef<Record<string, string[]>>({});

  // 加载已配置的 API Keys
  const loadApiKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      if (Array.isArray(data)) {
        setApiKeys(data);
      }
    } catch (e) {
      console.warn("Failed to load API keys:", e);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  // 打开时加载 API keys
  useEffect(() => {
    if (open && apiKeys.length === 0 && !keysLoading) {
      loadApiKeys();
    }
  }, [open, apiKeys.length, keysLoading, loadApiKeys]);

  // 加载指定 provider 的可用模型
  const loadModels = useCallback(async (provider: string) => {
    // 先用缓存
    if (modelsCacheRef.current[provider]) {
      setModels(modelsCacheRef.current[provider]);
      return;
    }
    const key = apiKeys.find(k => k.provider === provider);
    if (!key) {
      setModels([]);
      setModelsError(language === "en" ? "No API key configured for this provider" : "该厂商未配置 API Key");
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch(`/api/api-keys/${key.id}/models`);
      const data = await res.json();
      if (!res.ok) {
        setModelsError(data.detail || data.error || "Failed to fetch models");
        setModels([]);
      } else {
        const list = data.models || [];
        modelsCacheRef.current[provider] = list;
        setModels(list);
      }
    } catch (e: any) {
      setModelsError(e.message || "Network error");
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [apiKeys, language]);

  // 切换 provider 时加载模型
  useEffect(() => {
    if (open && value.provider) {
      loadModels(value.provider);
    }
  }, [open, value.provider, loadModels]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const configuredProviders = PROVIDERS.filter(p => apiKeys.some(k => k.provider === p.value));

  const handleSelectProvider = (provider: string) => {
    // 切换 provider，model 暂时清空（等模型列表加载后用户再选）
    // 但如果缓存有模型，选第一个
    const cached = modelsCacheRef.current[provider];
    const newSelection: ModelSelection = { provider, model: cached?.[0] || "" };
    onChange(newSelection);
    saveSelection(callSite, newSelection);
    // 触发模型加载
    loadModels(provider);
  };

  const handleSelectModel = (model: string) => {
    const newSelection: ModelSelection = { ...value, model };
    onChange(newSelection);
    saveSelection(callSite, newSelection);
    setOpen(false);
  };

  const handleRefreshModels = () => {
    delete modelsCacheRef.current[value.provider];
    loadModels(value.provider);
  };

  const providerConfig = getProvider(value.provider);
  const currentLabel = value.model || (language === "en" ? "Not selected" : "未选择");

  if (compact) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1"
          title={language === "en" ? "Switch AI model" : "切换 AI 模型"}
        >
          <Cpu className="w-3 h-3" />
          <span className="max-w-[120px] truncate">{currentLabel}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <ModelSelectorDropdown
            language={language}
            keysLoading={keysLoading}
            configuredProviders={configuredProviders}
            apiKeys={apiKeys}
            value={value}
            models={models}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            onSelectProvider={handleSelectProvider}
            onSelectModel={handleSelectModel}
            onRefreshModels={handleRefreshModels}
            providerConfig={providerConfig}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs font-mono bg-white/5 border border-white/10 px-3 py-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-2"
      >
        {providerConfig && (
          <span className={`w-5 h-5 rounded bg-gradient-to-br ${providerConfig.gradient} flex items-center justify-center text-[8px] font-bold text-white`}>
            {providerConfig.shortLabel}
          </span>
        )}
        <span className="max-w-[160px] truncate">{currentLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ModelSelectorDropdown
          language={language}
          keysLoading={keysLoading}
          configuredProviders={configuredProviders}
          apiKeys={apiKeys}
          value={value}
          models={models}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          onSelectProvider={handleSelectProvider}
          onSelectModel={handleSelectModel}
          onRefreshModels={handleRefreshModels}
          providerConfig={providerConfig}
        />
      )}
    </div>
  );
}

// ─── 下拉面板 ───
interface DropdownProps {
  language: "zh" | "en";
  keysLoading: boolean;
  configuredProviders: typeof PROVIDERS;
  apiKeys: ApiKeyInfo[];
  value: ModelSelection;
  models: string[];
  modelsLoading: boolean;
  modelsError: string | null;
  onSelectProvider: (provider: string) => void;
  onSelectModel: (model: string) => void;
  onRefreshModels: () => void;
  providerConfig: ReturnType<typeof getProvider>;
}

function ModelSelectorDropdown({
  language,
  keysLoading,
  configuredProviders,
  value,
  models,
  modelsLoading,
  modelsError,
  onSelectProvider,
  onSelectModel,
  onRefreshModels,
  providerConfig,
}: DropdownProps) {
  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-[#0a0a12] border border-white/15 rounded-lg shadow-2xl shadow-black/50 overflow-hidden">
      {/* Provider 选择 */}
      <div className="p-3 border-b border-white/10">
        <div className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">
          {language === "en" ? "Provider" : "厂商"}
        </div>
        {keysLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {language === "en" ? "Loading..." : "加载中..."}
          </div>
        ) : configuredProviders.length === 0 ? (
          <div className="text-xs text-amber-400 py-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{language === "en" ? "No API keys configured. Go to Setting → AI Management to add one." : "尚未配置任何 API Key，请到 Setting → AI Management 添加。"}</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {configuredProviders.map(p => (
              <button
                key={p.value}
                onClick={() => onSelectProvider(p.value)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded border transition cursor-pointer ${
                  value.provider === p.value
                    ? "border-white/30 bg-white/10"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                }`}
              >
                <span className={`w-7 h-7 rounded bg-gradient-to-br ${p.gradient} flex items-center justify-center text-[9px] font-bold text-white`}>
                  {p.shortLabel}
                </span>
                <span className="text-[9px] font-mono text-slate-400 truncate max-w-full">{p.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model 选择 */}
      <div className="p-3 max-h-64 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            {language === "en" ? "Model" : "模型"}
          </div>
          {providerConfig && !modelsLoading && (
            <button
              onClick={onRefreshModels}
              className="text-slate-500 hover:text-white transition cursor-pointer"
              title={language === "en" ? "Refresh" : "刷新"}
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>

        {modelsLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {language === "en" ? "Fetching models..." : "获取模型列表..."}
          </div>
        ) : modelsError ? (
          <div className="text-xs text-red-400 py-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-all">{modelsError}</span>
          </div>
        ) : models.length === 0 ? (
          <div className="text-xs text-slate-600 py-2">
            {language === "en" ? "No models available" : "无可用模型"}
          </div>
        ) : (
          <div className="space-y-0.5">
            {models.map(m => (
              <button
                key={m}
                onClick={() => onSelectModel(m)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition cursor-pointer flex items-center justify-between gap-2 ${
                  value.model === m
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className="truncate">{m}</span>
                {value.model === m && <Check className="w-3 h-3 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 border-t border-white/10 bg-white/[0.02]">
        <div className="text-[9px] font-mono text-slate-600">
          {language === "en"
            ? "Selection saved automatically for next time."
            : "选择会自动记忆，下次默认使用。"}
        </div>
      </div>
    </div>
  );
}

// ─── 内联展开版（无下拉，直接渲染 provider 网格 + model 列表），用于 ApiDebugDrawer ───
interface ModelSelectorInlineProps {
  callSite: "slice" | "script" | "build";
  value: ModelSelection;
  onChange: (value: ModelSelection) => void;
}

export function ModelSelectorInline({ callSite, value, onChange }: ModelSelectorInlineProps) {
  const { language } = useLanguage();
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [keysLoading, setKeysLoading] = useState(false);
  const modelsCacheRef = useRef<Record<string, string[]>>({});

  const loadApiKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      if (Array.isArray(data)) setApiKeys(data);
    } catch (e) {
      console.warn("Failed to load API keys:", e);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  const loadModels = useCallback(async (provider: string) => {
    if (modelsCacheRef.current[provider]) {
      setModels(modelsCacheRef.current[provider]);
      return;
    }
    const key = apiKeys.find(k => k.provider === provider);
    if (!key) {
      setModels([]);
      setModelsError(language === "en" ? "No API key configured for this provider" : "该厂商未配置 API Key");
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch(`/api/api-keys/${key.id}/models`);
      const data = await res.json();
      if (!res.ok) {
        setModelsError(data.detail || data.error || "Failed to fetch models");
        setModels([]);
      } else {
        const list = data.models || [];
        modelsCacheRef.current[provider] = list;
        setModels(list);
      }
    } catch (e: any) {
      setModelsError(e.message || "Network error");
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [apiKeys, language]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  useEffect(() => {
    if (value.provider) loadModels(value.provider);
  }, [value.provider, loadModels]);

  const configuredProviders = PROVIDERS.filter(p => apiKeys.some(k => k.provider === p.value));

  const handleSelectProvider = (provider: string) => {
    const cached = modelsCacheRef.current[provider];
    const newSelection: ModelSelection = { provider, model: cached?.[0] || "" };
    onChange(newSelection);
    saveSelection(callSite, newSelection);
    loadModels(provider);
  };

  const handleSelectModel = (model: string) => {
    const newSelection: ModelSelection = { ...value, model };
    onChange(newSelection);
    saveSelection(callSite, newSelection);
  };

  const handleRefreshModels = () => {
    delete modelsCacheRef.current[value.provider];
    loadModels(value.provider);
  };

  const providerConfig = getProvider(value.provider);

  return (
    <div className="space-y-3">
      {/* Provider 网格 */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">
          {language === "en" ? "Provider" : "厂商"}
        </div>
        {keysLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {language === "en" ? "Loading..." : "加载中..."}
          </div>
        ) : configuredProviders.length === 0 ? (
          <div className="text-xs text-amber-400 py-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{language === "en" ? "No API keys configured. Go to Setting → AI Management to add one." : "尚未配置任何 API Key，请到 Setting → AI Management 添加。"}</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {configuredProviders.map(p => (
              <button
                key={p.value}
                onClick={() => handleSelectProvider(p.value)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded border transition cursor-pointer ${
                  value.provider === p.value
                    ? "border-purple-500/40 bg-purple-500/10"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                }`}
              >
                <span className={`w-7 h-7 rounded bg-gradient-to-br ${p.gradient} flex items-center justify-center text-[9px] font-bold text-white`}>
                  {p.shortLabel}
                </span>
                <span className="text-[9px] font-mono text-slate-400 truncate max-w-full">{p.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model 列表 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            {language === "en" ? "Model" : "模型"}
          </div>
          {providerConfig && !modelsLoading && (
            <button
              onClick={handleRefreshModels}
              className="text-slate-500 hover:text-white transition cursor-pointer"
              title={language === "en" ? "Refresh" : "刷新"}
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
        {modelsLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {language === "en" ? "Fetching models..." : "获取模型列表..."}
          </div>
        ) : modelsError ? (
          <div className="text-xs text-red-400 py-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-all">{modelsError}</span>
          </div>
        ) : models.length === 0 ? (
          <div className="text-xs text-slate-600 py-2">
            {language === "en" ? "No models available" : "无可用模型"}
          </div>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {models.map(m => (
              <button
                key={m}
                onClick={() => handleSelectModel(m)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition cursor-pointer flex items-center justify-between gap-2 ${
                  value.model === m
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className="truncate">{m}</span>
                {value.model === m && <Check className="w-3 h-3 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
