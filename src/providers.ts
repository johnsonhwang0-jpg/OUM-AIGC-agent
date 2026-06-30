// 厂商定义：value 与后端 api_keys.provider 对应
// 被 AIManagement.tsx 和 ModelSelector.tsx 共用

export interface ProviderConfig {
  value: string;
  label: string;
  shortLabel: string;
  gradient: string;
  defaultBaseUrl: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { value: "deepseek", label: "DeepSeek",          shortLabel: "DS", gradient: "from-blue-500 to-cyan-400",   defaultBaseUrl: "https://api.deepseek.com" },
  { value: "qwen",     label: "Qwen (通义千问)",    shortLabel: "QW", gradient: "from-purple-500 to-pink-400",  defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { value: "minimax",  label: "MiniMax",           shortLabel: "MM", gradient: "from-orange-500 to-red-400",   defaultBaseUrl: "https://api.minimax.chat/v1" },
  { value: "gemini",   label: "Gemini",            shortLabel: "GM", gradient: "from-blue-500 to-indigo-400",  defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { value: "openai",   label: "OpenAI",            shortLabel: "AI", gradient: "from-emerald-500 to-teal-400", defaultBaseUrl: "https://api.openai.com/v1" },
  { value: "glm",      label: "GLM (智谱)",         shortLabel: "GL", gradient: "from-fuchsia-500 to-purple-400", defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4" },
];

export function getProvider(value: string): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.value === value);
}
