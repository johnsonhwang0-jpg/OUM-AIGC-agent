import React, { useState, useEffect, useRef, useCallback, useMemo, Component, ErrorInfo, ReactNode } from "react";
import { 
  Upload, BookOpen, Sparkles, Play, Check, Plus, Trash2, Edit3, Layers, 
  MessageSquare, Send, RefreshCw, FileText, Settings, ArrowRight, Gamepad2, 
  CheckCircle2, XCircle, Compass, HelpCircle, Info, Download, Copy, AlertCircle, 
  Award, Trophy, ChevronRight, CornerDownRight, Volume2, Gamepad, Lock, Code2, Terminal,
  Maximize2, Minimize2, X, Eye, Scissors, FileCode, Rocket
} from "lucide-react";
import { useLanguage, type TranslationKey } from "./i18n/LanguageContext";

// Error Boundary component - prevents the entire app from crashing
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-lg text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Application Error</h2>
            <p className="text-slate-400 text-sm mb-4">{this.state.error.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { TEMPLATE_BOOKS } from "./data";
import {
  BookModule, BookBlueprint, GameScript, Message, GameSessionState, GameChallenge, GameType, DirectoryItem,
  SummaryInfo, InfoDensity, CohesionDetail, ExtractedImage, SimulationBlueprintScript, ProjectInfo, AutomationJob
} from "./types";
import { parseTextToDirectory, serializeDirectoryToText } from "./utils/directoryParser";
import { getExtractedTextForModule, getExtractedTextForModuleAsync, calculateAutoPageOffset } from "./utils/textbookMatcher";
import StandalonePreview from "./components/StandalonePreview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import ModelManagement from "./components/ModelManagement";
import SystemSettings from "./components/SystemSettings";
import { APP_VERSION } from "./version";
import ApiDebugDrawer from "./components/ApiDebugDrawer";
import { AutomationPanel } from "./components/Automation";
import { NewProjectModal, type NewProjectResult } from "./components/NewProjectModal";
import { TaskManager } from "./components/TaskManager";
import { HomeView, type HomeProject } from "./components/HomeView";

// Extract valid HTML from AI response, stripping markdown fences and explanatory text
function extractValidHtml(raw: string): string {
  if (!raw) return '';
  
  let code = raw.trim();
  
  // Remove markdown code block markers (html, HTML, or empty)
  code = code.replace(/^```(?:html|HTML)?\s*\n?/i, "");
  code = code.replace(/\n?\s*```$/i, "");
  code = code.replace(/```(?:html|HTML)?\s*\n?/gi, "");
  code = code.trim();
  
  // Find the actual HTML content by looking for <!DOCTYPE or <html
  const doctypeIdx = code.indexOf('<!DOCTYPE');
  const htmlIdx = code.indexOf('<html');
  
  if (doctypeIdx !== -1) {
    // Found DOCTYPE, extract from there to the end
    return code.substring(doctypeIdx);
  } else if (htmlIdx !== -1) {
    // Found <html tag, extract from there and prepend DOCTYPE
    return '<!DOCTYPE html>\n' + code.substring(htmlIdx);
  }
  
  // If no DOCTYPE or <html found, try to find any < tag
  const firstTagIdx = code.indexOf('<');
  if (firstTagIdx !== -1) {
    return code.substring(firstTagIdx);
  }
  
  // Fallback: return as-is
  return code;
}

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-xl bg-[#09090e] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition cursor-pointer"
      >
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        <span className="text-slate-500 text-xs transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-white/5">
          <div className="pt-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { t, language } = useLanguage();
  // Draggable split workspace sizing engine
  const [leftWidth, setLeftWidth] = useState<number>(450);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Prevent shrinking the AI Chat area less than 320px, nor more than 60% of viewport
      const minW = 320;
      const maxW = Math.max(minW, window.innerWidth * 0.6);
      const newWidth = Math.max(minW, Math.min(maxW, e.clientX));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);
  // Navigation & Progress Steps
  // step 1: Load book, step 2: Edit/design games blueprint, step 3: Generate scripts & Play test
  const [activeStep, setActiveStep] = useState<number>(1);
  const [step2ViewMode, setStep2ViewMode] = useState<'table' | 'cards' | 'raw'>('cards');
  const [rawBlueprintData, setRawBlueprintData] = useState<string>("");
  const [aiMeta, setAiMeta] = useState<{ model: string; provider: string; systemInstruction: string; userPrompt: string; callTime?: string; status?: 'success' | 'fail' } | null>(null);
  
  // AI Agent Conversation logs
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "agent",
      text: language === "en" 
        ? "Hello! I'm your **AI Game Course Planner**. 🧙‍♂️\n\nI can help you transform any boring **PDF textbook/paper** into a complete set of **fun themed interactive games**.\n\nPlease select a **classic course template** I've prepared on the right to start, or drag and drop your **PDF textbook** for me to analyze and architect the game levels!"
        : "您好！我是您的 **AI 游戏课件规划师**。🧙‍♂️\n\n我可以帮您将任何枯燥的**PDF课本/论文**转换成一整套**趣味盎然的主题探索互动游戏**。\n\n请在右侧选择一个我为您准备的**经典课程模版**开始体验，或者直接拖放您的 **PDF 课本文件**，由我来进行人工智能解析与游戏关卡架构！",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: "text"
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Loaded Book Metadata
  const [bookTitle, setBookTitle] = useState<string>("");
  const [bookContentText, setBookContentText] = useState<string>("");
  const [directoryItems, setDirectoryItems] = useState<DirectoryItem[]>([]);
  const [bookInputMode, setBookInputMode] = useState<'toc' | 'text'>('toc');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  // Blueprint / Syllabus Data
  const [modules, setModules] = useState<BookModule[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string>("");
  const [hasSavedModules, setHasSavedModules] = useState<boolean>(false);

  // Step 3 States: Active Simulator and script code export
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [scriptGenerating, setScriptGenerating] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'original' | 'edit'>('simulator');
  const [showModelManagement, setShowModelManagement] = useState<boolean>(false);
  const [showApiDrawer, setShowApiDrawer] = useState<boolean>(false);
  const [showSliceSettings, setShowSliceSettings] = useState<boolean>(false);
  const [apiDebugInfo, setApiDebugInfo] = useState<{
    model: string;
    systemPrompt: string;
    userPrompt: string;
    status: 'idle' | 'calling' | 'success' | 'error';
    rawResponse: string;
    timestamp: string;
  }>({
    model: 'deepseek-v4-flash',
    systemPrompt: '',
    userPrompt: '',
    status: 'idle',
    rawResponse: '',
    timestamp: ''
  });

  // Step 5 API debug state
  const [showAppApiDrawer, setShowAppApiDrawer] = useState<boolean>(false);
  const [appApiDebugInfo, setAppApiDebugInfo] = useState<{
    model: string;
    systemPrompt: string;
    userPrompt: string;
    status: 'idle' | 'calling' | 'success' | 'error';
    rawResponse: string;
    timestamp: string;
  }>({
    model: 'deepseek-v4-flash',
    systemPrompt: '你是一个顶级的全栈工程师，必须输出可直接运行的完整代码，注重UI美感和交互细节，如果代码被截断要主动重试。只需要输出代码，不需要解释文字。',
    userPrompt: '',
    status: 'idle',
    rawResponse: '',
    timestamp: ''
  });
  const [scriptCopySuccess, setScriptCopySuccess] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [recommendingId, setRecommendingId] = useState<string | null>(null);
  const [extractedContent, setExtractedContent] = useState<string>("");
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [extractingModuleId, setExtractingModuleId] = useState<string | null>(null);
  const [extractedModules, setExtractedModules] = useState<Record<string, string>>({});
  const [moduleImages, setModuleImages] = useState<Record<string, ExtractedImage[]>>({});
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  
  // Style guide demo content
  const styleGuideDemo = `# 一级标题示例

## 二级标题示例

### 三级标题示例

#### 四级标题示例

这是一段普通段落文本。段落之间会有适当的间距。这是**加粗文字**的示例，这是*斜体文字*的示例。

---

### 表格示例

| 阶段 | 情感发展 | 行为表现 |
|---|---|---|
| 三岁 | 他们对情绪的控制能力很弱。 | 如果看到有趣的东西会笑，如果难过或生气会哭。 |
| 四岁 | 他们开始理解情绪爆发与负面后果之间的联系。 | 他们开始减少发脾气。 |
| 五岁 | 他们展现出更好的情绪调节能力。 | 他们开始毫无困难地表达自己的感受。 |

---

### 列表示例

**无序列表：**
- 第一项内容
- 第二项内容
- 第三项内容

**有序列表：**
1. 第一步
2. 第二步
3. 第三步

---

### 代码示例

行内代码：\`const x = 42;\`

代码块：
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

---

> 这是一个引用块示例。引用块通常用于强调重要内容或引用他人话语。
`;

  // Step 4 States: UI Preference and App Generation
  const [uiTheme, setUiTheme] = useState<'minimal' | 'cyberpunk' | 'cartoon' | 'retro'>('minimal');
  const [primaryColor, setPrimaryColor] = useState<string>('#06b6d4');
  const [isGeneratingApp, setIsGeneratingApp] = useState(false);
  const [finalCode, setFinalCode] = useState<string>('');
  const [appModel, setAppModel] = useState<string>('deepseek-v4-flash');
  const [outputTab, setOutputTab] = useState<'code' | 'preview'>('preview');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Step 5 States: Slice selection for app building
  const [selectedStep5ModuleId, setSelectedStep5ModuleId] = useState<string | null>(null);
  const [moduleAppCodes, setModuleAppCodes] = useState<Record<string, string>>({}); // moduleId -> generated code
  const [moduleGenerating, setModuleGenerating] = useState<Record<string, boolean>>({}); // moduleId -> is generating

  // Helper functions to flatten new object types to strings for UI display
  const getSummaryText = (summary: BookModule['summary']): string => {
    if (typeof summary === 'string') return summary;
    if (summary && typeof summary === 'object') {
      const learnedPoints = (summary as SummaryInfo).learnedPoints || [];
      const practicalProblems = (summary as SummaryInfo).practicalProblems || [];
      return [...learnedPoints, ...practicalProblems].join('\n');
    }
    return '';
  };

  const getInfoDensityText = (infoDensity: BookModule['infoDensity']): string => {
    if (typeof infoDensity === 'string') return infoDensity || '';
    if (infoDensity && typeof infoDensity === 'object') {
      const d = infoDensity as InfoDensity;
      return language === "en" ? `Concepts: ${d.conceptCount}, Facts: ${d.factCount}, Abstraction: ${d.abstractLevel}, Nesting: ${d.nestingLevel || 'None'}, Suggested: ${d.suggestedMinutes || '10-15'}\n${d.rationale}` : `概念数: ${d.conceptCount}, 事实数: ${d.factCount}, 抽象度: ${d.abstractLevel}, 嵌套: ${d.nestingLevel || '无'}, 建议时长: ${d.suggestedMinutes || '10-15'}\n${d.rationale}`;
    }
    return '';
  };

  const getCohesionText = (cohesionDetail: BookModule['cohesionDetail']): string => {
    if (typeof cohesionDetail === 'string') return cohesionDetail || '';
    if (cohesionDetail && typeof cohesionDetail === 'object') {
      const c = cohesionDetail as CohesionDetail;
      return language === "en" ? `Type: ${c.cohesionType}\nCore Question: ${c.coreQuestion}\n${c.mechanism}` : `类型: ${c.cohesionType}\n核心问题: ${c.coreQuestion}\n${c.mechanism}`;
    }
    return '';
  };

  const sliceSystemPrompt = `你是一名为教师/课程设计者提供服务的教学切片专家。我将给你一本书的目录，请你帮我将其切分成多个教学切片，每个切片用于后续设计互动内容。
 
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
输出必须是有效的纯 JSON，不要包含注释或额外文字`;

  const sliceUserPromptTemplate = `请为以下书籍进行教学切片，书籍名称："{{bookTitle}}"。

{{directoryText}}

请严格按照上述目录结构进行切片，只使用我提供的书名和目录信息，不要使用你训练数据中的任何其他课本内容。

⚠️ 关于 coveredChapters 字段的特别提醒：
1. 目录采用手风琴层级结构，例如 Topic 3 下面可能有 3.1、3.2、3.3...3.7，但可能没有 3.8 或 3.9。你在填写 coveredChapters 时，必须先确认目录中实际存在哪些章节编号，只能使用目录中真实存在的章节！
2. 注意多层级编号的区别：如果 3.1 下面有子章节 3.1.1、3.1.2...3.1.5，你想覆盖这些子章节时，coveredChapters 必须写成 "3.1.1-3.1.5"，绝对不能写成 "3.1-3.5"（这表示的是 3.1、3.2、3.3、3.4、3.5 五个同级章节）！
3. 填写前请先确认你要覆盖的章节在目录中的完整编号，然后把完整编号写进 coveredChapters。`;

  const simulationBlueprintSystemPrompt = `你是一名“教学模拟产品设计师 + 互动学习脚本架构师”。

你的任务不是生成 quiz、选择题、判断题、填空题、题库、剧情问答或换皮闯关。
你的任务是把一个教学切片转化为一份可交给 AI coding agent 实现的“可视化、沉浸式、问题驱动的互动模拟器生成脚本”。

核心原则：
1. 每个模拟必须围绕一个综合问题场景。学生进入具体情境，扮演具体角色，面对必须使用本切片知识才能解决的任务。
2. 互动必须是“应用知识干预场景”，不是“回忆知识回答问题”。学生应观察场景、调整变量、选择策略、安排步骤、诊断原因、分配资源、预测后果或优化方案。
3. 知识点必须变成场景机制。切片中的概念、关系、流程、判断标准必须映射为可观察对象、状态变量、用户操作、反馈规则、成功/失败条件。
4. 反馈必须体现因果。每次操作后的反馈要说明场景发生了什么变化、为什么会这样、对应教材中的哪个机制、下一步应如何调整。
5. 视觉设计要服务教学内容。不同学科应生成不同模拟形态，例如应急处置、课堂/角色实践、变量实验室、诊断决策、系统优化、流程搭建、情境推理、证据研判等。不要套用固定玩法模板。

输出要求：
- 使用中文。
- 输出结构化 Markdown，不要输出 JSON，不要输出代码。
- 这份 Markdown 将被 AI coding agent 直接用来生成网页应用，所以必须具体、可实现、可渲染、可编辑。
- 必须包含页面布局、主要组件、场景对象、状态变量、交互阶段、操作反馈、知识机制解释和完成条件。`;


  // Playable interactive Game Session state for active simulator
  const [gameSession, setGameSession] = useState<GameSessionState>({
    currentChallengeIndex: 0,
    selectedOption: null,
    textAnswer: "",
    score: 0,
    showFeedback: false,
    isCorrect: false,
    isCompleted: false,
    userMatches: {}
  });

  // Client-side PDF worker loading states & Custom PDF variables
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pdfPagesText, setPdfPagesText] = useState<string[]>([]);
  const [pdfExtractionProgress, setPdfExtractionProgress] = useState<string>("");
  const [pdfReaderLoading, setPdfReaderLoading] = useState<boolean>(false);
  const [pdfPageOffset, setPdfPageOffset] = useState<number>(0);
  const [pdfData, setPdfData] = useState<string | null>(null);

  // Project Management State
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<any[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [savedScripts, setSavedScripts] = useState<Record<string, any>>({});

  // 统一的 pdfPageOffset 修改入口：同时更新 React state 和 DB
  // 此前手动 +/- 调整只更新 state，后端 orchestrator 读取 DB 旧值 → 自动模式 extract 页码偏移错误
  const changePdfPageOffset = useCallback((newOffset: number) => {
    setPdfPageOffset(newOffset);
    if (currentProjectId) {
      fetch(`/api/projects/${currentProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfPageOffset: newOffset }),
      }).catch(err => console.error("Failed to save pdfPageOffset:", err));
    }
  }, [currentProjectId]);
  const [showProjectList, setShowProjectList] = useState<boolean>(false);
  const [automationJobId, setAutomationJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"steps" | "task-manager">("steps");
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  // 编辑项目名称（复用 NewProjectModal 的编辑模式）
  const [editingProject, setEditingProject] = useState<{ id: string; name: string } | null>(null);
  // 后台自动化任务状态：当用户最小化 TaskManager 后，轮询 job 状态用于全局指示器展示
  const [backgroundJob, setBackgroundJob] = useState<AutomationJob | null>(null);

  // 项目内容锁定：自动任务执行中（running / paused）时，前端禁用关键写操作
  // 配合后端 projectWriteLock 中间件（409 兜底），避免双入口并发写入冲突
  // 注：task-manager 视图不显示锁定提示（用户在看任务进度本身），但状态仍保留供切换视图时立即生效
  const isProjectLocked = !!(backgroundJob && (backgroundJob.status === "running" || backgroundJob.status === "paused"));

  // Ref pointers for list scroll anchors
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat log to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // 进入第三步时，自动批量提取所有切片的原文内容（有缓存，不重复提取）
  // 注意：自动模式下由 orchestrator 负责 extract，前端跳过，避免双重提取导致冲突与灰屏
  const batchExtractingRef = useRef(false);

  // 后台任务轮询：当不在 TaskManager 视图时，轮询 automation job 状态用于全局指示器
  useEffect(() => {
    if (!automationJobId) {
      setBackgroundJob(null);
      return;
    }
    // 在 TaskManager 视图时由 SSE 实时更新，无需轮询
    if (viewMode === "task-manager" && currentProjectId) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/automation/${automationJobId}/status`);
        if (!res.ok) return;
        const snap = await res.json();
        if (cancelled) return;
        if (snap.job) setBackgroundJob(snap.job);
      } catch { /* ignore transient errors */ }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [automationJobId, viewMode, currentProjectId]);

  useEffect(() => {
    // 有活跃自动化任务时由后端 orchestrator 处理 extract，前端跳过避免并发
    if (automationJobId) return;
    if (activeStep !== 3 || !pdfData || modules.length === 0 || batchExtractingRef.current) return;

    const extractAll = async () => {
      batchExtractingRef.current = true;
      for (const mod of modules) {
        // 已缓存的跳过
        if (extractedModules[mod.id]) continue;

        setExtractingModuleId(mod.id);
        try {
          const result = await getExtractedTextForModuleAsync(
            mod, directoryItems, bookContentText,
            pdfData,
            pdfPagesText.length > 0 ? pdfPagesText : undefined,
            pdfPageOffset,
            undefined,
            currentProjectId
          );
          setExtractedModules(prev => ({ ...prev, [mod.id]: result.extractedOriginalText }));
          
          // 保存图片信息
          if (result.extractedImages && result.extractedImages.length > 0) {
            setModuleImages(prev => ({ ...prev, [mod.id]: result.extractedImages! }));
          }

          // 保存到数据库
          if (currentProjectId) {
            fetch(`/api/projects/${currentProjectId}/extracted`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ moduleId: mod.id, content: result.extractedOriginalText })
            }).catch(err => console.error(language === "en" ? "Failed to save extracted content:" : "保存提取内容失败:", err));
          }
        } catch (err) {
          setExtractedModules(prev => ({ ...prev, [mod.id]: language === "en" ? `⚠️ Extraction failed: ${(err as Error).message}` : `⚠️ 提取失败: ${(err as Error).message}` }));
        } finally {
          setExtractingModuleId(prev => prev === mod.id ? null : prev);
        }
      }
      batchExtractingRef.current = false;
    };

    extractAll();
  }, [activeStep, pdfData, modules, currentProjectId, automationJobId]);

  // 当切换选中模块时，从缓存中读取原文内容和图片
  useEffect(() => {
    if (activeModuleId && extractedModules[activeModuleId]) {
      setExtractedContent(extractedModules[activeModuleId]);
      setExtractedImages(moduleImages[activeModuleId] || []);
    } else if (activeModuleId && !extractingModuleId) {
      setExtractedContent(language === "en" ? "⏳ Extracting..." : "⏳ 正在提取中...");
      setExtractedImages([]);
    }
  }, [activeModuleId, extractedModules, extractingModuleId, moduleImages]);

  // Load template helper
  const handleSelectTemplate = (id: string) => {
    const template = TEMPLATE_BOOKS.find(b => b.id === id);
    if (template) {
      setSelectedTemplateId(id);
      setBookTitle(template.title);
      setBookContentText(template.content);
      setDirectoryItems(parseTextToDirectory(template.content));
      setPdfFileName(""); // reset custom pdf
      
      const briefAgentText = language === "en"
        ? `Loaded template textbook: **${template.title}** (${template.subject}).\n\nThis is a learning material covering rich knowledge points. Please click the fixed **"✨ Smart Textbook Content Slicing"** button below to start intelligent splitting! I will customize a fun interactive learning model for it.`
        : `已载入模板课本：**${template.title}** (${template.subject})。\n\n这是一部涵盖丰富知识点的学习材料。请点击底下固定的 **"✨ 教材内容智能切片"** 按钮开展智能拆分！我将为它量身定做趣味互动学习模型。`;
      addAgentMessage(briefAgentText);
    }
  };

  // Helper additions for chat history
  // 模块级自增计数器，避免同毫秒生成的消息 id 重复（Date.now() 精度不足）
  const messageSeqRef = useRef(0);
  const nextMsgId = (prefix: "user" | "agent") => `${prefix}-${Date.now()}-${++messageSeqRef.current}`;

  const addUserMessage = (text: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { id: nextMsgId("user"), sender: "user", text, timestamp };
    setMessages(prev => [...prev, userMsg]);
  };

  const addAgentMessage = (text: string, type: 'text' | 'blueprint_ready' | 'script_ready' = 'text', metadata?: any) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const agentMsg: Message = { id: nextMsgId("agent"), sender: "agent", text, timestamp, type, metadata };
    setMessages(prev => [...prev, agentMsg]);
  };

  // Load project list from server
  const loadProjectList = useCallback(async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const projects = await response.json();
        setProjectList(projects);
        return projects;
      }
    } catch (err) {
      console.error("Failed to load project list:", err);
    }
    return [];
  }, []);

  // 返回首页：清空当前项目，回到 HomeView
  const handleBackHome = useCallback(() => {
    setCurrentProjectId(null);
    setViewMode("steps");
    setActiveStep(1);
    // 清空当前项目的临时状态，避免下次进入时残留
    setBookTitle("");
    setPdfFileName("");
    setPdfData(null);
    setBookContentText("");
    setDirectoryItems([]);
    setModules([]);
    setExtractedModules({});
    setMessages([]);
  }, []);

  // 把 projectList 映射为 HomeView 所需的结构（带 slice/script/app 计数）
  const homeProjects: HomeProject[] = useMemo(() => {
    return projectList.map(p => {
      let sliceCount = 0;
      try {
        if (p.modules) {
          const parsed = JSON.parse(p.modules);
          if (Array.isArray(parsed)) sliceCount = parsed.length;
        }
      } catch { /* ignore */ }
      return {
        id: p.id,
        name: p.name || "",
        bookTitle: p.bookTitle,
        pdfFileName: p.pdfFileName,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        sliceCount: typeof p.sliceCount === "number" ? p.sliceCount : sliceCount,
        scriptCount: typeof p.scriptCount === "number" ? p.scriptCount : 0,
        appCount: typeof p.appCount === "number" ? p.appCount : 0,
        automationStatus: p.automationStatus ?? null,
      };
    });
  }, [projectList]);

  // Load a specific project
  const loadProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error("Failed to load project");
      }
      const project = await response.json();

      setCurrentProjectId(projectId);
      // 切换项目时先清空旧 automation job 状态，避免残留上一个项目的任务引用
      setAutomationJobId(null);
      setBookTitle(project.bookTitle || project.name || "");
      setBookContentText(project.bookContentText || "");
      setPdfFileName(project.pdfFileName || "");
      setPdfData(project.pdfData || null);
      // 视图不再按 executionMode 决定：默认进 steps，若有活跃 job 则进 task-manager
      setPdfPageOffset(typeof project.pdfPageOffset === "number" ? project.pdfPageOffset : 0);
      setProjectInfo({
        id: project.id,
        name: project.name || "",
        bookTitle: project.bookTitle || "",
        pdfFileName: project.pdfFileName || "",
        createdAt: project.createdAt || "",
      });

      // 恢复活跃的 automation job：若该项目有 running/paused 任务，自动恢复 automationJobId
      // 这样进入 TaskManager 时无需再点「开始自动生成」按钮，直接显示进度
      const latestJob = project.latestJob;
      if (latestJob && (latestJob.status === "running" || latestJob.status === "paused")) {
        setAutomationJobId(latestJob.id);
        // 同步初始化 backgroundJob，确保从 steps 视图进入时 isProjectLocked 立即生效
        setBackgroundJob(latestJob);
        // 有活跃任务直接进任务看板
        setViewMode("task-manager");
      } else {
        // 项目无活跃任务：清空 backgroundJob，避免上个项目的状态残留导致误锁
        setBackgroundJob(null);
        setViewMode("steps");
      }

      if (project.directoryItems) {
        try {
          const parsed = JSON.parse(project.directoryItems);
          setDirectoryItems(parsed);
        } catch (e) {
          console.error("Failed to parse directory items:", e);
        }
      }

      let parsedModules: any[] = [];

      if (project.modules) {
        try {
          parsedModules = JSON.parse(project.modules);
          if (Array.isArray(parsedModules) && parsedModules.length > 0) {
            setModules(parsedModules);
            setActiveStep(2);
          }
        } catch (e) {
          console.error("Failed to parse modules:", e);
        }
      } else {
        setModules([]);
      }

      if (project.aiMeta) {
        try {
          const parsedAiMeta = JSON.parse(project.aiMeta);
          setAiMeta(parsedAiMeta);
        } catch (e) {
          console.error("Failed to parse aiMeta:", e);
        }
      }

      if (project.rawBlueprintData) {
        setRawBlueprintData(project.rawBlueprintData);
      }

      const scriptsResponse = await fetch(`/api/projects/${projectId}/scripts`);
      if (scriptsResponse.ok) {
        const scripts = await scriptsResponse.json();
        const scriptsMap: Record<string, any> = {};
        scripts.forEach((s: any) => {
          try {
            scriptsMap[s.moduleId] = JSON.parse(s.script);
          } catch (e) {
            scriptsMap[s.moduleId] = s.script;
          }
        });
        setSavedScripts(scriptsMap);

        // Merge scripts back into modules
        if (scripts.length > 0) {
          setModules(prev => prev.map(m => {
            const script = scriptsMap[m.id];
            if (script) {
              if (script.kind === "simulation_blueprint_markdown" || script.markdown) {
                return { ...m, scriptStatus: 'completed' as const, simulationScript: script };
              }
              return { ...m, scriptStatus: 'completed' as const, script };
            }
            return m;
          }));
        }
      }

      // 加载已保存的提取内容
      const extractedResponse = await fetch(`/api/projects/${projectId}/extracted`);
      if (extractedResponse.ok) {
        const extracted = await extractedResponse.json();
        const extractedMap: Record<string, string> = {};
        extracted.forEach((e: any) => {
          extractedMap[e.moduleId] = e.content;
        });
        setExtractedModules(extractedMap);
      }

      // 加载已保存的App代码
      const appCodeMap: Record<string, string> = {};
      const modsToLoad = parsedModules.length > 0 ? parsedModules : modules;
      for (const mod of modsToLoad) {
        try {
          const codeResponse = await fetch(`/api/projects/${projectId}/app-code/${mod.id}`);
          if (codeResponse.ok) {
            const codeData = await codeResponse.json();
            if (codeData.code) {
              appCodeMap[mod.id] = extractValidHtml(codeData.code);
            }
          }
        } catch {}
      }
      setModuleAppCodes(appCodeMap);

      let msg = language === "en" ? `📂 **Loaded project: ${project.name}**\n\n` : `📂 **已加载项目：${project.name}**\n\n`;
      if (project.pdfFileName) msg += language === "en" ? `📄 PDF: ${project.pdfFileName}\n` : `📄 PDF：${project.pdfFileName}\n`;
      if (project.bookTitle) msg += language === "en" ? `📖 Textbook: 《${project.bookTitle}》\n` : `📖 教材：《${project.bookTitle}》\n`;
      if (project.directoryItems) {
        try {
          const dirs = JSON.parse(project.directoryItems);
          msg += language === "en" ? `📑 Directory: ${Array.isArray(dirs) ? dirs.length : 0} chapters\n` : `📑 目录：${Array.isArray(dirs) ? dirs.length : 0} 个章节节点\n`;
        } catch {}
      }
      if (project.modules) {
        try {
          const mods = JSON.parse(project.modules);
          if (Array.isArray(mods) && mods.length > 0) {
            msg += language === "en" ? `🧩 Planning outline: ${mods.length} slices\n` : `🧩 策划大纲：${mods.length} 个切片\n`;
          }
        } catch {}
      }
      msg += language === "en" ? `\nYou can continue your previous editing work.` : `\n您可以继续之前的编辑工作。`;
      try { addAgentMessage(msg); } catch (e) { console.error("addAgentMessage error:", e); }

      setShowProjectList(false);
    } catch (err) {
      console.error("Failed to load project:", err);
      // 即使出错，如果数据已经加载成功，不显示错误提示
      if (!bookTitle && !modules.length) {
        alert(language === "en" ? "Failed to load project, please try again." : "加载项目失败，请重试。");
      }
    }
  }, [addAgentMessage]);

  // Create a new project
  const createNewProject = useCallback(async (
    name: string,
    pdfFile?: string,
    pdfDataVal?: string,
    bTitle?: string,
    bContent?: string,
    dirItems?: any[],
    mods?: any[],
    aiMetaVal?: typeof aiMeta,
    rawBlueprintVal?: string
  ) => {
    console.log("🔵 createNewProject called:", name);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          pdfFileName: pdfFile,
          pdfData: pdfDataVal,
          bookTitle: bTitle || "",
          bookContentText: bContent || "",
          directoryItems: dirItems ? JSON.stringify(dirItems) : "",
          modules: mods ? JSON.stringify(mods) : "",
          aiMeta: aiMetaVal ? JSON.stringify(aiMetaVal) : "",
          rawBlueprintData: rawBlueprintVal || ""
        })
      });
      console.log("📡 createNewProject response status:", response.status);
      if (!response.ok) {
        throw new Error("Failed to create project");
      }
      const project = await response.json();
      console.log("✅ Project created:", project);
      setCurrentProjectId(project.id);
      // Force refresh project list
      await loadProjectList();
      return project;
    } catch (err) {
      console.error("❌ Failed to create project:", err);
      throw err;
    }
  }, [loadProjectList]);

  // NewProjectModal 创建完成回调
  const handleNewProjectCreated = useCallback(async (result: NewProjectResult) => {
    setShowNewProjectModal(false);
    setCurrentProjectId(result.projectId);
    setBookTitle(result.bookTitle);
    setBookContentText(result.bookContentText);
    setDirectoryItems(result.directoryItems);
    setPdfFileName(result.pdfFileName);
    setPdfData(result.pdfData);
    setPdfPagesText(result.pdfPagesText);
    setPdfPageOffset(result.pdfPageOffset);
    setModules([]); // 新建项目无切片
    setProjectInfo({
      id: result.projectId,
      name: result.bookTitle || "",
      bookTitle: result.bookTitle || "",
      pdfFileName: result.pdfFileName || "",
      createdAt: new Date().toISOString(),
    });
    setActiveStep(1); // Preview 步骤：创建后停在预览页，由用户点"下一步"触发后续流程

    // 持久化 pdfPageOffset 到 DB，后端 orchestrator 读取后用于自动模式 extract 页码对齐
    if (result.projectId && typeof result.pdfPageOffset === "number") {
      fetch(`/api/projects/${result.projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfPageOffset: result.pdfPageOffset }),
      }).catch(err => console.error("Failed to save pdfPageOffset:", err));
    }

    // 新建后统一进入 steps 视图（Step 1 目录预览），用户可随时在步骤中启动自动化
    setViewMode("steps");
    await loadProjectList();
  }, [loadProjectList]);

  // Save current project state
  const saveCurrentProject = useCallback(async (overrideModules?: any[], overrideAiMeta?: typeof aiMeta, overrideRawBlueprint?: string) => {
    if (!currentProjectId) return;
    try {
      const modulesToSave = overrideModules || modules;
      const aiMetaToSave = overrideAiMeta || aiMeta;
      const rawBlueprintToSave = overrideRawBlueprint || rawBlueprintData;
      console.log("💾 saveCurrentProject: saving", {
        projectId: currentProjectId,
        modulesCount: modulesToSave.length,
        directoryItemsCount: directoryItems.length
      });
      const response = await fetch(`/api/projects/${currentProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookTitle,
          bookContentText,
          directoryItems: JSON.stringify(directoryItems),
          modules: JSON.stringify(modulesToSave),
          pdfFileName,
          pdfData,
          aiMeta: aiMetaToSave ? JSON.stringify(aiMetaToSave) : "",
          rawBlueprintData: rawBlueprintToSave || ""
        })
      });
      console.log("✅ saveCurrentProject: response status", response.status);
    } catch (err) {
      console.error("Failed to save project:", err);
    }
  }, [currentProjectId, bookTitle, bookContentText, directoryItems, modules, pdfFileName, pdfData, aiMeta, rawBlueprintData]);

  // Save script to project
  const saveScriptToProject = useCallback(async (moduleId: string, script: any) => {
    if (!currentProjectId) return;
    try {
      await fetch(`/api/projects/${currentProjectId}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, script })
      });
      setSavedScripts(prev => ({ ...prev, [moduleId]: script }));
    } catch (err) {
      console.error("Failed to save script:", err);
    }
  }, [currentProjectId]);

  // Delete a project
  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to delete this project? This cannot be undone." : "确定要删除这个项目吗？此操作不可撤销。")) return;
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (response.ok) {
        await loadProjectList();
        if (currentProjectId === projectId) {
          setCurrentProjectId(null);
          setModules([]);
          setBookTitle("");
          setBookContentText("");
          setDirectoryItems([]);
          setSavedScripts({});
        }
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  }, [currentProjectId, loadProjectList]);

  // Toggle project selection for batch operations
  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  }, []);

  // Select all projects
  const selectAllProjects = useCallback(() => {
    if (selectedProjects.size === projectList.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projectList.map(p => p.id)));
    }
  }, [projectList, selectedProjects.size]);

  // Batch delete selected projects
  const handleBatchDelete = useCallback(async () => {
    if (selectedProjects.size === 0) return;
    if (!confirm(language === "en" ? `Are you sure you want to delete the selected ${selectedProjects.size} projects? This cannot be undone.` : `确定要删除选中的 ${selectedProjects.size} 个项目吗？此操作不可撤销。`)) return;
    
    try {
      // Delete all selected projects
      const promises = Array.from(selectedProjects).map(id => 
        fetch(`/api/projects/${id}`, { method: "DELETE" })
      );
      
      const responses = await Promise.all(promises);
      const successfulDeletions = responses.filter(res => res.ok).length;
      
      if (successfulDeletions > 0) {
        // Remove from current project if it was selected
        if (Array.from(selectedProjects).includes(currentProjectId || "")) {
          setCurrentProjectId(null);
          setModules([]);
          setBookTitle("");
          setBookContentText("");
          setDirectoryItems([]);
          setSavedScripts({});
        }
        
        await loadProjectList();
        setSelectedProjects(new Set()); // Clear selection after deletion
      }
    } catch (err) {
      console.error("Failed to batch delete projects:", err);
    }
  }, [selectedProjects, currentProjectId, loadProjectList]);

  // Load project list on mount
  useEffect(() => {
    loadProjectList();
  }, [loadProjectList]);

  // Saved modules storage key
  const SAVED_MODULES_KEY = `book-to-game-saved-modules-${bookTitle || 'default'}`;

  // Check if there are saved modules on mount and when bookTitle changes
  useEffect(() => {
    const saved = localStorage.getItem(`book-to-game-saved-modules-${bookTitle || 'default'}`);
    setHasSavedModules(!!saved);
  }, [bookTitle]);

  // Save modules to localStorage
  const saveModulesToStorage = useCallback(() => {
    if (modules.length === 0) {
      alert(language === "en" ? "No modules to save!" : "当前没有可保存的切片数据！");
      return;
    }
    try {
      const modulesJson = JSON.stringify(modules);
      localStorage.setItem(SAVED_MODULES_KEY, modulesJson);
      setHasSavedModules(true);
      alert(language === "en" ? `✅ Successfully saved ${modules.length} modules! Saved modules will be prioritized next time.` : `✅ 已成功保存 ${modules.length} 个切片！下次加载将优先使用保存的切片。`);
    } catch (err) {
      console.error(language === "en" ? "Failed to save modules:" : "保存切片失败:", err);
      alert(language === "en" ? "Failed to save modules, please check browser storage space." : "保存切片失败，请检查浏览器存储空间。");
    }
  }, [modules, SAVED_MODULES_KEY]);

  // Load modules from localStorage
  const loadModulesFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(SAVED_MODULES_KEY);
      if (!saved) {
        alert(language === "en" ? "No saved modules found." : "没有找到已保存的切片数据。");
        return false;
      }
      const parsedModules: BookModule[] = JSON.parse(saved);
      if (!Array.isArray(parsedModules) || parsedModules.length === 0) {
        alert(language === "en" ? "Invalid saved module data format." : "保存的切片数据格式无效。");
        return false;
      }
      setModules(parsedModules);
      setActiveStep(2);
      addAgentMessage(
        language === "en"
          ? `📂 **Loaded saved slice plan!**\n\nRestored **${parsedModules.length} core teaching units** from local storage:\n` +
            parsedModules.map(m => ` - **${m.sliceId || m.chapterIndex} ${m.title}**: ${typeof m.summary === 'string' ? m.summary : (m.summary as any)?.learnedPoints?.[0] || 'Core concept'}`).join("\n") +
            `\n\nYou can directly use these slices to continue, or click "🔄 Re-AI Slice" to generate a new plan.`
          : `📂 **已加载保存的切片方案！**\n\n已从本地存储中恢复了 **${parsedModules.length} 个核心教学单元**：\n` +
            parsedModules.map(m => ` - **${m.sliceId || m.chapterIndex} ${m.title}**: ${typeof m.summary === 'string' ? m.summary : (m.summary as any)?.learnedPoints?.[0] || '核心概念'}`).join("\n") +
            `\n\n您可以直接使用这些切片继续后续操作，或者点击"🔄 重新 AI 切片"按钮生成新的切片方案。`
      );
      return true;
    } catch (err) {
      console.error(language === "en" ? "Failed to load modules:" : "加载切片失败:", err);
      alert(language === "en" ? "Failed to load modules, please check data format." : "加载切片失败，请检查数据格式。");
      return false;
    }
  }, [SAVED_MODULES_KEY, addAgentMessage]);

  // Client Custom PDF File Loader logic
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert(language === "en" ? "Please upload a valid PDF document." : "请上传有效的 PDF 格式教材文档。");
      return;
    }

    setPdfFileName(file.name);
    setBookTitle(file.name.replace(/\.[^/.]+$/, ""));
    setPdfReaderLoading(true);
    setPdfExtractionProgress(language === "en" ? "Mounting PDF parser and extracting text data..." : "正在挂载 PDF 解析器并提取文本数据...");

    const fileReader = new FileReader();
    fileReader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
        
        // Safely extract text utilizing client-side CDN pdf.js
        const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
        if (!pdfjsLib) {
          throw new Error(language === "en" ? "PDF.js script failed to load in time, please try refreshing." : "PDF.js 脚本未能在本容器内及时加载，请尝试刷新。");
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        
        setPdfExtractionProgress(language === "en" ? `Parsing PDF (${totalPages} pages)...` : `正在解析 PDF (共 ${totalPages} 页)...`);
        
        let extractedText = "";
        const pagesTextList: string[] = [];
        // Read upper limit of 150 pages to cover full textbook chapters without causing browser lag
        const pageLimit = Math.min(totalPages, 150);
        
        for (let i = 1; i <= pageLimit; i++) {
          setPdfExtractionProgress(language === "en" ? `Extracting text and aligning page data (${i} / ${pageLimit})...` : `正在逐页提取文本及页码对齐数据 (${i} / ${pageLimit})...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map((item: any) => item.str);
          const pageText = pageStrings.join(" ");
          pagesTextList.push(pageText);
          extractedText += pageText + "\n";
        }

        if (!extractedText.trim()) {
          throw new Error(language === "en" ? "This PDF appears to be a scanned or image document and no text could be extracted. A demo simulation outline has been loaded for you." : "该 PDF 似乎是扫描版或图片文档，未能提取到物理文本。我们已为您装载演示用模拟大纲。");
        }

        setPdfPagesText(pagesTextList);
        setBookContentText(extractedText);
        const parsedOutline = parseTextToDirectory(extractedText);
        setDirectoryItems(parsedOutline);
        
        // Auto-calibrate physical-to-printed page offset based on TOC section titles
        const autoOffset = calculateAutoPageOffset(parsedOutline, pagesTextList);
        setPdfPageOffset(autoOffset);
        
        setSelectedTemplateId("");
        setPdfReaderLoading(false);
        setPdfExtractionProgress("");

        const projectName = file.name.replace(/\.[^/.]+$/, "");
        const base64Reader = new FileReader();
        base64Reader.onload = async () => {
          try {
            const dataUrl = base64Reader.result as string;
            const base64Pdf = dataUrl.split(",")[1];
            setPdfData(base64Pdf);
            
            const newProject = await createNewProject(
              projectName,
              file.name,
              base64Pdf,
              projectName,
              extractedText,
              parsedOutline,
              []
            );
            // 持久化 pdfPageOffset，后端 orchestrator 自动模式 extract 需要
            if (newProject?.id) {
              fetch(`/api/projects/${newProject.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pdfPageOffset: autoOffset }),
              }).catch(err => console.error("Failed to save pdfPageOffset:", err));
            }
            setShowProjectList(true);
            addAgentMessage(language === "en"
              ? `📦 **Successfully received your uploaded textbook eBook:**\n《${file.name}》\n\nProject **"${projectName}"** has been created and saved to the database!\n\nI have successfully read the first **${pageLimit} pages** of text in the browser terminal (about ${extractedText.length} characters), and intelligently detected that the **offset between printed pages and PDF physical pages is \`${autoOffset >= 0 ? "+" : ""}${autoOffset}\` pages**.\n\nThe system has completed noise reduction alignment and directory extraction for textbook pages. I have opened the "My Projects" list on the left for you, where you can see the newly created project. Next, please click **"✨ Smart Textbook Content Slicing"** at the bottom of the right page, and we can complete intelligent content chunking!`
              : `📦 **成功收到您上传的教材电子书：**\n《${file.name}》\n\n项目 **"${projectName}"** 已创建并保存到数据库！\n\n我已在浏览器终端成功无损读取了前 **${pageLimit} 页** 的文本（约 ${extractedText.length} 字），并智能探测出**印刷页与PDF物理页的偏差偏移量 (Offset) 为 \`${autoOffset >= 0 ? "+" : ""}${autoOffset}\` 页**。\n\n系统已对教材页面完成了降噪对齐与目录抽取。我已为您打开左侧的"我的项目"列表，您可以看到新创建的项目。接下来，请在右侧页面底部点击 **"✨ 教材内容智能切片"**，我们即可完成智能内容切块！`);
          } catch (err) {
            console.error("Failed to create project in base64Reader:", err);
            addAgentMessage(language === "en"
              ? `📦 **Successfully received your uploaded textbook eBook:**\n《${file.name}》\n\nProject **"${projectName}"** has been received and parsed, but encountered an issue when saving to the database: ${(err as Error).message || err}. You can still experience the complete teaching slice and outline design in the current session!`
              : `📦 **成功收到您上传的教材电子书：**\n《${file.name}》\n\n项目 **"${projectName}"** 已收到并完成解析，但数据库存储时遇到问题：${(err as Error).message || err}。您仍可在当前会话中体验完整教学切片与大纲设计！`);
          }
        };
        base64Reader.readAsDataURL(file);
      } catch (err: any) {
        console.error(err);
        setPdfReaderLoading(false);
        setPdfExtractionProgress("");
        // Fallback robust text injection so user isn't stuck
        const sampleText = TEMPLATE_BOOKS[0].content;
        setBookTitle(TEMPLATE_BOOKS[0].title);
        setBookContentText(sampleText);
        setDirectoryItems(parseTextToDirectory(sampleText));
        addAgentMessage(language === "en"
          ? `⚠️ **PDF Reading Reminder:** ${err.message || "Unable to silently extract due to file version or same-origin restrictions."}\n\nDon't worry! I have automatically loaded a generic **"Advanced Comprehensive Science Textbook Outline"** text as the base page for you. You can still click **"✨ Smart Textbook Content Slicing"** at the bottom of the right page to perfectly experience the full AI node design process!`
          : `⚠️ **PDF读取提醒：** ${err.message || "由于文件版本或者同源限制原因无法静默提取。"}\n\n不用担心！我已经为你自动载入了通用的**《高阶综合科学教材纲要》**文本作为底页，现在您仍然可以点击右侧页面底部 **"✨ 教材内容智能切片"**，完美体验全套 AI 节点设计流程！`);
      }
    };
    fileReader.readAsArrayBuffer(file);
  };

  // Directory editing helper functions
  const updateDirectoryItemTitle = (id: string, newTitle: string) => {
    const updated = directoryItems.map(item => {
      if (item.id === id) {
        return { ...item, title: newTitle };
      }
      return item;
    });
    setDirectoryItems(updated);
    setBookContentText(serializeDirectoryToText(updated));
  };

  const updateDirectoryItemPage = (id: string, newPage: string) => {
    const updated = directoryItems.map(item => {
      if (item.id === id) {
        return { ...item, page: newPage };
      }
      return item;
    });
    setDirectoryItems(updated);
    setBookContentText(serializeDirectoryToText(updated));
  };

  const deleteDirectoryItem = (id: string) => {
    const updated = directoryItems.filter(item => item.id !== id);
    setDirectoryItems(updated);
    setBookContentText(serializeDirectoryToText(updated));
  };

  const addDirectoryItem = (type: 'chapter' | 'section') => {
    let lastPageNum = 1;
    if (directoryItems.length > 0) {
      const lastItem = directoryItems[directoryItems.length - 1];
      const parsedPage = parseInt(lastItem.page || "1", 10);
      if (!isNaN(parsedPage)) {
        lastPageNum = parsedPage + (type === 'chapter' ? 10 : 3);
      }
    }

    const newItem: DirectoryItem = {
      id: `custom-${Date.now()}`,
      type,
      title: type === 'chapter' 
        ? `第${directoryItems.filter(i => i.type === 'chapter').length + 1}章 核心主传` 
        : `第 ${directoryItems.filter(i => i.type === 'section').length + 1} 节 核心探究分支`,
      page: String(lastPageNum),
      level: type === 'chapter' ? 1 : 2
    };

    const updated = [...directoryItems, newItem];
    setDirectoryItems(updated);
    setBookContentText(serializeDirectoryToText(updated));
  };

  // Triggering Book Splitting (API 1)
  // 彻底简化：始终使用当前选中的 bookTitle 和 directoryItems 直接调用AI
  const handleSplitBook = async (forceRegenerate: boolean = false) => {
    console.log("\n🚀 ========== HANDLE SPLIT BOOK STARTED ==========");
    console.log("📕 Current bookTitle state:", bookTitle);
    console.log("📂 Current directoryItems.length:", directoryItems.length);
    console.log("📋 First 3 directory items:", JSON.stringify(directoryItems.slice(0, 3), null, 2));
    console.log("📏 Current bookContentText.length:", bookContentText.length);
    console.log("🔧 forceRegenerate:", forceRegenerate);
    console.log("==================================================\n");

    try {
      localStorage.removeItem(SAVED_MODULES_KEY);
      localStorage.removeItem(`${SAVED_MODULES_KEY}-dir-hash`);
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }

    if (!bookTitle || !bookTitle.trim()) {
      alert(language === "en" ? "⚠️ Please select a book or upload PDF first!\n\nNo textbook name detected." : "⚠️ 请先在左侧选择一本书或上传PDF！\n\n当前未检测到课本名称。");
      return;
    }
    if (!directoryItems || directoryItems.length === 0) {
      alert(language === "en" ? "⚠️ No directory data available for this textbook!\n\nPlease confirm a textbook has been selected/uploaded on the left." : "⚠️ 当前课本没有可用的目录数据！\n\n请先确认左侧已选择/上传了课本。");
      return;
    }
    if (!bookContentText || !bookContentText.trim()) {
      alert(language === "en" ? "⚠️ Textbook content is empty!\n\nPlease re-select or upload PDF." : "⚠️ 当前课本内容为空！\n\n请重新选择或上传PDF。");
      return;
    }

    setIsParsing(true);
    setParseError("");
    setModules([]);

    // Don't reset currentProjectId - we want to update the existing project if one exists
    const existingProjectId = currentProjectId;

    addAgentMessage(
      language === "en"
        ? `🪐 Generating AI slice plan for 《${bookTitle}》...\n\n` +
          `📚 Book: ${bookTitle}\n` +
          `📂 Directory chapters: ${directoryItems.length}\n` +
          `📋 Directory preview: ${directoryItems.slice(0, 3).map(d => d.title).join(", ")}...\n\n` +
          `Analyzing directory structure with **DeepSeek V4 Flash** model, please wait 3-8 seconds...`
        : `🪐 正在为《${bookTitle}》生成 AI 切片方案...\n\n` +
          `📚 书名：${bookTitle}\n` +
          `📂 目录章节数：${directoryItems.length}\n` +
          `📋 目录预览：${directoryItems.slice(0, 3).map(d => d.title).join("、")}...\n\n` +
          `正在使用 **DeepSeek V4 Flash** 模型分析目录结构，请稍候 3-8 秒...`
    );

    // 构造API请求数据 - 完全使用当前状态值
    const requestPayload: any = {
      title: bookTitle,
      directoryStructure: directoryItems
    };

    // Fetch latest prompt from DB for smart-split
    try {
      const res = await fetch('/api/prompt-templates?aiEntry=smart-split');
      const data = await res.json();
      if (data && data.length > 0) {
        const activePrompt = data.find((p: any) => p.isActive) || data[0];
        requestPayload.systemPrompt = activePrompt.systemPrompt || undefined;
        requestPayload.userPromptTemplate = activePrompt.userPromptTemplate || undefined;
      }
    } catch (e) {
      console.warn('Failed to fetch slice prompts, using defaults');
    }

    // Set API debug calling status
    setApiDebugInfo({
      model: 'deepseek-v4-flash',
      systemPrompt: requestPayload.systemPrompt || sliceSystemPrompt,
      userPrompt: '',
      status: 'calling',
      rawResponse: '',
      timestamp: new Date().toLocaleTimeString()
    });

    // 详细日志：记录发送给AI的精确数据
    console.log("\n📤 ========== SENDING TO API ==========");
    console.log("📕 title (bookTitle):", requestPayload.title);
    console.log("📂 directoryStructure.length:", requestPayload.directoryStructure.length);
    console.log("📋 directoryStructure (first 5):", JSON.stringify(requestPayload.directoryStructure.slice(0, 5), null, 2));
    console.log("======================================\n");

    try {
      const response = await fetch("/api/parse-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || errorData?.error || (language === "en" ? `Analysis failed - Status code: ${response.status}` : `分析失败 - 状态码: ${response.status}`));
      }

      const rawResponse: any = await response.json();
      const { _meta, ...data } = rawResponse;

      if (_meta?.error || _meta?.degraded) {
        const degradedMessage = _meta?.error || (
          language === "en"
            ? "AI slicing was degraded to a local heuristic result."
            : "AI 切片调用已降级为本地启发式结果。"
        );
        setApiDebugInfo(prev => ({
          ...prev,
          model: _meta?.model || prev.model,
          systemPrompt: _meta?.systemInstruction || prev.systemPrompt,
          userPrompt: _meta?.userPrompt || prev.userPrompt,
          status: 'error',
          rawResponse: JSON.stringify(_meta, null, 2),
          timestamp: new Date().toLocaleTimeString()
        }));
        throw new Error(degradedMessage);
      }
      
      const currentAiMeta = _meta ? {
        ..._meta,
        callTime: new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'success' as const
      } : null;
      
      const currentRawBlueprint = "========== 实际发送给AI模型的 Prompt ==========\n\n" +
        "【系统指令 (System Instruction)】:\n" +
        (_meta?.systemInstruction || "无") +
        "\n\n【用户指令 (User Prompt)】:\n" +
        (_meta?.userPrompt || "无") +
        "\n\n========== AI模型返回的原始响应 ==========\n" +
        JSON.stringify(data, null, 2);
      
      if (currentAiMeta) {
        setAiMeta(currentAiMeta);
      }
      
      // Update API debug info with actual call results
      setApiDebugInfo(prev => ({
        ...prev,
        model: _meta?.model || prev.model,
        systemPrompt: _meta?.systemInstruction || prev.systemPrompt,
        userPrompt: _meta?.userPrompt || prev.userPrompt,
        status: 'success',
        rawResponse: JSON.stringify(data, null, 2).substring(0, 2000),
        timestamp: new Date().toLocaleTimeString()
      }));
      
      setRawBlueprintData(currentRawBlueprint);
      console.log("\n📥 ========== RECEIVED FROM API ==========");
      console.log("📕 bookTitle from AI:", data.bookTitle);
      console.log("📊 totalSlices from AI:", data.totalSlices);
      console.log("📋 Number of slices received:", data.slices?.length || data.modules?.length || 0);
      console.log("🔍 First slice:", JSON.stringify((data.slices || data.modules || [])[0], null, 2));
      console.log("=========================================\n");

      const rawModules = data.slices || data.modules || [];

      if (rawModules.length === 0) {
        throw new Error(language === "en" ? "AI returned empty slices, please retry or check the prompt" : "AI返回的切片为空，请重试或检查prompt");
      }

      const formattedModules: BookModule[] = rawModules.map((mod: any, index: number) => {
        const norm = (mod.title || "").toLowerCase();
        let defaultGameType: GameType = 'quiz';
        if (norm.includes("计算") || norm.includes("公式") || norm.includes("数") || norm.includes("物理") || norm.includes("数学") || norm.includes("方程") || norm.includes("量")) {
          defaultGameType = 'math-quest';
        } else if (norm.includes("代码") || norm.includes("编程") || norm.includes("逻辑") || norm.includes("算法") || norm.includes("函数") || norm.includes("脚本") || norm.includes("源") || norm.includes("程序")) {
          defaultGameType = 'coding-puzzle';
        } else if (norm.includes("概念") || norm.includes("对比") || norm.includes("分类") || norm.includes("匹配") || norm.includes("对应") || norm.includes("关联")) {
          defaultGameType = 'cross-match';
        } else if (norm.includes("故事") || norm.includes("场景") || norm.includes("抉择") || norm.includes("剧情") || norm.includes("历史") || norm.includes("悲剧")) {
          defaultGameType = 'interactive-story';
        } else if (index % 3 === 0) {
          defaultGameType = 'cross-match';
        } else if (index % 3 === 1) {
          defaultGameType = 'fill-blank';
        } else {
          defaultGameType = 'quiz';
        }

        const summaryText = typeof mod.summary === 'string'
          ? mod.summary
          : (mod.summary?.learnedPoints || []).join("；");

        const defaultGameTitle = `${mod.title}核心概念通关`;
        const defaultGameRules = `在限定时间内，通过${
          defaultGameType === 'quiz' ? '全知选择问答' :
          defaultGameType === 'cross-match' ? '核心概念匹配连线' :
          defaultGameType === 'fill-blank' ? '逻辑空格词条填充' :
          defaultGameType === 'interactive-story' ? '情境故事分支因果抉择' :
          defaultGameType === 'coding-puzzle' ? '诊断排查缺陷纠错' :
          '量化应用计算推理'
        }的形式，巩固对 [${summaryText}] 考点的系统认知。`;

        return {
          ...mod,
          id: mod.id || `mod-${index + 1}-${Date.now()}`,
          sliceId: mod.sliceId || `S${index + 1}`,
          chapterIndex: mod.chapterIndex || mod.sliceId || `S${index + 1}`,
          duration: mod.duration || (mod.infoDensity && typeof mod.infoDensity === 'object' ? (mod.infoDensity as InfoDensity).suggestedMinutes : "10-15分钟"),
          gameType: mod.gameType || defaultGameType,
          gameTitle: mod.gameTitle || defaultGameTitle,
          gameRules: mod.gameRules || defaultGameRules,
          scriptStatus: 'pending'
        };
      });

      // Update book title from response (only if we have one)
      const responseTitle = data.bookTitle || data.title || bookTitle;
      if (responseTitle && responseTitle !== bookTitle) {
        setBookTitle(responseTitle);
      }

      setModules(formattedModules);
      setIsParsing(false);
      setActiveStep(2);

      console.log("✅ Modules set successfully, count:", formattedModules.length);
      console.log("📦 handleSplitBook: existingProjectId =", existingProjectId);

      if (!existingProjectId) {
        console.log("🆕 No project ID, creating new project");
        try {
          await createNewProject(
            responseTitle || bookTitle,
            pdfFileName || "",
            pdfData || "",
            responseTitle || bookTitle,
            bookContentText,
            directoryItems,
            formattedModules,
            currentAiMeta,
            currentRawBlueprint
          );
        } catch (e) {
          console.error("Failed to create project:", e);
        }
      } else {
        console.log("💾 Project exists, updating modules to DB");
        await saveCurrentProject(formattedModules, currentAiMeta, currentRawBlueprint);
        await loadProjectList();
      }

      const moduleSummaries = formattedModules.map(m => {
        const s = typeof m.summary === 'string' ? m.summary : (m.summary as any)?.learnedPoints?.[0] || m.title;
        return ` - **${m.sliceId || m.chapterIndex} ${m.title}**: ${s}`;
      }).join("\n");

      addAgentMessage(
        language === "en"
          ? `🎉 **Subject gamification layered planning plan is ready!**\n\nI have sliced the book 《${responseTitle || bookTitle}》 into **${formattedModules.length} core teaching units**:\n` +
            moduleSummaries +
            `\n\nIn the workspace on the right, you can now **freely edit and fully correct** this set of curriculum outlines. You can modify any chapter title, or customize real conflict simulation scenarios and core gameplay specifications! Data has been automatically saved to the database.`
          : `🎉 **学科游戏化分层规划方案已制定就绪！**\n\n我已将书籍《${responseTitle || bookTitle}》细切为 **${formattedModules.length} 个核心教学单元**：\n` +
            moduleSummaries +
            `\n\n在右侧的工作区中，您现在可以对这一套课程大纲开展**自由编辑与完全订正**。您可以修改任何章节标题，或者自定义真实的冲突模拟场景及核心玩法规范！数据已自动保存到数据库中。`,
        "blueprint_ready"
      );

    } catch (err: any) {
      console.error("❌ handleSplitBook error:", err);
      setIsParsing(false);
      setParseError(err.message || (language === "en" ? "Network request timed out, please try again." : "网络请求超时，请重试。"));
      
      // Update API debug info with error
      setApiDebugInfo(prev => ({
        ...prev,
        status: 'error',
        rawResponse: `Error: ${err.message || "Unknown error"}`,
        timestamp: new Date().toLocaleTimeString()
      }));
      
      setAiMeta({
        model: aiMeta?.model || "unknown",
        provider: aiMeta?.provider || "unknown",
        systemInstruction: aiMeta?.systemInstruction || "",
        userPrompt: aiMeta?.userPrompt || "",
        callTime: new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'fail'
      });
      addAgentMessage(language === "en"
        ? `❌ **AI Slice Generation Failed**\n\nError message: ${err.message || "Unknown error"}\n\nPlease check:\n1. Whether the API Key is correctly configured in the terminal\n2. Whether the network can access the DeepSeek API\n3. Detailed error logs in the browser console`
        : `❌ **AI 切片生成失败**\n\n错误信息：${err.message || "未知错误"}\n\n请检查：\n1. 终端是否显示 API Key 配置正确\n2. 网络是否能访问 DeepSeek API\n3. 浏览器控制台的详细错误日志`);
      alert(language === "en" ? `Script generation failed: ${err.message || "Unknown error"}` : `切片生成失败：${err.message || "未知错误"}`);
    }
  };

  // API 2: Single module interactive script generator
  const handleGenerateScript = async (moduleId: string) => {
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;

    setScriptGenerating(prev => ({ ...prev, [moduleId]: true }));
    
    // Update state to generating
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, scriptStatus: 'generating' } : m));

    // Set API debug calling status
    setApiDebugInfo(prev => ({
      ...prev,
      model: 'deepseek-chat',
      systemPrompt: simulationBlueprintSystemPrompt,
      status: 'calling',
      rawResponse: '',
      timestamp: new Date().toLocaleTimeString()
    }));

    // Fetch saved prompts from DB
    let savedSystemPrompt: string | undefined;
    let savedUserPromptTemplate: string | undefined;
    try {
      const res = await fetch('/api/prompt-templates?aiEntry=script-gen');
      const data = await res.json();
      if (data && data.length > 0) {
        savedSystemPrompt = data[0].systemPrompt || undefined;
        savedUserPromptTemplate = data[0].userPromptTemplate || undefined;
      }
    } catch (e) {
      console.warn('Failed to fetch saved prompts, using defaults');
    }

    try {
      const { extractedOriginalText } = await getExtractedTextForModuleAsync(
        mod, directoryItems, bookContentText,
        pdfData,
        pdfPagesText.length > 0 ? pdfPagesText : undefined,
        pdfPageOffset,
        undefined,
        currentProjectId
      );

      const userPrompt = `Book: ${bookTitle}
Chapter: ${mod.chapterIndex} - ${mod.title}
Summary: ${mod.summary}
Info Density: ${getInfoDensityText(mod.infoDensity)}
Cohesion: ${getCohesionText(mod.cohesionDetail)}
Design Rationale: ${mod.designRationale || ""}
Extracted Content: ${extractedOriginalText.substring(0, 8000)}`;

      // Update user prompt in debug info
      setApiDebugInfo(prev => ({ ...prev, userPrompt }));

      const payload = {
        bookTitle: bookTitle,
        chapterTitle: mod.title,
        chapterIndex: mod.chapterIndex,
        summary: mod.summary,
        infoDensity: mod.infoDensity,
        cohesionDetail: mod.cohesionDetail,
        designRationale: mod.designRationale,
        extractedContent: extractedOriginalText.substring(0, 8000),
        systemPrompt: savedSystemPrompt,
        userPromptTemplate: savedUserPromptTemplate
      };

      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        setApiDebugInfo(prev => ({
          ...prev,
          status: 'error',
          rawResponse: `HTTP ${response.status}: ${errorText}`,
          timestamp: new Date().toLocaleTimeString()
        }));
        throw new Error(`Script generation request error: HTTP ${response.status} - ${errorText}`);
      }

      const rawText = await response.text();
      const responseData = JSON.parse(rawText);

      // Update API debug with raw response
      setApiDebugInfo(prev => ({
        ...prev,
        model: responseData?._meta?.model || prev.model,
        systemPrompt: responseData?._meta?.systemInstruction || prev.systemPrompt,
        userPrompt: responseData?._meta?.userPrompt || prev.userPrompt,
        status: 'success',
        rawResponse: rawText,
        timestamp: new Date().toLocaleTimeString()
      }));

      const markdown = typeof responseData.markdown === "string" ? responseData.markdown : rawText;
      
      const finishedScript: SimulationBlueprintScript = {
        id: `simulation-script-${mod.id}`,
        moduleId: mod.id,
        kind: "simulation_blueprint_markdown",
        markdown,
        generatedAt: new Date().toISOString()
      };

      setModules(prev => prev.map(m => 
        m.id === moduleId 
          ? { ...m, scriptStatus: 'completed', simulationScript: finishedScript }
          : m
      ));
      
      // Save script to database
      await saveScriptToProject(moduleId, finishedScript);
      
      setScriptGenerating(prev => ({ ...prev, [moduleId]: false }));

      // If this is the active module being viewed, initialize the play state instantly
      setActiveTab('simulator');

    } catch (err: any) {
      console.error(err);
      setScriptGenerating(prev => ({ ...prev, [moduleId]: false }));
      setModules(prev => prev.map(m => m.id === moduleId ? { ...m, scriptStatus: 'failed' } : m));
      setApiDebugInfo(prev => ({
        ...prev,
        status: 'error',
        rawResponse: prev.rawResponse || `Error: ${err.message}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    }
  };

  // Re-extract PDF text from stored PDF data if needed
  const reExtractPdfText = useCallback(async () => {
    if (!pdfData || pdfPagesText.length > 0) return;
    try {
      setPdfReaderLoading(true);
      setPdfExtractionProgress(language === "en" ? "Re-extracting text from stored PDF file..." : "正在从存储的 PDF 文件重新提取文本...");
      
      const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
      if (!pdfjsLib) {
        throw new Error(language === "en" ? "PDF.js script failed to load in time, please try refreshing." : "PDF.js 脚本未能在本容器内及时加载，请尝试刷新。");
      }
      
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      
      const binaryString = atob(pdfData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      
      setPdfExtractionProgress(language === "en" ? `Parsing PDF (${totalPages} pages)...` : `正在解析 PDF (共 ${totalPages} 页)...`);
      
      let extractedText = "";
      const pagesTextList: string[] = [];
      const pageLimit = Math.min(totalPages, 150);
      
      for (let i = 1; i <= pageLimit; i++) {
        setPdfExtractionProgress(language === "en" ? `Extracting text and aligning page data (${i} / ${pageLimit})...` : `正在逐页提取文本及页码对齐数据 (${i} / ${pageLimit})...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items.map((item: any) => item.str);
        const pageText = pageStrings.join(" ");
        pagesTextList.push(pageText);
        extractedText += pageText + "\n";
      }

      if (extractedText.trim()) {
        setPdfPagesText(pagesTextList);
        setBookContentText(extractedText);
        const parsedOutline = parseTextToDirectory(extractedText);
        setDirectoryItems(parsedOutline);
        
        const autoOffset = calculateAutoPageOffset(parsedOutline, pagesTextList);
        setPdfPageOffset(autoOffset);

        // 持久化到 DB，确保自动模式与手动模式 offset 一致
        if (currentProjectId) {
          fetch(`/api/projects/${currentProjectId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfPageOffset: autoOffset }),
          }).catch(err => console.error("Failed to save pdfPageOffset:", err));
        }
      }
      
      setPdfReaderLoading(false);
      setPdfExtractionProgress("");
    } catch (err) {
      console.error("Failed to re-extract PDF text:", err);
      setPdfReaderLoading(false);
      setPdfExtractionProgress("");
    }
  }, [pdfData, pdfPagesText.length]);

  // Transition to Phase 3 for manual curriculum review and safe segment synthesis
  const handleGenerateAllScripts = async () => {
    await reExtractPdfText();
    
    setActiveStep(3);
    setActiveTab('original'); // Set view mode to original textbook by default
    
    addAgentMessage(
      language === "en"
        ? "📋 **You have now entered Phase 3: Block-by-block textbook content review!**\n\n" +
          "To ensure seamless alignment between game levels and actual textbook exam points, we have precisely extracted/aligned the **original textbook paragraphs** for each chapter based on your selected textbook outline.\n\n" +
          "You can click the **\"📖 Original Text Mapping\"** tab below to proofread each section. Once you've confirmed the content is accurate, simply click the **\"✨ Start Simulation Synthesis\"** button to quickly build a customized game simulation script and high-quality quiz bank!"
        : "📋 **已为您进入第三阶段：分块教材内容精确审查！**\n\n" +
          "为了保障游戏关卡与实际教材考点的无缝精准对接，我们已经基于您选定的教材目录大纲，为您精准提取/对齐了每一章节的**教材原文段落**。\n\n" +
          "您可以点击下方 **「📖 教材原文映射 (Original text)」** 选项卡对每一部分原文内容进行校对。当您确定内容准确无误后，只需点击 **「✨ 开启本章仿真合成」** 按钮，即可个性化、快速构建配套的游戏仿真剧本及高水平答题库！"
    );
    
    // Pick the first module to view in Simulator
    if (modules.length > 0) {
      setActiveModuleId(modules[0].id);
    }
  };

  // Game Session state initializer/resetter
  const initGameSession = (script: GameScript) => {
    // Generate default random matches representation if matching game type
    const initialMatches: Record<string, string> = {};
    setGameSession({
      currentChallengeIndex: 0,
      selectedOption: null,
      textAnswer: "",
      score: 0,
      showFeedback: false,
      isCorrect: false,
      isCompleted: false,
      userMatches: initialMatches
    });
  };

  // Handles click on Chapter list inside Stage 3 workspace
  const handleSelectModuleForSimulator = (moduleId: string) => {
    setActiveModuleId(moduleId);
    const mod = modules.find(m => m.id === moduleId);
    if (mod && mod.script) {
      initGameSession(mod.script);
    }
    // Note: To respect user directive, clicking pending modules does not trigger automatic 
    // generation. Instead, it lets the user review original textbook texts & manually trigger generator.
  };

  // Interactively processes a user answer submission in Simulator
  const handleCheckAnswer = (challenge: GameChallenge, userAnswer: string) => {
    const isCorrect = userAnswer.toLowerCase().trim() === challenge.correctAnswer.toLowerCase().trim();
    
    // If correct, award 10 points
    const pointsAwarded = isCorrect ? 10 : 0;

    setGameSession(prev => ({
      ...prev,
      selectedOption: userAnswer,
      textAnswer: userAnswer,
      showFeedback: true,
      isCorrect,
      score: prev.score + pointsAwarded
    }));
  };

  // Next level / finish game handler
  const handleNextChallenge = (script: GameScript) => {
    const nextIndex = gameSession.currentChallengeIndex + 1;
    if (nextIndex >= script.challenges.length) {
      // Completed current module game!
      setGameSession(prev => ({
        ...prev,
        isCompleted: true,
        showFeedback: false
      }));
      
      // Update Agent companion statement to praise user
      addAgentMessage(language === "en"
        ? `🏆 **Trial Report!** Just completed the simulation test in level unit **"${modules.find(m => m.id === script.moduleId)?.title}"**, with a final score of: **${gameSession.score + (gameSession.isCorrect ? 10 : 0)} points**!\nThrough this quiz, students can immediately deepen their physical concepts for chapter difficulties. You can switch to other modules below for calibration at any time!`
        : `🏆 **试炼捷报！** 刚刚在关卡单元 **"${modules.find(m => m.id === script.moduleId)?.title}"** 中完成了仿真测试，最终斩获比分：**${gameSession.score + (gameSession.isCorrect ? 10 : 0)} 分**！\n学子们通过这套答题，能够立刻对章节的难点加深物理概念。您可以随时在下方切换其他模块进行校准！`);
    } else {
      setGameSession(prev => ({
        ...prev,
        currentChallengeIndex: nextIndex,
        selectedOption: null,
        textAnswer: "",
        showFeedback: false,
        isCorrect: false
      }));
    }
  };

  // Match item linkage handler
  const handleSelectMatchPair = (challenge: GameChallenge, concept: string, definition: string) => {
    setGameSession(prev => {
      const updated = { ...prev.userMatches, [concept]: definition };
      const isFinish = Object.keys(updated).length >= 1; // Simplify matching demo
      const isPairCorrect = definition.toLowerCase().trim() === challenge.correctAnswer.toLowerCase().trim();
      
      return {
        ...prev,
        userMatches: updated,
        selectedOption: definition,
        showFeedback: true,
        isCorrect: isPairCorrect,
        score: prev.score + (isPairCorrect ? 10 : 0)
      };
    });
  };

  // Generative QA message handler inside Chat companion
  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessageText = chatInput;
    addUserMessage(userMessageText);
    setChatInput("");
    setChatLoading(true);

    try {
      const recentConversation = messages.concat([
        { id: `temp-${Date.now()}`, sender: "user", text: userMessageText, timestamp: "" }
      ]).slice(-8); // Keep conversation short for context saving

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: recentConversation,
          currentBookTitle: bookTitle
        })
      });

      if (!response.ok) {
        throw new Error("Chat api failed");
      }

      const data = await response.json();
      setChatLoading(false);
      addAgentMessage(data.reply);

    } catch (err: any) {
      console.error(err);
      setChatLoading(false);
      addAgentMessage(language === "en"
        ? "😊 Sorry, my network microprocessor is daydreaming. But I have securely stored your teaching data in memory, you can directly select and edit on the right!"
        : "😊 抱歉，我的网络微处理器开小差了。但我已经帮您把教学数据牢牢存储在内存中了，您可以在右侧直接点选和编辑！");
    }
  };

  // Fast chat triggers
  const handlePresetSpeech = (prompt: string) => {
    setChatInput(prompt);
    // Submit in next tick safely
    setTimeout(() => {
      const btn = document.getElementById("chat-submit-btn");
      btn?.click();
    }, 50);
  };

  // Chapter editing methods
  const handleUpdateModule = (id: string, fields: Partial<BookModule>) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m));
    if (currentProjectId) {
      saveCurrentProject();
    }
  };

  // Helper updates for specific challenges inside active module script
  const handleUpdateChallengeField = (moduleId: string, chalIndex: number, field: string, value: any) => {
    setModules(prev => prev.map(m => {
      if (m.id === moduleId && m.script) {
        const updatedChallenges = [...m.script.challenges];
        updatedChallenges[chalIndex] = {
          ...updatedChallenges[chalIndex],
          [field]: value
        } as any;
        return {
          ...m,
          script: {
            ...m.script,
            challenges: updatedChallenges
          }
        };
      }
      return m;
    }));
    if (currentProjectId) {
      saveCurrentProject();
    }
  };

  const handleUpdateChallengeOption = (moduleId: string, chalIndex: number, optionIndex: number, newValue: string) => {
    setModules(prev => prev.map(m => {
      if (m.id === moduleId && m.script) {
        const updatedChallenges = [...m.script.challenges];
        const originalOpts = updatedChallenges[chalIndex].options ? [...updatedChallenges[chalIndex].options!] : ["", "", "", ""];
        originalOpts[optionIndex] = newValue;
        updatedChallenges[chalIndex] = {
          ...updatedChallenges[chalIndex],
          options: originalOpts
        };
        return {
          ...m,
          script: {
            ...m.script,
            challenges: updatedChallenges
          }
        };
      }
      return m;
    }));
  };

  const handleUpdateScriptField = (moduleId: string, field: 'introduction' | 'conclusion', value: string) => {
    setModules(prev => prev.map(m => {
      if (m.id === moduleId && m.script) {
        return {
          ...m,
          script: {
            ...m.script,
            [field]: value
          }
        };
      }
      return m;
    }));
  };

  const handleAddCustomModule = () => {
    const newIdx = `0${modules.length + 1}`.slice(-2);
    const newMod: BookModule = {
      id: `custom-mod-${Date.now()}`,
      chapterIndex: language === "en" ? `Chapter ${newIdx}` : `章节 ${newIdx}`,
      title: language === "en" ? "Custom Knowledge Theme (Custom Concept Node)" : "自拟新知识主题 (Custom Concept Node)",
      coveredChapters: `${modules.length + 1}.1`,
      summary: language === "en" ? "Conduct more exploratory and creative multimodal academic inquiry around this custom node." : "围绕该自拟节点，进行更具探索性和创造性的多模态课业考究。",
      infoDensity: language === "en" ? "Based on single-class-hour limits, refine facets to optimal self-study absorption load." : "根据单学时极限，精炼切面，负荷处在自学吸收的最佳区间内。",
      cohesionDetail: language === "en" ? "The core test point of this unit belongs to causal chain structure, highly suitable for joint inquiry and thinking internalization." : "此单元的核心考点属于因果串联结构，极其适合进行联合探究与思维内化。",
      gameType: "quiz",
      gameTitle: language === "en" ? "Knowledge Hero Duel (The Concept Duel)" : "新知识英雄决斗 (The Concept Duel)",
      gameRules: language === "en" ? "Players face multi-level academic decisions, must rely on precise logic and textbook knowledge to overcome various scientific obstacles." : "玩家面临多级学术决策，必须依靠精密的逻辑和教材知识才能克服各种科学魔障。",
      duration: language === "en" ? "10 minutes" : "10分钟",
      designRationale: language === "en" ? "Use single-player closed-loop exploration game, let learners personally make strategy choices in crisis, deepen principle application." : "使用单人闭环探究游戏，让学员亲自在危机中做出策略抉择，加深原理运用。",
      scriptStatus: 'pending'
    };
    setModules(prev => [...prev, newMod]);
    
    addUserMessage(language === "en" ? `➕ Added a brand new course unit: Chapter ${newIdx}` : `➕ 增加了一个全新的课程单元：章节 ${newIdx}`);
    addAgentMessage(language === "en"
      ? "Alright! I've created a brand new custom module for you. You can directly write customized textbook details in the outline panel, and later we'll generate your exclusive game script all at once!"
      : "好的！我已经为您创建了全新的自定义单元。您可以在大纲面板中直接写入定制的教材细节，稍后我们将为您一次性生成专属游戏剧本！");
  };

  // Deletes single curriculum chapter
  const handleDeleteModule = (id: string) => {
    const deletedMod = modules.find(m => m.id === id);
    setModules(prev => prev.filter(m => m.id !== id));
    addUserMessage(language === "en" ? `🗑️ Removed course level: ${deletedMod?.title || "Undefined chapter"}` : `🗑️ 移除了课程关卡：${deletedMod?.title || "未定义章节"}`);
  };

  // Helper translations Chinese tags helper
  const getGameTypeChinese = (type: GameType) => {
    switch (type) {
      case "quiz": return language === "en" ? "Knowledge Quiz" : "知识抢答 (Quiz)";
      case "cross-match": return language === "en" ? "Concept Matching" : "消消乐搭配 (Match)";
      case "fill-blank": return language === "en" ? "Fill-in-Blank" : "填空魔法 (Fill-Blank)";
      case "interactive-story": return language === "en" ? "Interactive Narrative" : "文字冒险 (Narrative)";
      case "coding-puzzle": return language === "en" ? "Code Logic Puzzle" : "代码拼图 (Code Logic)";
      case "math-quest": return language === "en" ? "Math Run" : "算术极速逃脱 (Math Run)";
      default: return language === "en" ? "Interactive Challenge" : "互动试炼";
    }
  };

  // Helper icon selector for distinct game classifications
  const renderGameTypeIcon = (type: GameType, sizeClass = "w-4 h-4") => {
    switch (type) {
      case "quiz": return <HelpCircle className={`${sizeClass} text-cyan-450 text-cyan-400`} />;
      case "cross-match": return <Layers className={`${sizeClass} text-fuchsia-400`} />;
      case "fill-blank": return <Edit3 className={`${sizeClass} text-emerald-400`} />;
      case "interactive-story": return <Compass className={`${sizeClass} text-amber-500`} />;
      case "coding-puzzle": return <Settings className={`${sizeClass} text-teal-400`} />;
      case "math-quest": return <Trophy className={`${sizeClass} text-amber-500`} />;
      default: return <Gamepad2 className={`${sizeClass} text-slate-400`} />;
    }
  };

  const getSimulationMarkdown = (module?: BookModule | null): string => {
    if (!module) return "";
    if (module.simulationScript?.markdown) return module.simulationScript.markdown;
    if (module.script) {
      const challenges = module.script.challenges || [];
      return `
# 【BookToGame 旧版互动剧本】
教材名称: 《${bookTitle}》
当前课章: ${module.chapterIndex} · ${module.title}

## 开场导语
${module.script.introduction}

## 挑战关卡
${challenges.map((challenge, cIdx) => `
### 关卡 ${cIdx + 1}: ${challenge.title}
- 类型: ${challenge.type}
- 提示: ${challenge.prompt}
${challenge.options ? `- 选项: ${challenge.options.join(" / ")}` : ""}
- 标准答案: ${challenge.correctAnswer}
- 正确反馈: ${challenge.feedbackCorrect}
- 错误反馈: ${challenge.feedbackIncorrect}
`).join("\n")}

## 总结
${module.script.conclusion}
      `.trim();
    }
    return "";
  };

  const handleUpdateSimulationMarkdown = (moduleId: string, markdown: string) => {
    const updatedScript: SimulationBlueprintScript = {
      id: `simulation-script-${moduleId}`,
      moduleId,
      kind: "simulation_blueprint_markdown",
      markdown,
      generatedAt: modules.find(m => m.id === moduleId)?.simulationScript?.generatedAt || new Date().toISOString()
    };

    const updatedModules = modules.map(m =>
      m.id === moduleId ? { ...m, scriptStatus: 'completed' as const, simulationScript: updatedScript } : m
    );
    setModules(updatedModules);
    saveScriptToProject(moduleId, updatedScript);
    if (currentProjectId) {
      saveCurrentProject(updatedModules);
    }
  };

  // 通用复制函数（fallback 方案）
  const doCopy = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const showCopyToast = () => {
    setScriptCopySuccess(true);
    setCopyToast({ message: language === "en" ? '✅ Copied successfully!' : '✅ 复制成功！', visible: true });
    setTimeout(() => setScriptCopySuccess(false), 2000);
    setTimeout(() => setCopyToast(prev => ({ ...prev, visible: false })), 2500);
  };

  const handleCopySimulationMarkdown = (markdown: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(markdown).then(showCopyToast).catch(() => {
        doCopy(markdown);
        showCopyToast();
      });
    } else {
      doCopy(markdown);
      showCopyToast();
    }
  };

  const handleCopyScriptMarkdown = (script: GameScript) => {
    const parentModule = modules.find(m => m.id === script.moduleId);
    const formattedText = `
# 互动课业剧本: ${parentModule?.title || "章节"}
核心模拟场景: ${parentModule?.gameTitle || "自定义挑战"}

## 【剧本开场导语】
${script.introduction}

## 【挑战关卡清单】
${script.challenges.map((c, i) => `
### 关卡 ${i + 1}: ${c.title}
* 类型: ${c.type}
* 任务提示: ${c.prompt}
${c.options ? `* 候选项: ${c.options.join(" / ")}` : ''}
* 官方标准答案: ${c.correctAnswer}
* 答对反馈: "${c.feedbackCorrect}"
* 答错反馈: "${c.feedbackIncorrect}"
`).join("\n")}

## 【本章复盘要要点】
${script.conclusion}
    `.trim();

    const showCopyToast = () => {
      setScriptCopySuccess(true);
      setCopyToast({ message: language === "en" ? '✅ Copied successfully!' : '✅ 复制成功！', visible: true });
      setTimeout(() => setScriptCopySuccess(false), 2000);
      setTimeout(() => setCopyToast(prev => ({ ...prev, visible: false })), 2500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formattedText).then(showCopyToast).catch(() => {
        doCopy(formattedText);
        showCopyToast();
      });
    } else {
      doCopy(formattedText);
      showCopyToast();
    }
  };

  const handleGenerateFinalApp = async () => {
    if (!selectedStep5ModuleId) {
      alert(language === "en" ? "Please select a slice first" : "请先选择一个切片");
      return;
    }

    const mod = modules.find(m => m.id === selectedStep5ModuleId);
    if (!mod) {
      alert(language === "en" ? "Selected slice not found" : "未找到选中的切片");
      return;
    }

    const markdown = getSimulationMarkdown(mod);
    if (!markdown.trim()) {
      alert(language === "en" ? "This module doesn't have an interactive script yet. Please generate the script first." : "该切片还没有生成互动脚本，请先生成脚本");
      return;
    }

    setIsGeneratingApp(true);
    setFinalCode('');

    const fixedPrompt = `根据以下要求，帮我实现一个web端的html。这是一个场景模拟游戏，让学生通过这个模拟游戏，将所学的知识进行应用，学以致用。我希望整体互动是沉浸式的，就是每个操作都有丰富的可视化的场景画面。并且我希望不要所有内容都是局限在一个页面上的，而是一个行为可能就是在一个页面上完成。完成这个行为可能就需要进入到新场景了。`;

    const userPrompt = `${fixedPrompt}\n\n以下是该章节的互动脚本内容，请根据脚本中的场景、角色、交互流程、反馈规则等来实现HTML场景模拟游戏：\n\n${markdown.substring(0, 5000)}`;

    setAppApiDebugInfo(prev => ({
      ...prev,
      model: appModel,
      userPrompt,
      status: 'calling',
      rawResponse: '',
      timestamp: new Date().toLocaleTimeString()
    }));

    addAgentMessage(language === "en"
      ? `🚀 Generating scenario simulation game based on slice **${mod.chapterIndex} · ${mod.title}** interactive script...`
      : `🚀 正在基于切片 **${mod.chapterIndex} · ${mod.title}** 的互动脚本生成场景模拟游戏...`);

    // Fetch saved prompts from DB
    let appSavedSystemPrompt: string | undefined;
    let appSavedUserPromptTemplate: string | undefined;
    try {
      const res = await fetch('/api/prompt-templates?aiEntry=app-code');
      const data = await res.json();
      if (data && data.length > 0) {
        appSavedSystemPrompt = data[0].systemPrompt || undefined;
        appSavedUserPromptTemplate = data[0].userPromptTemplate || undefined;
      }
    } catch (e) {
      console.warn('Failed to fetch saved app prompts, using defaults');
    }

    try {
      const response = await fetch('/api/generate-app-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookTitle,
          chapterTitle: `${mod.chapterIndex} · ${mod.title}`,
          coveredChapters: mod.coveredChapters,
          scriptMarkdown: markdown,
          model: appModel,
          systemPrompt: appSavedSystemPrompt,
          userPromptTemplate: appSavedUserPromptTemplate
        })
      });

      const rawText = await response.text();
      if (!response.ok) {
        setAppApiDebugInfo(prev => ({
          ...prev,
          status: 'error',
          rawResponse: `HTTP ${response.status}: ${rawText}`,
          timestamp: new Date().toLocaleTimeString()
        }));
        throw new Error(rawText || `HTTP ${response.status}`);
      }

      const data = JSON.parse(rawText);
      let generatedCode = data.code || '';
      
      // Extract valid HTML from AI response
      generatedCode = extractValidHtml(generatedCode);
      
      setFinalCode(generatedCode);

      setAppApiDebugInfo(prev => ({
        ...prev,
        status: 'success',
        rawResponse: rawText.substring(0, 10000),
        timestamp: new Date().toLocaleTimeString()
      }));
      
      // Save generated code to backend and local state
      if (currentProjectId && generatedCode) {
        setModuleAppCodes(prev => ({ ...prev, [selectedStep5ModuleId]: generatedCode }));
        fetch(`/api/projects/${currentProjectId}/app-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId: selectedStep5ModuleId, code: generatedCode })
        }).catch(err => console.error(language === "en" ? "Failed to save App code:" : "保存App代码失败:", err));
      }
      
      setIsGeneratingApp(false);
      setOutputTab('preview');
      addAgentMessage(language === "en"
        ? `✅ **Scenario simulation game generated successfully!**\n\nYou can preview the effect on the right, or switch to the code view to see the HTML source code.`
        : `✅ **场景模拟游戏生成完成！**\n\n你可以在右侧预览效果，或切换到代码视图查看 HTML 源码。`, 'text');
    } catch (err: any) {
      setIsGeneratingApp(false);
      const message = err?.message || (language === "en" ? "Unknown error" : "未知错误");
      setFinalCode(`<!-- ${language === "en" ? "DeepSeek V4 Flash code generation failed" : "DeepSeek V4 Flash 代码生成失败"} -->\n<!-- ${message} -->`);
      setAppApiDebugInfo(prev => ({
        ...prev,
        status: 'error',
        rawResponse: prev.rawResponse || `Error: ${message}`,
        timestamp: new Date().toLocaleTimeString()
      }));
      addAgentMessage(language === "en"
        ? `❌ **Scenario simulation game generation failed**\n\nError message: ${message}`
        : `❌ **场景模拟游戏生成失败**\n\n错误信息：${message}`);
    }
  };
  const handleDownloadFinalCode = () => {
    const mod = modules.find(m => m.id === selectedStep5ModuleId);
    const chapterName = mod ? mod.title : '';
    const fileName = chapterName && bookTitle
      ? `${chapterName}-${bookTitle}.html`
      : `${bookTitle || 'game'}.html`;
    const blob = new Blob([finalCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSelectStep5Module = (moduleId: string) => {
    setSelectedStep5ModuleId(moduleId);
    // Restore saved code if exists
    const savedCode = moduleAppCodes[moduleId];
    if (savedCode) {
      setFinalCode(savedCode);
      setOutputTab('preview');
    } else {
      setFinalCode('');
    }
  };

  const getActiveModule = () => {
    return modules.find(m => m.id === activeModuleId) || null;
  };

  const activeModule = getActiveModule();

  // System Settings full-screen page
  if (showModelManagement) {
    return <SystemSettings onBack={() => setShowModelManagement(false)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#050508] text-slate-200 font-sans overflow-hidden relative z-10">

      {/* Toast Notification */}
      {copyToast.visible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-500/90 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-sm font-semibold animate-bounce">
          {copyToast.message}
        </div>
      )}

      {/* Immersive Theme Decor Backdrops */}
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -z-10 pointer-events-none"></div>

      {/* Main Container Split View */}
      <div className="flex flex-1 overflow-hidden z-10">
        
        {/* ========================================================= */}
        {/* LEFT PANEL - AI Agent Companion Workspace */}
        {/* ========================================================= */}
        <div id="agent-container" className="border-r border-white/10 bg-[#0a0a0f] flex flex-col h-full shrink-0" style={{ width: `${leftWidth}px` }}>
          
          {/* Agent Identity & Header Section */}
          <div className="p-4 bg-[#0a0a0f] text-white flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)] flex items-center justify-center font-bold text-lg text-white">
                  AI
                </div>
                {/* Active light indicator */}
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-cyan-400 border-2 border-[#0a0a0f]"></div>
              </div>
              <div>
                <div className="font-semibold text-sm flex items-center gap-1.5 text-white">
                  ND Teaching Interactive AIGC Agent
                </div>
                <div className="text-[11px] text-cyan-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-455 text-cyan-400" />
                  version {APP_VERSION}
                </div>
              </div>
            </div>
            
            {/* Minimal decoration */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModelManagement(true)}
                className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1"
                title={t("systemSettingsTitle")}
              >
                <Settings className="w-3 h-3" />
                {t("systemSettings")}
              </button>
            </div>
          </div>

          {/* Core Chat Bubbles Log Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[90%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Mini Avatars */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  msg.sender === 'user' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-slate-300 border border-white/10'
                }`}>
                  {msg.sender === 'user' ? 'ME' : 'AI'}
                </div>

                <div className="space-y-1">
                  {/* Bubble body */}
                  <div className={`px-3.5 py-2.5 rounded-2xl whitespace-pre-line text-sm leading-relaxed shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-cyan-950/40 text-cyan-200 border border-cyan-500/30 rounded-tr-none shadow-[0_0_15px_rgba(6,182,212,0.05)]'
                      : 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-none'
                  }`}>
                    {msg.text}

                    {/* Rich interaction tags loaded inline within chat notifications */}
                    {msg.type === 'blueprint_ready' && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
                        <div className="text-xs text-cyan-200 font-semibold flex items-center gap-1.5 bg-cyan-950/20 border border-cyan-500/20 p-2 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-cyan-405 text-cyan-400 shrink-0" />
                          {language === "en" ? "Course outline structure is ready!" : "课程大纲结构准备生成完毕！"}
                        </div>
                        <button 
                          onClick={() => setActiveStep(2)}
                          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-400/25 cursor-pointer"
                        >
                          {t("viewEditOutline")} <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Message timestamp metadata */}
                  <div className={`text-[10px] text-slate-500 px-1 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {/* Simulated typing dot effect */}
            {chatLoading && (
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-lg bg-white/5 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 border border-white/10">
                  AI
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-md">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Text Input Bottom field */}
          <form onSubmit={handleSendChat} className="p-3 bg-[#0a0a0f] border-t border-white/10 shrink-0 flex items-center gap-2">
            <input 
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t("chatPlaceholder")}
              className="flex-1 bg-white/5 hover:bg-white/10 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-xl px-4 py-2.5 text-sm font-sans text-white placeholder:text-slate-600 transition"
            />
            <button 
              id="chat-submit-btn"
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className={`p-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

        {/* Dynamic Drag Splitter Handler */}
        <div 
          onMouseDown={startResize}
          className={`w-1 cursor-col-resize hover:w-2 shrink-0 h-full transition-all relative z-25 flex items-center justify-center group ${
            isDragging ? 'bg-cyan-500 w-2 shadow-[0_0_15px_rgba(6,182,212,0.8)]' : 'bg-white/5 hover:bg-cyan-500/40 border-r border-white/5'
          }`}
          title={t("dragResize")}
        >
          {/* Draggable grip tactile dots */}
          <div className="absolute top-1/2 -track-y-1/2 flex flex-col gap-1.5 pointer-events-none opacity-40 group-hover:opacity-100">
            <div className={`w-1 h-1 rounded-full ${isDragging ? 'bg-white' : 'bg-cyan-400'}`}></div>
            <div className={`w-1 h-1 rounded-full ${isDragging ? 'bg-white' : 'bg-cyan-400'}`}></div>
            <div className={`w-1 h-1 rounded-full ${isDragging ? 'bg-white' : 'bg-cyan-400'}`}></div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANEL - Multi-Stage Workspace Area */}
        {/* ========================================================= */}
        <div id="workspace-container" className="flex-1 bg-[#050508]/30 overflow-hidden flex flex-col h-full relative">
          
          {/* Active Title Banner */}
          <div className="bg-[#050508]/80 backdrop-blur-md border-b border-white/10 px-6 py-3 shrink-0 flex items-center justify-between z-10">
            <div className="flex items-center gap-2 text-slate-200 min-w-0">
              {currentProjectId && (
                <>
                  <button
                    type="button"
                    onClick={handleBackHome}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                    title={language === "en" ? "Back to project list" : "返回项目列表"}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                      <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {language === "en" ? "back" : "返回"}
                  </button>
                  <div className="w-px h-5 bg-white/10 shrink-0" />
                </>
              )}
              <Layers className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-sm truncate">
                {!currentProjectId ? (language === "en" ? "Book to Game · Home" : "Book to Game · 首页") : (projectInfo?.name || "")}
              </span>
            </div>

            {/* Step navigation shortcut pins */}
            <div className="flex items-center gap-2">
              {currentProjectId && (
              <>
              {/* 任务管理器：独立按钮，样式与步骤按钮区分。
                  当存在后台活跃任务时，按钮内合并展示脉冲状态指示器 + 进度计数。 */}
              {(() => {
                const hasBg = !!(backgroundJob && (backgroundJob.status === "running" || backgroundJob.status === "paused"));
                const isActive = viewMode === "task-manager";
                return (
                  <button
                    onClick={() => {
                      if (hasBg && backgroundJob.projectId && backgroundJob.projectId !== currentProjectId) {
                        loadProject(backgroundJob.projectId);
                      }
                      setViewMode("task-manager");
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1.5 shrink-0 font-semibold ${
                      isActive
                        ? 'bg-amber-500 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                    }`}
                    title={hasBg
                      ? (language === "en"
                          ? `Task Manager · ${backgroundJob!.status === "running" ? "running" : "paused"} ${backgroundJob!.completedSlices + backgroundJob!.failedSlices}/${backgroundJob!.totalSlices}`
                          : `任务管理器 · ${backgroundJob!.status === "running" ? "运行中" : "已暂停"} ${backgroundJob!.completedSlices + backgroundJob!.failedSlices}/${backgroundJob!.totalSlices}`)
                      : (language === "en" ? "Task Manager" : "任务管理器")}
                  >
                    <Layers className="w-3 h-3" />
                    {language === "en" ? "TaskManager" : "任务管理器"}
                    {hasBg && (
                      <>
                        <span className="relative flex h-1.5 w-1.5 ml-0.5">
                          {backgroundJob!.status === "running" && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
                          )}
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${backgroundJob!.status === "running" ? "bg-cyan-300" : "bg-amber-300"}`} />
                        </span>
                        {backgroundJob!.totalSlices > 0 && (
                          <span className={`text-[10px] font-mono tabular-nums ${isActive ? "text-amber-100" : "text-amber-400/80"}`}>
                            {backgroundJob!.completedSlices + backgroundJob!.failedSlices}/{backgroundJob!.totalSlices}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })()}
              <div className="w-px h-5 bg-white/10 shrink-0" />
              {/* 步骤导航：Preview → Slice → Extract → Script → Build App */}
              <button
                onClick={() => { setViewMode("steps"); setActiveStep(1); }}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  viewMode === "steps" && activeStep === 1
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {language === "en" ? "1. Preview" : "1. 预览目录"}
              </button>
              <button
                onClick={() => modules.length > 0 && (setViewMode("steps"), setActiveStep(2))}
                disabled={modules.length === 0}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  modules.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
                } ${
                  viewMode === "steps" && activeStep === 2
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {language === "en" ? "2. Slice" : "2. 课程切片"}
              </button>
              <button
                onClick={async () => {
                  if (modules.length === 0) return;
                  await reExtractPdfText();
                  setViewMode("steps");
                  setActiveStep(3);
                  setActiveTab('original');
                  if (modules.length > 0) {
                    setActiveModuleId(modules[0].id);
                  }
                }}
                disabled={modules.length === 0}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  modules.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
                } ${
                  viewMode === "steps" && activeStep === 3
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {language === "en" ? "3. Extract" : "3. 切片内容提取"}
              </button>
              <button
                onClick={async () => {
                  if (modules.length === 0) return;
                  await reExtractPdfText();
                  if (!activeModuleId || !modules.some(m => m.id === activeModuleId)) {
                    setActiveModuleId(modules[0].id);
                  }
                  setViewMode("steps");
                  setActiveTab('simulator');
                  setActiveStep(4);
                }}
                disabled={modules.length === 0}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  modules.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
                } ${
                  viewMode === "steps" && activeStep === 4
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {language === "en" ? "4. Script" : "4. 互动脚本生成"}
              </button>
              <button
                onClick={() => modules.some(m => m.scriptStatus === 'completed') && (setViewMode("steps"), setActiveStep(5))}
                disabled={!modules.some(m => m.scriptStatus === 'completed')}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  !modules.some(m => m.scriptStatus === 'completed') ? 'opacity-30 cursor-not-allowed' : ''
                } ${
                  viewMode === "steps" && activeStep === 5
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {language === "en" ? "5. Build App" : "5. App 构建"}
              </button>
              </>
              )}
            </div>
          </div>

          {/* 首页：未选择项目时显示使用说明 + 项目列表 */}
          {!currentProjectId && (
            <HomeView
              projects={homeProjects}
              language={language}
              onSelectProject={loadProject}
              onDeleteProject={handleDeleteProject}
              onEditProject={(id, name) => setEditingProject({ id, name })}
              onBatchDelete={async (ids) => {
                if (ids.length === 0) return;
                if (!confirm(language === "en" ? `Are you sure you want to delete the selected ${ids.length} projects? This cannot be undone.` : `确定要删除选中的 ${ids.length} 个项目吗？此操作不可撤销。`)) return;
                try {
                  await Promise.all(ids.map(id => fetch(`/api/projects/${id}`, { method: "DELETE" })));
                  if (currentProjectId && ids.includes(currentProjectId)) {
                    setCurrentProjectId(null);
                    setModules([]);
                    setBookTitle("");
                    setBookContentText("");
                    setDirectoryItems([]);
                    setSavedScripts({});
                  }
                  await loadProjectList();
                } catch (err) {
                  console.error("Failed to batch delete projects:", err);
                }
              }}
              onNewProject={() => setShowNewProjectModal(true)}
              onRefresh={loadProjectList}
            />
          )}

          {/* 自动任务执行中：内容锁定提示 banner
              仅在 steps 视图显示（task-manager 视图本身就是任务进度，无需重复提示）
              采用 amber 色提示用户：当前内容只读，如需编辑请先暂停/取消任务 */}
          {viewMode === "steps" && isProjectLocked && currentProjectId && (
            <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 shrink-0 flex items-center justify-between gap-3 z-20">
              <div className="flex items-center gap-2 text-amber-300 min-w-0">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-semibold truncate">
                  {language === "en"
                    ? `Automation ${backgroundJob!.status === "running" ? "running" : "paused"} · content is read-only to avoid conflicts`
                    : `自动任务${backgroundJob!.status === "running" ? "执行中" : "已暂停"} · 内容已锁定只读，避免与自动流程冲突`}
                </span>
              </div>
              <button
                onClick={() => setViewMode("task-manager")}
                className="text-[11px] font-semibold text-amber-200 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/40 px-2.5 py-1 rounded-md transition cursor-pointer shrink-0"
              >
                {language === "en" ? "Open TaskManager →" : "打开任务看板 →"}
              </button>
            </div>
          )}

          {/* 自动模式：任务管理器覆盖层 */}
          {viewMode === "task-manager" && currentProjectId && (
            <div className="absolute inset-0 z-30 animate-fadeIn">
              <TaskManager
                projectId={currentProjectId}
                bookTitle={bookTitle}
                modules={modules}
                directoryItems={directoryItems}
                projectInfo={projectInfo}
                jobId={automationJobId}
                onJobIdChange={setAutomationJobId}
                onEditSlice={(moduleId) => {
                  setActiveModuleId(moduleId);
                  setViewMode("steps");
                  setActiveStep(3);
                }}
                appCount={Object.keys(moduleAppCodes).length}
                savedScriptCount={Object.keys(savedScripts).length}
                extractedCount={Object.keys(extractedModules).length}
                onViewBuild={() => {
                  // 查看详情：进入 steps 视图的 build app 步骤（activeStep=5）
                  setViewMode("steps");
                  setActiveStep(5);
                }}
                onMinimize={async () => {
                  // 最小化到后台：刷新项目数据（让 steps 视图显示已完成的切片/脚本/app），服务端任务继续运行
                  if (currentProjectId) {
                    await loadProject(currentProjectId);
                  }
                  // loadProject 会按活跃 job 设视图（有 job→task-manager），这里覆盖为 steps
                  setViewMode("steps");
                  // 刷新首页项目列表进度（sliceCount/scriptCount/appCount）
                  loadProjectList();
                }}
                onRefreshProject={() => {
                  if (currentProjectId) loadProject(currentProjectId);
                }}
              />
            </div>
          )}

          {/* Step 1 View: Load Book and Uploading PDF */}
          {viewMode === "steps" && activeStep === 1 && currentProjectId && (
            <div className="flex-1 flex flex-col min-h-0 w-full animate-fadeIn z-10 overflow-hidden">
              {/* Scrollable Container */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
              {/* Text Input edit fallback box */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-cyan-400" />
                    {language === "en" ? "Textbook Content Preview & Verification" : "教材提取文本预览与校验（支持补充或自拟内容）"}
                  </h4>

                  {/* Mode switcher tabs */}
                  {bookContentText && (
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 self-start">
                      <button
                        type="button"
                        onClick={() => setBookInputMode('toc')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          bookInputMode === 'toc'
                            ? 'bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        {language === "en" ? "🗂️ Structured TOC" : "🗂️ 智能目录格式 (Structured TOC)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookInputMode('text')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          bookInputMode === 'text'
                            ? 'bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {language === "en" ? "✏️ Raw Text" : "✏️ 提取排版源码 (Raw Text)"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">{t("bookTitleLabel")}</label>
                    <input 
                      type="text"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      placeholder={t("bookTitlePlaceholder")}
                      className="w-full bg-[#0a0a0f] focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg px-3.5 py-1.5 text-sm text-slate-100 transition"
                    />
                  </div>

                  {bookInputMode === 'toc' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs text-slate-450 text-slate-400 font-bold flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                          {language === "en" ? `Identified Hierarchy (${directoryItems.length} nodes / drag or fine-tune)` : `已识别层级架构 (共 ${directoryItems.length} 个章节节点 / 拖拽或手动微调)`}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addDirectoryItem('chapter')}
                            disabled={isProjectLocked}
                            className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3 h-3" />
                            {language === "en" ? "Add Chapter" : "添加大章 (Chapter)"}
                          </button>
                          <button
                            type="button"
                            onClick={() => addDirectoryItem('section')}
                            disabled={isProjectLocked}
                            className="text-[10px] font-bold text-teal-400 bg-teal-500/10 hover:bg-teal-500/25 border border-teal-500/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3 h-3" />
                            {language === "en" ? "Add Section" : "添加小节 (Section)"}
                          </button>
                        </div>
                      </div>

                      {directoryItems.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 border border-dashed border-white/10 rounded-2xl bg-[#0a0a0f]/40">
                          <BookOpen className="w-8 h-8 mx-auto text-slate-600 mb-2 stroke-1" />
                          <p className="text-xs font-medium">{t("noDirectoryFrame")}</p>
                          <p className="text-[11px] text-slate-500 mt-1">{t("noDirectoryHint")}</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 select-text">
                          {directoryItems.map((item) => {
                            const isCh = item.type === 'chapter';
                            const isSec = item.type === 'section';
                            const isSub = item.type === 'subsection';
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between gap-3 group transition-all duration-150 ${
                                  isCh 
                                    ? 'bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 pl-3.5' 
                                    : isSec
                                    ? 'bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 border-dashed rounded-lg p-2.5 pl-3 ml-6 md:ml-8 relative'
                                    : 'bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 border-dashed rounded-lg p-2 pl-3 ml-12 md:ml-14 relative'
                                }`}
                              >
                                {/* Left tree indentation line marker */}
                                {!isCh && (
                                  <div className={`absolute -left-5 top-1/2 -translate-y-1/2 w-5 h-5 border-l-2 border-b-2 rounded-bl-lg pointer-events-none ${
                                    isSub ? 'border-white/5' : 'border-white/10'
                                  }`}></div>
                                )}

                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {isCh ? (
                                    <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                                  ) : isSec ? (
                                    <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  ) : (
                                    <CornerDownRight className="w-3 h-3 text-slate-600 shrink-0" />
                                  )}

                                  <input
                                    type="text"
                                    value={item.title}
                                    onChange={(e) => updateDirectoryItemTitle(item.id, e.target.value)}
                                    readOnly={isProjectLocked}
                                    placeholder={isCh ? t("chapterTitlePlaceholder") : isSec ? t("sectionTitlePlaceholder") : t("subSectionTitlePlaceholder")}
                                    className={`w-full bg-transparent outline-none text-xs text-slate-200 border-b border-transparent focus:border-cyan-500/40 py-0.5 transition read-only:cursor-not-allowed ${
                                      isCh ? 'font-bold text-slate-105 text-sm' : isSec ? 'text-slate-300' : 'text-slate-400'
                                    }`}
                                  />
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Compact Page input pill */}
                                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                                    <span className="text-[9px] text-slate-500 font-bold font-mono">P.</span>
                                    <input
                                      type="text"
                                      value={item.page || ""}
                                      onChange={(e) => updateDirectoryItemPage(item.id, e.target.value)}
                                      readOnly={isProjectLocked}
                                      placeholder={t("pagePlaceholder")}
                                      className="w-12 bg-transparent text-center font-mono text-[11px] font-bold text-cyan-400 outline-none border-none read-only:cursor-not-allowed"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => deleteDirectoryItem(item.id)}
                                    disabled={isProjectLocked}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
                                    title={t("removeLevel")}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-400">{t("textPreviewLabel")}</label>
                        <span className="text-[10px] text-slate-500">{t("textPreviewHint")}</span>
                      </div>
                      <textarea
                        value={bookContentText}
                        onChange={(e) => {
                          setBookContentText(e.target.value);
                          setDirectoryItems(parseTextToDirectory(e.target.value));
                        }}
                        readOnly={isProjectLocked}
                        placeholder={t("textPreviewPlaceholder")}
                        className="w-full h-48 bg-[#0a0a0f] focus:bg-[#050508] border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg p-3 text-xs font-mono text-slate-300 transition resize-y read-only:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 模式选择已前置到「新建项目」弹窗，目录提取后自动进入后续流程 */}

            </div> {/* max-w-4xl */}
          </div> {/* flex-1 overflow-y-auto */}

          {/* Core CTA Sticky Footer */}
          <div className="shrink-0 p-4 bg-[#0a0a0f] border-t border-white/10 flex items-center justify-between gap-4 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20">
            <div className="text-xs text-slate-400">
              {bookContentText ? `${language === "en" ? `Loaded text` : `当前载入教材文本`}: ${bookContentText.length} ${language === "en" ? "chars" : "字符"}` : (language === "en" ? "Textbook not yet loaded" : "教材尚未载入")}
            </div>

            <div className="flex items-center gap-3">
              {parseError && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/30 text-red-200 text-xs rounded-xl flex items-center gap-2 max-w-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="line-clamp-1">{parseError}</span>
                </div>
              )}

              <button 
                onClick={() => setShowSliceSettings(true)}
                className="p-2.5 rounded-xl transition cursor-pointer bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10"
                title={language === "en" ? "Slice Settings" : "切片设置"}
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleSplitBook(false)}
                disabled={isParsing || !bookContentText.trim() || !bookTitle.trim()}
                className={`px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-cyan-400/25 pulsing-glow cursor-pointer ${
                  (isParsing || !bookContentText.trim() || !bookTitle.trim()) ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {isParsing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {language === "en" ? "Parsing..." : "教材切片解析中..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {language === "en" ? "Smart Content Slicing" : "教材内容智能切片"}
                      </>
                    )}
              </button>
            </div>
          </div>

        </div>
      )}

          {/* Step 2 View: Editable Module Planner List */}
          {activeStep === 2 && (
            <div className="flex-1 flex flex-col h-full z-10 w-full overflow-hidden animate-fadeIn">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-[1300px] mx-auto space-y-6">
              
              {/* Syllabus Planner Title Header */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                    {language === "en" ? "🗺️ Course Slice Blueprint" : "🗺️ 课程切片策划大纲"}
                  </h3>
                  {aiMeta && (
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400">
                        {language === "en" ? "Last call" : "最后调用"}：{aiMeta.callTime || (language === "en" ? "Unknown" : "未知")}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          aiMeta.status === 'success' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' :
                          aiMeta.status === 'fail' ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]' :
                          'bg-yellow-400'
                        }`}></span>
                        <span className={
                          aiMeta.status === 'success' ? 'text-green-400' :
                          aiMeta.status === 'fail' ? 'text-red-400' :
                          'text-yellow-400'
                        }>
                          {aiMeta.status === 'success' ? 'Success' : aiMeta.status === 'fail' ? 'Fail' : 'Pending'}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* View Switcher Toggle */}
                  <div className="flex items-center bg-[#07070a] border border-white/10 rounded-xl p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setStep2ViewMode('table')}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                        step2ViewMode === 'table'
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>📊 {language === "en" ? "Table View" : "表格视图"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep2ViewMode('cards')}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                        step2ViewMode === 'cards'
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>🎴 {language === "en" ? "Card View" : "精美卡片"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep2ViewMode('raw')}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                        step2ViewMode === 'raw'
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>🔧 {language === "en" ? "Raw Data" : "原始数据"}</span>
                    </button>
                  </div>

                  <button
                    onClick={handleAddCustomModule}
                    type="button"
                    disabled={isProjectLocked}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-400/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Plus className="w-4 h-4" />
                    {language === "en" ? "Manually Add New Level" : "手动增设新关卡"}
                  </button>

                  <button
                    onClick={() => setShowSliceSettings(true)}
                    disabled={isProjectLocked}
                    className="p-2.5 rounded-xl transition cursor-pointer bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={language === "en" ? "Slice Settings" : "切片设置"}
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleSplitBook(true)}
                    type="button"
                    disabled={isParsing || !bookContentText.trim() || isProjectLocked}
                    className={`text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition border cursor-pointer ${
                      isParsing || !bookContentText.trim() || isProjectLocked
                        ? 'bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-400 border-amber-500/20 hover:border-amber-400/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    }`}
                  >
                    <Sparkles className={`w-4 h-4 ${isParsing ? 'animate-spin' : ''}`} />
                    {isParsing ? (language === "en" ? 'AI Parsing...' : 'AI 解析中...') : (language === "en" ? '✨ AI Re-slice' : '✨ AI 重新切片')}
                  </button>
                </div>
              </div>

              {/* TABLE VIEW (Primary / Default) */}
              {step2ViewMode === 'table' && (
                <div className="overflow-x-auto border border-white/10 rounded-2xl bg-[#09090e] shadow-xl">
                  <table className="w-full text-left border-collapse min-w-[1300px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-[11px] font-bold text-slate-300 font-display">
                        <th className="p-3 w-[70px] text-center">{language === "en" ? "Lesson ID" : "学时编号"}</th>
                        <th className="p-3 w-[120px]">{language === "en" ? "Covered Chapters" : "覆盖教材章节"}</th>
                        <th className="p-3 w-[160px]">{language === "en" ? "Knowledge Slice Topic" : "知识切片主题"}</th>
                        <th className="p-3 w-[180px]">{language === "en" ? "Core Concepts / Points" : "涵盖核心考点 / 概念"}</th>
                        <th className="p-3 w-[95px] text-center">{language === "en" ? "Est. Study Time" : "预计自学时间"}</th>
                        <th className="p-3 w-[280px]">{language === "en" ? "⚡ Info Load Assessment" : "⚡ 信息负荷合理性评估"}</th>
                        <th className="p-3 w-[280px]">{language === "en" ? "🎯 Core Cohesion & Relations" : "🎯 主干考点内聚性与关联机制"}</th>
                        <th className="p-3 w-[240px]">{language === "en" ? "📋 Design Overview" : "📋 整体设计概要"}</th>
                        <th className="p-3 w-[55px] text-center">{language === "en" ? "Remove" : "移除"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[12px]">
                      {modules.map((mod, index) => (
                        <tr key={mod.id} className="hover:bg-white/[0.02] transition align-top">
                          
                          {/* Col 1: Chapter Index */}
                          <td className="p-2 py-3 text-center">
                            <input 
                              type="text"
                              value={mod.chapterIndex}
                              onChange={(e) => handleUpdateModule(mod.id, { chapterIndex: e.target.value })}
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-center font-mono font-bold text-cyan-400 focus:bg-black/40 rounded p-1"
                            />
                          </td>

                          {/* Col 2: Covered Chapters */}
                          <td className="p-2 py-3">
                            <input 
                              type="text"
                              value={mod.coveredChapters || ""}
                              onChange={(e) => handleUpdateModule(mod.id, { coveredChapters: e.target.value })}
                              placeholder={language === "en" ? "e.g. Topic 1.1-1.3" : "如 Topic 1.1-1.3"}
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none font-semibold text-slate-200 focus:bg-black/40 rounded p-1"
                            />
                            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 py-0.5 px-1.5 rounded block mt-1.5 shrink-0 font-mono text-center">
                              📖 {getExtractedTextForModule(mod, directoryItems, bookContentText, pdfPagesText, pdfPageOffset).mappedPages}
                            </span>
                          </td>

                          {/* Col 3: Title */}
                          <td className="p-2 py-3">
                            <input 
                              type="text"
                              value={mod.title}
                              onChange={(e) => handleUpdateModule(mod.id, { title: e.target.value })}
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none font-semibold text-white focus:bg-black/40 rounded p-1"
                            />
                          </td>

                          {/* Col 4: Summary (Associated concepts) */}
                          <td className="p-2 py-3">
                            <textarea 
                              value={getSummaryText(mod.summary)}
                              onChange={(e) => handleUpdateModule(mod.id, { summary: e.target.value })}
                              rows={3}
                              placeholder={language === "en" ? "List all knowledge points and core concepts in this slice" : "完整列出该切片包含的所有知识点和核心概念"}
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-300 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                            />
                          </td>

                          {/* Col 5: Duration */}
                          <td className="p-2 py-3 text-center">
                            <input 
                              type="text"
                              value={mod.duration || (language === "en" ? "10-15 min" : "10分钟")}
                              onChange={(e) => handleUpdateModule(mod.id, { duration: e.target.value })}
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-center text-slate-300 focus:bg-black/40 rounded p-1"
                            />
                          </td>

                          {/* Col 6: Info Density */}
                          <td className="p-2 py-3">
                            <textarea 
                              value={getInfoDensityText(mod.infoDensity)}
                              onChange={(e) => handleUpdateModule(mod.id, { infoDensity: e.target.value })}
                              rows={3}
                              placeholder={language === "en" ? "Explain why this slice's info load is reasonable, analyze cognitive load, concept depth and time allocation" : "明确说明为什么这个切片的信息负荷是合理的，分析认知负载、概念深度和时间分配"}
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-200 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                            />
                          </td>

                          {/* Col 7: Cohesion Detail */}
                          <td className="p-2 py-3">
                            <textarea 
                              value={getCohesionText(mod.cohesionDetail)}
                              onChange={(e) => handleUpdateModule(mod.id, { cohesionDetail: e.target.value })}
                              rows={3}
                              placeholder={language === "en" ? "Explain the teaching core, relationships between knowledge points, and why they can be aggregated into one chapter" : "说明教学核心是什么，各知识点之间的关联性和为什么可以聚合为一个章节"}
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-300 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                            />
                          </td>

                          {/* Col 8: Design Rationale */}
                          <td className="p-2 py-3">
                            {typeof mod.designRationale === 'object' && mod.designRationale !== null ? (
                              <div className="space-y-2">
                                <div>
                                  <p className="text-[10px] font-semibold text-cyan-400 mb-1">{language === "en" ? "Learned:" : "学了什么："}</p>
                                  <textarea
                                    value={(mod.designRationale as any).learnedPoints || ""}
                                    onChange={(e) => handleUpdateModule(mod.id, {
                                      designRationale: { learnedPoints: e.target.value, practicalProblems: (mod.designRationale as any).practicalProblems || "" }
                                    })}
                                    rows={2}
                                    placeholder={language === "en" ? "List 3-5 declarable knowledge points" : "列出 3-5 条可陈述的知识点"}
                                    className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-400 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                                  />
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold text-amber-400 mb-1">{language === "en" ? "Practical Problems Solved:" : "解决的实际问题："}</p>
                                  <textarea
                                    value={(mod.designRationale as any).practicalProblems || ""}
                                    onChange={(e) => handleUpdateModule(mod.id, {
                                      designRationale: { learnedPoints: (mod.designRationale as any).learnedPoints || "", practicalProblems: e.target.value }
                                    })}
                                    rows={2}
                                    placeholder={language === "en" ? "List 2-3 scenarios describing what problems this knowledge can solve" : "列出 2-3 个场景，描述能用这些知识解决什么问题"}
                                    className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-400 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                                  />
                                </div>
                              </div>
                            ) : (
                              <textarea 
                                value={(mod.designRationale as string) || ""}
                                onChange={(e) => handleUpdateModule(mod.id, { designRationale: e.target.value })}
                                rows={3}
                                placeholder={language === "en" ? "Overall design summary: how students learn through this slice, what they learn, and what practical problems they can solve" : "整体设计概要：学生如何通过此切片学习、学到什么内容、能解决什么实际问题"}
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-400 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                              />
                            )}
                          </td>

                          {/* Col 9: Delete operation */}
                          <td className="p-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(mod.id)}
                              disabled={isProjectLocked}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition mt-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                              title={language === "en" ? "Remove this module" : "移除此模块"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {step2ViewMode === 'cards' && (
                /* CARD VIEW (Secondary Presets) */
                <div className="space-y-4">
                  {modules.map((mod, index) => {
                    return (
                      <div 
                        key={mod.id} 
                        className="bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-md overflow-hidden hover:border-cyan-500/30 transition pb-4"
                      >
                        
                        {/* Upper Chapter Indicator Bar */}
                        <div className="bg-white/5 border-b border-white/10 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded">
                              {mod.chapterIndex}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {language === "en" ? "Covered Chapter" : "覆盖章节"}: {mod.coveredChapters || (language === "en" ? "Not filled" : "暂未填写")}
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                              📖 {getExtractedTextForModule(mod, directoryItems, bookContentText, pdfPagesText, pdfPageOffset).mappedPages}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(mod.id)}
                              disabled={isProjectLocked}
                              className="p-1 px-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {language === "en" ? "Remove" : "移除该章"}
                            </button>
                          </div>
                        </div>

                        {/* Editing fields content body */}
                        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                          
                          {/* Chapter Academic Details (Left Side col-4) */}
                          <div className="col-span-1 md:col-span-4 space-y-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                {language === "en" ? "Knowledge Slice Topic" : "知识切片主题"}
                              </label>
                              <input 
                                type="text"
                                value={mod.title}
                                onChange={(e) => handleUpdateModule(mod.id, { title: e.target.value })}
                                className="w-full bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-sm font-semibold text-white transition"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                  {language === "en" ? "Covered Chapters" : "覆盖教材章节"}
                                </label>
                                <input 
                                  type="text"
                                  value={mod.coveredChapters || ""}
                                  onChange={(e) => handleUpdateModule(mod.id, { coveredChapters: e.target.value })}
                                  placeholder="Topic 1.1"
                                  className="w-full bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs font-semibold text-slate-200 transition"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                  {language === "en" ? "Est. Study Time" : "预计自学时间"}
                                </label>
                                <input 
                                  type="text"
                                  value={mod.duration || (language === "en" ? "10-15 min" : "10分钟")}
                                  onChange={(e) => handleUpdateModule(mod.id, { duration: e.target.value })}
                                  className="w-full bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs font-semibold text-slate-200 transition"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                {language === "en" ? "Core Concepts / Points" : "涵盖核心考点 / 概念"}
                              </label>
                              <textarea 
                                value={getSummaryText(mod.summary)}
                                onChange={(e) => handleUpdateModule(mod.id, { summary: e.target.value })}
                                className="w-full h-24 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-[#ffffff1a] focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-300 transition resize-none leading-relaxed"
                              />
                            </div>
                          </div>

                          {/* Chapter Slicing Evaluation details (Right Side col-8) */}
                          <div className="col-span-1 md:col-span-8 space-y-3 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="col-span-1">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                  {language === "en" ? "⚡ Info Load Assessment (Density Control)" : "⚡ 信息负荷合理性评估 (密度控制)"}
                                </label>
                                <textarea 
                                  value={getInfoDensityText(mod.infoDensity)}
                                  onChange={(e) => handleUpdateModule(mod.id, { infoDensity: e.target.value })}
                                  className="w-full h-32 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-250 text-slate-200 transition resize-none leading-relaxed"
                                  placeholder={language === "en" ? "Measure information throughput, evaluate per-session load, prevent cognitive overload." : "衡量信息吞吐量，评估单学时，防范负荷过载阻碍。"}
                                />
                              </div>
                            </div>

                            <div className="col-span-1">
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                {language === "en" ? "🎯 Core Cohesion & Association Mechanism" : "🎯 主干考点内聚性与关联机制"}
                              </label>
                              <textarea 
                                value={getCohesionText(mod.cohesionDetail)}
                                onChange={(e) => handleUpdateModule(mod.id, { cohesionDetail: e.target.value })}
                                className="w-full h-32 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-300 transition resize-none leading-relaxed"
                                placeholder={language === "en" ? "Explain the intrinsic strong coupling principle or logical chain of this group of core concepts." : "说明此组核心考点的内在强耦合原理或逻辑链条。"}
                              />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                {language === "en" ? "🎓 Deep Learning Goals & Academic Value" : "🎓 深度研习目标与学术应用级价值"}
                              </label>
                              {typeof mod.designRationale === 'object' && mod.designRationale !== null ? (
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-[10px] font-semibold text-cyan-400 mb-1">{language === "en" ? "Learned:" : "学了什么："}</p>
                                    <textarea
                                      value={(mod.designRationale as any).learnedPoints || ""}
                                      onChange={(e) => handleUpdateModule(mod.id, {
                                        designRationale: { learnedPoints: e.target.value, practicalProblems: (mod.designRationale as any).practicalProblems || "" }
                                      })}
                                      className="w-full h-16 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-400 transition resize-none leading-relaxed"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-amber-400 mb-1">{language === "en" ? "Practical Problems Solved:" : "解决的实际问题："}</p>
                                    <textarea
                                      value={(mod.designRationale as any).practicalProblems || ""}
                                      onChange={(e) => handleUpdateModule(mod.id, {
                                        designRationale: { learnedPoints: (mod.designRationale as any).learnedPoints || "", practicalProblems: e.target.value }
                                      })}
                                      className="w-full h-16 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-400 transition resize-none leading-relaxed"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <textarea 
                                  value={(mod.designRationale as string) || ""}
                                  onChange={(e) => handleUpdateModule(mod.id, { designRationale: e.target.value })}
                                  className="w-full h-20 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-400 transition resize-none leading-relaxed"
                                />
                              )}
                            </div>

                          </div>

                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {step2ViewMode === 'raw' && (
                <div className="space-y-3">
                  {aiMeta ? (
                    <>
                      <CollapsibleSection title={language === "en" ? "🤖 AI Model Info" : "🤖 调用的AI模型信息"} defaultOpen={true}>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
{language === "en" ? `Model: ${aiMeta.model}
Provider: ${aiMeta.provider}
API: https://api.deepseek.com/chat/completions` : `模型名称：${aiMeta.model}
服务商：${aiMeta.provider}
API地址：https://api.deepseek.com/chat/completions`}
                        </pre>
                      </CollapsibleSection>

                      <CollapsibleSection title={language === "en" ? "📋 System Instruction" : "📋 系统指令（System Instruction）"} defaultOpen={false}>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
{aiMeta.systemInstruction}
                        </pre>
                      </CollapsibleSection>

                      <CollapsibleSection title={language === "en" ? "📝 User Prompt" : "📝 用户指令（User Prompt）"} defaultOpen={true}>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                          {aiMeta.userPrompt}
                        </pre>
                      </CollapsibleSection>

                      <CollapsibleSection title={language === "en" ? "📤 Raw AI Response" : "📤 AI返回的原始数据"} defaultOpen={true}>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-[50vh] overflow-y-auto">
                          {rawBlueprintData || (language === "en" ? "Empty" : "数据为空")}
                        </pre>
                      </CollapsibleSection>
                    </>
                  ) : (
                    <div className="border border-white/10 rounded-2xl bg-[#09090e] p-6 text-center text-slate-400">
                      <p>{language === "en" ? "No AI call data yet. Please run AI slicing first." : "暂无AI调用数据，请先执行 AI 切片"}</p>
                      {modules.length > 0 && (
                        <div className="mt-4">
                          <CollapsibleSection title={language === "en" ? "📤 Currently Loaded Slice Data" : "📤 当前加载的切片数据"} defaultOpen={true}>
                            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-[50vh] overflow-y-auto">
                              {JSON.stringify({ bookTitle, totalSlices: modules.length, slices: modules }, null, 2)}
                            </pre>
                          </CollapsibleSection>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              </div>
            </div>

            {/* Stage Navigation Buttons (Fixed Bottom) */}
            <div className="shrink-0 bg-[#050508]/90 backdrop-blur-md border-t border-white/10 p-5 z-20">
              <div className="max-w-[1300px] mx-auto flex items-center justify-between">
                <button 
                  onClick={() => setActiveStep(1)}
                  className="px-5 py-2 border border-white/10 text-slate-300 bg-white/5 hover:bg-white/10 font-semibold rounded-xl text-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  {language === "en" ? "Back to Import" : "返回导入课本"}
                </button>
                <button 
                  onClick={handleGenerateAllScripts}
                  className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/25 cursor-pointer"
                >
                  {language === "en" ? "Confirm All & Review Textbook Alignment" : "一键确认，精确审查教材对齐原文并仿真"} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        )}

          {/* Step 3: Slice Content Extraction */}
          {activeStep === 3 && (
            <div className="flex-1 flex flex-col h-full z-10 w-full overflow-hidden animate-fadeIn">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="w-full space-y-6">

              {/* 自动化面板：随时可启动自动化任务，模式由是否有活跃 job 自然表达 */}
              {currentProjectId && modules.length > 0 && (
                <AutomationPanel
                  projectId={currentProjectId}
                  modules={modules}
                  onEditSlice={(moduleId) => {
                    setActiveModuleId(moduleId);
                  }}
                  jobId={automationJobId}
                  onJobIdChange={setAutomationJobId}
                />
              )}

              <div className="flex flex-col md:flex-row gap-4">
              {/* Left sidebar: Modules list */}
              <div className="w-full md:w-64 border border-white/10 rounded-2xl bg-[#0a0a0f] p-3 space-y-2 shrink-0 flex flex-col overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-500 px-2 tracking-wider uppercase mb-1 shrink-0">
                  {language === "en" ? "Chapter List" : "教材学习关卡 (Chapter List)"}
                </div>

                {modules.map((mod) => {
                  const isActive = activeModuleId === mod.id;
                  const isDone = mod.scriptStatus === 'completed';
                  const isGen = mod.scriptStatus === 'generating';
                  const isExtracting = extractingModuleId === mod.id;
                  const isExtracted = !!extractedModules[mod.id];
                  
                  return (
                    <button 
                      key={mod.id}
                      onClick={() => handleSelectModuleForSimulator(mod.id)}
                      className={`text-left p-2.5 rounded-xl border transition flex flex-col gap-1 w-full shrink-0 cursor-pointer ${
                        isActive 
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                          : 'border-white/5 bg-white/5 hover:border-cyan-500/30 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wide">
                          {mod.chapterIndex}
                        </span>

                        {/* Status badges */}
                        <div className="flex items-center gap-1">
                          {isExtracting ? (
                            <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 animate-pulse border border-cyan-500/20">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> {language === "en" ? "Extracting..." : "提取中..."}
                            </span>
                          ) : isExtracted ? (
                            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 border border-blue-500/20">
                              <BookOpen className="w-2.5 h-2.5" /> {language === "en" ? "Extracted" : "已提取"}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <h5 className={`font-semibold text-xs leading-normal line-clamp-1 ${isActive ? 'text-cyan-400 font-bold' : 'text-slate-300'}`}>
                        {mod.title}
                      </h5>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-450 text-slate-400 line-clamp-1">📖 {mod.coveredChapters}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Right: Original Text Mapping View */}
              <div className="flex-1 border border-white/10 rounded-2xl bg-[#0a0a0f] flex flex-col overflow-hidden">
                <div className="bg-[#0a0a0f] px-5 py-3 border-b border-white/10 shrink-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-cyan-500 text-white font-extrabold px-2 py-0.5 rounded shadow-[0_0_10px_rgba(6,182,212,0.4)]">ORIGINAL TEXT</span>
                    <h4 className="font-semibold text-sm text-white font-display">{activeModule ? `《${activeModule.chapterIndex} · ${activeModule.title}》` : (language === "en" ? "Waiting for chapter" : "等待载入章节")}</h4>
                    {/* Preview button */}
                    {activeModuleId && extractedModules[activeModuleId] && (
                      <button
                        onClick={() => setShowPreviewModal(true)}
                        className="text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                          title={language === "en" ? "Preview rendered example" : "查看渲染样式示例"}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {pdfPagesText && pdfPagesText.length > 0 && (
                      <div className="flex items-center gap-2 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/15 p-1 px-2 rounded-lg transition">
                        <span className="text-[9px] text-cyan-300 font-semibold select-none">Offset</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => changePdfPageOffset(pdfPageOffset - 1)} className="w-4 h-4 bg-white/5 hover:bg-cyan-500/20 text-cyan-400 active:scale-95 rounded flex items-center justify-center text-[10px] border border-white/5 font-bold cursor-pointer" title={language === "en" ? "Offset back one page" : "向前偏移一页"}>-</button>
                          <input type="number" value={pdfPageOffset} onChange={(e) => changePdfPageOffset(parseInt(e.target.value, 10) || 0)} className="w-7 bg-black/80 border border-white/10 text-center font-mono text-[9px] font-bold text-cyan-200 py-0 rounded outline-none focus:border-cyan-400" />
                          <button type="button" onClick={() => changePdfPageOffset(pdfPageOffset + 1)} className="w-4 h-4 bg-white/5 hover:bg-cyan-500/20 text-cyan-400 active:scale-95 rounded flex items-center justify-center text-[10px] border border-white/5 font-bold cursor-pointer" title={language === "en" ? "Offset forward one page" : "向后偏移一页"}>+</button>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            const autoOffset = calculateAutoPageOffset(directoryItems, pdfPagesText);
                            changePdfPageOffset(autoOffset);
                          }}
                          className="w-4 h-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 active:scale-95 rounded flex items-center justify-center text-[10px] border border-cyan-500/30 cursor-pointer" 
                          title={language === "en" ? "Recalculate offset" : "重新计算偏移量"}
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                      <span className="text-[9px] text-cyan-300 font-semibold select-none">{language === "en" ? "Page" : "页码"}</span>
                      <input 
                        type="text" 
                        value={activeModule?.pageRange || getExtractedTextForModule(activeModule, directoryItems, bookContentText, pdfPagesText, pdfPageOffset).mappedPages}
                        onChange={(e) => {
                          if (activeModule) {
                            handleUpdateModule(activeModule.id, { pageRange: e.target.value });
                          }
                        }}
                        placeholder="P.X-Y"
                        className="w-16 bg-transparent border-0 outline-none font-mono text-[10px] font-bold text-cyan-400 text-center placeholder:text-cyan-600"
                      />
                    </div>
                    {activeModule && pdfData && (
                      <button
                        type="button"
                        disabled={isProjectLocked}
                        onClick={async () => {
                          if (!activeModule || !pdfData) return;
                          const modId = activeModule.id;
                          // 设置提取中状态
                          setExtractingModuleId(modId);
                          setExtractedContent("⏳ 正在重新提取...");
                          setExtractedImages([]);
                          try {
                            const result = await getExtractedTextForModuleAsync(
                              activeModule, directoryItems, bookContentText,
                              pdfData,
                              pdfPagesText.length > 0 ? pdfPagesText : undefined,
                              pdfPageOffset,
                              undefined,
                              currentProjectId
                            );
                            // 更新缓存和内容
                            setExtractedModules(prev => ({ ...prev, [modId]: result.extractedOriginalText }));
                            setExtractedContent(result.extractedOriginalText);
                            if (result.extractedImages && result.extractedImages.length > 0) {
                              setExtractedImages(result.extractedImages);
                              setModuleImages(prev => ({ ...prev, [modId]: result.extractedImages! }));
                            }
                            setExtractingModuleId(null);
                            // 保存到数据库
                            if (currentProjectId) {
                              fetch(`/api/projects/${currentProjectId}/extracted`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ moduleId: modId, content: result.extractedOriginalText })
                              }).catch(err => console.error(language === "en" ? "Failed to save extracted content:" : "保存提取内容失败:", err));
                            }
                          } catch (err) {
                            setExtractedContent(`⚠️ 提取失败: ${(err as Error).message}`);
                            setExtractingModuleId(null);
                          }
                        }}
                        className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full transition text-[9px] font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-amber-500/10"
                        title={language === "en" ? "Re-extract this slice's original text" : "重新提取本切片原文"}
                      >
                        <RefreshCw className="w-3 h-3" />
                        {language === "en" ? "Re-extract" : "重新提取"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {!activeModule ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
                      <BookOpen className="w-12 h-12 text-slate-600" />
                      <p className="text-sm">{language === "en" ? "No chapter selected. Click a chapter from the left sidebar to view the original text." : "尚未选定任何章节，请点击左侧列表的章节查看教材原文。"}</p>
                    </div>
                  ) : (
                    <div className="animate-fadeIn p-5">
                      <div className="text-xs text-slate-300 leading-relaxed font-sans overflow-y-auto select-text selection:bg-cyan-500/30 selection:text-white scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{
                            h2: ({ node, ...props }) => (<h2 className="text-sm font-bold text-cyan-400 bg-cyan-500/5 border-l-2 border-cyan-500/50 px-3 py-1.5 mt-6 mb-3 font-mono tracking-wide" {...props} />),
                            h3: ({ node, ...props }) => (<h3 className="text-[11px] font-bold text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded-lg mt-4 mb-2 inline-block font-mono tracking-wider" {...props} />),
                            h4: ({ node, ...props }) => (<h4 className="text-[11px] font-bold text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded-lg mt-5 mb-3 inline-block font-mono tracking-wider" {...props} />),
                            p: ({ node, ...props }) => (<p className="text-xs text-slate-300 leading-relaxed mb-3 font-sans opacity-95" {...props} />),
                            strong: ({ node, ...props }) => (<strong className="text-white font-extrabold" {...props} />),
                            blockquote: () => null,
                            ul: ({ node, ...props }) => (<ul className="list-disc pl-4 space-y-1 my-2.5 text-xs text-slate-300" {...props} />),
                            ol: ({ node, ...props }) => (<ol className="list-decimal pl-4 space-y-1 my-2.5 text-xs text-slate-300" {...props} />),
                            li: ({ node, ...props }) => (<li className="text-xs text-slate-300 leading-relaxed" {...props} />),
                            hr: ({ node, ...props }) => (<hr className="border-t border-white/5 my-4" {...props} />),
                            code: ({ node, ...props }) => (<code className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10.5px] text-cyan-200 font-bold" {...props} />),
                            img: ({ node, src, alt, ...props }) => src ? (<img src={src} alt={alt} className="max-w-full h-auto rounded-lg border border-white/10 my-4 shadow-lg" {...props} />) : null,
                            table: ({ node, ...props }) => (<table className="w-full border-collapse my-4 text-xs" {...props} />),
                            thead: ({ node, ...props }) => (<thead className="bg-cyan-500/10" {...props} />),
                            tbody: ({ node, ...props }) => (<tbody {...props} />),
                            tr: ({ node, ...props }) => (<tr className="border-b border-white/10 hover:bg-white/5 transition" {...props} />),
                            th: ({ node, ...props }) => (<th className="text-left px-3 py-2 text-cyan-300 font-semibold border-r border-white/5 last:border-r-0" {...props} />),
                            td: ({ node, ...props }) => (<td className="px-3 py-2 text-slate-300 border-r border-white/5 last:border-r-0 align-top" {...props} />),
                          }}>{activeModuleId && extractingModuleId === activeModuleId ? (language === "en" ? "⏳ Extracting content from PDF..." : "⏳ 正在从 PDF 提取内容...") : (extractedContent || (language === "en" ? "Please select a chapter from the left to view original text" : "请点击左侧列表选择章节查看原文"))}</ReactMarkdown>
                        </div>
                      
                      {activeModule && (
                      <div className="p-3.5 bg-cyan-500/5 rounded-xl border border-cyan-500/10 flex items-start gap-2.5 mt-4">
                        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-slate-400 leading-relaxed">
                          <span className="font-semibold text-slate-300">{language === "en" ? "Smart Alignment Tip:" : "智能对齐提示："}</span> {language === "en" ? `The system anchors the corresponding chapter theme and surrounding textbook paragraphs from the original textbook by fuzzy matching the knowledge slice's "Covered Chapters" attribute (here` : `系统通过在教材大纲中模糊匹配该知识切片的 `}<code>{activeModule.coveredChapters}</code>{language === "en" ? `), thereby anchoring the corresponding chapter theme and surrounding textbook paragraphs from the original textbook.` : `），从而锚定了原始教材中的对应章节主题及其前后的课本段落原文。`}
                        </div>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </div>

                </div>
              </div>

              {/* Stage Navigation Buttons (Fixed Bottom) */}
              <div className="shrink-0 bg-[#050508]/90 backdrop-blur-md border-t border-white/10 p-5 z-20">
                <div className="max-w-[1300px] mx-auto flex items-center justify-between">
                  <button 
                    onClick={() => setActiveStep(2)}
                    className="px-5 py-2 border border-white/10 text-slate-300 bg-white/5 hover:bg-white/10 font-semibold rounded-xl text-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {language === "en" ? "⚙️ Back to Outline Editing" : "⚙️ 返工修改大纲设定"}
                  </button>
                  <button 
                    onClick={() => { setActiveStep(4); addAgentMessage("✅ **已进入第四阶段：互动脚本生成！**\n\n现在您可以为每个章节生成仿真剧本、编辑参数、查看代码。"); }}
                    className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/25 cursor-pointer"
                  >
                    {language === "en" ? "✨ Enter Interactive Script Generation" : "✨ 进入互动脚本生成"} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Simulation blueprint generation and editing panel */}
          {activeStep === 4 && (
            <div className="p-4 flex-1 flex flex-col md:flex-row gap-4 overflow-hidden h-full z-10 animate-fadeIn">
              
              {/* Sub Column left sidebar: Modules Menu list */}
              <div className="w-full md:w-64 border border-white/10 rounded-2xl bg-[#0a0a0f] p-3 space-y-2 shrink-0 flex flex-col overflow-y-auto max-h-[220px] md:max-h-none">
                <div className="text-[11px] font-bold text-slate-500 px-2 tracking-wider uppercase mb-1 shrink-0">
                  {language === "en" ? "Chapter List" : "教材学习关卡 (Chapter List)"}
                </div>

                {modules.map((mod) => {
                  const isActive = activeModuleId === mod.id;
                  const isDone = mod.scriptStatus === 'completed';
                  const isGen = mod.scriptStatus === 'generating';
                  const isExtracting = extractingModuleId === mod.id;
                  const isExtracted = !!extractedModules[mod.id];
                  
                  return (
                    <button 
                      key={mod.id}
                      onClick={() => handleSelectModuleForSimulator(mod.id)}
                      className={`text-left p-2.5 rounded-xl border transition flex flex-col gap-1 w-full shrink-0 cursor-pointer ${
                        isActive 
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                          : 'border-white/5 bg-white/5 hover:border-cyan-500/30 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wide">
                          {mod.chapterIndex}
                        </span>

                        {/* Status badges */}
                        <div className="flex items-center gap-1">
                          {isExtracting ? (
                            <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 animate-pulse border border-cyan-500/20">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> {language === "en" ? "Extracting..." : "提取中..."}
                            </span>
                          ) : null}
                          {isDone ? (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-0.5 border border-emerald-500/20">
                              <Check className="w-2.5 h-2.5" /> {language === "en" ? "Generated" : "已生成"}
                            </span>
                          ) : isGen ? (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 animate-pulse border border-amber-500/20">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> {language === "en" ? "Generating..." : "生成中..."}
                            </span>
                          ) : (
                            <span className="text-[9px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-white/5 italic">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      <h5 className={`font-semibold text-xs leading-normal line-clamp-1 ${isActive ? 'text-cyan-400 font-bold' : 'text-slate-300'}`}>
                        {mod.title}
                      </h5>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-450 text-slate-400 line-clamp-1"> {mod.simulationScript ? (language === "en" ? "Simulator script ready" : "模拟器脚本已就绪") : (mod.coveredChapters || (language === "en" ? "Waiting to generate" : "等待生成"))}</span>
                      </div>
                    </button>
                  );
                })}

                <div className="pt-2 shrink-0 border-t border-white/10 mt-auto">
                  <button 
                    onClick={() => setActiveStep(2)}
                    className="w-full text-center text-xs font-semibold py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl block border border-white/10 transition cursor-pointer"
                  >
                    {language === "en" ? "⚙️ Back to Outline Editing" : "⚙️ 返工修改大纲设定"}
                  </button>
                </div>
              </div>

              {/* Sub Column Middle/Right: Interactive Simulator Terminal & raw scripts files */}
              <div className="flex-1 border border-white/10 rounded-2xl bg-[#0a0a0f] flex flex-col h-full overflow-hidden">
                
                {/* Simulator controls header bar */}
                <div className="bg-[#0a0a0f] px-5 py-3 border-b border-white/10 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-cyan-500 text-white font-extrabold px-2 py-0.5 rounded shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                      BLUEPRINT
                    </span>
                    <h4 className="font-semibold text-sm text-white font-display">
                      {activeModule ? `《${activeModule.chapterIndex} · ${activeModule.title}》` : (language === "en" ? "Waiting for chapter..." : "等待载入章节")}
                    </h4>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowApiDrawer(true)}
                      className="p-2 rounded-lg transition cursor-pointer bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10"
                      title={language === "en" ? "API Debug" : "API 调试"}
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => activeModule && handleGenerateScript(activeModule.id)}
                      disabled={!activeModule || activeModule.scriptStatus === 'generating' || isProjectLocked}
                      className="text-xs px-4 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeModule.scriptStatus === 'generating' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          {language === "en" ? "Generating..." : "生成中..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {language === "en" ? "Generate Interactive Script" : "生成互动脚本"}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Main Dynamic View: Loaded simulator vs. raw codes document */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#050508]/80 relative">
                  
                  {/* Status checklist: checking if script is generated */}
                  {!activeModule ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
                      <Gamepad className="w-12 h-12 text-slate-650 text-slate-600" />
                      <p className="text-sm">{language === "en" ? "No chapter selected. Click a chapter from the left sidebar to start generating." : "尚未选定任何章节，请点击左侧列表的章节进行挂画。"}</p>
                    </div>
                  ) : activeModule.scriptStatus === 'generating' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                      <div className="p-3 bg-cyan-500/10 rounded-full animate-bounce">
                        <Sparkles className="w-8 h-8 text-cyan-405 text-cyan-400" />
                      </div>
                      <div className="font-semibold text-sm text-white">
                        {language === "en" ? `Smart synthesis of interactive challenges for "${activeModule.title}" via [ND-3.5 Academic LLM Engine]...` : `正在通过【ND-3.5-学术大模型引擎】智能合成《${activeModule.title}》的互动挑战试炼...`}
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                        {language === "en" ? "AI advisor is exploring the depth of atomic fusion, divine responsibilities, or If condition scenarios, and planning 3 high-level challenge tiers." : "AI 顾问正在发掘原子融合、众神职责、或是 If 条件抉誓的情景深度，并策划 3 个高水平挑战等级。"}
                      </p>
                      <div className="w-48 bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full w-2/3 animate-pulse rounded-full"></div>
                      </div>
                    </div>
                  ) : activeModule.scriptStatus === 'failed' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2.5">
                      <XCircle className="w-10 h-10 text-red-400 animate-pulse" />
                      <div className="font-semibold text-sm text-white">{language === "en" ? "Interactive script generation failed" : "游戏互动剧本合成失败"}</div>
                      <p className="text-xs text-slate-400">{language === "en" ? "The LLM encountered a slight delay. Please click the retry button to fetch the script." : "大模型通信遇到了一点延迟。请重试按钮拉取脚本。"}</p>
                      <button
                        onClick={() => handleGenerateScript(activeModule.id)}
                        disabled={isProjectLocked}
                        className="text-xs bg-cyan-500 text-white px-4 py-2 hover:bg-[#050508] border border-cyan-500/30 hover:text-cyan-400 rounded-lg font-bold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-500 disabled:hover:text-white"
                      >
                        {language === "en" ? "Retry Generation" : "重新连通生成"}
                      </button>
                    </div>
                  ) : activeModule.scriptStatus === 'pending' ? (
                    <div className="max-w-3xl mx-auto bg-[#0a0a0f] border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded uppercase">
                            Simulation Blueprint
                          </span>
                          <h3 className="text-lg font-bold text-white font-display mt-1 flex items-center gap-1.5">
                            {language === "en" ? "Generate Immersive Interactive Simulator Script" : "生成沉浸式互动模拟器脚本"}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {language === "en" ? "The system will directly generate a structured Markdown spec for AI coding based on the teaching slice, knowledge cohesion analysis, and textbook original text." : "系统会直接根据教学切片、知识内聚分析和教材原文，生成一份可交给 AI coding 的结构化 Markdown 规格。"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs text-slate-300">
                        <div className="space-y-1 bg-[#050508]/60 p-4 rounded-xl border border-white/5">
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">{language === "en" ? "Knowledge Slice Topic" : "知识切片主题"}</span>
                          <p className="font-bold text-white mb-1">{activeModule.title}</p>
                          <p className="text-slate-400 leading-normal">{getSummaryText(activeModule.summary)}</p>
                        </div>
                        <div className="space-y-1 bg-[#050508]/60 p-4 rounded-xl border border-white/5">
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">{language === "en" ? "Knowledge Mechanism & Cohesion" : "知识机制与内聚度"}</span>
                          <p className="text-slate-300 leading-normal font-medium">{getCohesionText(activeModule.cohesionDetail) || getInfoDensityText(activeModule.infoDensity) || (language === "en" ? "No analysis yet" : "暂无分析")}</p>
                        </div>
                      </div>

                      <div className="bg-[#030305]/60 border border-white/5 rounded-xl p-3.5 space-y-2">
                        <span className="text-cyan-400 font-bold block text-[10px] uppercase tracking-wider">
                          {language === "en" ? "Textbook Original Reference" : "教材原文依据"}
                        </span>
                        <div className="text-[11px] text-slate-300 bg-black/50 border border-white/5 p-3 rounded-xl max-h-44 overflow-y-auto select-text leading-relaxed font-sans scrollbar-thin scrollbar-thumb-white/10">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {activeModuleId && extractingModuleId === activeModuleId ? (language === "en" ? "Extracting textbook content..." : "正在提取教材原文...") : (extractedContent || (language === "en" ? "No original text content yet" : "暂无原文内容"))}
                          </ReactMarkdown>
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-xs text-amber-100 leading-relaxed">
                        <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                          <Info className="w-4 h-4" /> {language === "en" ? "Generation Target" : "生成目标"}
                        </div>
                        {language === "en" ? "Not generating a question bank or A/B/C/D multiple choice questions, but generating a simulator design brief complete with 'scene objects, state variables, user actions, feedback rules, and completion conditions'." : "不是生成题库，也不是让学生做 A/B/C/D 选择题，而是生成一个「场景对象、状态变量、用户操作、反馈规则、完成条件」齐备的模拟器设计 brief。"}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateScript(activeModule.id)}
                        disabled={isProjectLocked}
                        className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-xs shadow-[0_0_20px_rgba(6,182,212,0.15)] cursor-pointer bg-cyan-500 hover:bg-cyan-600 text-white border border-cyan-400/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-500 disabled:active:scale-100"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                        {language === "en" ? "Generate Interactive Simulator Script for This Slice" : "生成本切片的互动模拟器脚本"}
                      </button>
                    </div>
                  ) : activeModule.scriptStatus === 'completed' && getSimulationMarkdown(activeModule) ? (
                    <div className="h-full flex flex-col gap-3">
                      <div className="flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded uppercase">
                            Simulation Blueprint
                          </span>
                          <span className="text-xs text-slate-400">《{activeModule.chapterIndex} · {activeModule.title}》</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab(activeTab === 'edit' ? 'simulator' : 'edit')}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer border ${
                              activeTab === 'edit'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {activeTab === 'edit' ? (language === "en" ? "Preview Mode" : "预览模式") : (language === "en" ? "Edit Mode" : "编辑模式")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopySimulationMarkdown(getSimulationMarkdown(activeModule))}
                            className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                          >
                            {scriptCopySuccess ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> {language === "en" ? "Copied" : "已复制"}</> : <><Copy className="w-3.5 h-3.5" /> {language === "en" ? "Copy Markdown" : "复制 Markdown"}</>}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStep(4);
                              addAgentMessage(language === "en" ? "✅ Simulator script confirmed. You can now hand this Markdown brief to the next step AI coding to generate the full interactive webpage." : "✅ 模拟器脚本已确认。你现在可以把这份 Markdown brief 交给下一步 AI coding 生成完整互动网页。", 'script_ready');
                            }}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1 transition shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {language === "en" ? "Confirm Script" : "确认脚本"}
                          </button>
                        </div>
                      </div>

                      {activeTab === 'edit' ? (
                        <textarea
                          value={getSimulationMarkdown(activeModule)}
                          onChange={(e) => handleUpdateSimulationMarkdown(activeModule.id, e.target.value)}
                          readOnly={isProjectLocked}
                          className="flex-1 min-h-[480px] bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-2xl p-4 text-xs text-slate-200 transition resize-none leading-relaxed focus:ring-1 focus:ring-cyan-500 font-mono read-only:cursor-not-allowed"
                        />
                      ) : (
                        <div className="flex-1 bg-[#0a0a0f] border border-white/10 rounded-2xl overflow-y-auto p-6 max-h-[calc(100vh-250px)]">
                          <div className="text-xs text-slate-300 leading-relaxed font-sans overflow-y-auto select-text selection:bg-cyan-500/30 selection:text-white scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{
                              h1: ({ node, ...props }) => (<h1 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6 mb-4 font-display" {...props} />),
                              h2: ({ node, ...props }) => (<h2 className="text-sm font-bold text-white bg-white/5 border-l-2 border-white/20 px-3 py-1.5 mt-6 mb-3 font-mono tracking-wide" {...props} />),
                              h3: ({ node, ...props }) => (<h3 className="text-[11px] font-bold text-white bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg mt-4 mb-2 inline-block font-mono tracking-wider" {...props} />),
                              h4: ({ node, ...props }) => (<h4 className="text-[11px] font-bold text-white bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg mt-5 mb-3 inline-block font-mono tracking-wider" {...props} />),
                              p: ({ node, ...props }) => (<p className="text-xs text-slate-300 leading-relaxed mb-3 font-sans opacity-95" {...props} />),
                              strong: ({ node, ...props }) => (<strong className="text-white font-extrabold" {...props} />),
                              blockquote: ({ node, ...props }) => (<blockquote className="border-l-2 border-white/20 pl-4 py-2 my-3 bg-white/5 rounded-r-lg text-xs text-slate-300 italic" {...props} />),
                              ul: ({ node, ...props }) => (<ul className="list-disc pl-4 space-y-1 my-2.5 text-xs text-slate-300" {...props} />),
                              ol: ({ node, ...props }) => (<ol className="list-decimal pl-4 space-y-1 my-2.5 text-xs text-slate-300" {...props} />),
                              li: ({ node, ...props }) => (<li className="text-xs text-slate-300 leading-relaxed" {...props} />),
                              hr: ({ node, ...props }) => (<hr className="border-t border-white/5 my-4" {...props} />),
                              code: ({ node, ...props }) => (<code className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10.5px] text-slate-200 font-bold" {...props} />),
                              pre: ({ node, ...props }) => (<pre className="bg-black/50 border border-white/10 rounded-lg p-3 my-3 overflow-x-auto text-[10px] font-mono text-slate-300" {...props} />),
                              table: ({ node, ...props }) => (<table className="w-full border-collapse my-4 text-xs" {...props} />),
                              thead: ({ node, ...props }) => (<thead className="bg-white/5" {...props} />),
                              tbody: ({ node, ...props }) => (<tbody {...props} />),
                              tr: ({ node, ...props }) => (<tr className="border-b border-white/10 hover:bg-white/5 transition" {...props} />),
                              th: ({ node, ...props }) => (<th className="text-left px-3 py-2 text-white font-semibold border-r border-white/5 last:border-r-0" {...props} />),
                              td: ({ node, ...props }) => (<td className="px-3 py-2 text-slate-300 border-r border-white/5 last:border-r-0 align-top" {...props} />),
                            }}>{getSimulationMarkdown(activeModule)}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                </div>

              </div>

            </div>
          )}

          {/* Slice AI Config Drawer */}
          <ApiDebugDrawer
            show={showSliceSettings}
            onClose={() => setShowSliceSettings(false)}
            aiEntry="smart-split"
            title={language === "en" ? "Slice - AI Config" : "切片-AI配置"}
            iconColor="text-cyan-400"
            model="deepseek-v4-flash"
            defaultSystemPrompt={sliceSystemPrompt}
            defaultUserPrompt={sliceUserPromptTemplate}
            apiDebugInfo={apiDebugInfo}
          />

          {/* Script Generation AI Config Drawer */}
          <ApiDebugDrawer
            show={showApiDrawer}
            onClose={() => setShowApiDrawer(false)}
            aiEntry="script-gen"
            title={language === "en" ? "Script - AI Config" : "脚本-AI配置"}
            iconColor="text-purple-400"
            model="deepseek-chat"
            defaultSystemPrompt={simulationBlueprintSystemPrompt}
            defaultUserPrompt=""
            apiDebugInfo={apiDebugInfo}
          />

          {/* App Generation AI Config Drawer */}
          <ApiDebugDrawer
            show={showAppApiDrawer}
            onClose={() => setShowAppApiDrawer(false)}
            aiEntry="app-code"
            title={language === "en" ? "App - AI Config" : "App-AI配置"}
            iconColor="text-cyan-400"
            model={appModel}
            defaultSystemPrompt={appApiDebugInfo.systemPrompt}
            defaultUserPrompt={appApiDebugInfo.userPrompt}
            apiDebugInfo={appApiDebugInfo}
          />

          {/* Step 5 View: App Building from selected slice */}
          {activeStep === 5 && (
            <div className="p-4 flex-1 flex flex-col md:flex-row gap-4 overflow-hidden h-full z-10 animate-fadeIn">
              
              {/* Left sidebar: Modules list */}
              <div className="w-full md:w-64 border border-white/10 rounded-2xl bg-[#0a0a0f] p-3 space-y-2 shrink-0 flex flex-col overflow-y-auto max-h-[220px] md:max-h-none">
                <div className="text-[11px] font-bold text-slate-500 px-2 tracking-wider uppercase mb-1 shrink-0">
                  {language === "en" ? "Chapters to Build (Chapter List)" : "待构建切片 (Chapter List)"}
                </div>

                {modules.map((mod) => {
                  const isDone = mod.scriptStatus === 'completed';
                  const isSelected = selectedStep5ModuleId === mod.id;
                  
                  return (
                    <div 
                      key={mod.id}
                      onClick={() => isDone && handleSelectStep5Module(mod.id)}
                      className={`text-left p-2.5 rounded-xl border transition flex flex-col gap-1 w-full shrink-0 cursor-pointer ${
                        isSelected
                          ? 'border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                          : isDone
                          ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10' 
                          : 'border-white/5 bg-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wide">
                          {mod.chapterIndex}
                        </span>

                        <div className="flex items-center gap-1">
                          {isDone ? (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-0.5 border border-emerald-500/20">
                              <Check className="w-2.5 h-2.5" /> {language === "en" ? "Script Ready" : "脚本就绪"}
                            </span>
                          ) : (
                            <span className="text-[9px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-white/5 italic">
                              {language === "en" ? "Not Ready" : "未就绪"}
                            </span>
                          )}
                        </div>
                      </div>

                      <h5 className={`font-semibold text-xs leading-normal line-clamp-1 ${isSelected ? 'text-cyan-400' : isDone ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {mod.title}
                      </h5>
                    </div>
                  );
                })}

                <div className="pt-2 shrink-0 border-t border-white/10 mt-auto">
                  <button 
                    onClick={() => setActiveStep(4)}
                    className="w-full text-center text-xs font-semibold py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl block border border-white/10 transition cursor-pointer"
                  >
                    {language === "en" ? "⚙️ Back to Script Editing" : "⚙️ 返回编辑模拟器脚本"}
                  </button>
                </div>
              </div>

              {/* Right: Build controls and output */}
              <div className="flex-1 overflow-y-auto z-10 w-full">
                <div className="space-y-6 flex flex-col h-full">
              
                <div className="bg-gradient-to-r from-cyan-950/40 to-[#0a0a0f] border border-cyan-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-5 shadow-lg">
                  <div className="p-3 bg-cyan-500/20 text-cyan-400 border border-cyan-400/20 rounded-xl">
                    <Gamepad2 className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-white">
                      {language === "en" ? "Scene Simulation Game Build" : "场景模拟游戏构建"}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      {language === "en" ? "Select a slice with a generated script from the left sidebar, click \"Start Build\", and AI will generate an immersive HTML scene simulation game based on the interactive script." : "选择左侧一个已生成脚本的切片，点击\"开始构建\"，AI 将基于互动脚本内容生成沉浸式 HTML 场景模拟游戏。"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                  
                  {/* Build Controls */}
                  <div className="space-y-6">
                    
                    {/* Selected slice info */}
                    {selectedStep5ModuleId && (
                      <div className="bg-[#0a0a0f] border border-white/10 rounded-xl p-4">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{language === "en" ? "Selected Slice" : "当前选中切片"}</div>
                        {(() => {
                          const mod = modules.find(m => m.id === selectedStep5ModuleId);
                          if (!mod) return null;
                          return (
                            <div>
                              <div className="text-sm font-semibold text-cyan-400">{mod.chapterIndex} · {mod.title}</div>
                              <div className="text-xs text-slate-400 mt-1 line-clamp-3">
                                {mod.coveredChapters && `${language === "en" ? "Covered Chapters" : "覆盖章节"}: ${mod.coveredChapters}`}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Build Action */}
                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleGenerateFinalApp}
                          disabled={isGeneratingApp || !selectedStep5ModuleId || isProjectLocked}
                          className="flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed bg-cyan-500 hover:bg-cyan-600 cursor-pointer"
                        >
                          {isGeneratingApp ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              {language === "en" ? "AI is generating the scene simulation game..." : "AI 正在生成场景模拟游戏..."}
                            </>
                          ) : (
                            <>
                              <Download className="w-5 h-5" />
                              {selectedStep5ModuleId ? (language === "en" ? 'Start Build' : '开始构建') : (language === "en" ? 'Please select a slice first' : '请先选择一个切片')}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setShowAppApiDrawer(true)}
                          className="p-3 rounded-xl transition cursor-pointer bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10 shrink-0"
                          title={language === "en" ? "API Debug" : "API 调试"}
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-center text-[10px] text-slate-500 mt-3 flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" /> {language === "en" ? "Generated using DeepSeek V4 Flash model" : "使用 DeepSeek V4 Flash 模型生成"}
                      </p>
                    </div>

                  </div>

                  {/* Live Output Pane */}
                  <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl flex flex-col overflow-hidden h-full min-h-[400px]">
                  <div className="bg-[#050508] border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                        <Settings className="w-4 h-4 text-cyan-400" /> {language === "en" ? "Scene Simulation Game" : "场景模拟游戏"}
                      </div>
                      
                      {finalCode && (
                        <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
                          <button
                            onClick={() => setOutputTab('preview')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              outputTab === 'preview'
                                ? 'bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Play className="w-2.5 h-2.5" />
                            {language === "en" ? "Preview" : "效果预览 (Preview)"}
                          </button>
                          <button
                            onClick={() => setOutputTab('code')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              outputTab === 'code'
                                ? 'bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Code2 className="w-2.5 h-2.5" />
                            {language === "en" ? "Code" : "查看代码 (Code)"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {finalCode && outputTab === 'preview' && (
                        <button
                          onClick={() => setIsFullscreen(true)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded text-[10px] font-bold transition cursor-pointer"
                        >
                          <Maximize2 className="w-3.5 h-3.5" /> {language === "en" ? "Full Experience" : "全屏体验"}
                        </button>
                      )}

                      {finalCode && (
                         <button
                           onClick={handleDownloadFinalCode}
                           className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-white rounded text-[10px] font-bold transition cursor-pointer"
                         >
                           <Download className="w-3.5 h-3.5" /> {language === "en" ? "Download HTML File" : "下载 HTML 文件"}
                         </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto bg-[#0a0a0f] select-text w-full max-w-full flex flex-col">
                    {isGeneratingApp ? (
                      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-cyan-500 animate-pulse py-12">
                        <Terminal className="w-10 h-10 animate-spin" />
                        <div className="text-center font-sans font-semibold text-sm">
                          {">"} {language === "en" ? "AI is generating the scene simulation game..." : "AI 正在生成场景模拟游戏..."}
                        </div>
                      </div>
                    ) : finalCode ? (
                      outputTab === 'preview' ? (
                        <iframe
                          srcDoc={finalCode}
                          className="w-full h-full border-0 min-h-[500px]"
                          sandbox="allow-scripts allow-same-origin"
                          title="Scene Simulation Preview"
                        />
                      ) : (
                        <div className="p-4 overflow-auto select-text flex-1">
                          <pre className="text-cyan-200/80 text-[11px] font-mono whitespace-pre leading-relaxed">{finalCode}</pre>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-650 py-12">
                        <Code2 className="w-12 h-12 stroke-1 text-slate-600" />
                        <span className="font-sans text-xs text-slate-500">{language === "en" ? "No generated code yet. Please configure settings on the left and click \"Build\" to generate." : "暂无生成代码，请在左侧设定后点击\"打包生成\""}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
              </div>
            </div>
            </div>
          )}

        </div>

      </div>

      {/* Style Guide Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPreviewModal(false)}>
          <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {language === "en" ? "Markdown Rendering Style Example" : "Markdown 渲染样式示例"}
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Modal content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-xs text-slate-300 leading-relaxed font-sans select-text selection:bg-cyan-500/30 selection:text-white">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{
                  h1: ({ node, ...props }) => (<h1 className="text-lg font-bold text-white mb-3 mt-4" {...props} />),
                  h2: ({ node, ...props }) => (<h2 className="text-sm font-bold text-cyan-400 bg-cyan-500/5 border-l-2 border-cyan-500/50 px-3 py-1.5 mt-6 mb-3 font-mono tracking-wide" {...props} />),
                  h3: ({ node, ...props }) => (<h3 className="text-[11px] font-bold text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded-lg mt-4 mb-2 inline-block font-mono tracking-wider" {...props} />),
                  h4: ({ node, ...props }) => (<h4 className="text-[11px] font-bold text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded-lg mt-5 mb-3 inline-block font-mono tracking-wider" {...props} />),
                  p: ({ node, ...props }) => (<p className="text-xs text-slate-300 leading-relaxed mb-3 font-sans opacity-95" {...props} />),
                  strong: ({ node, ...props }) => (<strong className="text-white font-extrabold" {...props} />),
                  em: ({ node, ...props }) => (<em className="text-slate-200 italic" {...props} />),
                  blockquote: ({ node, ...props }) => (<blockquote className="border-l-2 border-cyan-500/30 pl-4 py-2 my-4 bg-cyan-500/5 rounded-r-lg" {...props} />),
                  ul: ({ node, ...props }) => (<ul className="list-disc pl-4 space-y-1 my-2.5 text-xs text-slate-300" {...props} />),
                  ol: ({ node, ...props }) => (<ol className="list-decimal pl-4 space-y-1 my-2.5 text-xs text-slate-300" {...props} />),
                  li: ({ node, ...props }) => (<li className="text-xs text-slate-300 leading-relaxed" {...props} />),
                  hr: ({ node, ...props }) => (<hr className="border-t border-white/10 my-6" {...props} />),
                  code: ({ node, className, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[10.5px] text-cyan-200 font-bold" {...props} />
                    ) : (
                      <code className="block bg-black/30 border border-white/10 rounded-lg p-3 my-3 font-mono text-[11px] text-cyan-200 overflow-x-auto" {...props} />
                    );
                  },
                  img: ({ node, src, alt, ...props }) => src ? (<img src={src} alt={alt} className="max-w-full h-auto rounded-lg border border-white/10 my-4 shadow-lg" {...props} />) : null,
                  table: ({ node, ...props }) => (<table className="w-full border-collapse my-4 text-xs" {...props} />),
                  thead: ({ node, ...props }) => (<thead className="bg-cyan-500/10" {...props} />),
                  tbody: ({ node, ...props }) => (<tbody {...props} />),
                  tr: ({ node, ...props }) => (<tr className="border-b border-white/10 hover:bg-white/5 transition" {...props} />),
                  th: ({ node, ...props }) => (<th className="text-left px-3 py-2 text-cyan-300 font-semibold border-r border-white/5 last:border-r-0" {...props} />),
                  td: ({ node, ...props }) => (<td className="px-3 py-2 text-slate-300 border-r border-white/5 last:border-r-0 align-top" {...props} />),
                }}>{styleGuideDemo}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Game Preview Portal overlay */}
      {isFullscreen && finalCode && (
        <div className="fixed inset-0 bg-[#050508] z-[999] flex flex-col animate-in fade-in duration-250 overflow-hidden">
          
          {/* Header Controls */}
          <div className="flex items-center justify-between bg-[#0a0a0f]/80 backdrop-blur-sm border-b border-white/10 px-4 md:px-6 py-3 shrink-0">
            <div className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-pulse text-cyan-400" />
              <span>{language === "en" ? "Immersive Sandbox Game Mode" : "智能全屏沉浸试炼模式 (Immersive Sandbox Game Mode)"}</span>
            </div>
            
            <button
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition border border-rose-500/20 shadow-md cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              {language === "en" ? "Exit Fullscreen" : "退出全屏 (Exit Fullscreen)"}
            </button>
          </div>

          {/* Sandbox Body wrapper - full screen width */}
          <div className="flex-1 w-full overflow-hidden flex flex-col">
            <iframe
              srcDoc={finalCode}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="Scene Simulation Fullscreen Preview"
            />
          </div>

        </div>
      )}

      {/* 新建项目弹窗 */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreated={handleNewProjectCreated}
        />
      )}

      {/* 编辑项目弹窗（仅修改名称，复用 NewProjectModal 编辑模式） */}
      {editingProject && (
        <NewProjectModal
          editProject={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={async () => {
            await loadProjectList();
            setEditingProject(null);
          }}
        />
      )}

    </div>
  );
}
