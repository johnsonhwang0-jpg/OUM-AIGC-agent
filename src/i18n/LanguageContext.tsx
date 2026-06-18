import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Language = "zh" | "en";

export const translations = {
  zh: {
    // Common
    appName: "沉浸式互动教学系统",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    back: "返回",
    confirm: "确认",
    loading: "加载中...",
    generating: "生成中...",
    success: "成功",
    error: "错误",
    actions: "操作",
    status: "状态",
    name: "名称",
    description: "描述",
    create: "创建",
    search: "搜索",
    reset: "重置",
    submit: "提交",
    close: "关闭",
    open: "打开",
    view: "查看",
    download: "下载",
    upload: "上传",
    select: "选择",
    none: "无",
    all: "全部",
    yes: "是",
    no: "否",

    // Navigation
    myProjects: "我的项目",
    newProject: "新建项目",
    systemSettings: "系统设置",
    modelManagement: "模型管理",
    promptManagement: "提示词管理",
    languageSettings: "语言设置",

    // Project
    projectName: "项目名称",
    projectList: "项目列表",
    createProject: "创建项目",
    deleteProject: "删除项目",
    deleteProjectConfirm: "确定要删除此项目吗？此操作不可撤销。",
    noProjects: "暂无项目",
    createFirstProject: "创建你的第一个项目",
    uploadPdf: "上传 PDF 教材",
    uploadPdfHint: "支持 .pdf 格式，最大 100MB",
    selectPdf: "选择 PDF 文件",
    pdfUploaded: "PDF 已上传",
    parseBook: "解析教材",
    parsing: "解析中...",
    parseSuccess: "教材解析成功",
    parseFailed: "教材解析失败",

    // Module/Slice
    modules: "模块",
    moduleList: "模块列表",
    addModule: "添加模块",
    moduleTitle: "模块标题",
    moduleSummary: "模块概要",
    moduleType: "模块类型",
    moduleContent: "模块内容",
    extractContent: "提取内容",
    extracting: "提取中...",
    extractSuccess: "内容提取成功",
    extractFailed: "内容提取失败",
    noModules: "暂无模块",
    parseBookFirst: "请先解析教材生成模块",
    moduleCount: "模块数量",
    originalText: "原文",

    // Script
    generateScript: "生成脚本",
    scriptGenerated: "脚本已生成",
    scriptGenerationFailed: "脚本生成失败",
    scriptContent: "脚本内容",
    noScript: "暂无脚本",
    generateScriptFirst: "请先生成互动脚本",

    // App
    buildApp: "构建 App",
    appBuilt: "App 已构建",
    appBuildFailed: "App 构建失败",
    preview: "预览",
    previewApp: "预览应用",
    exportCode: "导出代码",
    copyCode: "复制代码",
    codeCopied: "代码已复制",

    // Simulator
    simulator: "模拟器",
    code: "代码",
    editScript: "编辑脚本",

    // Settings
    modelConfig: "模型配置",
    modelConfigDesc: "管理 AI 模型的 API 密钥、基础 URL 和参数配置。当前核心功能（切片、脚本生成、App构建）使用环境变量中的配置。",
    modelConfigDev: "模型管理功能开发中...",
    modelConfigEnv: "当前使用 .env 中的 AI_PROVIDER 和 API 密钥",
    promptTemplates: "提示词模板",
    promptTemplatesDesc: "管理各阶段 AI 调用的提示词模板，包括课程切片、脚本生成、App 构建等。",
    slicePrompt: "课程切片提示词",
    slicePromptDesc: "用于将教材目录解析为结构化切片数据",
    scriptPrompt: "互动脚本生成提示词",
    scriptPromptDesc: "根据切片内容生成互动教学脚本",
    appPrompt: "App 构建提示词",
    appPromptDesc: "将脚本转换为可运行的 HTML 游戏应用",
    viewHistory: "查看历史版本",
    languageSetting: "语言设置",
    languageSettingDesc: "选择界面显示语言。",
    simplifiedChinese: "简体中文",
    english: "English",
    languageTip: "提示：AI 输出语言由提示词中的语言指令控制，不受此设置影响",

    // Dashboard
    dashboard: "项目概览",
    totalModules: "总模块数",
    generatedScripts: "已生成脚本",
    builtApps: "已构建 App",
    progress: "进度",
    steps: "步骤",
    step1: "上传教材",
    step2: "解析切片",
    step3: "生成脚本",
    step4: "构建应用",
    step1Desc: "上传 PDF 格式教材",
    step2Desc: "AI 自动解析教材目录并生成结构化切片",
    step3Desc: "为每个切片生成互动教学脚本",
    step4Desc: "将脚本打包为可运行的 HTML 游戏应用",

    // Game types
    gameType: "游戏类型",
    fillBlank: "填空题",
    multipleChoice: "选择题",
    matching: "匹配题",
    ordering: "排序题",
    trueFalse: "判断题",
    shortAnswer: "简答题",
    dialogue: "对话题",
    scenario: "情景题",

    // Misc
    bookTitle: "教材名称",
    chapterTitle: "章节标题",
    learningObjective: "学习目标",
    difficulty: "难度",
    easy: "简单",
    medium: "中等",
    hard: "困难",
    score: "得分",
    totalScore: "总分",
    correct: "正确",
    incorrect: "错误",
    tryAgain: "重试",
    next: "下一题",
    previous: "上一题",
    finish: "完成",
    restart: "重新开始",
    hint: "提示",
    answer: "答案",
    yourAnswer: "你的答案",
    correctAnswer: "正确答案",
    explanation: "解析",
    feedback: "反馈",
    excellent: "太棒了！",
    goodJob: "做得好！",
    keepTrying: "继续加油！",

    // Version
    version: "版本",
  },
  en: {
    // Common
    appName: "Immersive Interactive Teaching System",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    back: "Back",
    confirm: "Confirm",
    loading: "Loading...",
    generating: "Generating...",
    success: "Success",
    error: "Error",
    actions: "Actions",
    status: "Status",
    name: "Name",
    description: "Description",
    create: "Create",
    search: "Search",
    reset: "Reset",
    submit: "Submit",
    close: "Close",
    open: "Open",
    view: "View",
    download: "Download",
    upload: "Upload",
    select: "Select",
    none: "None",
    all: "All",
    yes: "Yes",
    no: "No",

    // Navigation
    myProjects: "My Projects",
    newProject: "New Project",
    systemSettings: "System Settings",
    modelManagement: "Model Management",
    promptManagement: "Prompt Management",
    languageSettings: "Language Settings",

    // Project
    projectName: "Project Name",
    projectList: "Project List",
    createProject: "Create Project",
    deleteProject: "Delete Project",
    deleteProjectConfirm: "Are you sure you want to delete this project? This action cannot be undone.",
    noProjects: "No projects yet",
    createFirstProject: "Create your first project",
    uploadPdf: "Upload PDF Textbook",
    uploadPdfHint: "Supports .pdf format, max 100MB",
    selectPdf: "Select PDF File",
    pdfUploaded: "PDF Uploaded",
    parseBook: "Parse Textbook",
    parsing: "Parsing...",
    parseSuccess: "Textbook parsed successfully",
    parseFailed: "Failed to parse textbook",

    // Module/Slice
    modules: "Modules",
    moduleList: "Module List",
    addModule: "Add Module",
    moduleTitle: "Module Title",
    moduleSummary: "Module Summary",
    moduleType: "Module Type",
    moduleContent: "Module Content",
    extractContent: "Extract Content",
    extracting: "Extracting...",
    extractSuccess: "Content extracted successfully",
    extractFailed: "Failed to extract content",
    noModules: "No modules yet",
    parseBookFirst: "Please parse the textbook first to generate modules",
    moduleCount: "Module Count",
    originalText: "Original Text",

    // Script
    generateScript: "Generate Script",
    scriptGenerated: "Script generated",
    scriptGenerationFailed: "Failed to generate script",
    scriptContent: "Script Content",
    noScript: "No script yet",
    generateScriptFirst: "Please generate the interactive script first",

    // App
    buildApp: "Build App",
    appBuilt: "App built",
    appBuildFailed: "Failed to build app",
    preview: "Preview",
    previewApp: "Preview App",
    exportCode: "Export Code",
    copyCode: "Copy Code",
    codeCopied: "Code copied",

    // Simulator
    simulator: "Simulator",
    code: "Code",
    editScript: "Edit Script",

    // Settings
    modelConfig: "Model Configuration",
    modelConfigDesc: "Manage AI model API keys, base URLs, and parameter configurations. Core features (slicing, script generation, app building) currently use environment variable configurations.",
    modelConfigDev: "Model management is under development...",
    modelConfigEnv: "Currently using AI_PROVIDER and API keys from .env",
    promptTemplates: "Prompt Templates",
    promptTemplatesDesc: "Manage prompt templates for AI calls at each stage, including course slicing, script generation, app building, etc.",
    slicePrompt: "Course Slicing Prompt",
    slicePromptDesc: "Parse textbook table of contents into structured slice data",
    scriptPrompt: "Interactive Script Generation Prompt",
    scriptPromptDesc: "Generate interactive teaching scripts based on slice content",
    appPrompt: "App Building Prompt",
    appPromptDesc: "Convert scripts into runnable HTML game applications",
    viewHistory: "View History",
    languageSetting: "Language Settings",
    languageSettingDesc: "Choose the interface display language.",
    simplifiedChinese: "简体中文",
    english: "English",
    languageTip: "Note: AI output language is controlled by language directives in prompts, not affected by this setting",

    // Dashboard
    dashboard: "Project Overview",
    totalModules: "Total Modules",
    generatedScripts: "Generated Scripts",
    builtApps: "Built Apps",
    progress: "Progress",
    steps: "Steps",
    step1: "Upload Textbook",
    step2: "Parse Slices",
    step3: "Generate Scripts",
    step4: "Build App",
    step1Desc: "Upload a PDF format textbook",
    step2Desc: "AI automatically parses the textbook TOC and generates structured slices",
    step3Desc: "Generate interactive teaching scripts for each slice",
    step4Desc: "Package scripts into runnable HTML game applications",

    // Game types
    gameType: "Game Type",
    fillBlank: "Fill in the Blank",
    multipleChoice: "Multiple Choice",
    matching: "Matching",
    ordering: "Ordering",
    trueFalse: "True/False",
    shortAnswer: "Short Answer",
    dialogue: "Dialogue",
    scenario: "Scenario",

    // Misc
    bookTitle: "Textbook Title",
    chapterTitle: "Chapter Title",
    learningObjective: "Learning Objective",
    difficulty: "Difficulty",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    score: "Score",
    totalScore: "Total Score",
    correct: "Correct",
    incorrect: "Incorrect",
    tryAgain: "Try Again",
    next: "Next",
    previous: "Previous",
    finish: "Finish",
    restart: "Restart",
    hint: "Hint",
    answer: "Answer",
    yourAnswer: "Your Answer",
    correctAnswer: "Correct Answer",
    explanation: "Explanation",
    feedback: "Feedback",
    excellent: "Excellent!",
    goodJob: "Good Job!",
    keepTrying: "Keep Trying!",

    // Version
    version: "Version",
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("app-language");
      return (saved === "en" ? "en" : "zh") as Language;
    } catch {
      return "zh";
    }
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("app-language", lang);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] ?? translations.zh[key] ?? key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
