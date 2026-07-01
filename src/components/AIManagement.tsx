import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, X, Copy, Cpu, Edit3, Check } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { PROVIDERS } from "../providers";
import { loadStoredSelection, ModelSelectorInline, type ModelSelection } from "./ModelSelector";

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

// API Key（provider 级别），与后端 database.ts ApiKey 对应
interface ApiKey {
  id: string;
  provider: string;
  apiKey: string;
  baseUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Codex CLI 配置（与后端 database.ts CodexConfig 对应）
interface CodexConfig {
  id: string;
  token: string;
  defaultSandbox: "read-only" | "workspace-write";
  defaultTimeoutSeconds: number;
  defaultSkills: string;
  createdAt: string;
  updatedAt: string;
}

// 预置的 Codex Superpowers skills（来自 codex-api-frontend-integration-v3 文档）
const CODEX_PRESET_SKILLS = [
  "$using-superpowers",
  "$brainstorming",
  "$test-driven-development",
  "$systematic-debugging",
  "$writing-plans",
  "$executing-plans",
  "$verification-before-completion",
  "$requesting-code-review",
  "$receiving-code-review",
  "$using-git-worktrees",
  "$writing-skills",
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
type AIEntryKey = "smart-split" | "script-gen" | "app-code" | "codex-build";

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
  {
    key: "codex-build",
    name: "Codex Agent 构建",
    nameEn: "Codex Agent Build",
    desc: "Codex Agent 把 HTML 写入 output/index.html，通过 artifacts 返回",
    descEn: "Codex Agent writes HTML to output/index.html, returns via artifacts",
    endpoint: "/api/codex-build/start",
    icon: "🤖",
    color: "emerald",
  },
];

// 主入口分组：左侧只显示 3 个主组，Build App 组内通过子 tab 切换 API / Codex CLI
const MAIN_GROUPS: {
  key: "slice" | "script" | "build";
  labelZh: string;
  labelEn: string;
  icon: string;
  color: "cyan" | "purple" | "emerald";
  entries: AIEntryKey[];
}[] = [
  {
    key: "slice",
    labelZh: "切片",
    labelEn: "Slice",
    icon: "📄",
    color: "cyan",
    entries: ["smart-split"],
  },
  {
    key: "script",
    labelZh: "脚本生成",
    labelEn: "Script Generation",
    icon: "🎬",
    color: "purple",
    entries: ["script-gen"],
  },
  {
    key: "build",
    labelZh: "构建应用",
    labelEn: "Build App",
    icon: "🎮",
    color: "emerald",
    entries: ["app-code", "codex-build"],
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
  "codex-build": {
    name: "Codex Agent 构建提示词",
    systemPrompt: `You are a top-tier full-stack engineer agent with autonomous file-write capability. Your task is to build a self-contained, runnable HTML scene simulation game by writing files into the run workspace.

Critical workflow rules:
1. You MUST write the complete HTML game to the file path: output/index.html (relative to your workspace root). Only files under output/ are exposed to the caller.
2. The HTML must be a single self-contained file with all CSS in <style> and all JS in <script> tags. No external local file dependencies.
3. Do NOT print the HTML content in your final response. Your final response should be a short natural-language summary (1-3 sentences) naming the file you created (output/index.html) and a one-line description of the game.
4. The HTML must be complete and runnable. If you are interrupted, retry writing the full file.
5. Focus on immersive, multi-scene UI with rich visual feedback for each interaction.`,
    userPromptTemplate: `Build a web-based HTML scene simulation game. This game helps students apply what they learned in a textbook chapter through an immersive, scenario-driven experience.

Requirements:
- Immersive: every interaction has rich visual scene feedback.
- Multi-scene: each behavior happens on its own page/screen; completing a behavior may transition to a new scene.
- Implement scenes, characters, interaction flows, and feedback rules from the script below.

Interactive script content:
{{scriptMarkdown}}

Chapter info:
- Book title: {{bookTitle}}
- Chapter title: {{chapterTitle}}

DELIVERABLE: Write the complete HTML game to output/index.html. Do not output HTML in your response text; only write it to the file. After writing, reply with the filename and a one-line summary.`,
  },
};

type TabKey = "models" | "prompts" | "codex";

export default function AIManagement({ onBack }: { onBack: () => void }) {
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
          <h1 className="text-lg font-bold">{language === "en" ? "AI Management" : "AI 管理"}</h1>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("prompts")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "prompts" ? "bg-purple-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {language === "en" ? "Prompts" : "提示词"}
          </button>
          <button
            onClick={() => setActiveTab("models")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "models" ? "bg-cyan-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {language === "en" ? "AI Model API" : "AI 模型 API"}
          </button>
          <button
            onClick={() => setActiveTab("codex")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
              activeTab === "codex" ? "bg-emerald-500/30 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {language === "en" ? "Codex CLI" : "Codex CLI"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "prompts" ? (
          <PromptTab language={language} />
        ) : activeTab === "models" ? (
          <ModelTab language={language} />
        ) : (
          <CodexTab language={language} />
        )}
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
  const currentGroup = MAIN_GROUPS.find(g => g.entries.includes(selectedEntry))!;
  const isBuildGroup = currentGroup.entries.length > 1;
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

  const handleGroupChange = (group: typeof MAIN_GROUPS[number]) => {
    const firstEntry = group.entries[0];
    setSelectedEntry(firstEntry);
    loadPrompts(firstEntry);
  };

  const handleSubEntryChange = (entry: AIEntryKey) => {
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

  const renderPromptWithVars = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (/^\{\{[^}]+\}\}$/.test(part)) {
        return (
          <span
            key={i}
            className="px-1 py-0 rounded text-[11px] font-mono font-semibold bg-purple-500/25 text-purple-300 border border-purple-500/30 whitespace-nowrap"
          >
            {part}
          </span>
        );
      }
      return <span key={i} className="text-slate-300">{part}</span>;
    });
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
          {MAIN_GROUPS.map(group => {
            const isActive = currentGroup.key === group.key;
            const ec = colorMap[group.color];
            return (
              <button
                key={group.key}
                onClick={() => handleGroupChange(group)}
                className={`w-full text-left p-3 rounded-lg border transition cursor-pointer ${
                  isActive ? ec.tab : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{group.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {language === "en" ? group.labelEn : group.labelZh}
                    </div>
                  </div>
                  {group.entries.length > 1 && (
                    <span className="text-[9px] text-slate-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {group.entries.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Flat Prompt List Table */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Build App 组子 tab：API / Codex CLI */}
        {isBuildGroup && (
          <div className="flex items-center gap-1 mb-4 pb-3 border-b border-white/5">
            {currentGroup.entries.map(subKey => {
              const subEntry = AI_ENTRIES.find(e => e.key === subKey)!;
              const isSubActive = selectedEntry === subKey;
              const subLabel = subKey === "app-code" ? "API" : "Codex CLI";
              return (
                <button
                  key={subKey}
                  onClick={() => handleSubEntryChange(subKey)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                    isSubActive
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  <span className="mr-1">{subEntry.icon}</span>{subLabel}
                </button>
              );
            })}
          </div>
        )}
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
                <div className="relative rounded-lg border border-white/10 overflow-hidden">
                  {/* Highlighted background layer */}
                  <div
                    className="absolute inset-0 px-3 py-2 text-sm font-mono leading-relaxed whitespace-pre-wrap break-words pointer-events-none"
                    aria-hidden="true"
                  >
                    {renderPromptWithVars(editingPrompt.userPromptTemplate || "")}
                  </div>
                  {/* Editable textarea on top - text transparent, caret visible */}
                  <textarea
                    value={editingPrompt.userPromptTemplate || ""}
                    onChange={e => setEditingPrompt({ ...editingPrompt, userPromptTemplate: e.target.value })}
                    rows={6}
                    className="relative w-full px-3 py-2 text-sm font-mono leading-relaxed whitespace-pre-wrap break-words bg-white/5 focus:outline-none focus:border-purple-500/50 resize-y caret-white"
                    style={{ color: "transparent", WebkitTextFillColor: "transparent" }}
                    placeholder={t("用户指令模板内容，使用 {{variable}} 插入变量...", "User prompt template, use {{variable}} to insert variables...")}
                    spellCheck={false}
                  />
                </div>
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

// 3 个 AI 调用入口当前使用的模型概览（从 localStorage 读取用户上次选择，可直接编辑）
function CurrentModelsOverview({ language }: { language: "zh" | "en" }) {
  const t = (zh: string, en: string) => language === "en" ? en : zh;

  const callSites = [
    { site: "slice" as const,   entry: AI_ENTRIES[0] },
    { site: "script" as const,  entry: AI_ENTRIES[1] },
    { site: "build" as const,   entry: AI_ENTRIES[2] },
  ];

  // 3 个 callSite 的当前选择（从 localStorage 初始化）
  const [selections, setSelections] = useState<Record<string, ModelSelection | null>>(() => ({
    slice: loadStoredSelection("slice"),
    script: loadStoredSelection("script"),
    build: loadStoredSelection("build"),
  }));
  // 当前正在编辑哪个 callSite，null 表示都不在编辑
  const [editingSite, setEditingSite] = useState<string | null>(null);

  const handleSave = (site: string, sel: ModelSelection) => {
    setSelections(prev => ({ ...prev, [site]: sel }));
  };

  return (
    <div className="mt-4 mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            {t("当前各调用入口使用的模型", "Current Model per AI Entry")}
          </h3>
        </div>
        <span className="text-[9px] font-mono text-slate-600">
          {t("点击编辑可直接切换", "Click edit to switch")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {callSites.map(({ site, entry }) => {
          const sel = selections[site];
          const providerCfg = sel ? PROVIDERS.find(p => p.value === sel.provider) : null;
          const isEditing = editingSite === site;
          return (
            <div
              key={site}
              className={`rounded-lg border p-3 bg-[#050508] transition ${
                isEditing ? "border-cyan-500/40" : "border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{entry.icon}</span>
                  <span className="text-xs font-semibold text-slate-300 truncate">
                    {language === "en" ? entry.nameEn : entry.name}
                  </span>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setEditingSite(site)}
                    className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition cursor-pointer shrink-0"
                    title={t("编辑", "Edit")}
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <ModelSelectorInline
                    callSite={site}
                    value={sel || { provider: "deepseek", model: "" }}
                    onChange={(v) => handleSave(site, v)}
                  />
                  <button
                    onClick={() => setEditingSite(null)}
                    className="w-full mt-1 px-2 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-semibold hover:bg-cyan-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3 h-3" />
                    {t("完成", "Done")}
                  </button>
                </div>
              ) : sel && providerCfg ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded bg-gradient-to-br ${providerCfg.gradient} flex items-center justify-center text-[7px] font-bold text-white shrink-0`}>
                      {providerCfg.shortLabel}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 truncate">{providerCfg.label.split(" ")[0]}</span>
                  </div>
                  <div className="text-[10px] font-mono text-purple-300 truncate" title={sel.model}>
                    {sel.model || t("（未选模型）", "(no model)")}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-600 italic">
                  {t("未配置，将使用默认", "Not set, will use default")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ModelTab({ language }: { language: "zh" | "en" }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState<Partial<ApiKey> & { apiKeyConfirm?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 动态获取的模型列表缓存：apiKeyId -> models[]
  const [modelsCache, setModelsCache] = useState<Record<string, string[]>>({});
  const [modelsLoading, setModelsLoading] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const t = (zh: string, en: string) => language === "en" ? en : zh;

  const loadKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      setKeys(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load API keys:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = () => {
    setEditing({
      provider: "deepseek",
      apiKey: "",
      baseUrl: "",
      apiKeyConfirm: "",
    });
    setShowEditModal(true);
  };

  const handleEdit = (k: ApiKey) => {
    setEditing({
      id: k.id,
      provider: k.provider,
      apiKey: "",
      apiKeyConfirm: "",
      baseUrl: k.baseUrl || "",
    });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.provider) {
      alert(t("请选择厂商", "Please select a provider"));
      return;
    }
    if (!editing.id && !editing.apiKey) {
      alert(t("请填写 API Key", "Please fill in API key"));
      return;
    }
    if (editing.apiKey && editing.apiKey !== editing.apiKeyConfirm) {
      alert(t("两次输入的 API Key 不一致", "API keys do not match"));
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        provider: editing.provider,
        baseUrl: editing.baseUrl || null,
      };
      if (editing.apiKey) {
        payload.apiKey = editing.apiKey;
      }
      if (editing.id) {
        const res = await fetch(`/api/api-keys/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated = await res.json();
        setKeys(prev => prev.map(k => k.id === updated.id ? updated : k));
      } else {
        const res = await fetch("/api/api-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await res.json();
        setKeys(prev => [created, ...prev]);
      }
      setShowEditModal(false);
      setEditing(null);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("确定删除此 API Key？", "Are you sure you want to delete this API key?"))) return;
    try {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      setKeys(prev => prev.filter(k => k.id !== id));
      setModelsCache(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  // 动态获取该 API Key 可调用的模型列表（调 provider 的 /models 端点）
  const handleFetchModels = async (id: string) => {
    if (modelsCache[id]) {
      // 已缓存，直接展开/收起
      setExpandedId(expandedId === id ? null : id);
      return;
    }
    setModelsLoading(id);
    setModelsError(null);
    try {
      const res = await fetch(`/api/api-keys/${id}/models`);
      const data = await res.json();
      if (!res.ok) {
        setModelsError(data.detail || data.error || "Failed to fetch models");
        setExpandedId(id);
      } else {
        setModelsCache(prev => ({ ...prev, [id]: data.models || [] }));
        setExpandedId(id);
      }
    } catch (e: any) {
      setModelsError(e.message || "Network error");
      setExpandedId(id);
    } finally {
      setModelsLoading(null);
    }
  };

  const maskKey = (key: string) => {
    if (!key) return "—";
    if (key.length <= 8) return "****";
    return `${key.slice(0, 4)}••••${key.slice(-4)}`;
  };

  const currentProvider = PROVIDERS.find(p => p.value === editing?.provider);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-bold">{language === "en" ? "API Keys" : "API Key 管理"}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {t(
              "按厂商配置 API Key。一个 Key 可调用该厂商下所有可用模型。具体用哪个模型 + 哪个提示词，在调用入口的配置面板选择。",
              "Configure API keys per provider. One key unlocks all available models of that provider. Which model + prompt to use is chosen at each AI entry's config panel."
            )}
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm font-semibold transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t("添加 API Key", "Add API Key")}
        </button>
      </div>

      {/* 当前 3 个 AI 调用入口使用的模型概览 */}
      <CurrentModelsOverview language={language} />

      {loading ? (
        <div className="text-center text-slate-500 text-sm py-8">{t("加载中...", "Loading...")}</div>
      ) : keys.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-12 bg-white/5 border border-white/10 rounded-xl mt-6">
          <div className="mb-2 text-3xl opacity-50">🔑</div>
          <div>{t("暂无 API Key，点击「添加 API Key」开始", "No API keys yet. Click 'Add API Key' to start.")}</div>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {keys.map(k => {
            const provider = PROVIDERS.find(p => p.value === k.provider);
            const cached = modelsCache[k.id];
            const expanded = expandedId === k.id;
            const isLoadingModels = modelsLoading === k.id;
            return (
              <div
                key={k.id}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${provider?.gradient || "from-slate-500 to-slate-600"} flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
                      {provider?.shortLabel || k.provider.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold truncate block">{provider?.label || k.provider}</span>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-mono text-amber-400/80">{maskKey(k.apiKey)}</span>
                        {k.baseUrl && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="font-mono text-slate-500 truncate max-w-[200px]">{k.baseUrl}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => handleFetchModels(k.id)}
                      disabled={isLoadingModels}
                      className="text-xs px-3 py-1.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingModels
                        ? t("获取中...", "Fetching...")
                        : expanded
                          ? t("收起", "Hide")
                          : t("可用模型", "Models")}
                    </button>
                    <button
                      onClick={() => handleEdit(k)}
                      className="text-xs px-3 py-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                    >
                      {t("编辑", "Edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(k.id)}
                      className="text-xs px-3 py-1.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition cursor-pointer"
                      title={t("删除", "Delete")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">
                      {t("可用模型（实时调用 provider API 获取）", "Available models (fetched live from provider)")}
                    </div>
                    {modelsError && expandedId === k.id && !cached ? (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                        {modelsError}
                      </div>
                    ) : cached && cached.length === 0 ? (
                      <span className="text-xs text-slate-500">{t("该 key 未返回任何模型", "No models returned")}</span>
                    ) : cached ? (
                      <div className="flex flex-wrap gap-2">
                        {cached.map((m: string) => (
                          <span
                            key={m}
                            className="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-white/10 font-mono text-slate-300"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold">
                {editing.id ? t("编辑 API Key", "Edit API Key") : t("添加 API Key", "Add API Key")}
              </h2>
              <button
                onClick={() => { setShowEditModal(false); setEditing(null); }}
                className="p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("厂商", "Provider")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditing({ ...editing, provider: p.value })}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition cursor-pointer ${
                        editing.provider === p.value
                          ? "border-purple-500/60 bg-purple-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white text-[10px] font-bold`}>
                        {p.shortLabel}
                      </div>
                      <span className="text-[10px] text-slate-300 text-center leading-tight">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  API Key {!editing.id && <span className="text-red-400">*</span>}
                  {editing.id && (
                    <span className="ml-2 text-slate-500 normal-case font-normal">
                      {t("留空表示不修改", "Leave empty to keep current")}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={editing.apiKey || ""}
                  onChange={e => setEditing({ ...editing, apiKey: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 font-mono"
                  placeholder={editing.id ? "••••••••" : "sk-..."}
                />
              </div>

              {editing.apiKey && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {t("确认 API Key", "Confirm API Key")}
                  </label>
                  <input
                    type="password"
                    value={editing.apiKeyConfirm || ""}
                    onChange={e => setEditing({ ...editing, apiKeyConfirm: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 font-mono"
                    placeholder={t("再次输入", "Type again")}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Base URL
                </label>
                <input
                  type="text"
                  value={editing.baseUrl || ""}
                  onChange={e => setEditing({ ...editing, baseUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 font-mono"
                  placeholder={currentProvider?.defaultBaseUrl || "https://..."}
                />
                {currentProvider && !editing.baseUrl && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t("默认", "Default")}: <span className="font-mono">{currentProvider.defaultBaseUrl}</span>
                  </p>
                )}
              </div>

              <p className="text-[11px] text-slate-500 bg-white/5 border border-white/10 rounded-lg p-2.5">
                {t(
                  "可用模型在保存后点击列表项的「可用模型」按钮实时获取。具体使用哪个模型 + 哪个提示词，在调用入口的配置面板选择。",
                  "Available models are fetched live after saving (click 'Models' on the list item). Which model + prompt to use is chosen at each AI entry's config panel."
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                onClick={() => { setShowEditModal(false); setEditing(null); }}
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

// ==================== Codex Tab（单条全局配置 + 测试连接）====================
export function CodexTab({ language, onStatusChange }: { language: "zh" | "en"; onStatusChange?: (configured: boolean, connected: boolean) => void }) {
  const [config, setConfig] = useState<CodexConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 编辑态：表单字段
  const [token, setToken] = useState("");
  const [tokenConfirm, setTokenConfirm] = useState(""); // 编辑时需二次输入，避免误覆盖
  const [sandbox, setSandbox] = useState<"read-only" | "workspace-write">("read-only");
  const [timeout, setTimeout] = useState(120);
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState(""); // 自定义 skill 输入框

  const t = (zh: string, en: string) => language === "en" ? en : zh;

  // 加载已存配置
  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/codex-config");
      const data = await res.json();
      if (data && data.id) {
        setConfig(data);
        setSandbox(data.defaultSandbox || "read-only");
        setTimeout(data.defaultTimeoutSeconds || 120);
        const skillArr = (data.defaultSkills || "").split(",").map((s: string) => s.trim()).filter(Boolean);
        setSkills(skillArr);
        onStatusChange?.(true, false); // 已配置，连接状态未知（不自动测）
      } else {
        setConfig(null);
        onStatusChange?.(false, false);
      }
    } catch (e) {
      console.error("Failed to load codex config:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // 保存配置
  const handleSave = async () => {
    if (timeout < 30 || timeout > 1800) {
      alert(t("超时时间必须在 30-1800 秒之间", "Timeout must be between 30-1800 seconds"));
      return;
    }
    // 决定最终用哪个 token
    let finalToken: string;
    if (config) {
      // 编辑模式
      if (token) {
        // 用户想改 token → 需要二次确认
        if (!tokenConfirm) {
          alert(t("修改 Token 时请二次输入以确认", "Please re-enter Token to confirm the change"));
          return;
        }
        if (token !== tokenConfirm) {
          alert(t("两次输入的 Token 不一致", "Tokens do not match"));
          return;
        }
        finalToken = token;
      } else {
        // 不改 token → 沿用已存的，只更新其他字段
        finalToken = config.token;
      }
    } else {
      // 首次配置：必须填 token
      if (!token) {
        alert(t("请填写 Token", "Please fill in Token"));
        return;
      }
      finalToken = token;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/codex-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: finalToken,
          defaultSandbox: sandbox,
          defaultTimeoutSeconds: timeout,
          defaultSkills: skills.join(","),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const saved = await res.json();
      setConfig(saved);
      setToken("");
      setTokenConfirm("");
      setTestResult({ ok: true, msg: t("保存成功", "Saved successfully") });
      window.setTimeout(() => setTestResult(null), 3000);
      onStatusChange?.(true, false); // 保存后：已配置，连接状态未知（token 可能变了）
    } catch (e: any) {
      alert(t("保存失败：", "Save failed: ") + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 测试连接
  const handleTest = async () => {
    if (!token && !tokenConfirm && !config?.token) {
      alert(t("请先填写 Token", "Please fill in Token first"));
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // 优先用当前输入框的值（token 或 tokenConfirm），否则用已存配置
      const testToken = tokenConfirm || token || config?.token || "";
      const res = await fetch("/api/codex-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: testToken }),
      });
      const data = await res.json();
      if (data.ok) {
        const clientId = data.client?.id || data.client?.clientId || "unknown";
        setTestResult({ ok: true, msg: t(`连接成功！Client ID: ${clientId}`, `Connected! Client ID: ${clientId}`) });
        onStatusChange?.(true, true); // 测试通过：已配置 + 已连接
      } else {
        setTestResult({ ok: false, msg: t(`连接失败 (${data.status || "error"})`, `Connection failed (${data.status || "error"})`) });
        onStatusChange?.(true, false); // 测试失败：已配置但未连接
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: t("测试失败：", "Test failed: ") + e.message });
      onStatusChange?.(true, false);
    } finally {
      setTesting(false);
    }
  };

  // 清除配置
  const handleDelete = async () => {
    if (!config) return;
    if (!confirm(t("确定要清除 Codex 配置吗？此操作不可恢复。", "Are you sure to clear Codex config? This cannot be undone."))) return;
    setLoading(true);
    try {
      await fetch("/api/codex-config", { method: "DELETE" });
      setConfig(null);
      setToken("");
      setTokenConfirm("");
      setSandbox("read-only");
      setTimeout(120);
      setSkills([]);
      setTestResult(null);
      onStatusChange?.(false, false); // 清除：未配置
    } catch (e: any) {
      alert(t("删除失败：", "Delete failed: ") + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 切换预置 skill 选中状态
  const toggleSkill = (skill: string) => {
    setSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  };

  // 添加自定义 skill
  const addCustomSkill = () => {
    const s = customSkillInput.trim();
    if (!s) return;
    if (!s.startsWith("$")) {
      alert(t("Skill 名必须以 $ 开头", "Skill name must start with $"));
      return;
    }
    if (skills.includes(s)) {
      setCustomSkillInput("");
      return;
    }
    setSkills(prev => [...prev, s]);
    setCustomSkillInput("");
  };

  // 移除 skill
  const removeSkill = (skill: string) => {
    setSkills(prev => prev.filter(s => s !== skill));
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* 标题区 */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            {t("Codex CLI 配置", "Codex CLI Configuration")}
          </h2>
          <p className="text-sm text-slate-400">
            {t(
              "Codex 是同事封装的 Agent 式 AI 执行服务，与 Model API 是两种不同的调用通道。这里只配置 Token 和默认参数，每个调用入口仍可单独选择是否使用 Codex。",
              "Codex is an agent-style AI execution service wrapped by your colleague, different from Model API. Only Token and default params are configured here; each call site can independently choose whether to use Codex."
            )}
          </p>
        </div>

        {/* 配置卡片 */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 space-y-5">
          {/* Token */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Token {config ? null : <span className="text-red-400">*</span>}
            </label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={config ? t("已配置（留空表示不修改 Token，仅更新其他设置）", "Configured (leave empty to keep current Token, only update other settings)") : t("请输入 Codex Token", "Please enter Codex Token")}
              className="w-full px-4 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white text-sm font-mono focus:border-emerald-500/50 focus:outline-none transition"
            />
            {config && token && (
              <input
                type="password"
                value={tokenConfirm}
                onChange={e => setTokenConfirm(e.target.value)}
                placeholder={t("再次输入新 Token 以确认修改", "Re-enter new Token to confirm modification")}
                className="w-full mt-2 px-4 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white text-sm font-mono focus:border-emerald-500/50 focus:outline-none transition"
              />
            )}
            <p className="text-xs text-slate-500 mt-1.5">
              {config
                ? t("Token 已保存。仅在需要更换时填写，修改其他设置可直接点保存。", "Token is saved. Only fill in when you need to change it; other settings can be saved directly.")
                : t("从同事处获取，唯一凭据，固定调用 https://codex-api.tangyinx.com", "Obtained from your colleague. Single credential, fixed endpoint https://codex-api.tangyinx.com")}
            </p>
          </div>

          {/* Sandbox */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("默认 Sandbox 模式", "Default Sandbox Mode")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSandbox("read-only")}
                className={`px-4 py-2.5 rounded-lg border text-sm transition cursor-pointer text-left ${
                  sandbox === "read-only"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : "bg-black/40 border-white/10 text-slate-400 hover:border-white/20"
                }`}
              >
                <div className="font-semibold">read-only</div>
                <div className="text-xs opacity-70 mt-0.5">{t("只读，安全", "Read-only, safe")}</div>
              </button>
              <button
                onClick={() => setSandbox("workspace-write")}
                className={`px-4 py-2.5 rounded-lg border text-sm transition cursor-pointer text-left ${
                  sandbox === "workspace-write"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : "bg-black/40 border-white/10 text-slate-400 hover:border-white/20"
                }`}
              >
                <div className="font-semibold">workspace-write</div>
                <div className="text-xs opacity-70 mt-0.5">{t("可写工作区", "Writable workspace")}</div>
              </button>
            </div>
          </div>

          {/* Timeout */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("默认超时时间（秒）", "Default Timeout (seconds)")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={30}
                max={1800}
                value={timeout}
                onChange={e => setTimeout(Number(e.target.value) || 120)}
                className="w-32 px-4 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-500/50 focus:outline-none transition"
              />
              <span className="text-xs text-slate-500">{t("范围 30-1800，默认 120", "Range 30-1800, default 120")}</span>
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t("默认 Skills", "Default Skills")}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {t("（可选，调用时自动拼到 prompt 前）", "(optional, auto-prepended to prompt on call)")}
              </span>
            </label>

            {/* 已选 skill 标签 */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {skills.map(s => (
                  <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                    {s}
                    <button onClick={() => removeSkill(s)} className="hover:text-red-400 transition cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 预置 skill 多选 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {CODEX_PRESET_SKILLS.map(skill => {
                const selected = skills.includes(skill);
                return (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1.5 rounded-md border text-xs font-mono transition cursor-pointer text-left ${
                      selected
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-black/40 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>

            {/* 自定义 skill 输入 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customSkillInput}
                onChange={e => setCustomSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); } }}
                placeholder={t("$your-custom-skill", "$your-custom-skill")}
                className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-mono focus:border-emerald-500/50 focus:outline-none transition"
              />
              <button
                onClick={addCustomSkill}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs transition cursor-pointer"
              >
                {t("添加", "Add")}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {t(
                "预置 skill 来自服务端已安装的 Superpowers skills；自定义 skill 需服务端已安装才生效。",
                "Preset skills are from server-installed Superpowers; custom skills only work if installed on server."
              )}
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {loading ? t("保存中...", "Saving...") : t("保存", "Save")}
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-sm transition cursor-pointer disabled:opacity-50"
            >
              {testing ? t("测试中...", "Testing...") : t("测试连接", "Test Connection")}
            </button>
            {config && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm transition cursor-pointer disabled:opacity-50 ml-auto"
              >
                {t("清除配置", "Clear Config")}
              </button>
            )}
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className={`px-4 py-3 rounded-lg border text-sm ${
              testResult.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}>
              {testResult.msg}
            </div>
          )}

          {/* 元信息 */}
          {config && (
            <div className="pt-4 border-t border-white/5 text-xs text-slate-500 space-y-1">
              <div>{t("创建时间", "Created")}: {new Date(config.createdAt).toLocaleString()}</div>
              <div>{t("更新时间", "Updated")}: {new Date(config.updatedAt).toLocaleString()}</div>
            </div>
          )}
        </div>

        {/* 说明区 */}
        <div className="mt-6 p-4 rounded-lg bg-blue-500/[0.03] border border-blue-500/10">
          <h3 className="text-sm font-semibold text-blue-300 mb-2">{t("Codex 与 Model API 的区别", "Codex vs Model API")}</h3>
          <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <li>• {t("Codex 单 Token 认证，无 provider/model 概念；Model API 按 provider 配置 Key。", "Codex uses single Token auth, no provider/model concept; Model API configures Key per provider.")}</li>
            <li>• {t("Codex 是异步 Agent 执行（有 sandbox/timeout/skills）；Model API 是同步文本输入输出。", "Codex is async agent execution (with sandbox/timeout/skills); Model API is sync text in/out.")}</li>
            <li>• {t("两者完全独立维护，调用入口可二选一（仅 build 步支持 Codex）。", "Both are maintained independently; call sites can choose either (Codex only available in build step).")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
