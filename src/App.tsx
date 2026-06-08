import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from "react";
import { 
  Upload, BookOpen, Sparkles, Play, Check, Plus, Trash2, Edit3, Layers, 
  MessageSquare, Send, RefreshCw, FileText, Settings, ArrowRight, Gamepad2, 
  CheckCircle2, XCircle, Compass, HelpCircle, Info, Download, Copy, AlertCircle, 
  Award, Trophy, ChevronRight, CornerDownRight, Volume2, Gamepad, Lock, Code2, Terminal,
  Maximize2, Minimize2, X, Image as ImageIcon, Eye
} from "lucide-react";

// Error Boundary 组件 - 防止整个应用崩溃
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
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-lg text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">应用发生错误</h2>
            <p className="text-slate-400 text-sm mb-4">{this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition"
            >
              刷新页面
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
  SummaryInfo, InfoDensity, CohesionDetail, ExtractedImage
} from "./types";
import { parseTextToDirectory, serializeDirectoryToText } from "./utils/directoryParser";
import { getExtractedTextForModule, getExtractedTextForModuleAsync, calculateAutoPageOffset } from "./utils/textbookMatcher";
import StandalonePreview from "./components/StandalonePreview";
import ReactMarkdown from "react-markdown";

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
      text: "您好！我是您的 **AI 游戏课件规划师**。🧙‍♂️\n\n我可以帮您将任何枯燥的**PDF课本/论文**转换成一整套**趣味盎然的主题探索互动游戏**。\n\n请在右侧选择一个我为您准备的**经典课程模版**开始体验，或者直接拖放您的 **PDF 课本文件**，由我来进行人工智能解析与游戏关卡架构！",
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
  const [scriptCopySuccess, setScriptCopySuccess] = useState<boolean>(false);
  const [recommendingId, setRecommendingId] = useState<string | null>(null);
  const [extractedContent, setExtractedContent] = useState<string>("");
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [extractingModuleId, setExtractingModuleId] = useState<string | null>(null);
  const [extractedModules, setExtractedModules] = useState<Record<string, string>>({});
  const [moduleImages, setModuleImages] = useState<Record<string, ExtractedImage[]>>({});
  
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewContent, setPreviewContent] = useState<string>("");

  // Step 4 States: UI Preference and App Generation
  const [uiTheme, setUiTheme] = useState<'minimal' | 'cyberpunk' | 'cartoon' | 'retro'>('minimal');
  const [primaryColor, setPrimaryColor] = useState<string>('#06b6d4');
  const [isGeneratingApp, setIsGeneratingApp] = useState(false);
  const [finalCode, setFinalCode] = useState<string>('');
  const [codeCopySuccess, setCodeCopySuccess] = useState<boolean>(false);
  const [outputTab, setOutputTab] = useState<'code' | 'preview'>('preview');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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
      return `概念数: ${d.conceptCount}, 事实数: ${d.factCount}, 抽象度: ${d.abstractLevel}, 嵌套: ${d.nestingLevel || '无'}, 建议时长: ${d.suggestedMinutes || '10-15'}\n${d.rationale}`;
    }
    return '';
  };

  const getCohesionText = (cohesionDetail: BookModule['cohesionDetail']): string => {
    if (typeof cohesionDetail === 'string') return cohesionDetail || '';
    if (cohesionDetail && typeof cohesionDetail === 'object') {
      const c = cohesionDetail as CohesionDetail;
      return `类型: ${c.cohesionType}\n核心问题: ${c.coreQuestion}\n${c.mechanism}`;
    }
    return '';
  };


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
  const [showProjectList, setShowProjectList] = useState<boolean>(false);

  // Ref pointers for list scroll anchors
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat log to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // 进入第三步时，自动批量提取所有切片的原文内容（有缓存，不重复提取）
  const batchExtractingRef = useRef(false);

  useEffect(() => {
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
            }).catch(err => console.error("保存提取内容失败:", err));
          }
        } catch (err) {
          setExtractedModules(prev => ({ ...prev, [mod.id]: `⚠️ 提取失败: ${(err as Error).message}` }));
        } finally {
          setExtractingModuleId(prev => prev === mod.id ? null : prev);
        }
      }
      batchExtractingRef.current = false;
    };

    extractAll();
  }, [activeStep, pdfData, modules, currentProjectId]);

  // 当切换选中模块时，从缓存中读取原文内容和图片
  useEffect(() => {
    if (activeModuleId && extractedModules[activeModuleId]) {
      setExtractedContent(extractedModules[activeModuleId]);
      setExtractedImages(moduleImages[activeModuleId] || []);
    } else if (activeModuleId && !extractingModuleId) {
      setExtractedContent("⏳ 正在提取中...");
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
      
      const briefAgentText = `已载入模板课本：**${template.title}** (${template.subject})。\n\n这是一部涵盖丰富知识点的学习材料。请点击底下固定的 **“✨ 教材内容智能切片”** 按钮开展智能拆分！我将为它量身定做趣味互动学习模型。`;
      addAgentMessage(briefAgentText);
    }
  };

  // Helper additions for chat history
  const addUserMessage = (text: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { id: `user-${Date.now()}`, sender: "user", text, timestamp };
    setMessages(prev => [...prev, userMsg]);
  };

  const addAgentMessage = (text: string, type: 'text' | 'blueprint_ready' | 'script_ready' = 'text', metadata?: any) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const agentMsg: Message = { id: `agent-${Date.now()}`, sender: "agent", text, timestamp, type, metadata };
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

  // Load a specific project
  const loadProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error("Failed to load project");
      }
      const project = await response.json();

      setCurrentProjectId(projectId);
      setBookTitle(project.bookTitle || project.name || "");
      setBookContentText(project.bookContentText || "");
      setPdfFileName(project.pdfFileName || "");
      setPdfData(project.pdfData || null);

      if (project.directoryItems) {
        try {
          const parsed = JSON.parse(project.directoryItems);
          setDirectoryItems(parsed);
        } catch (e) {
          console.error("Failed to parse directory items:", e);
        }
      }

      if (project.modules) {
        try {
          const parsedModules = JSON.parse(project.modules);
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

      let msg = `📂 **已加载项目：${project.name}**\n\n`;
      if (project.pdfFileName) msg += `📄 PDF：${project.pdfFileName}\n`;
      if (project.bookTitle) msg += `📖 教材：《${project.bookTitle}》\n`;
      if (project.directoryItems) {
        try {
          const dirs = JSON.parse(project.directoryItems);
          msg += `📑 目录：${Array.isArray(dirs) ? dirs.length : 0} 个章节节点\n`;
        } catch {}
      }
      if (project.modules) {
        try {
          const mods = JSON.parse(project.modules);
          if (Array.isArray(mods) && mods.length > 0) {
            msg += `🧩 策划大纲：${mods.length} 个切片\n`;
          }
        } catch {}
      }
      msg += `\n您可以继续之前的编辑工作。`;
      try { addAgentMessage(msg); } catch (e) { console.error("addAgentMessage error:", e); }

      setShowProjectList(false);
    } catch (err) {
      console.error("Failed to load project:", err);
      // 即使出错，如果数据已经加载成功，不显示错误提示
      if (!bookTitle && !modules.length) {
        alert("加载项目失败，请重试。");
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
    if (!confirm("确定要删除这个项目吗？此操作不可撤销。")) return;
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
    if (!confirm(`确定要删除选中的 ${selectedProjects.size} 个项目吗？此操作不可撤销。`)) return;
    
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
      alert("当前没有可保存的切片数据！");
      return;
    }
    try {
      const modulesJson = JSON.stringify(modules);
      localStorage.setItem(SAVED_MODULES_KEY, modulesJson);
      setHasSavedModules(true);
      alert(`✅ 已成功保存 ${modules.length} 个切片！下次加载将优先使用保存的切片。`);
    } catch (err) {
      console.error("保存切片失败:", err);
      alert("保存切片失败，请检查浏览器存储空间。");
    }
  }, [modules, SAVED_MODULES_KEY]);

  // Load modules from localStorage
  const loadModulesFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(SAVED_MODULES_KEY);
      if (!saved) {
        alert("没有找到已保存的切片数据。");
        return false;
      }
      const parsedModules: BookModule[] = JSON.parse(saved);
      if (!Array.isArray(parsedModules) || parsedModules.length === 0) {
        alert("保存的切片数据格式无效。");
        return false;
      }
      setModules(parsedModules);
      setActiveStep(2);
      addAgentMessage(
        `📂 **已加载保存的切片方案！**\n\n已从本地存储中恢复了 **${parsedModules.length} 个核心教学单元**：\n` +
        parsedModules.map(m => ` - **${m.sliceId || m.chapterIndex} ${m.title}**: ${typeof m.summary === 'string' ? m.summary : (m.summary as any)?.learnedPoints?.[0] || '核心概念'}`).join("\n") +
        `\n\n您可以直接使用这些切片继续后续操作，或者点击"🔄 重新 AI 切片"按钮生成新的切片方案。`
      );
      return true;
    } catch (err) {
      console.error("加载切片失败:", err);
      alert("加载切片失败，请检查数据格式。");
      return false;
    }
  }, [SAVED_MODULES_KEY, addAgentMessage]);

  // Client Custom PDF File Loader logic
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type !== "application/pdf") {
      alert("请上传有效的 PDF 格式教材文档。");
      return;
    }

    setPdfFileName(file.name);
    setBookTitle(file.name.replace(/\.[^/.]+$/, ""));
    setPdfReaderLoading(true);
    setPdfExtractionProgress("正在挂载 PDF 解析器并提取文本数据...");

    const fileReader = new FileReader();
    fileReader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
        
        // Safely extract text utilizing client-side CDN pdf.js
        const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
        if (!pdfjsLib) {
          throw new Error("PDF.js 脚本未能在本容器内及时加载，请尝试刷新。");
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        
        setPdfExtractionProgress(`正在解析 PDF (共 ${totalPages} 页)...`);
        
        let extractedText = "";
        const pagesTextList: string[] = [];
        // Read upper limit of 150 pages to cover full textbook chapters without causing browser lag
        const pageLimit = Math.min(totalPages, 150);
        
        for (let i = 1; i <= pageLimit; i++) {
          setPdfExtractionProgress(`正在逐页提取文本及页码对齐数据 (${i} / ${pageLimit})...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map((item: any) => item.str);
          const pageText = pageStrings.join(" ");
          pagesTextList.push(pageText);
          extractedText += pageText + "\n";
        }

        if (!extractedText.trim()) {
          throw new Error("该 PDF 似乎是扫描版或图片文档，未能提取到物理文本。我们已为您装载演示用模拟大纲。");
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
            
            await createNewProject(
              projectName,
              file.name,
              base64Pdf,
              projectName,
              extractedText,
              parsedOutline,
              []
            );
            setShowProjectList(true);
            addAgentMessage(`📦 **成功收到您上传的教材电子书：**\n《${file.name}》\n\n项目 **"${projectName}"** 已创建并保存到数据库！\n\n我已在浏览器终端成功无损读取了前 **${pageLimit} 页** 的文本（约 ${extractedText.length} 字），并智能探测出**印刷页与PDF物理页的偏差偏移量 (Offset) 为 \`${autoOffset >= 0 ? "+" : ""}${autoOffset}\` 页**。\n\n系统已对教材页面完成了降噪对齐与目录抽取。我已为您打开左侧的“我的项目”列表，您可以看到新创建的项目。接下来，请在右侧页面底部点击 **"✨ 教材内容智能切片"**，我们即可完成智能内容切块！`);
          } catch (err) {
            console.error("Failed to create project in base64Reader:", err);
            addAgentMessage(`📦 **成功收到您上传的教材电子书：**\n《${file.name}》\n\n项目 **"${projectName}"** 已收到并完成解析，但数据库存储时遇到问题：${(err as Error).message || err}。您仍可在当前会话中体验完整教学切片与大纲设计！`);
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
        addAgentMessage(`⚠️ **PDF读取提醒：** ${err.message || "由于文件版本或者同源限制原因无法静默提取。"}\n\n不用担心！我已经为你自动载入了通用的**《高阶综合科学教材纲要》**文本作为底页，现在您仍然可以点击右侧页面底部 **“✨ 教材内容智能切片”**，完美体验全套 AI 节点设计流程！`);
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
      alert("⚠️ 请先在左侧选择一本书或上传PDF！\n\n当前未检测到课本名称。");
      return;
    }
    if (!directoryItems || directoryItems.length === 0) {
      alert("⚠️ 当前课本没有可用的目录数据！\n\n请先确认左侧已选择/上传了课本。");
      return;
    }
    if (!bookContentText || !bookContentText.trim()) {
      alert("⚠️ 当前课本内容为空！\n\n请重新选择或上传PDF。");
      return;
    }

    setIsParsing(true);
    setParseError("");
    setModules([]);

    // Don't reset currentProjectId - we want to update the existing project if one exists
    const existingProjectId = currentProjectId;

    addAgentMessage(
      `🪐 正在为《${bookTitle}》生成 AI 切片方案...\n\n` +
      `📚 书名：${bookTitle}\n` +
      `📂 目录章节数：${directoryItems.length}\n` +
      `📋 目录预览：${directoryItems.slice(0, 3).map(d => d.title).join("、")}...\n\n` +
      `正在使用 **DeepSeek V4 Flash** 模型分析目录结构，请稍候 3-8 秒...`
    );

    // 构造API请求数据 - 完全使用当前状态值
    const requestPayload = {
      title: bookTitle,
      directoryStructure: directoryItems
    };

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
        throw new Error(errorData?.message || errorData?.error || `分析失败 - 状态码: ${response.status}`);
      }

      const rawResponse: any = await response.json();
      const { _meta, ...data } = rawResponse;
      
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
      setRawBlueprintData(currentRawBlueprint);
      console.log("\n📥 ========== RECEIVED FROM API ==========");
      console.log("📕 bookTitle from AI:", data.bookTitle);
      console.log("📊 totalSlices from AI:", data.totalSlices);
      console.log("📋 Number of slices received:", data.slices?.length || data.modules?.length || 0);
      console.log("🔍 First slice:", JSON.stringify((data.slices || data.modules || [])[0], null, 2));
      console.log("=========================================\n");

      const rawModules = data.slices || data.modules || [];

      if (rawModules.length === 0) {
        throw new Error("AI返回的切片为空，请重试或检查prompt");
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
        `🎉 **学科游戏化分层规划方案已制定就绪！**\n\n我已将书籍《${responseTitle || bookTitle}》细切为 **${formattedModules.length} 个核心教学单元**：\n` +
        moduleSummaries +
        `\n\n在右侧的工作区中，您现在可以对这一套课程大纲开展**自由编辑与完全订正**。您可以修改任何章节标题，或者自定义真实的冲突模拟场景及核心玩法规范！数据已自动保存到数据库中。`,
        "blueprint_ready"
      );

    } catch (err: any) {
      console.error("❌ handleSplitBook error:", err);
      setIsParsing(false);
      setParseError(err.message || "网络请求超时，请重试。");
      setAiMeta({
        model: aiMeta?.model || "unknown",
        provider: aiMeta?.provider || "unknown",
        systemInstruction: aiMeta?.systemInstruction || "",
        userPrompt: aiMeta?.userPrompt || "",
        callTime: new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'fail'
      });
      addAgentMessage(`❌ **AI 切片生成失败**\n\n错误信息：${err.message || "未知错误"}\n\n请检查：\n1. 终端是否显示 API Key 配置正确\n2. 网络是否能访问 DeepSeek API\n3. 浏览器控制台的详细错误日志`);
      alert(`切片生成失败：${err.message || "未知错误"}`);
    }
  };

  // API 2: Single module interactive script generator
  const handleGenerateScript = async (moduleId: string) => {
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;

    setScriptGenerating(prev => ({ ...prev, [moduleId]: true }));
    
    // Update state to generating
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, scriptStatus: 'generating' } : m));

    try {
      const { extractedOriginalText } = await getExtractedTextForModuleAsync(
        mod, directoryItems, bookContentText,
        pdfData,
        pdfPagesText.length > 0 ? pdfPagesText : undefined,
        pdfPageOffset,
        undefined,
        currentProjectId
      );

      const payload = {
        bookTitle: bookTitle,
        chapterTitle: mod.title,
        chapterIndex: mod.chapterIndex,
        summary: mod.summary,
        gameType: mod.gameType,
        gameTitle: mod.gameTitle,
        gameRules: mod.gameRules,
        extractedContent: extractedOriginalText.substring(0, 8000)
      };

      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Script generation request error");
      }

      const scriptData = await response.json();
      
      const finishedScript: GameScript = {
        id: `script-${mod.id}`,
        moduleId: mod.id,
        gameType: mod.gameType,
        introduction: scriptData.introduction,
        challenges: scriptData.challenges,
        conclusion: scriptData.conclusion
      };

      setModules(prev => prev.map(m => 
        m.id === moduleId 
          ? { ...m, scriptStatus: 'completed', script: finishedScript } 
          : m
      ));
      
      // Save script to database
      await saveScriptToProject(moduleId, finishedScript);
      
      setScriptGenerating(prev => ({ ...prev, [moduleId]: false }));

      // If this is the active module being viewed, initialize the play state instantly
      if (activeModuleId === moduleId) {
        initGameSession(finishedScript);
      }

    } catch (err: any) {
      console.error(err);
      setScriptGenerating(prev => ({ ...prev, [moduleId]: false }));
      setModules(prev => prev.map(m => m.id === moduleId ? { ...m, scriptStatus: 'failed' } : m));
    }
  };

  // Re-extract PDF text from stored PDF data if needed
  const reExtractPdfText = useCallback(async () => {
    if (!pdfData || pdfPagesText.length > 0) return;
    try {
      setPdfReaderLoading(true);
      setPdfExtractionProgress("正在从存储的 PDF 文件重新提取文本...");
      
      const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
      if (!pdfjsLib) {
        throw new Error("PDF.js 脚本未能在本容器内及时加载，请尝试刷新。");
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
      
      setPdfExtractionProgress(`正在解析 PDF (共 ${totalPages} 页)...`);
      
      let extractedText = "";
      const pagesTextList: string[] = [];
      const pageLimit = Math.min(totalPages, 150);
      
      for (let i = 1; i <= pageLimit; i++) {
        setPdfExtractionProgress(`正在逐页提取文本及页码对齐数据 (${i} / ${pageLimit})...`);
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
      "📋 **已为您进入第三阶段：分块教材内容精确审查！**\n\n" +
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
      addAgentMessage(`🏆 **试炼捷报！** 刚刚在关卡单元 **“${modules.find(m => m.id === script.moduleId)?.title}”** 中完成了仿真测试，最终斩获比分：**${gameSession.score + (gameSession.isCorrect ? 10 : 0)} 分**！\n学子们通过这套答题，能够立刻对章节的难点加深物理概念。您可以随时在下方切换其他模块进行校准！`);
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
      addAgentMessage("😊 抱歉，我的网络微处理器开小差了。但我已经帮您把教学数据牢牢存储在内存中了，您可以在右侧直接点选和编辑！");
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
      chapterIndex: `章节 ${newIdx}`,
      title: "自拟新知识主题 (Custom Concept Node)",
      coveredChapters: `${modules.length + 1}.1`,
      summary: "围绕该自拟节点，进行更具探索性和创造性的多模态课业考究。",
      infoDensity: "根据单学时极限，精炼切面，负荷处在自学吸收的最佳区间内。",
      cohesionDetail: "此单元的核心考点属于因果串联结构，极其适合进行联合探究与思维内化。",
      gameType: "quiz",
      gameTitle: "新知识英雄决斗 (The Concept Duel)",
      gameRules: "玩家面临多级学术决策，必须依靠精密的逻辑和教材知识才能克服各种科学魔障。",
      duration: "10分钟",
      designRationale: "使用单人闭环探究游戏，让学员亲自在危机中做出策略抉择，加深原理运用。",
      scriptStatus: 'pending'
    };
    setModules(prev => [...prev, newMod]);
    
    addUserMessage(`➕ 增加了一个全新的课程单元：章节 ${newIdx}`);
    addAgentMessage(`好的！我已经为您创建了全新的自定义单元。您可以在大纲面板中直接写入定制的教材细节，稍后我们将为您一次性生成专属游戏剧本！`);
  };

  // Deletes single curriculum chapter
  const handleDeleteModule = (id: string) => {
    const deletedMod = modules.find(m => m.id === id);
    setModules(prev => prev.filter(m => m.id !== id));
    addUserMessage(`🗑️ 移除了课程关卡：${deletedMod?.title || "未定义章节"}`);
  };

  // Helper translations Chinese tags helper
  const getGameTypeChinese = (type: GameType) => {
    switch (type) {
      case "quiz": return "知识抢答 (Quiz)";
      case "cross-match": return "消消乐搭配 (Match)";
      case "fill-blank": return "填空魔法 (Fill-Blank)";
      case "interactive-story": return "文字冒险 (Narrative)";
      case "coding-puzzle": return "代码拼图 (Code Logic)";
      case "math-quest": return "算术极速逃脱 (Math Run)";
      default: return "互动试炼";
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

    navigator.clipboard.writeText(formattedText).then(() => {
      setScriptCopySuccess(true);
      setTimeout(() => setScriptCopySuccess(false), 2000);
    });
  };

  const handleGenerateFinalApp = () => {
    setIsGeneratingApp(true);
    addAgentMessage(`🚀 正在启动**独立应用构建引擎**... 我将综合您的 ${modules.length} 个关卡剧本数据，融合 ${uiTheme} 主题与指定色调（${primaryColor}），为您生成一组可直接运行的完整包含本地状态存储的 React/TypeScript 代码方案。稍等...`);
    
    setTimeout(() => {
      setIsGeneratingApp(false);
      setFinalCode(`// ==========================================
// 自动生成 - 交互教材小游戏整合游戏机
// 教材书籍: 《${bookTitle}》
// UI 主题: ${uiTheme} | 强调色: ${primaryColor}
// 包含关卡数: ${modules.length}
// ==========================================

import React, { useState } from 'react';

// 注入用户完全定制与AI策划的本章关卡剧本数据
const GAME_MODULES = ${JSON.stringify(modules.map(m => ({ title: m.title, chapterIndex: m.chapterIndex, gameType: m.gameType, gameTitle: m.gameTitle, gameRules: m.gameRules, script: m.script })), null, 2)};

export default function StandaloneEduGame() {
  const [activeModule, setActiveModule] = useState(0);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'feedback' | 'completed' | 'all-done'>('intro');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState<string>('');
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  
  const activeChapter = GAME_MODULES[activeModule];
  const script = activeChapter?.script;
  const challenge = script?.challenges?.[currentChallenge];

  // UI Theme specific Tailwind Styles definitions
  const themeStyles = {
    minimal: {
      bg: 'bg-slate-50 text-slate-900 font-sans',
      card: 'bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-5',
      button: 'bg-[#18181b] hover:bg-[#27272a] text-white rounded-xl py-2.5 px-4 font-medium transition',
      optionBtn: 'border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 font-medium text-left p-3.5 rounded-xl transition',
      title: 'text-slate-950 font-bold tracking-tight',
      badge: 'bg-slate-150 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono',
      input: 'border border-slate-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-slate-900 outline-none w-full bg-slate-50 text-slate-900',
      successCard: 'bg-emerald-50 text-emerald-800 border border-emerald-150 p-4 rounded-xl space-y-1',
      failCard: 'bg-rose-50 text-rose-800 border border-rose-150 p-4 rounded-xl space-y-1'
    },
    cyberpunk: {
      bg: 'bg-[#05050a] text-cyan-400 font-mono relative',
      card: 'bg-[#0a0a14] border-2 border-cyan-500/30 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.15)] p-6 space-y-5',
      button: 'bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-400 rounded-xl py-2.5 px-4 font-bold tracking-wide transition uppercase',
      optionBtn: 'border border-cyan-500/20 hover:border-cyan-400 bg-[#080810] hover:bg-cyan-950/20 text-slate-300 hover:text-cyan-400 text-left p-3.5 rounded-xl transition',
      title: 'text-white font-black tracking-widest uppercase text-cyan-400',
      badge: 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/40 px-2.5 py-1 rounded-md text-[10px] font-bold',
      input: 'border border-cyan-500/30 rounded-xl p-3 text-xs focus:ring-1 focus:ring-cyan-400 outline-none w-full bg-[#050510] text-cyan-300 font-mono',
      successCard: 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30 p-4 rounded-xl space-y-1',
      failCard: 'bg-rose-950/30 text-rose-300 border border-rose-500/30 p-4 rounded-xl space-y-1'
    },
    cartoon: {
      bg: 'bg-amber-100 text-amber-900 font-sans font-medium',
      card: 'bg-white border-4 border-amber-400 rounded-3xl shadow-[0_8px_0_#d97706] p-6 space-y-5',
      button: 'bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-2xl border-b-4 border-amber-600 font-bold text-center py-2.5 px-4 transition active:translate-y-0.5',
      optionBtn: 'border-2 border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-100/50 text-amber-950 font-semibold text-left p-3.5 rounded-2xl transition',
      title: 'text-amber-900 font-extrabold text-2xl tracking-normal',
      badge: 'bg-amber-400/20 text-amber-600 font-extrabold px-3 py-1 rounded-full text-[10px]',
      input: 'border-2 border-amber-300 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-amber-400 outline-none w-full bg-amber-50 text-amber-950 font-bold',
      successCard: 'bg-emerald-100 text-emerald-900 border-2 border-emerald-300 p-4 rounded-xl space-y-1',
      failCard: 'bg-rose-105 bg-rose-100 text-rose-900 border-2 border-rose-300 p-4 rounded-xl space-y-1'
    },
    retro: {
      bg: 'bg-slate-950 text-fuchsia-400 font-mono relative',
      card: 'bg-black border-4 border-double border-fuchsia-500 shadow-[6px_6px_0_#d946ef] p-6 space-y-5',
      button: 'bg-fuchsia-950 hover:bg-fuchsia-900 border-2 border-fuchsia-500 text-fuchsia-300 py-2.5 px-4 font-bold transition tracking-tight',
      optionBtn: 'border border-fuchsia-500/30 hover:border-fuchsia-500 bg-black hover:bg-fuchsia-950/30 text-slate-400 hover:text-fuchsia-350 text-left p-3.5 transition',
      title: 'text-fuchsia-400 font-bold tracking-tight uppercase',
      badge: 'bg-fuchsia-950 text-fuchsia-400 border border-fuchsia-500 px-2 py-0.5 text-[10px] font-bold',
      input: 'border-2 border-fuchsia-500 bg-black text-fuchsia-300 p-3 text-xs focus:ring-1 focus:ring-fuchsia-400 outline-none w-full',
      successCard: 'bg-stone-900 text-green-400 border border-green-500 p-4 space-y-1',
      failCard: 'bg-stone-900 text-red-400 border border-red-500 p-4 space-y-1'
    }
  };

  const st = themeStyles['${uiTheme}'] || themeStyles.minimal;

  const handleStartGame = () => {
    setGameState('playing');
    setCurrentChallenge(0);
    setSelectedOpt(null);
    setTextAnswer('');
  };

  const handleSelectOption = (opt: string) => {
    if (!challenge) return;
    setSelectedOpt(opt);
    const correct = opt.trim().toLowerCase() === challenge.correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);
    if (correct) {
      setScore(prev => prev + 10);
    }
    setGameState('feedback');
  };

  const handleSubmitText = () => {
    if (!challenge || !textAnswer.trim()) return;
    const correct = textAnswer.trim().toLowerCase() === challenge.correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);
    if (correct) {
      setScore(prev => prev + 10);
    }
    setGameState('feedback');
  };

  const handleNextChallenge = () => {
    if (!script) return;
    const nextIdx = currentChallenge + 1;
    if (nextIdx >= (script.challenges || []).length) {
      setGameState('completed');
    } else {
      setCurrentChallenge(nextIdx);
      setSelectedOpt(null);
      setTextAnswer('');
      setGameState('playing');
    }
  };

  const handleNextModule = () => {
    const nextModIdx = activeModule + 1;
    if (nextModIdx >= GAME_MODULES.length) {
      setGameState('all-done');
    } else {
      setActiveModule(nextModIdx);
      setGameState('intro');
    }
  };

  const handleRestart = () => {
    setActiveModule(0);
    setScore(0);
    setGameState('intro');
  };

  return (
    <div className={"min-h-screen p-4 md:p-8 " + st.bg + " flex flex-col items-center justify-center"}>
      
      {/* Retro scanline overlay decoration */}
      {"${uiTheme}" === 'retro' && (
        <div className="absolute inset-0 bg-[radial-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_100%)] pointer-events-none z-50"></div>
      )}

      <div className="w-full max-w-2xl space-y-6">
        
        {/* Header Metadata */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <h1 className="text-xl font-bold font-display" style={{ color: '${primaryColor}' }}>
              《${bookTitle}》· 智能交互随身学
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">教材游戏化转换系统出品 · 主题模式：${uiTheme}</p>
          </div>
          <div className="flex items-center gap-3">
            {activeChapter && (
              <span className={st.badge}>
                关卡 {activeModule + 1} / {GAME_MODULES.length}
              </span>
            )}
            <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              🏅 总积分: {score}
            </span>
          </div>
        </header>

        {/* Dynamic game stages rendering */}
        {gameState === 'intro' && activeChapter && (
          <div className={st.card}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{activeChapter.chapterIndex}</span>
            </div>
            
            <h2 className={"text-xl font-bold font-display " + st.title}>
              🎮 {activeChapter.gameTitle}
            </h2>

            <div className="p-4 bg-slate-950/40 rounded-xl border border-white/10 leading-relaxed text-slate-300 italic text-sm">
              “{script?.introduction || ("本章带您深入浅出领略 " + activeChapter.title + " 的精彩原理。准备接受试炼了吗？")}”
            </div>

            <div className="p-3.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-xs text-slate-400 leading-relaxed">
              <span className="font-extrabold text-cyan-400 block mb-0.5">🧭 关卡规则：</span>
              {activeChapter.gameRules}
            </div>

            <button onClick={handleStartGame} className={"w-full " + st.button}>
              载入神力，开辟试炼 🚀
            </button>
          </div>
        )}

        {gameState === 'playing' && challenge && (
          <div className={st.card}>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-400">推进进度: 挑战 {currentChallenge + 1} / {(script?.challenges || []).length}</span>
              <span className="font-mono">难点点位 A-{currentChallenge + 1}</span>
            </div>

            <div className="bg-slate-950/50 p-2 text-xs font-bold text-slate-300 rounded border-l-4 border-cyan-500">
              🛡️ {challenge.title}
            </div>

            <h3 className="text-base font-semibold leading-relaxed text-slate-200">
              {challenge.prompt}
            </h3>

            {/* OPTIONS */}
            {challenge.options && challenge.options.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 pt-2">
                {challenge.options.map((opt: string, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => handleSelectOption(opt)}
                    className={st.optionBtn}
                  >
                    <span className="w-5 h-5 bg-white/5 rounded-md flex items-center justify-center text-[10px] font-bold text-slate-400 border border-white/10 shrink-0 mr-3 inline-flex">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <input 
                  type="text"
                  placeholder="请输入您的学术关键字..."
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitText()}
                  className={st.input}
                />
                <button onClick={handleSubmitText} className={"w-full " + st.button}>
                  核实并提交验证 🖋️
                </button>
              </div>
            )}
          </div>
        )}

        {gameState === 'feedback' && challenge && (
          <div className={st.card}>
            <h3 className="text-xs font-bold text-slate-400 uppercase">问卜审核日志</h3>
            
            {isCorrect ? (
              <div className={st.successCard}>
                <div className="font-extrabold flex items-center gap-1.5 text-sm h-6">
                  ✨ 恭喜，回答完全正确！ 积分 +10
                </div>
                <p className="text-xs leading-relaxed opacity-90 p-1">
                  {challenge.feedbackCorrect}
                </p>
              </div>
            ) : (
              <div className={st.failCard}>
                <div className="font-extrabold flex items-center gap-1.5 text-sm h-6">
                  ❌ 答题偏位，我们需要总结
                </div>
                <p className="text-xs leading-relaxed opacity-90 p-1">
                  {challenge.feedbackIncorrect}
                </p>
              </div>
            )}

            <div className="p-3.5 bg-slate-950/40 rounded-xl text-xs text-slate-400">
              教材官方标准解答：<span className="text-cyan-400 font-bold underline select-all">{challenge.correctAnswer}</span>
            </div>

            <button onClick={handleNextChallenge} className={"w-full " + st.button}>
              继续后行挑战关卡 🏆
            </button>
          </div>
        )}

        {gameState === 'completed' && activeChapter && (
          <div className={st.card}>
            <div className="text-center space-y-4 py-3">
              <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center text-white text-2xl mx-auto shadow-md">
                🏅
              </div>
              <div>
                <h2 className={"text-lg font-extrabold " + st.title}>
                  🎉 通关成功！《{activeChapter.title}》
                </h2>
                <p className="text-xs text-slate-400 mt-1">您已完成了该章节的所有游戏指标</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/40 border border-white/10 rounded-xl leading-relaxed text-xs text-slate-300">
              <span className="font-bold text-amber-500 block mb-1">💡 知识点总结复盘：</span>
              {script?.conclusion || '您已经圆满掌握了本节课文的科学内含与公式。'}
            </div>

            <button onClick={handleNextModule} className={"w-full " + st.button}>
              开启下个章节游戏战役 🗺️
            </button>
          </div>
        )}

        {gameState === 'all-done' && (
          <div className={st.card}>
            <div className="text-center space-y-4 py-8">
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-5xl mx-auto animate-bounce">
                👑
              </div>
              <div className="space-y-1">
                <h2 className={"text-2xl font-black tracking-tight " + st.title}>
                  🎓 整书大满贯，学业完成！
                </h2>
                <p className="text-xs text-slate-450 text-slate-400">
                  您已经完成了整部教材《${bookTitle}》的所有小游戏。
                </p>
              </div>
            </div>

            <div className="bg-amber-500/10 border-2 border-amber-500/20 p-5 rounded-2xl text-center space-y-1 max-w-md mx-auto">
              <div className="text-[11px] text-slate-550 text-slate-400 uppercase font-bold tracking-wider">终极成绩单总比分</div>
              <div className="text-3xl font-black text-amber-500">{score} 点学业分</div>
              <div className="text-xs text-amber-700 font-semibold">授予评级：SS 顶阶智慧先锋学者</div>
            </div>

            <button onClick={handleRestart} className={"w-full " + st.button}>
              重启整书学科卡牌游戏 🔄
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
      `);
      setOutputTab('preview');
      addAgentMessage(`✅ **生成完毕！** 我已经根据你当前的最新模块大纲、**${uiTheme} 主题** 风格以及最新的游戏脚本剧本，为您独家产出了最完美的 StandaloneeduGame 独立全功能游戏整合客户端代码方案（包含了自动答卷、游戏交互和所有积分总结）。\n\n您可以点击右侧 “拷贝到本地执行” 并在您的任何 React 物理项目(例如 App.tsx)中开始运行它！`, 'text');
    }, 3000);
  };

  const handleCopyFinalCode = () => {
    navigator.clipboard.writeText(finalCode).then(() => {
      setCodeCopySuccess(true);
      setTimeout(() => setCodeCopySuccess(false), 2000);
    });
  };

  const getActiveModule = () => {
    return modules.find(m => m.id === activeModuleId) || null;
  };

  const activeModule = getActiveModule();

  return (
    <div className="flex flex-col h-screen bg-[#050508] text-slate-200 font-sans overflow-hidden relative z-10">
      
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
                  ND教学互动AIGC-Agent
                </div>
                <div className="text-[11px] text-cyan-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-455 text-cyan-400" />
                  智能内容切片与互动剧本生成
                </div>
              </div>
            </div>
            
            {/* Minimal decoration */}
            <div className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-1 rounded text-slate-400">
              version 1.0.22
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
                          课程大纲结构准备生成完毕！
                        </div>
                        <button 
                          onClick={() => setActiveStep(2)}
                          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-400/25 cursor-pointer"
                        >
                          立即查看/编辑大纲清单 <ArrowRight className="w-3 h-3" />
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
              placeholder="向 AI 代理咨询改进玩法、生成规则提示..."
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
          title="左右拖拽调整物理区域占比 (拖曳此分割线)"
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
            <div className="flex items-center gap-2 text-slate-200">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span className="font-semibold text-sm">
                {activeStep === 1 ? "第一阶段：分析并挂载教材数据源" : 
                 activeStep === 2 ? "第二阶段：教学进度大纲大盘与规则编辑" : 
                 activeStep === 3 ? "第三阶段：小游戏仿真演练及剧本代码" :
                 "第四阶段：UI主题渲染与独立游戏代码导出"}
              </span>
            </div>
            
            {/* Step navigation shortcut pins */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveStep(1)}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  activeStep === 1 
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                1. 导入课件
              </button>
              <button 
                onClick={() => modules.length > 0 && setActiveStep(2)}
                disabled={modules.length === 0}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  modules.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
                } ${
                  activeStep === 2 
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                2. 课程切片
              </button>
              <button 
                onClick={async () => {
                  if (modules.length === 0) return;
                  await reExtractPdfText();
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
                  activeStep === 3 
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                3. 切片内容提取
              </button>
              <button 
                onClick={() => modules.length > 0 && setActiveStep(4)}
                disabled={modules.length === 0}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  modules.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
                } ${
                  activeStep === 4 
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                4. 互动脚本生成
              </button>
              <button 
                onClick={() => modules.some(m => m.scriptStatus === 'completed') && setActiveStep(5)}
                disabled={!modules.some(m => m.scriptStatus === 'completed')}
                className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  !modules.some(m => m.scriptStatus === 'completed') ? 'opacity-30 cursor-not-allowed' : ''
                } ${
                  activeStep === 5 
                    ? 'bg-cyan-500 border-cyan-500 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-white/5 border-white/10 text-slate-450 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                5. App 构建
              </button>
            </div>
          </div>

          {/* Step 1 View: Load Book and Uploading PDF */}
          {activeStep === 1 && (
            <div className="flex-1 flex flex-col min-h-0 w-full animate-fadeIn z-10 overflow-hidden">
              {/* Scrollable Container */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  
                  {/* Introduction Call-out Section */}
                  <div className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-lg">
                    <div className="flex gap-5 items-start md:items-center">
                      <div className="p-3.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl shrink-0">
                        <BookOpen className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base font-display text-white">
                          一书变多关：一站式 AI 教学方案生成器
                        </h3>
                        <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                          在下方挂载您已准备的小学、初高中或者成人专业培训 PDF 教料。系统将智能识别内容，秒级提炼子单元并配套高可玩性的连连看、剧情抉择、代码拼图等闯关，供您定制和下载！
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectTemplate("astro-phys")}
                      className="px-4 py-2.5 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)] hover:shadow-[0_0_16px_rgba(6,182,212,0.6)] rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 self-stretch md:self-center cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      使用样例数据
                    </button>
                  </div>

                  {/* Project List Panel */}
                  {showProjectList && (
                    <div className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          我的项目列表
                        </h4>
                        <div className="flex items-center gap-3">
                          {selectedProjects.size > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                已选 {selectedProjects.size} 项
                              </span>
                              <button
                                type="button"
                                onClick={handleBatchDelete}
                                className="text-[10px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/20 transition cursor-pointer flex items-center gap-1"
                                title="批量删除"
                              >
                                <Trash2 className="w-3 h-3" />
                                删除
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={selectAllProjects}
                            className="text-[10px] font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-full border border-white/10 transition cursor-pointer"
                          >
                            {selectedProjects.size === projectList.length ? '取消全选' : '全选'}
                          </button>
                          <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                            {projectList.length} 个项目
                          </span>
                        </div>
                      </div>
                      {projectList.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">暂无保存的项目</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {projectList.map(project => (
                            <div
                              key={project.id}
                              className={`flex items-center justify-between p-3 border rounded-xl hover:bg-white/[0.07] active:scale-[0.99] transition-all duration-200 group cursor-pointer ${
                                selectedProjects.has(project.id)
                                  ? 'border-cyan-500/60 bg-cyan-500/10'
                                  : 'border-white/10 bg-white/5 hover:border-cyan-500/40'
                              }`}
                              onClick={() => loadProject(project.id)}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProjectSelection(project.id);
                                  }}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition cursor-pointer shrink-0 ${
                                    selectedProjects.has(project.id)
                                      ? 'border-cyan-500 bg-cyan-500 text-white'
                                      : 'border-white/20 hover:border-white/40'
                                  }`}
                                >
                                  {selectedProjects.has(project.id) && (
                                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                                      <FileText className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-white truncate leading-tight">{project.name}</p>
                                      <p className="text-[11px] text-slate-400 mt-0.5">
                                        {project.bookTitle || "未指定教材"}
                                        {project.modules ? ` • ${JSON.parse(project.modules).length} 个切片` : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-slate-600 mt-1 ml-9">
                                    {new Date(project.updatedAt).toLocaleString("zh-CN")}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProject(project.id);
                                }}
                                className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                                title="删除项目"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

              {/* Custom PDF File Upload box */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    上传本地 PDF 开辟自定义教材（100% 真实解析）
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowProjectList(!showProjectList)}
                    className="px-4 py-2 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)] hover:shadow-[0_0_16px_rgba(6,182,212,0.6)] rounded-xl transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    我的项目 ({projectList.length})
                  </button>
                </div>

                <div className="border border-dashed border-white/20 rounded-2xl bg-white/5 p-8 flex flex-col items-center justify-center text-center relative hover:border-cyan-500 hover:bg-white/10 transition">
                  <input 
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  
                  <div className="p-3 bg-white/5 rounded-full text-slate-300 mb-3 border border-white/10">
                    <FileText className="w-8 h-8" />
                  </div>

                  {pdfFileName ? (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-emerald-400 flex items-center gap-1.5 justify-center">
                        <Check className="w-4 h-4" /> 已绑定文档：{pdfFileName}
                      </span>
                      <p className="text-xs text-slate-500">点击或再次拖拽文件可以自由重新更换</p>
                    </div>
                  ) : pdfData ? (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-cyan-400 flex items-center gap-1.5 justify-center">
                        <Check className="w-4 h-4" /> 已从项目加载 PDF
                      </span>
                      <p className="text-xs text-slate-500">PDF 文件已还原，点击可替换</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-white">
                        将 PDF 电子书拖拽至此，或点此浏览上传
                      </p>
                      <p className="text-xs text-slate-550 text-slate-500 mt-1">
                        支持任意格式 PDF 发掘内容，客户端自动抽取最核心物理内容发送大模型
                      </p>
                    </div>
                  )}

                  {/* Extract loading indicator */}
                  {pdfReaderLoading && (
                    <div className="mt-4 p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center gap-2.5 max-w-md mx-auto">
                      <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                      <span className="text-xs text-cyan-200 font-medium">{pdfExtractionProgress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Text Input edit fallback box */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-cyan-400" />
                    教材提取文本预览与校验（支持补充或自拟内容）
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
                        🗂️ 智能目录格式 (Structured TOC)
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
                        ✏️ 提取排版源码 (Raw Text)
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">书籍/课件自定义标题 (Book Title)</label>
                    <input 
                      type="text"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      placeholder="例如：《高等有机化学概要第一篇》"
                      className="w-full bg-[#0a0a0f] focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg px-3.5 py-1.5 text-sm text-slate-100 transition"
                    />
                  </div>

                  {bookInputMode === 'toc' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs text-slate-450 text-slate-400 font-bold flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                          已识别层级架构 (共 {directoryItems.length} 个章节节点 / 拖拽或手动微调)
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addDirectoryItem('chapter')}
                            className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            添加大章 (Chapter)
                          </button>
                          <button
                            type="button"
                            onClick={() => addDirectoryItem('section')}
                            className="text-[10px] font-bold text-teal-400 bg-teal-500/10 hover:bg-teal-500/25 border border-teal-500/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            添加小节 (Section)
                          </button>
                        </div>
                      </div>

                      {directoryItems.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 border border-dashed border-white/10 rounded-2xl bg-[#0a0a0f]/40">
                          <BookOpen className="w-8 h-8 mx-auto text-slate-600 mb-2 stroke-1" />
                          <p className="text-xs font-medium">暂无核心目录框架</p>
                          <p className="text-[11px] text-slate-500 mt-1">请载入上方经典模版或者拖拽挂载 PDF 文档，我将为您全盘智能解析！</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 select-text">
                          {directoryItems.map((item) => {
                            const isCh = item.type === 'chapter';
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between gap-3 group transition-all duration-150 ${
                                  isCh 
                                    ? 'bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 pl-3.5' 
                                    : 'bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 border-dashed rounded-lg p-2.5 pl-3 ml-6 md:ml-8 relative'
                                }`}
                              >
                                {/* Left tree indentation line marker */}
                                {!isCh && (
                                  <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-5 h-5 border-l-2 border-b-2 border-white/10 rounded-bl-lg pointer-events-none"></div>
                                )}

                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {isCh ? (
                                    <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                                  ) : (
                                    <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  )}

                                  <input
                                    type="text"
                                    value={item.title}
                                    onChange={(e) => updateDirectoryItemTitle(item.id, e.target.value)}
                                    placeholder={isCh ? "例如：第一章 万有引力与多体物理机制" : "例如：1.1 核心公式及恒星聚变反应条件"}
                                    className={`w-full bg-transparent outline-none text-xs text-slate-200 border-b border-transparent focus:border-cyan-500/40 py-0.5 transition ${
                                      isCh ? 'font-bold text-slate-105 text-sm' : 'text-slate-300'
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
                                      placeholder="P"
                                      className="w-12 bg-transparent text-center font-mono text-[11px] font-bold text-cyan-400 outline-none border-none"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => deleteDirectoryItem(item.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                    title="移除该层级"
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
                        <label className="block text-[11px] font-bold text-slate-400">核心文本片段预览（AI 大纲生成的主要引流资料）</label>
                        <span className="text-[10px] text-slate-500">直接修改可实时和智能目录互相绑定</span>
                      </div>
                      <textarea 
                        value={bookContentText}
                        onChange={(e) => {
                          setBookContentText(e.target.value);
                          setDirectoryItems(parseTextToDirectory(e.target.value));
                        }}
                        placeholder="您可以直接手动在这里粘贴任意教材的目录或文本段落进行一键解析......"
                        className="w-full h-48 bg-[#0a0a0f] focus:bg-[#050508] border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg p-3 text-xs font-mono text-slate-300 transition resize-y"
                      />
                    </div>
                  )}
                </div>
              </div>

            </div> {/* max-w-4xl */}
          </div> {/* flex-1 overflow-y-auto */}

          {/* Core CTA Sticky Footer */}
          <div className="shrink-0 p-4 bg-[#0a0a0f] border-t border-white/10 flex items-center justify-between gap-4 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20">
            <div className="text-xs text-slate-400">
              {bookContentText ? `当前载入教材文本: ${bookContentText.length} 字符` : "教材尚未载入"}
            </div>

            <div className="flex items-center gap-3">
              {parseError && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/30 text-red-200 text-xs rounded-xl flex items-center gap-2 max-w-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="line-clamp-1">{parseError}</span>
                </div>
              )}

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
                    教材切片解析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    教材内容智能切片
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
                    🗺️ 课程切片策划大纲
                  </h3>
                  {aiMeta && (
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400">
                        最后调用：{aiMeta.callTime || "未知"}
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
                      <span>📊 表格视图</span>
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
                      <span>🎴 精美卡片</span>
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
                      <span>🔧 原始数据</span>
                    </button>
                  </div>

                  <button
                    onClick={handleAddCustomModule}
                    type="button"
                    className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-400/20 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    手动增设新关卡
                  </button>

                  <button
                    onClick={() => handleSplitBook(true)}
                    type="button"
                    disabled={isParsing || !bookContentText.trim()}
                    className={`text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition border cursor-pointer ${
                      isParsing || !bookContentText.trim()
                        ? 'bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-400 border-amber-500/20 hover:border-amber-400/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    }`}
                  >
                    <Sparkles className={`w-4 h-4 ${isParsing ? 'animate-spin' : ''}`} />
                    {isParsing ? 'AI 解析中...' : '✨ AI 重新切片'}
                  </button>
                </div>
              </div>

              {/* TABLE VIEW (Primary / Default) */}
              {step2ViewMode === 'table' && (
                <div className="overflow-x-auto border border-white/10 rounded-2xl bg-[#09090e] shadow-xl">
                  <table className="w-full text-left border-collapse min-w-[1300px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-[11px] font-bold text-slate-300 font-display">
                        <th className="p-3 w-[70px] text-center">学时编号</th>
                        <th className="p-3 w-[120px]">覆盖教材章节</th>
                        <th className="p-3 w-[160px]">知识切片主题</th>
                        <th className="p-3 w-[180px]">涵盖核心考点 / 概念</th>
                        <th className="p-3 w-[95px] text-center">预计自学时间</th>
                        <th className="p-3 w-[280px]">⚡ 信息负荷合理性评估</th>
                        <th className="p-3 w-[280px]">🎯 主干考点内聚性与关联机制</th>
                        <th className="p-3 w-[240px]">📋 整体设计概要</th>
                        <th className="p-3 w-[55px] text-center">移除</th>
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
                              placeholder="如 Topic 1.1-1.3"
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
                              placeholder="完整列出该切片包含的所有知识点和核心概念"
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-300 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                            />
                          </td>

                          {/* Col 5: Duration */}
                          <td className="p-2 py-3 text-center">
                            <input 
                              type="text"
                              value={mod.duration || "10分钟"}
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
                              placeholder="明确说明为什么这个切片的信息负荷是合理的，分析认知负载、概念深度和时间分配"
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-200 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                            />
                          </td>

                          {/* Col 7: Cohesion Detail */}
                          <td className="p-2 py-3">
                            <textarea 
                              value={getCohesionText(mod.cohesionDetail)}
                              onChange={(e) => handleUpdateModule(mod.id, { cohesionDetail: e.target.value })}
                              rows={3}
                              placeholder="说明教学核心是什么，各知识点之间的关联性和为什么可以聚合为一个章节"
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-300 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                            />
                          </td>

                          {/* Col 8: Design Rationale */}
                          <td className="p-2 py-3">
                            {typeof mod.designRationale === 'object' && mod.designRationale !== null ? (
                              <div className="space-y-2">
                                <div>
                                  <p className="text-[10px] font-semibold text-cyan-400 mb-1">学了什么：</p>
                                  <textarea
                                    value={(mod.designRationale as any).learnedPoints || ""}
                                    onChange={(e) => handleUpdateModule(mod.id, {
                                      designRationale: { learnedPoints: e.target.value, practicalProblems: (mod.designRationale as any).practicalProblems || "" }
                                    })}
                                    rows={2}
                                    placeholder="列出 3-5 条可陈述的知识点"
                                    className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-400 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                                  />
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold text-amber-400 mb-1">解决的实际问题：</p>
                                  <textarea
                                    value={(mod.designRationale as any).practicalProblems || ""}
                                    onChange={(e) => handleUpdateModule(mod.id, {
                                      designRationale: { learnedPoints: (mod.designRationale as any).learnedPoints || "", practicalProblems: e.target.value }
                                    })}
                                    rows={2}
                                    placeholder="列出 2-3 个场景，描述能用这些知识解决什么问题"
                                    className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-400 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                                  />
                                </div>
                              </div>
                            ) : (
                              <textarea 
                                value={(mod.designRationale as string) || ""}
                                onChange={(e) => handleUpdateModule(mod.id, { designRationale: e.target.value })}
                                rows={3}
                                placeholder="整体设计概要：学生如何通过此切片学习、学到什么内容、能解决什么实际问题"
                                className="w-full bg-transparent border-0 border-b border-transparent focus:border-cyan-500 outline-none text-slate-400 focus:bg-black/40 rounded p-1 resize-y leading-relaxed text-[11px]"
                              />
                            )}
                          </td>

                          {/* Col 9: Delete operation */}
                          <td className="p-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(mod.id)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition mt-1 cursor-pointer"
                              title="移除此模块"
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
                              覆盖章节: {mod.coveredChapters || "暂未填写"}
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                              📖 {getExtractedTextForModule(mod, directoryItems, bookContentText, pdfPagesText, pdfPageOffset).mappedPages}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => handleDeleteModule(mod.id)}
                              className="p-1 px-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              移除该章
                            </button>
                          </div>
                        </div>

                        {/* Editing fields content body */}
                        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                          
                          {/* Chapter Academic Details (Left Side col-4) */}
                          <div className="col-span-1 md:col-span-4 space-y-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                知识切片主题
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
                                  覆盖教材章节
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
                                  预计自学时间
                                </label>
                                <input 
                                  type="text"
                                  value={mod.duration || "10分钟"}
                                  onChange={(e) => handleUpdateModule(mod.id, { duration: e.target.value })}
                                  className="w-full bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs font-semibold text-slate-200 transition"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                涵盖核心考点 / 概念
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
                                  ⚡ 信息负荷合理性评估 (密度控制)
                                </label>
                                <textarea 
                                  value={getInfoDensityText(mod.infoDensity)}
                                  onChange={(e) => handleUpdateModule(mod.id, { infoDensity: e.target.value })}
                                  className="w-full h-32 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-250 text-slate-200 transition resize-none leading-relaxed"
                                  placeholder="衡量信息吞吐量，评估单学时，防范负荷过载阻碍。"
                                />
                              </div>
                            </div>

                            <div className="col-span-1">
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                🎯 主干考点内聚性与关联机制
                              </label>
                              <textarea 
                                value={getCohesionText(mod.cohesionDetail)}
                                onChange={(e) => handleUpdateModule(mod.id, { cohesionDetail: e.target.value })}
                                className="w-full h-32 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-300 transition resize-none leading-relaxed"
                                placeholder="说明此组核心考点的内在强耦合原理或逻辑链条。"
                              />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                🎓 深度研习目标与学术应用级价值
                              </label>
                              {typeof mod.designRationale === 'object' && mod.designRationale !== null ? (
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-[10px] font-semibold text-cyan-400 mb-1">学了什么：</p>
                                    <textarea
                                      value={(mod.designRationale as any).learnedPoints || ""}
                                      onChange={(e) => handleUpdateModule(mod.id, {
                                        designRationale: { learnedPoints: e.target.value, practicalProblems: (mod.designRationale as any).practicalProblems || "" }
                                      })}
                                      className="w-full h-16 bg-[#050508] hover:bg-white/5 focus:bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-slate-400 transition resize-none leading-relaxed"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-amber-400 mb-1">解决的实际问题：</p>
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
                      <CollapsibleSection title="🤖 调用的AI模型信息" defaultOpen={true}>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
{`模型名称：${aiMeta.model}
服务商：${aiMeta.provider}
API地址：https://api.deepseek.com/chat/completions`}
                        </pre>
                      </CollapsibleSection>

                      <CollapsibleSection title="📋 系统指令（System Instruction）" defaultOpen={false}>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
{aiMeta.systemInstruction}
                        </pre>
                      </CollapsibleSection>

                      <CollapsibleSection title="📝 用户指令（User Prompt）" defaultOpen={true}>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                          {aiMeta.userPrompt}
                        </pre>
                      </CollapsibleSection>

                      <CollapsibleSection title="📤 AI返回的原始数据" defaultOpen={true}>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-[50vh] overflow-y-auto">
                          {rawBlueprintData || "数据为空"}
                        </pre>
                      </CollapsibleSection>
                    </>
                  ) : (
                    <div className="border border-white/10 rounded-2xl bg-[#09090e] p-6 text-center text-slate-400">
                      <p>暂无AI调用数据，请先执行 AI 切片</p>
                      {modules.length > 0 && (
                        <div className="mt-4">
                          <CollapsibleSection title="📤 当前加载的切片数据" defaultOpen={true}>
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
                  返回导入课本
                </button>
                <button 
                  onClick={handleGenerateAllScripts}
                  className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/25 cursor-pointer"
                >
                  一键确认，精确审查教材对齐原文并仿真 <ArrowRight className="w-4 h-4" />
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
              
              <div className="flex flex-col md:flex-row gap-4">
              {/* Left sidebar: Modules list */}
              <div className="w-full md:w-64 border border-white/10 rounded-2xl bg-[#0a0a0f] p-3 space-y-2 shrink-0 flex flex-col overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-500 px-2 tracking-wider uppercase mb-1 shrink-0">
                  教材学习关卡 (Chapter List)
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
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> 提取中...
                            </span>
                          ) : isExtracted ? (
                            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 border border-blue-500/20">
                              <BookOpen className="w-2.5 h-2.5" /> 已提取
                            </span>
                          ) : null}
                          {isDone ? (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-0.5 border border-emerald-500/20">
                              <Check className="w-2.5 h-2.5" /> Playable
                            </span>
                          ) : isGen ? (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 animate-pulse border border-amber-500/20">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Coding...
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
                    <h4 className="font-semibold text-sm text-white font-display">{activeModule ? `《${activeModule.chapterIndex} · ${activeModule.title}》` : "等待载入章节"}</h4>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {pdfPagesText && pdfPagesText.length > 0 && (
                      <div className="flex items-center gap-2 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/15 p-1 px-2 rounded-lg transition">
                        <span className="text-[9px] text-cyan-300 font-semibold select-none">Offset</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setPdfPageOffset(prev => prev - 1)} className="w-4 h-4 bg-white/5 hover:bg-cyan-500/20 text-cyan-400 active:scale-95 rounded flex items-center justify-center text-[10px] border border-white/5 font-bold cursor-pointer" title="向前偏移一页">-</button>
                          <input type="number" value={pdfPageOffset} onChange={(e) => setPdfPageOffset(parseInt(e.target.value, 10) || 0)} className="w-7 bg-black/80 border border-white/10 text-center font-mono text-[9px] font-bold text-cyan-200 py-0 rounded outline-none focus:border-cyan-400" />
                          <button type="button" onClick={() => setPdfPageOffset(prev => prev + 1)} className="w-4 h-4 bg-white/5 hover:bg-cyan-500/20 text-cyan-400 active:scale-95 rounded flex items-center justify-center text-[10px] border border-white/5 font-bold cursor-pointer" title="向后偏移一页">+</button>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            const autoOffset = calculateAutoPageOffset(directoryItems, pdfPagesText);
                            setPdfPageOffset(autoOffset);
                          }} 
                          className="w-4 h-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 active:scale-95 rounded flex items-center justify-center text-[10px] border border-cyan-500/30 cursor-pointer" 
                          title="重新计算偏移量"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                      <span className="text-[9px] text-cyan-300 font-semibold select-none">页码</span>
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
                              }).catch(err => console.error("保存提取内容失败:", err));
                            }
                          } catch (err) {
                            setExtractedContent(`⚠️ 提取失败: ${(err as Error).message}`);
                            setExtractingModuleId(null);
                          }
                        }}
                        className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full transition text-[9px] font-semibold cursor-pointer"
                        title="重新提取本切片原文"
                      >
                        <RefreshCw className="w-3 h-3" />
                        重新提取
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {!activeModule ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
                      <BookOpen className="w-12 h-12 text-slate-600" />
                      <p className="text-sm">尚未选定任何章节，请点击左侧列表的章节查看教材原文。</p>
                    </div>
                  ) : (
                    <div className="animate-fadeIn p-5">
                      <div className="text-xs text-slate-300 leading-relaxed font-sans overflow-y-auto select-text selection:bg-cyan-500/30 selection:text-white scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                          <ReactMarkdown components={{
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
                          }}>{activeModuleId && extractingModuleId === activeModuleId ? "⏳ 正在从 PDF 提取内容..." : (extractedContent || "请点击左侧列表选择章节查看原文")}</ReactMarkdown>
                        </div>
                      
                      {/* 显示提取的图片 */}
                      {extractedImages.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
                            <ImageIcon className="w-3.5 h-3.5" />
                            提取的图片 ({extractedImages.length})
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {extractedImages.map((img, idx) => (
                              <div key={idx} className="relative group">
                                <img
                                  src={img.url}
                                  alt={img.filename}
                                  className="w-full h-auto rounded-lg border border-white/10 shadow-lg transition-transform group-hover:scale-[1.02]"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white px-2 py-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                  {img.filename}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {activeModule && (
                      <div className="p-3.5 bg-cyan-500/5 rounded-xl border border-cyan-500/10 flex items-start gap-2.5 mt-4">
                        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-slate-400 leading-relaxed">
                          <span className="font-semibold text-slate-300">智能对齐提示：</span> 系统通过在教材大纲中模糊匹配该知识切片的 <strong>"覆盖章节"</strong> 属性（此处为 <code>{activeModule.coveredChapters}</code>），从而锚定了原始教材中的对应章节主题及其前后的课本段落原文。
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
                    ⚙️ 返工修改大纲设定
                  </button>
                  <button 
                    onClick={() => { setActiveStep(4); addAgentMessage("✅ **已进入第四阶段：互动脚本生成！**\n\n现在您可以为每个章节生成仿真剧本、编辑参数、查看代码。"); }}
                    className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/25 cursor-pointer"
                  >
                    ✨ 进入互动脚本生成 <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Interactive Playable Simulator and Export codes panel */}
          {activeStep === 4 && (
            <div className="p-4 flex-1 flex flex-col md:flex-row gap-4 overflow-hidden h-full z-10 animate-fadeIn">
              
              {/* Sub Column left sidebar: Modules Menu list */}
              <div className="w-full md:w-64 border border-white/10 rounded-2xl bg-[#0a0a0f] p-3 space-y-2 shrink-0 flex flex-col overflow-y-auto max-h-[220px] md:max-h-none">
                <div className="text-[11px] font-bold text-slate-500 px-2 tracking-wider uppercase mb-1 shrink-0">
                  教材学习关卡 (Chapter List)
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
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> 提取中...
                            </span>
                          ) : isExtracted ? (
                            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 border border-blue-500/20">
                              <BookOpen className="w-2.5 h-2.5" /> 已提取
                            </span>
                          ) : null}
                          {isDone ? (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-0.5 border border-emerald-500/20">
                              <Check className="w-2.5 h-2.5" /> Playable
                            </span>
                          ) : isGen ? (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 animate-pulse border border-amber-500/20">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Coding...
                            </span>
                          ) : !isExtracted ? (
                            <span className="text-[9px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-white/5 italic">
                              Pending
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <h5 className={`font-semibold text-xs leading-normal line-clamp-1 ${isActive ? 'text-cyan-400 font-bold' : 'text-slate-300'}`}>
                        {mod.title}
                      </h5>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-450 text-slate-400 line-clamp-1"> {mod.gameTitle}</span>
                        {/* Preview button */}
                        {extractedModules[mod.id] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewContent(extractedModules[mod.id]);
                              setShowPreviewModal(true);
                            }}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition flex items-center gap-0.5 cursor-pointer"
                            title="预览原文渲染效果"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </button>
                  );
                })}

                <div className="pt-2 shrink-0 border-t border-white/10 mt-auto">
                  <button 
                    onClick={() => setActiveStep(2)}
                    className="w-full text-center text-xs font-semibold py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl block border border-white/10 transition cursor-pointer"
                  >
                    ⚙️ 返工修改大纲设定
                  </button>
                </div>
              </div>

              {/* Sub Column Middle/Right: Interactive Simulator Terminal & raw scripts files */}
              <div className="flex-1 border border-white/10 rounded-2xl bg-[#0a0a0f] flex flex-col h-full overflow-hidden">
                
                {/* Simulator controls header bar */}
                <div className="bg-[#0a0a0f] px-5 py-3 border-b border-white/10 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-cyan-500 text-white font-extrabold px-2 py-0.5 rounded shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                      SIMULATOR
                    </span>
                    <h4 className="font-semibold text-sm text-white font-display">
                      {activeModule ? `《${activeModule.chapterIndex} · ${activeModule.title}》` : "等待载入章节"}
                    </h4>
                  </div>

                  {/* Simulator vs Script Code Tabs */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setActiveTab('simulator')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 cursor-pointer ${
                        activeTab === 'simulator' 
                          ? 'bg-cyan-500 text-white font-semibold shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      运行仿真实验 (Play simulator)
                    </button>

                    <button 
                      onClick={() => setActiveTab('edit')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 cursor-pointer ${
                        activeTab === 'edit' 
                          ? 'bg-cyan-500 text-white font-semibold shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      修改确认脚本 (Edit script)
                    </button>
                    
                    <button 
                      onClick={() => setActiveTab('code')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 cursor-pointer ${
                        activeTab === 'code' 
                          ? 'bg-cyan-500 text-white font-semibold shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      查看游戏剧本代码 (Script code)
                    </button>
                  </div>
                </div>

                {/* Main Dynamic View: Loaded simulator vs. raw codes document */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#050508]/80 relative">
                  
                  {/* Status checklist: checking if script is generated */}
                  {!activeModule ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
                      <Gamepad className="w-12 h-12 text-slate-650 text-slate-600" />
                      <p className="text-sm">尚未选定任何章节，请点击左侧列表的章节进行挂画。</p>
                    </div>
                  ) : activeModule.scriptStatus === 'generating' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                      <div className="p-3 bg-cyan-500/10 rounded-full animate-bounce">
                        <Sparkles className="w-8 h-8 text-cyan-405 text-cyan-400" />
                      </div>
                      <div className="font-semibold text-sm text-white">
                        正在通过【ND-3.5-学术大模型引擎】智能合成《{activeModule.title}》的互动挑战试炼...
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                        AI 顾问正在发掘原子融合、众神职责、或是 If 条件抉誓的情景深度，并策划 3 个高水平挑战等级。
                      </p>
                      <div className="w-48 bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full w-2/3 animate-pulse rounded-full"></div>
                      </div>
                    </div>
                  ) : activeModule.scriptStatus === 'failed' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2.5">
                      <XCircle className="w-10 h-10 text-red-400 animate-pulse" />
                      <div className="font-semibold text-sm text-white">游戏互动剧本合成失败</div>
                      <p className="text-xs text-slate-400">大模型通信遇到了一点延迟。请重试按钮拉取脚本。</p>
                      <button 
                        onClick={() => handleGenerateScript(activeModule.id)}
                        className="text-xs bg-cyan-500 text-white px-4 py-2 hover:bg-[#050508] border border-cyan-500/30 hover:text-cyan-400 rounded-lg font-bold cursor-pointer transition"
                      >
                        重新连通生成
                      </button>
                    </div>
                  ) : activeModule.scriptStatus === 'pending' ? (
                    <div className="max-w-2xl mx-auto bg-[#0a0a0f] border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                      
                      {/* Dashboard Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded uppercase">
                            Stage 3 · Gameplay Conception Cabin
                          </span>
                          <h3 className="text-lg font-bold text-white font-display mt-1 flex items-center gap-1.5">
                            🎬 游戏化副本创意调取与机制匹配舱
                          </h3>
                        </div>
                      </div>

                      {/* Top Panel: Grounded Academic Context Card */}
                      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} /> 学术大纲锚定面 (Curriculum Anchors)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs text-slate-300">
                          <div className="space-y-1 bg-[#050508]/60 p-3 rounded-xl border border-white/5">
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">📚 知识切片主题与考点</span>
                            <p className="font-bold text-white mb-1">{activeModule.title}</p>
                            <p className="text-slate-400 leading-normal line-clamp-2">{getSummaryText(activeModule.summary)}</p>
                          </div>
                          <div className="space-y-1 bg-[#050508]/60 p-3 rounded-xl border border-white/5">
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">⚡ 信息负荷评估与内聚度</span>
                            <p className="text-slate-300 leading-normal line-clamp-3 font-medium">{getInfoDensityText(activeModule.infoDensity) || "暂无合理度评估"}</p>
                          </div>
                        </div>

                        {/* Mapped Textbook Paragraph Excerpt */}
                        <div className="bg-[#030305]/60 border border-white/5 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-cyan-400 font-bold block text-[10px] uppercase tracking-wider">
                              📖 匹配对齐本单元的教材原文段落 ({activeModule ? getExtractedTextForModule(activeModule, directoryItems, bookContentText, pdfPagesText, pdfPageOffset).mappedPages : ""})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 bg-black/50 border border-white/5 p-3 rounded-xl max-h-40 overflow-y-auto select-text leading-relaxed font-sans scrollbar-thin scrollbar-thumb-white/10">
                            <ReactMarkdown
                              components={{
                                h3: ({ node, ...props }) => (
                                  <h3 className="text-xs font-bold text-cyan-400 mt-1 mb-2 pb-1 border-b border-white/10 flex items-center gap-1 font-display" {...props} />
                                ),
                                h4: ({ node, ...props }) => (
                                  <h4 className="text-[10px] font-bold text-amber-400/90 bg-amber-500/5 px-2 py-0.5 rounded mt-3 mb-1.5 inline-block font-mono" {...props} />
                                ),
                                p: ({ node, ...props }) => (
                                  <p className="text-[10.5px] text-slate-300 leading-relaxed mb-1.5 font-sans opacity-95" {...props} />
                                ),
                                strong: ({ node, ...props }) => (
                                  <strong className="text-white font-semibold" {...props} />
                                ),
                                blockquote: ({ node, ...props }) => (
                                  <blockquote className="border-l border-cyan-500/50 bg-cyan-500/5 px-2 py-1 rounded-r-lg my-1 text-[10px] text-slate-400 leading-normal" {...props} />
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul className="list-disc pl-3 space-y-0.5 my-1 text-[10.5px]" {...props} />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol className="list-decimal pl-3 space-y-0.5 my-1 text-[10.5px]" {...props} />
                                ),
                                li: ({ node, ...props }) => (
                                  <li className="text-[10.5px] leading-relaxed" {...props} />
                                ),
                                hr: ({ node, ...props }) => (
                                  <hr className="border-t border-white/5 my-2" {...props} />
                                ),
                                code: ({ node, ...props }) => (
                                  <code className="bg-white/10 px-1 py-0.5 rounded font-mono text-[9.5px] text-cyan-200" {...props} />
                                ),
                                img: ({ node, src, alt, ...props }) => (
                                  <img src={src} alt={alt} className="max-w-full h-auto rounded-lg border border-white/10 my-2" {...props} />
                                ),
                              }}
                            >
                              {activeModuleId && extractingModuleId === activeModuleId ? "⏳ 正在提取..." : (extractedContent || "暂无原文内容")}
                            </ReactMarkdown>
                          </div>
                          
                          {/* 移动端显示提取的图片 */}
                          {extractedImages.length > 0 && (
                            <div className="mt-3">
                              <span className="text-cyan-400 font-bold block text-[10px] uppercase tracking-wider mb-2">
                                🖼️ 提取的图片 ({extractedImages.length})
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                {extractedImages.map((img, idx) => (
                                  <img
                                    key={idx}
                                    src={img.url}
                                    alt={img.filename}
                                    className="w-full h-auto rounded-lg border border-white/10"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Main Creation Grid */}
                      <div className="space-y-5">
                        
                        {/* 1. Game Type Selector Card Row */}
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">
                            STEP 1. 匹配游戏交互机制 (Choose Interactive Mechanic)
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { id: 'quiz', label: '知识诊断抢答', desc: '限时排障与高密度反思诊断' },
                              { id: 'interactive-story', label: '危机对抗战役', desc: '面临解体临界抉择生死权衡' },
                              { id: 'coding-puzzle', label: '逻辑重构焊接', desc: '故障代码检修与网络阻断' },
                              { id: 'math-quest', label: '精密参数计算', desc: '高压参数极值限时对齐协议' }
                            ].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleUpdateModule(activeModule.id, { gameType: item.id as GameType })}
                                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition h-20 group relative overflow-hidden cursor-pointer ${
                                  (activeModule.gameType || 'quiz') === item.id
                                    ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-white'
                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-400 hover:text-white'
                                }`}
                              >
                                <span className="font-bold text-xs">{item.label}</span>
                                <span className={`text-[9.5px] block leading-tight ${
                                  (activeModule.gameType || 'quiz') === item.id ? 'text-cyan-300 font-medium' : 'text-slate-500'
                                }`}>{item.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. Interactive Title and Scenario Rules Column */}
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">
                              STEP 2. 设计冲突化情境 Scenario (Title & Rules)
                            </label>
                            
                            {/* Recommend Button */}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  setRecommendingId(activeModule.id);
                                  const response = await fetch("/api/recommend-scenario", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      chapterTitle: activeModule.title,
                                      summary: activeModule.summary,
                                      gameType: activeModule.gameType || 'quiz',
                                      designRationale: activeModule.designRationale
                                    })
                                  });
                                  const recommendation = await response.json();
                                  if (recommendation && recommendation.gameTitle) {
                                    handleUpdateModule(activeModule.id, {
                                      gameTitle: recommendation.gameTitle,
                                      gameRules: recommendation.gameRules
                                    });
                                    addAgentMessage(`⚡ 我已经帮您推荐了《${recommendation.gameTitle}》创意情景！您可以在匹配舱内直接微调，然后点击“启动合拢剧本合成”即可运行仿真！`);
                                  }
                                } catch (e) {
                                  console.error(e);
                                } finally {
                                  setRecommendingId(null);
                                }
                              }}
                              disabled={recommendingId === activeModule.id}
                              className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition hover:border-cyan-500 hover:bg-cyan-500/20 active:scale-95"
                            >
                              {recommendingId === activeModule.id ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                  AI 创意智能构建中...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                                  ⚡ AI 专业推荐游戏创意
                                </>
                              )}
                            </button>
                          </div>

                          <div className="space-y-3">
                            {/* Scenario Title */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block mb-1">🎮 副本关卡命名 (Title)</span>
                              <input 
                                type="text"
                                value={activeModule.gameTitle || ""}
                                onChange={(e) => handleUpdateModule(activeModule.id, { gameTitle: e.target.value })}
                                placeholder="如：核动力电离层平衡自限协议"
                                className="w-full bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-xl p-2.5 text-xs text-white transition font-semibold"
                              />
                            </div>
                            
                            {/* Scenario Rules */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block mb-1">⚔️ 特遣冲突情境、虚拟角色及通关目标 (Rules)</span>
                              <textarea 
                                value={activeModule.gameRules || ""}
                                onChange={(e) => handleUpdateModule(activeModule.id, { gameRules: e.target.value })}
                                rows={3}
                                placeholder="描述玩家扮演的角色，遭遇的物理/学术突发性级联崩溃，引导学生必须如何应用该切片的概念进行精准纠错/诊断判断以获胜。"
                                className="w-full bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-xl p-2.5 text-xs text-slate-300 transition leading-relaxed resize-none"
                              />
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Giant Neon CTA Button to Compile Script */}
                      <div className="pt-4 border-t border-white/5 space-y-2">
                        <button
                          type="button"
                          onClick={() => handleGenerateScript(activeModule.id)}
                          disabled={!activeModule.gameTitle || !activeModule.gameRules}
                          className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-xs shadow-[0_0_20px_rgba(6,182,212,0.15)] cursor-pointer ${
                            activeModule.gameTitle && activeModule.gameRules
                              ? 'bg-cyan-500 hover:bg-cyan-600 text-white border border-cyan-400/20 active:scale-95'
                              : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 text-white fill-white" />
                          ⚔️ 启动合拢！生成互动仿真剧本 (Generate Simulation Playflow)
                        </button>
                        
                        {!activeModule.gameTitle || !activeModule.gameRules ? (
                          <div className="text-[9.5px] text-center text-slate-500 leading-normal">
                            请填写 <strong>关卡命名</strong> 和 <strong>冲突情境</strong> (或点击右上角 “⚡ AI 专业推荐游戏创意” )，以激活副本合成
                          </div>
                        ) : (
                          <div className="text-[9.5px] text-center text-cyan-500/80 leading-normal">
                            ✨ 点击该按钮，Gemini 将根据上面的情境设定、大纲考点自适应合成 3 个极具深度的交互游戏难关！
                          </div>
                        )}
                      </div>

                    </div>
                  ) : activeModule.scriptStatus === 'completed' && activeModule.script ? (
                    
                    // Main Completed View Container
                    <div className="h-full">
                      
                      {/* Sub-view TAB A: Interactive Simulator Window */}
                      {activeTab === 'simulator' && (
                        <div className="max-w-xl mx-auto bg-[#0a0a0f] border border-white/10 rounded-3xl shadow-lg overflow-hidden flex flex-col min-h-[380px] p-5">
                          
                          {/* Upper visual game header bar */}
                          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 shrink-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-sm text-white font-display">
                                🎮 {activeModule.gameTitle}
                              </h5>
                            </div>

                            {/* Scoring monitor */}
                            <div className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                              <Trophy className="w-3.5 h-3.5" />
                              积分: {gameSession.score}
                            </div>
                          </div>

                          {/* GAME PLAYFLOW STAGE 1: INTRO */}
                          {gameSession.currentChallengeIndex === 0 && !gameSession.isCompleted && !gameSession.showFeedback && !gameSession.selectedOption ? (
                            <div className="flex-1 flex flex-col justify-between py-2">
                              <div className="space-y-3.5">
                                <div className="text-xs text-slate-400 flex items-center gap-1 uppercase tracking-wider font-extrabold">
                                  <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin" /> Game Introduction Story
                                </div>
                                <h4 className="text-base font-bold text-white font-display leading-snug">
                                  🎮 副本战役：“{activeModule.gameTitle}” 开启！
                                </h4>
                                <p className="text-sm text-slate-300 bg-[#050508] rounded-2xl p-4 border border-white/10 leading-relaxed italic">
                                  “{activeModule.script.introduction}”
                                </p>
                                <div className="p-3.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 flex items-start gap-2.5">
                                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                  <div className="text-xs text-slate-300 leading-relaxed">
                                    <span className="font-semibold">玩法通关指南：</span> {activeModule.gameRules}
                                  </div>
                                </div>
                              </div>

                              <button 
                                onClick={() => setGameSession(prev => ({ ...prev, currentChallengeIndex: 0, showFeedback: false, textAnswer: "START" }))}
                                className="w-full mt-4 bg-cyan-500 hover:bg-cyan-600 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition text-sm shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointerborder border-cyan-400/20"
                              >
                                投递神力并开辟挑战 <Play className="w-4 h-4 fill-white text-white" />
                              </button>
                            </div>
                          ) : !gameSession.isCompleted ? (
                            
                            // LEVEL ACTIVE STAGES: Loops through 3 challenges
                            <div className="flex-1 flex flex-col justify-between">
                              
                              {/* Upper level numbers map */}
                              <div className="flex items-center justify-between text-xs text-slate-400 mb-3.5 shrink-0">
                                <span className="font-bold flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-cyan-400 animate-pulse" />
                                  进度: 关卡 {gameSession.currentChallengeIndex + 1} / {activeModule.script.challenges.length}
                                </span>
                                <span className="font-mono text-slate-500">{10 * (gameSession.currentChallengeIndex + 1)}% COMPLETED</span>
                              </div>

                              {/* Active challenge box */}
                              {(() => {
                                const challenge: GameChallenge = activeModule.script!.challenges[gameSession.currentChallengeIndex];
                                if (!challenge) return null;

                                return (
                                  <div className="space-y-4 flex-1">
                                    
                                    {/* Challenge title */}
                                    <div className="bg-[#050508] p-2 text-xs font-bold text-slate-300 rounded-lg border-l-4 border-cyan-500 font-display">
                                      🛡️ {challenge.title}
                                    </div>

                                    {/* Question prompt text */}
                                    <h4 className="text-sm font-bold text-slate-200 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                                      {challenge.prompt}
                                    </h4>

                                    {/* DYNAMIC MECHANICS: Check game types rendering */}
                                    {!gameSession.showFeedback ? (
                                      
                                      <div className="mt-4">
                                        
                                        {/* OPTION A: Multiple choice UI (for Quiz or Story or general Choices) */}
                                        {challenge.options && challenge.options.length > 0 ? (
                                          <div className="grid grid-cols-1 gap-2">
                                            {challenge.options.map((opt, oIdx) => (
                                              <button 
                                                key={oIdx}
                                                type="button"
                                                onClick={() => handleCheckAnswer(challenge, opt)}
                                                className="text-left w-full p-3 border border-white/10 hover:border-cyan-500 hover:bg-cyan-500/10 text-xs font-semibold text-slate-300 rounded-xl transition flex items-center gap-3 cursor-pointer"
                                              >
                                                <span className="w-5 h-5 bg-white/5 border border-white/10 text-slate-350 text-slate-300 text-[10px] font-bold rounded-lg flex items-center justify-center shrink-0">
                                                  {String.fromCharCode(65 + oIdx)}
                                                </span>
                                                <span>{opt}</span>
                                              </button>
                                            ))}
                                          </div>
                                        ) : challenge.type === 'match' ? (
                                          
                                          // OPTION B: Interactive matching concept linking
                                          <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-slate-400">请选择正确的匹配概念进行连线消消乐：</p>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="p-3 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-xl text-xs font-bold text-center">
                                                科学名词等式
                                              </div>
                                              <div className="flex flex-col gap-1.5">
                                                <button 
                                                  onClick={() => handleSelectMatchPair(challenge, "Core Concept", challenge.correctAnswer)}
                                                  className="p-2 border border-white/10 hover:border-cyan-500 hover:bg-cyan-500/10 rounded-xl text-xs font-semibold text-slate-300 text-center cursor-pointer transition"
                                                >
                                                  {challenge.correctAnswer} (正确释义)
                                                </button>
                                                <button 
                                                  onClick={() => handleSelectMatchPair(challenge, "Core Concept", "无关混淆干扰定义...")}
                                                  className="p-2 border border-white/10 hover:border-cyan-500 hover:bg-cyan-500/10 rounded-xl text-xs font-semibold text-slate-300 text-center cursor-pointer transition"
                                                >
                                                  相反性质物理常量
                                                </button>
                                              </div>
                                            </div>
                                          </div>

                                        ) : (
                                          
                                          // OPTION C: Core fill in blank text inputs
                                          <div className="space-y-2">
                                            <input 
                                              type="text"
                                              placeholder="在这里键入您认为的最合适学术关键词（不区分大小写）..."
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  handleCheckAnswer(challenge, (e.target as HTMLInputElement).value);
                                                }
                                              }}
                                              className="w-full bg-[#050508] border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none rounded-xl p-3 text-xs text-white transition placeholder:text-slate-500"
                                            />
                                            <p className="text-[10px] text-slate-500">输入完毕后直接按下 **Enter 回车键** 提交验证。</p>
                                          </div>

                                        )}

                                      </div>
                                    ) : (
                                      
                                      // FEEDBACK SCREEN WITH GEMINI SCIENTIFIC INSIGHTS
                                      <div className={`mt-4 p-4 rounded-2xl border ${
                                        gameSession.isCorrect 
                                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                                          : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                      }`}>
                                        <div className="flex items-start gap-2 text-sm font-bold animate-fadeIn">
                                          {gameSession.isCorrect ? (
                                            <>
                                              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                              <span>回答正确！积分 +10 点 💫</span>
                                            </>
                                          ) : (
                                            <>
                                              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                                              <span>未能答对该题，我们汲取经验：</span>
                                            </>
                                          )}
                                        </div>

                                        <p className="text-xs leading-relaxed mt-2 p-1 font-medium select-text text-slate-300">
                                          {gameSession.isCorrect ? challenge.feedbackCorrect : challenge.feedbackIncorrect}
                                        </p>
                                        
                                        <div className="text-[10px] text-slate-500 mt-2">
                                          正确答案是：<span className="font-bold text-cyan-400 underline">{challenge.correctAnswer}</span>
                                        </div>
                                      </div>

                                    )}

                                  </div>
                                );
                              })()}

                              {/* Simulator footer controls */}
                              <div className="mt-4 pt-3 border-t border-white/10 shrink-0">
                                {gameSession.showFeedback ? (
                                  <button 
                                    onClick={() => handleNextChallenge(activeModule.script!)}
                                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
                                  >
                                    下一级挑战 <ChevronRight className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <div className="text-center text-[10px] text-slate-500">
                                    💡 玩家必须回答完本题才能推进关卡。提示：本挑战答案可在课本相应章节找到。
                                  </div>
                                )}
                              </div>

                            </div>
                          ) : (
                            
                            // LEVEL COMPLETED STATS SCREEN
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-4 space-y-4 animate-scaleUp">
                              <div className="relative">
                                <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-white scale-up animate-pulse shadow-md">
                                  <Trophy className="w-8 h-8 fill-amber-300" />
                                </div>
                                <div className="absolute -top-1 -right-1 bg-cyan-500 border border-cyan-400/20 text-white rounded-full p-1 text-[8px] font-bold">
                                  BEST
                                </div>
                              </div>

                              <div className="space-y-1">
                                <h4 className="font-bold text-base text-white font-display">
                                  🏆 恭喜，关卡试炼圆满通关！
                                </h4>
                                <p className="text-xs text-slate-400 max-w-sm leading-normal">
                                  您已完美达成了单元 **“{activeModule.title}”** 的全部学业积分。
                                </p>
                              </div>

                              <div className="bg-white/5 px-5 py-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-8 shrink-0">
                                <div className="text-center">
                                  <div className="text-[10px] text-slate-500">本关累计得分</div>
                                  <div className="text-lg font-bold text-cyan-400">{gameSession.score} / 30</div>
                                </div>
                                <div className="w-px bg-white/10 h-8"></div>
                                <div className="text-center">
                                  <div className="text-[10px] text-slate-500">学术评级等级</div>
                                  <div className="text-md font-extrabold text-amber-500">
                                    {gameSession.score >= 30 ? "SS 学术领跑者" : (gameSession.score >= 20 ? "A 卓越特等生" : "B 探索学员")}
                                  </div>
                                </div>
                              </div>

                              <p className="text-xs text-slate-350 italic bg-[#050508] p-3 rounded-xl border border-white/10 max-w-sm">
                                “{activeModule.script.conclusion}”
                              </p>

                              <div className="flex items-center gap-2 w-full pt-2">
                                <button 
                                  onClick={() => initGameSession(activeModule.script!)}
                                  className="flex-1 border border-white/10 hover:bg-white/10 text-slate-300 py-2 rounded-xl font-semibold text-xs transition cursor-pointer"
                                >
                                  🔄 重刷此关
                                </button>
                                <button 
                                  onClick={() => {
                                    // Move to next module in list if available
                                    const cIdx = modules.findIndex(m => m.id === activeModuleId);
                                    if (cIdx >= 0 && cIdx < modules.length - 1) {
                                      handleSelectModuleForSimulator(modules[cIdx + 1].id);
                                    } else {
                                      alert("恭喜您，这已经是整本书籍的最后一关啦！再次导出剧本给学生体验吧！");
                                    }
                                  }}
                                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-2 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-cyan-400/20"
                                >
                                  解锁下一本书章 <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>

                            </div>
                          )}

                        </div>
                      )}



                      {/* Sub-view TAB B: Raw Exporting scripts codes */}
                      {activeTab === 'code' && (
                        <div className="space-y-3.5 h-full flex flex-col">
                          
                          {/* Export buttons utilities bar */}
                          <div className="flex items-center justify-between shrink-0">
                            <span className="text-xs text-slate-500 font-medium">
                              可复制的 Markdown/YAML 书籍游戏化剧本配置文件 (CSV-compatible)
                            </span>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleCopyScriptMarkdown(activeModule.script!)}
                                className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                              >
                                {scriptCopySuccess ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" /> 已复制到剪切板！
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" /> 复制剧本源文本
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* JetBrains Mono beautiful code representation document */}
                          <div className="flex-1 bg-[#0a0a0f] border border-white/10 rounded-2xl p-4 overflow-auto max-h-[460px]">
                            <pre className="text-[11px] font-mono whitespace-pre text-slate-300 leading-relaxed select-text">
{`# 【BookToGame 智能课程配方清单】
教材名称: 《${bookTitle}》
当前课章: ${activeModule.chapterIndex} · ${activeModule.title}
覆盖重点知识要项: ${activeModule.summary}
关卡代号: ${activeModule.gameTitle}

---

## ── 【第一阶段：宇宙世界观宏伟开局】 ──
背景引言 (Storyline Scenario):
"${activeModule.script.introduction}"

## ── 【第二阶段：三重深度游戏化关卡】 ──
${activeModule.script.challenges.map((challenge, cIdx) => `
### [等级试炼 ${cIdx + 1}] -> ${challenge.title}
* 挑战类别: ${challenge.type}
* 主线考卷题目: "${challenge.prompt}"
${challenge.options ? `* 可选游戏决策卡:\n   ${challenge.options.map((opt, oIdx) => `[${String.fromCharCode(65 + oIdx)}] ${opt}`).join("\n   ")}` : '* 作答方式: 玩家物理单词填空'}
* 官方底稿答案: "${challenge.correctAnswer}"
* 答对反馈释义: "${challenge.feedbackCorrect}"
* 答错挽救提示: "${challenge.feedbackIncorrect}"
`).join("\n")}

## ── 【第三阶段：本章科学法则复盘总纲】 ──
复盘总结:
"${activeModule.script.conclusion}"
`}
                            </pre>
                          </div>

                        </div>
                      )}

                      {/* Sub-view TAB C: Interactive Script Editor */}
                      {activeTab === 'edit' && (
                        <div className="space-y-4 h-full flex flex-col">
                          <div className="flex items-center justify-between shrink-0">
                            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                              <Edit3 className="w-4 h-4 text-cyan-400" />
                              进行戏剧化剧本/考题关卡精细化修改 (Interactive Script Editor)
                            </span>
                            <button
                              onClick={() => {
                                setActiveStep(4);
                                addAgentMessage("✨ 剧本及挑战关卡修改确认完毕！接下来请设置您最喜欢的 UI 界面偏好风格并选择您需要色彩系统，我们即将生成最终的独立游戏应用代码。");
                              }}
                              className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1 transition shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              确认剧本，进入下一步
                            </button>
                          </div>

                          <div className="flex-1 bg-[#0a0a0f] border border-white/10 rounded-2xl p-4 overflow-y-auto max-h-[460px] space-y-6">
                            
                            {/* Intro Story */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-bold text-slate-200 border-l-2 border-cyan-500 pl-2">
                                🌌 【本章开场剧情故事 / 背景世界观引导】 (Game Introduction)
                              </h4>
                              <p className="text-[11px] text-slate-500">剧本开场引入，用于引发学生的沉浸式代入好奇心：</p>
                              <textarea
                                value={activeModule.script.introduction}
                                onChange={(e) => handleUpdateScriptField(activeModule.id, 'introduction', e.target.value)}
                                className="w-full h-24 bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-3 text-xs text-slate-300 transition resize-none leading-relaxed focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>

                            {/* Challenges list */}
                            <div className="space-y-6">
                              <h4 className="text-sm font-bold text-slate-200 border-l-2 border-cyan-500 pl-2">
                                🛡️ 【关卡详细题目与答疑库】 (Active Challenges)
                              </h4>
                              
                              {activeModule.script.challenges.map((challenge, cIdx) => (
                                <div key={cIdx} className="bg-[#050508] border border-white/5 rounded-xl p-4 space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                                      <span className="w-5 h-5 bg-cyan-500/20 text-cyan-300 rounded-full flex items-center justify-center font-extrabold text-[11px]">
                                        {cIdx + 1}
                                      </span>
                                      关卡等级: {challenge.title}
                                    </span>
                                    <input
                                      type="text"
                                      value={challenge.title}
                                      onChange={(e) => handleUpdateChallengeField(activeModule.id, cIdx, 'title', e.target.value)}
                                      placeholder="例如：关卡 1: 化学平衡漏口"
                                      className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-cyan-500 outline-none rounded px-2.5 py-1 text-xs text-slate-200 font-semibold transition"
                                    />
                                  </div>

                                  {/* Prompt */}
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-400">问题或冒险情境说明 (Question Prompt)</label>
                                    <textarea
                                      value={challenge.prompt}
                                      onChange={(e) => handleUpdateChallengeField(activeModule.id, cIdx, 'prompt', e.target.value)}
                                      className="w-full h-16 bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2.5 text-xs text-slate-300 resize-none leading-relaxed focus:ring-1 focus:ring-cyan-500"
                                    />
                                  </div>

                                  {/* Options (if multiple choice or match) */}
                                  {challenge.options && challenge.options.length > 0 && (
                                    <div className="space-y-2">
                                      <label className="block text-[10px] font-bold text-slate-400">问题可选项 (Choices & Options)</label>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {challenge.options.map((opt, oIdx) => (
                                          <div key={oIdx} className="flex items-center gap-2 bg-[#050508] border border-white/5 p-1 rounded">
                                            <span className="text-xs text-slate-500 font-bold px-1.5">{String.fromCharCode(65 + oIdx)}</span>
                                            <input
                                              type="text"
                                              value={opt}
                                              onChange={(e) => handleUpdateChallengeOption(activeModule.id, cIdx, oIdx, e.target.value)}
                                              className="flex-1 bg-transparent outline-none text-xs text-slate-300"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Correct answer & validation */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-400">官方标准答案 / 必填匹配对 (Correct Answer)</label>
                                    <input
                                      type="text"
                                      value={challenge.correctAnswer}
                                      onChange={(e) => handleUpdateChallengeField(activeModule.id, cIdx, 'correctAnswer', e.target.value)}
                                      className="w-full bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-2 text-xs text-emerald-400 font-semibold focus:ring-1 focus:ring-cyan-500"
                                    />
                                    {challenge.options && challenge.options.length > 0 && !challenge.options.includes(challenge.correctAnswer) && (
                                      <p className="text-[10px] text-amber-500 flex items-center gap-1 bg-amber-500/10 p-1 rounded border border-amber-500/20">
                                        <AlertCircle className="w-3.5 h-3.5" /> 提示：当前标准答案和可选项内容未能精确吻合，请确保两边文字拼写及空格完全一致。
                                      </p>
                                    )}
                                  </div>

                                  {/* Feedbacks */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                    <div className="space-y-1">
                                      <label className="block text-[10px] font-bold text-slate-400 text-emerald-400">回答正确释义反馈 (Correct Feedback)</label>
                                      <textarea
                                        value={challenge.feedbackCorrect}
                                        onChange={(e) => handleUpdateChallengeField(activeModule.id, cIdx, 'feedbackCorrect', e.target.value)}
                                        className="w-full h-16 bg-[#050508] border border-emerald-500/20 focus:border-emerald-500 outline-none rounded-lg p-2 text-xs text-slate-300 resize-none leading-relaxed focus:ring-1 focus:ring-emerald-500"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-[10px] font-bold text-rose-400">回答错误纠偏提示 (Incorrect Feedback)</label>
                                      <textarea
                                        value={challenge.feedbackIncorrect}
                                        onChange={(e) => handleUpdateChallengeField(activeModule.id, cIdx, 'feedbackIncorrect', e.target.value)}
                                        className="w-full h-16 bg-[#050508] border border-rose-500/20 focus:border-rose-500 outline-none rounded-lg p-2 text-xs text-slate-300 resize-none leading-relaxed focus:ring-1 focus:ring-rose-500"
                                      />
                                    </div>
                                  </div>

                                </div>
                              ))}
                            </div>

                            {/* Final Conclusion */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-bold text-slate-200 border-l-2 border-cyan-500 pl-2">
                                🏁 【终关复盘与学业总结】 (Game Conclusion Summary)
                              </h4>
                              <p className="text-[11px] text-slate-500">本章战役顺利过关后的科学道理高度复盘总结：</p>
                              <textarea
                                value={activeModule.script.conclusion}
                                onChange={(e) => handleUpdateScriptField(activeModule.id, 'conclusion', e.target.value)}
                                className="w-full h-24 bg-[#050508] border border-white/10 focus:border-cyan-500 outline-none rounded-lg p-3 text-xs text-slate-300 transition resize-none leading-relaxed focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>

                          </div>
                        </div>
                      )}

                    </div>
                  ) : null}

                </div>

              </div>

            </div>
          )}

          {/* Step 5 View: UI Preferences and App Generation */}
          {activeStep === 5 && (
            <div className="flex-1 overflow-y-auto p-6 z-10 w-full animate-fadeIn">
              <div className="max-w-4xl mx-auto space-y-6 flex flex-col">
              
              <div className="bg-gradient-to-r from-cyan-950/40 to-[#0a0a0f] border border-cyan-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-5 shadow-lg">
                <div className="p-3 bg-cyan-500/20 text-cyan-400 border border-cyan-400/20 rounded-xl">
                  <Gamepad2 className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-white">
                    全书部署：一键生成您的专属定制 App 客户端游戏源码
                  </h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    所有通过智能规划并已完成剧本加载的教育关卡现已就绪。告诉我们您的终极视觉偏好（深色朋克风或者二次元），我将利用大模型构建包含骨架逻辑和内容数据分离封装的成品应用。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                
                {/* Preferences Left Pane */}
                <div className="space-y-6">
                  
                  {/* Theme Select */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">主题风格 (UI Paradigm)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'minimal', label: '极简学术 (Minimal)', desc: '简洁清晰的高端学术风格', color: 'bg-slate-100 hover:bg-white text-slate-900 border-slate-200' },
                        { id: 'cyberpunk', label: '赛博朋克 (Cyberpunk)', desc: '暗黑系高对比霓虹发光材质', color: 'bg-[#0a0a0f] hover:bg-cyan-950 text-cyan-400 border-cyan-500/30' },
                        { id: 'cartoon', label: '卡通奇迹 (Cartoon)', desc: '圆润有趣适合低龄化学生', color: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30' },
                        { id: 'retro', label: '复古街机 (8-Bit Arc)', desc: '像素风格和CRT滤镜叠加', color: 'bg-fuchsia-950/30 hover:bg-fuchsia-900/40 text-fuchsia-400 border-fuchsia-500/30' },
                      ].map(theme => (
                        <div 
                          key={theme.id}
                          onClick={() => setUiTheme(theme.id as any)}
                          className={`p-3 rounded-xl border cursor-pointer transition ${theme.color} ${uiTheme === theme.id ? 'ring-2 ring-cyan-500 shadow-md' : 'opacity-70'}`}
                        >
                          <div className="font-semibold text-sm flex items-center justify-between">
                            {theme.label}
                            {uiTheme === theme.id && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div className="text-[10px] mt-1 opacity-80">{theme.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Primary Color Select */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      核心品牌色调 (Primary Tint)
                      <span className="font-mono text-[10px] text-slate-500">{primaryColor}</span>
                    </label>
                    <div className="flex gap-3">
                      {[
                        { hex: '#06b6d4', ring: 'ring-cyan-400' },
                        { hex: '#3b82f6', ring: 'ring-blue-400' },
                        { hex: '#10b981', ring: 'ring-emerald-400' },
                        { hex: '#f59e0b', ring: 'ring-amber-400' },
                        { hex: '#ef4444', ring: 'ring-rose-400' },
                        { hex: '#8b5cf6', ring: 'ring-violet-400' }
                      ].map(color => (
                        <div 
                          key={color.hex}
                          onClick={() => setPrimaryColor(color.hex)}
                          className={`w-10 h-10 rounded-full cursor-pointer transition ${primaryColor === color.hex ? 'scale-110 ring-2 ring-offset-2 ring-offset-[#050508] ' + color.ring : 'hover:scale-105'}`}
                          style={{ backgroundColor: color.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Build Action */}
                  <div className="pt-4 border-t border-white/10">
                    <button
                      onClick={handleGenerateFinalApp}
                      disabled={isGeneratingApp || !modules.some(m => m.scriptStatus === 'completed')}
                      className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed bg-cyan-500 hover:bg-cyan-600 cursor-pointer"
                    >
                      {isGeneratingApp ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          正在编译和整合所有教料资源...
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          打包代码：生成最终教学互动 App！ 
                        </>
                      )}
                    </button>
                    <p className="text-center text-[10px] text-slate-500 mt-3 flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3" /> 数据私有化，不收集任何学生及课本数据
                    </p>
                  </div>

                </div>

                {/* Live Output Pane */}
                <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl flex flex-col overflow-hidden h-full min-h-[400px]">
                  <div className="bg-[#050508] border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                        <Settings className="w-4 h-4 text-cyan-400" /> App.tsx 最终应用
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
                            效果预览 (Preview)
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
                            查看代码 (Code)
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
                          <Maximize2 className="w-3.5 h-3.5" /> 全屏体验
                        </button>
                      )}

                      {finalCode && (
                         <button
                           onClick={handleCopyFinalCode}
                           className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-white rounded text-[10px] font-bold transition cursor-pointer"
                         >
                           {codeCopySuccess ? (
                             <><Check className="w-3.5 h-3.5" /> 已复制!</>
                           ) : (
                             <><Copy className="w-3.5 h-3.5" /> 拷贝到本地执行</>
                           )}
                         </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto text-[11px] font-mono whitespace-pre text-slate-400 leading-relaxed bg-[#0a0a0f] select-text w-full max-w-full flex flex-col">
                    {isGeneratingApp ? (
                      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-cyan-500 animate-pulse py-12">
                        <Terminal className="w-10 h-10 animate-spin" />
                        <div className="text-center font-sans font-semibold text-sm">
                          {">"} Building customized assets and routing mechanics...
                        </div>
                      </div>
                    ) : finalCode ? (
                      outputTab === 'preview' ? (
                        <StandalonePreview
                          bookTitle={bookTitle}
                          modules={modules}
                          uiTheme={uiTheme}
                          primaryColor={primaryColor}
                          isFullscreen={false}
                          onToggleFullscreen={() => setIsFullscreen(true)}
                        />
                      ) : (
                        <div className="p-4 overflow-auto select-text flex-1">
                          <pre className="text-cyan-200/80">{finalCode}</pre>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-650 py-12">
                        <Code2 className="w-12 h-12 stroke-1 text-slate-600" />
                        <span className="font-sans text-xs text-slate-500">暂无生成代码，请在左侧设定后点击“打包生成”</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPreviewModal(false)}>
          <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                原文渲染预览
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
                <ReactMarkdown components={{
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
                }}>{previewContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Game Preview Portal overlay */}
      {isFullscreen && finalCode && (
        <div className="fixed inset-0 bg-[#050508]/95 z-[999] flex flex-col p-4 md:p-6 animate-in fade-in duration-250 overflow-y-auto">
          
          {/* Header Controls */}
          <div className="flex items-center justify-between bg-[#0a0a0f] border-b border-white/10 px-6 py-4 rounded-t-2xl max-w-4xl w-full mx-auto shrink-0 mt-2 shadow-2xl">
            <div className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-pulse text-cyan-400" />
              <span>智能全屏沉浸试炼模式 (Immersive Sandbox Game Mode)</span>
            </div>
            
            <button
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition border border-rose-500/20 shadow-md cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              退出全屏 (Exit Fullscreen)
            </button>
          </div>

          {/* Sandbox Body wrapper */}
          <div className="flex-1 max-w-4xl w-full mx-auto bg-slate-950 overflow-hidden rounded-b-2xl shadow-2xl border-x border-b border-white/10 flex flex-col min-h-[500px] mb-6">
            <StandalonePreview
              bookTitle={bookTitle}
              modules={modules}
              uiTheme={uiTheme}
              primaryColor={primaryColor}
              isFullscreen={true}
              onToggleFullscreen={() => setIsFullscreen(false)}
            />
          </div>

        </div>
      )}

    </div>
  );
}
