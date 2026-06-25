export type GameType = 'quiz' | 'cross-match' | 'fill-blank' | 'interactive-story' | 'coding-puzzle' | 'math-quest';

// Legacy challenge-based types (keep for backward compatibility)
export interface GameChallenge {
  id: string;
  type: 'question' | 'match' | 'blank' | 'puzzle' | 'choice';
  title: string;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

export interface GameScript {
  id: string;
  moduleId: string;
  gameType: GameType;
  introduction: string;
  challenges: GameChallenge[];
  conclusion: string;
}

// New scenario-based interactive script types
export interface ScriptOption {
  text: string;
  isCorrect: boolean;
  consequence: string; // Narrative consequence after this choice
  explanation: string; // Why right/wrong, connecting to textbook knowledge
}

export interface ScriptStage {
  id: string;
  title: string; // Stage title, e.g. "Phase 1: Discovery"
  sceneDescription: string; // Immersive scene description (visual, narrative)
  problem: string; // The problem/challenge the student faces
  knowledgeHint: string; // Hint about what knowledge to apply
  options: ScriptOption[];
}

export interface ScenarioScript {
  id: string;
  moduleId: string;
  scenarioTitle: string;
  scenarioContext: string; // Overall immersive scenario setup
  role: string; // What role the student plays in the scenario
  stages: ScriptStage[];
  conclusion: string; // Wrap-up and knowledge reflection
  knowledgeSummary: string; // Summary of knowledge applied throughout
}

export interface SimulationBlueprintScript {
  id: string;
  moduleId: string;
  kind: "simulation_blueprint_markdown";
  markdown: string;
  generatedAt?: string;
}

export interface SummaryInfo {
  learnedPoints: string[];
  practicalProblems: string[];
}

export interface InfoDensity {
  conceptCount: number;
  factCount: number;
  abstractLevel: "低" | "中" | "高";
  nestingLevel: "无" | "两层" | "三层";
  suggestedMinutes: string;
  rationale: string;
}

export interface CohesionDetail {
  cohesionType: string;
  mechanism: string;
  coreQuestion: string;
}

export interface ExtractedImage {
  filename: string;
  path: string;
  width?: number;
  height?: number;
  url?: string; // Frontend-accessible URL
}

export interface BookModule {
  id: string;
  sliceId?: string; // e.g., "S1", "S2"
  chapterIndex?: string; // e.g., "Chapter 1" or "01" (legacy)
  title: string;
  coveredChapters?: string;
  pageRange?: string; // 手动设置的页码范围，如 "P.2-16"，覆盖自动计算的页码
  summary: SummaryInfo | string; // Support both new object and old string format
  infoDensity?: InfoDensity | string; // 信息量/负载合理性评估
  cohesionDetail?: CohesionDetail | string; // 核心考点关联性与内聚度说明
  gameType?: GameType;
  gameTitle?: string;
  gameRules?: string;
  duration?: string;
  designRationale?: string | { learnedPoints?: string; practicalProblems?: string }; // 教学设计逻辑/课业深度价值
  extractedContent?: string; // Content text utilized for generating this script
  extractedImages?: ExtractedImage[]; // Images extracted alongside content
  scriptStatus: 'pending' | 'generating' | 'completed' | 'failed';
  script?: GameScript; // Legacy challenge-based script
  scenarioScript?: ScenarioScript; // New scenario-based interactive script
  simulationScript?: SimulationBlueprintScript; // Markdown simulation blueprint for AI coding
  verificationStatus?: VerificationStatus; // 校验模式下的人工校验状态
}

export interface BookBlueprint {
  bookTitle?: string;
  title?: string; // Legacy
  totalSlices?: number;
  slices?: BookModule[];
  modules?: BookModule[]; // Legacy
}

export interface BookTemplate {
  id: string;
  title: string;
  subject: string;
  description: string;
  content: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  status?: 'sending' | 'complete' | 'error';
  // Additional system metadata helpers
  type?: 'text' | 'blueprint_ready' | 'script_ready';
  metadata?: any;
}

export interface DirectoryItem {
  id: string;
  type: 'chapter' | 'section' | 'subsection';
  title: string;
  page?: string;
  level: number;
}

export interface GameSessionState {
  currentChallengeIndex: number;
  selectedOption: string | null;
  textAnswer: string;
  score: number;
  showFeedback: boolean;
  isCorrect: boolean;
  isCompleted: boolean;
  userMatches: Record<string, string>; // Match-pair games state
  lastConsequence?: string; // Narrative consequence for scenario-based scripts
  lastExplanation?: string; // Knowledge explanation for scenario-based scripts
}

// ==================== 自动化任务类型 ====================

export type ExecutionMode = "auto" | "manual";

export type VerificationStatus = "pending" | "verified" | "rejected";

export type AutomationJobStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "partial"
  | "cancelled"
  | "failed";

export type AutomationTaskStage = "extract" | "script" | "app-code";

export type AutomationTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface AutomationJob {
  id: string;
  projectId: string;
  status: AutomationJobStatus;
  totalSlices: number;
  completedSlices: number;
  failedSlices: number;
  concurrency: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationTask {
  id: string;
  jobId: string;
  projectId: string;
  moduleId: string;
  sliceId: string | null;
  sliceTitle: string;
  stage: AutomationTaskStage;
  status: AutomationTaskStatus;
  attempts: number;
  maxAttempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationJobSnapshot {
  job: AutomationJob | null;
  tasks: AutomationTask[];
}

export interface ProjectInfo {
  id: string;
  name: string;
  bookTitle: string;
  pdfFileName: string;
  createdAt: string;
  executionMode: ExecutionMode;
}
