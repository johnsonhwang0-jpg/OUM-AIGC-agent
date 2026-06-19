import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, X, Copy } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

interface PromptTemplate {
  id: string;
  aiEntry?: string;
  name: string;
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
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
}

const AI_ENTRIES: AIEntryDef[] = [
  {
    key: "smart-split",
    name: "智能切片",
    nameEn: "Smart Slicing",
    desc: "将教材PDF智能切分为教学单元",
    descEn: "Split textbook PDF into teaching units",
    endpoint: "/api/parse-book",
    icon: "📄",
    color: "cyan",
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
  },
];

const DEFAULT_PROMPTS: Record<AIEntryKey, { name: string; systemPrompt: string; userPromptTemplate: string }> = {
  "smart-split": {
    name: "智能切片提示词",
    systemPrompt: `你是一名为教师/课程设计者提供服务的教学切片专家。我将给你一本书的目录，请你帮我将其切分成多个教学切片，每个切片用于后续设计互动内容。
 
一、核心切片原则
信息负荷控制：每个切片包含 3-6 个核心概念（或 5-10 条具体策略/事实），对应 8-18 分钟的学习时长
知识内聚性：每个切片内的知识点必须能共同回答一个完整的子问题或完成一个闭环的子任务
章节覆盖格式：使用 a-b 格式表示连续章节（如 2.1-2.3），单个章节写成 a（如 5.2）
二、输出格式要求
请输出纯 JSON 格式，结构如下：
{
  "bookTitle": "从目录中提取的书名",
  "totalSlices": 22,
  "slices": [
    {
      "sliceId": "S1",
      "title": "切片主题名称（一句话，让学生知道这个切片在讲什么）",
      "coveredChapters": "1.1-1.2/1.1/1.1.1-1.1.5",
      "summary": {
        "learnedPoints": [
          "能说出/理解/区分XXX（具体可陈述的知识点）",
          "能描述XXX的X个阶段/类型",
          "能解释XXX与XXX的关系"
        ],
        "practicalProblems": [
          "当...时，你能...（具体场景化描述）",
          "当...时，你能..."
        ]
      },
      "infoDensity": {
        "conceptCount": 4,
        "factCount": 2,
        "abstractLevel": "低/中/高",
        "nestingLevel": "无/两层/三层",
        "suggestedMinutes": "8-12",
        "rationale": "用2-3句话说明：为什么这个负荷是合理的？"
      },
      "cohesionDetail": {
        "cohesionType": "因果链/时序递进/对比争鸣/问题-解决链/分类并列/工具性内聚/解释性递进",
        "mechanism": "用3-4句话说明知识点之间的具体连接方式（如：A导致B，B决定C；前3个概念共同支撑第4个；两个考点并列但共同服务于一个目的）",
        "coreQuestion": "用一句话概括：这个切片，几个知识点共同指向的同一个核心问题是什么？"
      },
      "designRationale": "结合本切片所有知识点，描述 2-3 个综合应用场景：当学习者在什么具体情境下，需要同时运用这些知识点来解决什么实际问题。要描述完整的问题场景，而非孤立地对应单个知识点。"
    }
  ]
}
三、字段详细填写规范
sliceId: S1, S2, S3… 按顺序编号
title: 一句话主题，建议用"动词+名词"或"核心问题"形式
coveredChapters: 使用 a-b 格式，如 2.1-2.3；单节写 3.5。极其重要：coveredChapters 中的章节编号必须严格来自上方目录中实际存在的章节！层级编号规则：目录采用多级编号，如果你想覆盖的是子章节，必须写完整编号如 "1.1.1-1.1.4"，不能写成 "1.1-1.4"。
summary.learnedPoints: 3-5条，每条以"能…"开头，可验证
summary.practicalProblems: 2-3条，格式为"当【具体场景】时，你能【具体行动】"
infoDensity.conceptCount: 纯理论概念的数量
infoDensity.factCount: 具体事实/策略/步骤的数量
infoDensity.abstractLevel: 低=可立即操作；中=需简单推理；高=需理论理解
infoDensity.nestingLevel: 无=并列；两层=概念下有子概念；三层=需多步推理
infoDensity.suggestedMinutes: 基于conceptCount×2~3分钟 + factCount×0.5~1分钟估算
infoDensity.rationale: 必须包含判断结论+依据，如超限则给出拆分建议
cohesionDetail.cohesionType: 从括号中选择最匹配的一项
cohesionDetail.mechanism: 明确写出"X连接Y""A支撑B""C和D共同指向E"
cohesionDetail.coreQuestion: 一个完整的问句，聚焦多个知识点的共同指向
designRationale: 描述2-3个综合应用场景，说明完整的问题场景
四、重要提醒
如果某一章/节的信息负荷过高（conceptCount > 7 或 abstractLevel=高 且 conceptCount > 5），请在 infoDensity.rationale 中明确建议"拆分为2个切片"
如果某一章/节的信息负荷过低（conceptCount < 2 且 factCount < 3），请合并到相邻切片
每个切片必须能让一个普通教师/学生在 20 分钟内完成理解（不含练习）
输出必须是有效的纯 JSON，不要包含注释或额外文字`,
    userPromptTemplate: `请为以下书籍进行教学切片，书籍名称："{{bookTitle}}"。

{{directoryText}}

请严格按照上述目录结构进行切片，只使用我提供的书名和目录信息，不要使用你训练数据中的任何其他课本内容。

⚠️ 关于 coveredChapters 字段的特别提醒：
1. 目录采用手风琴层级结构，例如 Topic 3 下面可能有 3.1、3.2、3.3...3.7，但可能没有 3.8 或 3.9。你在填写 coveredChapters 时，必须先确认目录中实际存在哪些章节编号，只能使用目录中真实存在的章节！
2. 注意多层级编号的区别：如果 3.1 下面有子章节 3.1.1、3.1.2...3.1.5，你想覆盖这些子章节时，coveredChapters 必须写成 "3.1.1-3.1.5"，绝对不能写成 "3.1-3.5"（这表示的是 3.1、3.2、3.3、3.4、3.5 五个同级章节）！
3. 填写前请先确认你要覆盖的章节在目录中的完整编号，然后把完整编号写进 coveredChapters。`,
  },
  "script-gen": {
    name: "互动脚本生成提示词",
    systemPrompt: `你是一名"教学模拟产品设计师 + 互动学习脚本架构师"。

你的任务不是生成 quiz、选择题、判断题、填空题、题库、剧情问答或换皮闯关。
你的任务是把一个教学切片转化为一份可交给 AI coding agent 实现的"沉浸式、问题驱动的互动模拟器生成脚本"。

这份脚本应该专注描述功能、交互和用户体验（UX），不要指定任何视觉样式（颜色、字体、布局、动画等）。视觉设计由后续的 AI coding agent 负责。

核心原则：
1. 每个模拟必须围绕一个综合问题场景。学生进入具体情境，扮演具体角色，面对必须使用本切片知识才能解决的任务。
2. 互动必须是"应用知识干预场景"，不是"回忆知识回答问题"。学生应观察场景、调整变量、选择策略、安排步骤、诊断原因、分配资源、预测后果或优化方案。
3. 知识点必须变成场景机制。切片中的概念、关系、流程、判断标准必须映射为可观察对象、状态变量、用户操作、反馈规则、成功/失败条件。
4. 反馈必须体现因果。每次操作后的反馈要说明场景发生了什么变化、为什么会这样、对应教材中的哪个机制、下一步应如何调整。
5. 不同学科应生成不同模拟形态，例如应急处置、课堂/角色实践、变量实验室、诊断决策、系统优化、流程搭建、情境推理、证据研判等。不要套用固定玩法模板。

输出要求：
- 使用中文。
- 输出结构化 Markdown，不要输出 JSON，不要输出代码。
- 这份 Markdown 将被 AI coding agent 直接用来生成网页应用，所以必须具体、可实现、可交互。
- 不要指定任何视觉样式（颜色、字体、布局、动画、图标等），只描述功能、交互逻辑和用户体验。
- 必须包含每个步骤的交互场景、用户操作、交互结果、关联知识点。

禁止：
- "请选择正确答案"
- A/B/C/D 答题卡
- 判断题/填空题/单纯问答
- 只有剧情，没有可操作对象或状态变化
- 只有讲解，没有模拟任务
- 每个阶段只是一个 quiz question
- 指定颜色、字体、布局、动画等视觉样式`,
    userPromptTemplate: `请基于以下教学切片，生成一份"可交给 AI coding 实现的沉浸式学习模拟器脚本"。

教材名称：
{{bookTitle}}

教学切片：
{{chapterIndex}} - {{chapterTitle}}

切片学习目标：
{{summary}}

信息密度与知识内聚分析：
{{infoDensity}}
{{cohesionDetail}}

教学设计理由：
{{designRationale}}

教材原文：
{{extractedContent}}

请输出以下5个部分的结构化 Markdown：

# 1. 教学切片理解
- **核心知识点**：列出本切片的关键概念、原理、流程或判断标准
- **综合实践情景**：这些知识点组织在一起，是用来理解、面对、解决什么样的综合性大问题/大情景的？描述一个贯穿整个模拟的大场景

# 2. 整体流程简要设计
- 描述整个模拟的逻辑流程和情景推进
- 每个环节如何把对应的知识点融入实践案例
- 环节之间的故事衔接如何保持情景的合理性、连贯性、流畅性

# 3. 模拟脚本互动流程设计
输出分步骤的详细流程，每个步骤包含：
- **步骤编号**：如"第一步"、"第二步"
- **交互场景描述**：在大情景中遇到了什么小流程节点？当前场景是什么？需要用户解决什么问题？
- **用户交互方式**：用户具体怎么操作？（如拖拽排序、调整滑块、选择策略、分配资源、诊断原因、预测后果等）
- **交互结果反馈**：每种操作会返回什么结果？场景如何变化？为什么这样变化？
- **关联知识点**：这个步骤对应教学切片中的哪些知识点？

# 4. 总结 Feedback 设计
- 基于用户在所有步骤中的整体互动过程，最后给出什么样的总结性反馈？
- 反馈应涵盖哪些维度？（如知识应用正确性、决策合理性、遗漏的关键点等）
- 如何根据用户的表现给出差异化的反馈？

# 5. 特殊要求说明
- 语言要求（如使用中文/英文）
- 不要出现课后反思填空等与模拟无关的内容
- 其他需要注意的事项

请确保它不是题库，而是一个学生可以通过观察、干预、验证、修正来完成的互动模拟器。`,
  },
  "app-code": {
    name: "场景游戏生成提示词",
    systemPrompt: `你是一个顶级的全栈工程师，必须输出可直接运行的完整代码，注重UI美感和交互细节，如果代码被截断要主动重试。只需要输出代码，不需要解释文字。`,
    userPromptTemplate: `根据以下要求，帮我实现一个web端的html。这是一个场景模拟游戏，让学生通过这个模拟游戏，将所学的知识进行应用，学以致用。我希望整体互动是沉浸式的，就是每个操作都有丰富的可视化的场景画面。并且我希望不要所有内容都是局限在一个页面上的，而是一个行为可能就是在一个页面上完成。完成这个行为可能就需要进入到新场景了。

以下是该章节的互动脚本内容，请根据脚本中的场景、角色、交互流程、反馈规则等来实现HTML场景模拟游戏：

{{scriptMarkdown}}

以下是该章节的基本信息：
教材名称：{{bookTitle}}
章节标题：{{chapterTitle}}

请实现一个完整的HTML场景模拟游戏，包含以下要求：
1. 沉浸式场景体验：每个交互步骤都有丰富的可视化场景画面
2. 多页面/多场景切换：不同行为在不同页面上完成，完成后进入新场景
3. 角色对话/互动：根据脚本中的角色和对话来实现交互
4. 操作反馈：每个操作都有明确的视觉反馈和场景变化
5. UI美感：注重界面美感和交互细节
6. 完整可运行：输出完整的HTML文件，包含所有CSS和JavaScript

请输出完整的HTML代码，可以直接在浏览器中打开运行。`,
  },
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

// ==================== Prompt Tab (3 AI Entry Tabs + Flat List + Modal) ====================
export function PromptTab({ language }: { language: "zh" | "en" }) {
  const [selectedEntry, setSelectedEntry] = useState<AIEntryKey>("smart-split");
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Partial<PromptTemplate> | null>(null);
  const [loading, setLoading] = useState(false);

  const currentEntry = AI_ENTRIES.find(e => e.key === selectedEntry)!;
  const colorMap = {
    cyan: { bg: "from-cyan-500/20", border: "border-cyan-500/30", text: "text-cyan-400", hover: "hover:border-cyan-500/50", active: "bg-cyan-500/10 border-cyan-500/40", tab: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" },
    purple: { bg: "from-purple-500/20", border: "border-purple-500/30", text: "text-purple-400", hover: "hover:border-purple-500/50", active: "bg-purple-500/10 border-purple-500/40", tab: "bg-purple-500/20 border-purple-500/40 text-purple-300" },
    emerald: { bg: "from-emerald-500/20", border: "border-emerald-500/30", text: "text-emerald-400", hover: "hover:border-emerald-500/50", active: "bg-emerald-500/10 border-emerald-500/40", tab: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
  };

  const t = (zh: string, en: string) => language === "en" ? en : zh;

  // Load prompts from backend
  const loadPrompts = async (entry: AIEntryKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prompt-templates?aiEntry=${entry}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setPrompts(list);
      // If no prompts exist, seed defaults
      if (list.length === 0) {
        await seedDefaults(entry);
      }
    } catch (e) {
      console.error("Failed to load prompts:", e);
    } finally {
      setLoading(false);
    }
  };

  const seedDefaults = async (entry: AIEntryKey) => {
    const def = DEFAULT_PROMPTS[entry];
    try {
      const res = await fetch("/api/prompt-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiEntry: entry,
          name: def.name,
          systemPrompt: def.systemPrompt,
          userPromptTemplate: def.userPromptTemplate,
        }),
      });
      const created = await res.json();
      setPrompts([created]);
    } catch (e) {
      console.error("Failed to seed defaults:", e);
    }
  };

  useEffect(() => {
    loadPrompts("smart-split");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEntryChange = (entry: AIEntryKey) => {
    setSelectedEntry(entry);
    loadPrompts(entry);
  };

  const handleCreate = () => {
    setEditingPrompt({
      name: "",
      systemPrompt: "",
      userPromptTemplate: "",
      note: "",
    });
    setShowEditModal(true);
  };

  const handleEdit = (p: PromptTemplate) => {
    setEditingPrompt({ ...p });
    setShowEditModal(true);
  };

  const handleDuplicate = (p: PromptTemplate) => {
    setEditingPrompt({
      name: `${p.name} (Copy)`,
      systemPrompt: p.systemPrompt,
      userPromptTemplate: p.userPromptTemplate,
      note: `${t("复制自", "Copied from")} ${p.name}`,
    });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!editingPrompt) return;
    setLoading(true);
    try {
      if (editingPrompt.id) {
        const res = await fetch(`/api/prompt-templates/${editingPrompt.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingPrompt.name,
            systemPrompt: editingPrompt.systemPrompt,
            userPromptTemplate: editingPrompt.userPromptTemplate,
            note: editingPrompt.note,
          }),
        });
        const updated = await res.json();
        setPrompts(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        const res = await fetch("/api/prompt-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aiEntry: selectedEntry,
            name: editingPrompt.name || "Untitled",
            systemPrompt: editingPrompt.systemPrompt || null,
            userPromptTemplate: editingPrompt.userPromptTemplate || null,
            note: editingPrompt.note || null,
          }),
        });
        const created = await res.json();
        setPrompts(prev => [...prev, created]);
      }
      setShowEditModal(false);
      setEditingPrompt(null);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("确定删除此提示词？", "Are you sure you want to delete this prompt?"))) return;
    try {
      await fetch(`/api/prompt-templates/${id}`, { method: "DELETE" });
      setPrompts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const insertVariable = (variable: string) => {
    if (!editingPrompt) return;
    const current = editingPrompt.userPromptTemplate || "";
    setEditingPrompt({ ...editingPrompt, userPromptTemplate: current + variable });
  };

  const c = colorMap[currentEntry.color];

  return (
    <div className="flex h-full">
      {/* Left: 3 AI Entry Tabs */}
      <div className="w-64 border-r border-white/10 flex flex-col shrink-0">
        <div className="p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-2">
            {t("AI 入口", "AI Entry Point")}
          </div>
          {AI_ENTRIES.map(entry => {
            const ec = colorMap[entry.color];
            const isActive = selectedEntry === entry.key;
            return (
              <button
                key={entry.key}
                onClick={() => handleEntryChange(entry.key)}
                className={`w-full text-left p-3 rounded-lg border transition cursor-pointer ${
                  isActive ? ec.tab : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{entry.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {language === "en" ? entry.nameEn : entry.name}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Flat Prompt List Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-xl">{currentEntry.icon}</span>
            {language === "en" ? currentEntry.nameEn : currentEntry.name}
            <span className="text-xs text-slate-500 font-normal">({prompts.length})</span>
          </h2>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm font-semibold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t("新建提示词", "New Prompt")}
          </button>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 text-sm py-8">{t("加载中...", "Loading...")}</div>
        ) : prompts.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-12 bg-white/5 border border-white/10 rounded-xl">
            <div className="text-3xl mb-3">{currentEntry.icon}</div>
            <div>{t("暂无提示词，点击「新建提示词」添加", "No prompts yet, click 'New Prompt' to add")}</div>
          </div>
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("名称", "Name")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-36">{t("创建时间", "Created")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-36">{t("更新时间", "Updated")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-24">{t("状态", "Status")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("备注", "Note")}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-48">{t("操作", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {prompts.map(p => (
                  <tr
                    key={p.id}
                    className="border-b border-white/5 hover:bg-white/5 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                        {p.systemPrompt?.slice(0, 80) || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(p.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                          {t("使用中", "Active")}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">{t("未启用", "Inactive")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-400 max-w-xs truncate" title={p.note || ""}>
                        {p.note || <span className="text-slate-700">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(p)}
                          className="text-[10px] px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                        >
                          {t("编辑", "Edit")}
                        </button>
                        <button
                          onClick={() => handleDuplicate(p)}
                          className="text-[10px] px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition cursor-pointer"
                          title={t("复制为新提示词", "Duplicate as new prompt")}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-[10px] px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${c.bg} ${c.text}`}>
                  {currentEntry.icon} {language === "en" ? currentEntry.nameEn : currentEntry.name}
                </span>
                {editingPrompt.id ? t("编辑提示词", "Edit Prompt") : t("新建提示词", "New Prompt")}
              </h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingPrompt(null); }}
                className="p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("名称", "Name")}
                </label>
                <input
                  type="text"
                  value={editingPrompt.name || ""}
                  onChange={e => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                  placeholder={t("提示词名称", "Prompt name")}
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("系统指令", "System Prompt")}
                </label>
                <textarea
                  value={editingPrompt.systemPrompt || ""}
                  onChange={e => setEditingPrompt({ ...editingPrompt, systemPrompt: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-y"
                  placeholder={t("系统指令内容...", "System prompt content...")}
                />
              </div>

              {/* User Prompt Template */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("用户指令模板", "User Prompt Template")}
                </label>
                <textarea
                  value={editingPrompt.userPromptTemplate || ""}
                  onChange={e => setEditingPrompt({ ...editingPrompt, userPromptTemplate: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-y"
                  placeholder={t("用户指令模板内容，使用 {{variable}} 插入变量...", "User prompt template, use {{variable}} to insert variables...")}
                />
                {/* Variable insertion buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {getAvailableVars(language).map(v => (
                    <button
                      key={v.var}
                      onClick={() => insertVariable(v.var)}
                      className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                      title={v.desc}
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note (last field) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("备注", "Note")}
                  <span className="normal-case font-normal text-slate-600 ml-1">
                    ({t("记录测试效果、为什么好/不好", "Record test results, why it works or doesn't")})
                  </span>
                </label>
                <textarea
                  value={editingPrompt.note || ""}
                  onChange={e => setEditingPrompt({ ...editingPrompt, note: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-none"
                  placeholder={t("例如：这个版本在XX场景下效果更好，但YY方面不如v2...", "e.g., This version works better in XX scenario, but worse in YY than v2...")}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                onClick={() => { setShowEditModal(false); setEditingPrompt(null); }}
                className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
              >
                {t("取消", "Cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? t("保存中...", "Saving...") : t("保存", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Model Tab ====================
export function ModelTab({ language }: { language: "zh" | "en" }) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingModel, setEditingModel] = useState<Partial<ModelConfig> | null>(null);
  const [loading, setLoading] = useState(false);

  const t = (zh: string, en: string) => language === "en" ? en : zh;

  const loadModels = async () => {
    setLoading(true);
    try {
      const [modelsRes, promptsRes] = await Promise.all([
        fetch("/api/model-configs"),
        fetch("/api/prompt-templates"),
      ]);
      const modelsData = await modelsRes.json();
      const promptsData = await promptsRes.json();
      setModels(Array.isArray(modelsData) ? modelsData : []);
      setPrompts(Array.isArray(promptsData) ? promptsData : []);
    } catch (e) {
      console.error("Failed to load models:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    setEditingModel({
      name: "",
      provider: "deepseek",
      modelId: "",
      apiKey: "",
      baseUrl: "",
      maxTokens: 16000,
      temperature: 0.7,
      topP: 0.9,
      promptTemplateId: null,
      isActive: false,
    });
    setShowEditModal(true);
  };

  const handleEdit = (m: ModelConfig) => {
    setEditingModel({ ...m });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!editingModel) return;
    setLoading(true);
    try {
      if (editingModel.id) {
        const res = await fetch(`/api/model-configs/${editingModel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingModel.name,
            provider: editingModel.provider,
            modelId: editingModel.modelId,
            apiKey: editingModel.apiKey,
            baseUrl: editingModel.baseUrl,
            maxTokens: editingModel.maxTokens,
            temperature: editingModel.temperature,
            topP: editingModel.topP,
            promptTemplateId: editingModel.promptTemplateId,
            isActive: editingModel.isActive,
          }),
        });
        const updated = await res.json();
        setModels(prev => prev.map(m => m.id === updated.id ? updated : m));
      } else {
        const res = await fetch("/api/model-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingModel.name || "Untitled",
            provider: editingModel.provider || "deepseek",
            modelId: editingModel.modelId || "",
            apiKey: editingModel.apiKey || null,
            baseUrl: editingModel.baseUrl || null,
            maxTokens: editingModel.maxTokens || 16000,
            temperature: editingModel.temperature ?? 0.7,
            topP: editingModel.topP ?? 0.9,
            promptTemplateId: editingModel.promptTemplateId || null,
            isActive: editingModel.isActive || false,
          }),
        });
        const created = await res.json();
        setModels(prev => [...prev, created]);
      }
      setShowEditModal(false);
      setEditingModel(null);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("确定删除此模型配置？", "Are you sure you want to delete this model config?"))) return;
    try {
      await fetch(`/api/model-configs/${id}`, { method: "DELETE" });
      setModels(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">{language === "en" ? "Model Configurations" : "模型配置"}</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm font-semibold transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t("新建模型", "New Model")}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 text-sm py-8">{t("加载中...", "Loading...")}</div>
      ) : models.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-12 bg-white/5 border border-white/10 rounded-xl">
          <div>{t("暂无模型配置，点击「新建模型」添加", "No model configs yet, click 'New Model' to add")}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {models.map(m => {
            const provider = PROVIDERS.find(p => p.value === m.provider);
            return (
              <div
                key={m.id}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center text-lg">
                      🤖
                    </div>
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-slate-400">
                        {provider?.label || m.provider} / {m.modelId}
                      </div>
                    </div>
                    {m.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                        {t("使用中", "Active")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEdit(m)}
                      className="text-xs px-3 py-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                    >
                      {t("编辑", "Edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs px-3 py-1.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold">
                {editingModel.id ? t("编辑模型", "Edit Model") : t("新建模型", "New Model")}
              </h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingModel(null); }}
                className="p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("名称", "Name")}
                </label>
                <input
                  type="text"
                  value={editingModel.name || ""}
                  onChange={e => setEditingModel({ ...editingModel, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                  placeholder={t("模型配置名称", "Model config name")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("提供商", "Provider")}
                  </label>
                  <select
                    value={editingModel.provider || "deepseek"}
                    onChange={e => setEditingModel({ ...editingModel, provider: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {PROVIDERS.map(p => (
                      <option key={p.value} value={p.value} className="bg-[#1a1a2e]">{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("模型ID", "Model ID")}
                  </label>
                  <input
                    type="text"
                    value={editingModel.modelId || ""}
                    onChange={e => setEditingModel({ ...editingModel, modelId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                    placeholder="deepseek-chat"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  value={editingModel.apiKey || ""}
                  onChange={e => setEditingModel({ ...editingModel, apiKey: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                  placeholder="sk-..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Base URL
                </label>
                <input
                  type="text"
                  value={editingModel.baseUrl || ""}
                  onChange={e => setEditingModel({ ...editingModel, baseUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                  placeholder="https://api.deepseek.com"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={editingModel.maxTokens ?? 16000}
                    onChange={e => setEditingModel({ ...editingModel, maxTokens: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Temperature
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={editingModel.temperature ?? 0.7}
                    onChange={e => setEditingModel({ ...editingModel, temperature: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Top P
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={editingModel.topP ?? 0.9}
                    onChange={e => setEditingModel({ ...editingModel, topP: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("关联提示词模板", "Linked Prompt Template")}
                </label>
                <select
                  value={editingModel.promptTemplateId || ""}
                  onChange={e => setEditingModel({ ...editingModel, promptTemplateId: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="" className="bg-[#1a1a2e]">{t("无", "None")}</option>
                  {prompts.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#1a1a2e]">{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingModel({ ...editingModel, isActive: !editingModel.isActive })}
                  className={`relative w-10 h-5 rounded-full transition cursor-pointer ${
                    editingModel.isActive ? "bg-emerald-500" : "bg-white/10"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${
                    editingModel.isActive ? "left-5" : "left-0.5"
                  }`} />
                </button>
                <span className="text-sm text-slate-300">
                  {editingModel.isActive ? t("设为使用中", "Set as Active") : t("未启用", "Inactive")}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                onClick={() => { setShowEditModal(false); setEditingModel(null); }}
                className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition cursor-pointer"
              >
                {t("取消", "Cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? t("保存中...", "Saving...") : t("保存", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
