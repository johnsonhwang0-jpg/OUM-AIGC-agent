export type GameType = 'quiz' | 'cross-match' | 'fill-blank' | 'interactive-story' | 'coding-puzzle' | 'math-quest';

export interface GameChallenge {
  id: string;
  type: 'question' | 'match' | 'blank' | 'puzzle' | 'choice';
  title: string;
  prompt: string;
  options?: string[]; // Used for quizzes or choice-based stories
  correctAnswer: string; // The correct answer string or matching index
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

export interface BookModule {
  id: string;
  chapterIndex: string; // e.g., "Chapter 1" or "01"
  title: string;
  coveredChapters?: string;
  summary: string;
  infoDensity?: string; // 信息量/负载合理性评估
  cohesionDetail?: string; // 核心考点关联性与内聚度说明
  gameType?: GameType;
  gameTitle?: string;
  gameRules?: string;
  duration?: string;
  designRationale?: string; // 教学设计逻辑/课业深度价值
  extractedContent?: string; // Content text utilized for generating this script
  scriptStatus: 'pending' | 'generating' | 'completed' | 'failed';
  script?: GameScript;
}

export interface BookBlueprint {
  title: string;
  modules: BookModule[];
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
  type: 'chapter' | 'section';
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
}
