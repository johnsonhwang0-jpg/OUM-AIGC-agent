import React, { useState, useEffect } from 'react';
import { 
  Play, Check, RefreshCw, Trophy, HelpCircle, 
  BookOpen, Maximize2, Minimize2, X, AlertCircle 
} from 'lucide-react';
import { BookModule } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface StandalonePreviewProps {
  bookTitle: string;
  modules: BookModule[];
  uiTheme: 'minimal' | 'cyberpunk' | 'cartoon' | 'retro';
  primaryColor: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function StandalonePreview({
  bookTitle,
  modules,
  uiTheme,
  primaryColor,
  isFullscreen = false,
  onToggleFullscreen
}: StandalonePreviewProps) {
  const { language } = useLanguage();
  // Only games that have completed generation
  const activeModules = modules.filter(m => m.scriptStatus === 'completed' && m.script);

  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'feedback' | 'completed' | 'all-done'>('intro');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState<string>('');
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);

  // Reset progress when theme changes or modules rebuild
  useEffect(() => {
    setActiveModuleIdx(0);
    setGameState('intro');
    setCurrentChallenge(0);
    setScore(0);
    setSelectedOpt(null);
    setTextAnswer('');
  }, [uiTheme, modules.length]);

  if (activeModules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500">
        <HelpCircle className="w-12 h-12 stroke-1 mb-3 text-slate-650" />
        <h3 className="font-semibold text-sm text-slate-350">{language === "en" ? "No Generated Levels Detected" : "未检测到已生成剧本的关卡"}</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          {language === "en" ? "The preview system requires at least one textbook mini-game with completed content generation to simulate playback." : "预览系统需要至少一个已通过「第一步/第二步」完成内容生成的课本小游戏来进行模拟播放。"}
        </p>
      </div>
    );
  }

  const activeChapter = activeModules[activeModuleIdx];
  const script = activeChapter?.script;
  const challenge = script?.challenges?.[currentChallenge];

  // UI Theme specific Tailwind Styles definitions
  const themeStyles = {
    minimal: {
      bg: 'bg-slate-50 text-slate-900 font-sans',
      card: 'bg-white border border-slate-200 rounded-2xl shadow-md p-6 space-y-5',
      button: 'bg-[#18181b] hover:bg-[#27272a] text-white rounded-xl py-2.5 px-4 font-medium transition active:scale-98',
      optionBtn: 'border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 font-medium text-left p-3.5 rounded-xl transition w-full flex items-center',
      title: 'text-slate-950 font-bold tracking-tight',
      badge: 'bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono',
      input: 'border border-slate-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-slate-950 outline-none w-full bg-slate-50 text-slate-900',
      successCard: 'bg-emerald-50 text-emerald-800 border border-emerald-150 p-4 rounded-xl space-y-1',
      failCard: 'bg-rose-50 text-rose-800 border border-rose-150 p-4 rounded-xl space-y-1'
    },
    cyberpunk: {
      bg: 'bg-[#05050a] text-cyan-400 font-mono relative',
      card: 'bg-[#0a0a14] border-2 border-cyan-500/30 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.15)] p-6 space-y-5',
      button: 'bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-400 rounded-xl py-2.5 px-4 font-bold tracking-wide transition uppercase active:scale-98',
      optionBtn: 'border border-cyan-500/20 hover:border-cyan-400 bg-[#080810] hover:bg-cyan-950/20 text-slate-300 hover:text-cyan-400 text-left p-3.5 rounded-xl transition w-full flex items-center',
      title: 'text-white font-black tracking-widest uppercase text-cyan-400',
      badge: 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/40 px-2.5 py-1 rounded-md text-[10px] font-bold',
      input: 'border border-cyan-500/30 rounded-xl p-3 text-xs focus:ring-1 focus:ring-cyan-400 outline-none w-full bg-[#050510] text-cyan-300 font-mono',
      successCard: 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30 p-4 rounded-xl space-y-1',
      failCard: 'bg-rose-950/30 text-rose-300 border border-rose-500/30 p-4 rounded-xl space-y-1'
    },
    cartoon: {
      bg: 'bg-amber-100 text-amber-905 text-amber-900 font-sans font-medium',
      card: 'bg-white border-4 border-amber-400 rounded-3xl shadow-[0_6px_0_#d97706] p-6 space-y-5',
      button: 'bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-2xl border-b-4 border-amber-600 font-bold text-center py-2.5 px-4 transition active:translate-y-0.5 active:shadow-[0_2px_0_#d97706]',
      optionBtn: 'border-2 border-amber-250 border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-100/50 text-amber-950 font-semibold text-left p-3.5 rounded-2xl transition w-full flex items-center',
      title: 'text-amber-900 font-extrabold text-2xl tracking-normal',
      badge: 'bg-amber-400/20 text-amber-600 font-extrabold px-3 py-1 rounded-full text-[10px]',
      input: 'border-2 border-amber-300 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-amber-400 outline-none w-full bg-amber-50 text-amber-950 font-bold',
      successCard: 'bg-emerald-100 text-emerald-900 border-2 border-emerald-300 p-4 rounded-xl space-y-1',
      failCard: 'bg-rose-100 text-rose-900 border-2 border-rose-300 p-4 rounded-xl space-y-1'
    },
    retro: {
      bg: 'bg-slate-950 text-fuchsia-400 font-mono relative',
      card: 'bg-black border-4 border-double border-fuchsia-500 shadow-[4px_4px_0_#d946ef] p-6 space-y-5',
      button: 'bg-fuchsia-950 hover:bg-fuchsia-905 hover:bg-fuchsia-900 border-2 border-fuchsia-500 text-fuchsia-300 py-2.5 px-4 font-bold transition tracking-tight active:translate-y-0.5',
      optionBtn: 'border border-fuchsia-500/30 hover:border-fuchsia-500 bg-black hover:bg-fuchsia-950/30 text-slate-400 hover:text-fuchsia-300 text-left p-3.5 transition w-full flex items-center',
      title: 'text-fuchsia-400 font-bold tracking-tight uppercase',
      badge: 'bg-fuchsia-950 text-fuchsia-400 border border-fuchsia-500 px-2 py-0.5 text-[10px] font-bold',
      input: 'border-2 border-fuchsia-500 bg-black text-fuchsia-400 p-3 text-xs focus:ring-1 focus:ring-fuchsia-400 outline-none w-full',
      successCard: 'bg-stone-900 text-green-400 border border-green-500 p-4 space-y-1',
      failCard: 'bg-stone-900 text-red-400 border border-red-500 p-4 space-y-1'
    }
  };

  const st = themeStyles[uiTheme] || themeStyles.minimal;

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
    const nextModIdx = activeModuleIdx + 1;
    if (nextModIdx >= activeModules.length) {
      setGameState('all-done');
    } else {
      setActiveModuleIdx(nextModIdx);
      setGameState('intro');
    }
  };

  const handleRestart = () => {
    setActiveModuleIdx(0);
    setScore(0);
    setGameState('intro');
  };

  const currentModuleName = activeChapter?.title || (language === "en" ? `Level ${activeModuleIdx + 1}` : `关卡 ${activeModuleIdx + 1}`);

  return (
    <div className={`w-full h-full flex flex-col justify-between p-6 ${st.bg} ${isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto' : 'rounded-b-2xl flex-1'}`}>
      
      {/* Retro scanline decoration */}
      {uiTheme === 'retro' && (
        <div className="absolute inset-0 bg-[radial-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_100%)] pointer-events-none z-40"></div>
      )}

      {/* Control overlay when fullscreen is active */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-full bg-slate-900/60 hover:bg-slate-900/80 border border-white/20 text-white transition cursor-pointer"
            title={language === "en" ? "Exit fullscreen" : "退出全屏"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className={`w-full max-w-2xl mx-auto space-y-6 ${isFullscreen ? 'my-auto py-10' : ''}`}>
        
        {/* Playable Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              <h1 className="text-lg font-extrabold" style={{ color: primaryColor }}>
                {language === "en" ? `《${bookTitle}》 Interactive Game Console` : `《${bookTitle}》探索互动式游戏机`}
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{language === "en" ? "Smart client preview area · Complete logic & UI experience" : "智能客户端预览区 · 体验完备逻辑与UI设计"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeChapter && (
              <span className={st.badge}>
                {language === "en" ? `Level ${activeModuleIdx + 1} / ${activeModules.length}` : `关卡 ${activeModuleIdx + 1} / ${activeModules.length}`}
              </span>
            )}
            <span className="text-xs font-bold text-amber-500 bg-amber-500/10 dark:bg-amber-500/5 px-2.5 py-1 rounded-full border border-amber-500/20">
              {language === "en" ? `🏅 Total Score: ${score}` : `🏅 累计积分: ${score}`}
            </span>
            {!isFullscreen && onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-1 px-2.5 bg-[#1e293b]/10 text-slate-400 hover:text-slate-200 border border-slate-350 dark:border-white/10 rounded text-[10px] font-bold tracking-tight transition flex items-center gap-1 cursor-pointer hover:bg-[#1e293b]/20"
              >
                <Maximize2 className="w-3 h-3" /> {language === "en" ? "Fullscreen" : "全屏体验"}
              </button>
            )}
          </div>
        </header>

        {/* Game State Rendering */}
        {gameState === 'intro' && activeChapter && (
          <div className={`${st.card} shadow-lg transition-all`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{activeChapter.chapterIndex}</span>
            </div>
            
            <h2 className={`text-xl font-bold ${st.title}`}>
              {language === "en" ? `🎮 ${activeChapter.gameTitle || 'Mystery Level Game'}` : `🎮 ${activeChapter.gameTitle || '探秘关卡游戏'}`}
            </h2>

            <div className="p-4 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-black/5 dark:border-white/10 leading-relaxed text-slate-750 dark:text-slate-300 italic text-xs leading-relaxed">
              "{script?.introduction || (language === "en" ? `This chapter will take you on a fun ${currentModuleName} adventure, revealing the knowledge principles in the book.` : `本章将带您经历趣味的 ${currentModuleName} 冒险旅程，揭示书本中的知识原理。`)}"
            </div>

            <div className="p-3.5 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="font-extrabold text-cyan-500 dark:text-cyan-400 block mb-1">{language === "en" ? "🧭 Challenge Rules:" : "🧭 挑战神圣守则："}</span>
              {activeChapter.gameRules || (language === "en" ? 'Listen to the instructions and check the correct answers to conquer the entire territory!' : '听完导语指示，核对正确答案以此攻下整个领地！')}
            </div>

            <button onClick={handleStartGame} className={`w-full py-3 ${st.button}`}>
              {language === "en" ? "Load Power, Begin Trial 🚀" : "载入神力，开辟试炼 🚀"}
            </button>
          </div>
        )}

        {gameState === 'playing' && challenge && (
          <div className={`${st.card} shadow-lg`}>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{language === "en" ? `Progress: Challenge ${currentChallenge + 1} / ${(script?.challenges || []).length}` : `推进进度: 挑战 ${currentChallenge + 1} / ${(script?.challenges || []).length}`}</span>
              <span className="font-mono">{language === "en" ? `Point A-${currentChallenge + 1}` : `难点 A-${currentChallenge + 1}`}</span>
            </div>

            <div className="bg-slate-100 dark:bg-slate-950/50 p-2 text-xs font-bold text-slate-700 dark:text-slate-300 rounded border-l-4 border-cyan-500">
              🛡️ {challenge.title}
            </div>

            <h3 className="text-base font-bold leading-relaxed text-slate-800 dark:text-slate-200">
              {challenge.prompt}
            </h3>

            {/* MCQ Option buttons */}
            {challenge.options && challenge.options.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 pt-2">
                {challenge.options.map((opt: string, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => handleSelectOption(opt)}
                    className={st.optionBtn}
                  >
                    <span className="w-5 h-5 bg-black/5 dark:bg-white/5 rounded-md flex items-center justify-center text-[10px] font-bold text-slate-400 border border-black/5 dark:border-white/10 shrink-0 mr-3">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-xs">{opt}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <input 
                  type="text"
                  placeholder={language === "en" ? "Enter your academic keyword/formula..." : "请输入您的学术关键字/公式..."}
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitText()}
                  className={st.input}
                />
                <button onClick={handleSubmitText} className={`w-full ${st.button}`}>
                  {language === "en" ? "Verify & Submit 🖋️" : "核实并提交验证 🖋️"}
                </button>
              </div>
            )}
          </div>
        )}

        {gameState === 'feedback' && challenge && (
          <div className={`${st.card} shadow-lg`}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Review Log" : "审评日志信息"}</h3>
            
            {isCorrect ? (
              <div className={st.successCard}>
                <div className="font-extrabold flex items-center gap-1.5 text-sm">
                  {language === "en" ? "✨ Congratulations, correct answer! +10 points" : "✨ 恭喜，回答完全正确！ 积分 +10"}
                </div>
                <p className="text-xs leading-relaxed opacity-95">
                  {challenge.feedbackCorrect}
                </p>
              </div>
            ) : (
              <div className={st.failCard}>
                <div className="font-extrabold flex items-center gap-1.5 text-sm">
                  {language === "en" ? "❌ Off track, keep trying" : "❌ 选项偏轨，仍需淬炼"}
                </div>
                <p className="text-xs leading-relaxed opacity-95">
                  {challenge.feedbackIncorrect}
                </p>
              </div>
            )}

            <div className="p-3 bg-slate-100 dark:bg-slate-950/40 rounded-xl text-xs text-slate-500 dark:text-slate-400 border border-black/5 dark:border-white/10">
              {language === "en" ? "Correct answer:" : "标准神圣答字："}<span className="text-emerald-650 dark:text-cyan-400 font-bold underline select-all">{challenge.correctAnswer}</span>
            </div>

            <button onClick={handleNextChallenge} className={`w-full ${st.button}`}>
              {language === "en" ? "Continue to Next Challenge 🏆" : "继续中续挑战 🏆"}
            </button>
          </div>
        )}

        {gameState === 'completed' && activeChapter && (
          <div className={`${st.card} shadow-lg text-center`}>
            <div className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center text-white text-xl mx-auto shadow-md mb-2">
              🏅
            </div>
            <h2 className={`text-lg font-extrabold ${st.title}`}>
              {language === "en" ? `Level Complete! 《${activeChapter.title}》` : `关卡凯旋！《${activeChapter.title}》`}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{language === "en" ? "You have completed all interactive assessment indicators for this chapter" : "您已完成了该章节的所有互动考查指标"}</p>

            <div className="p-4 bg-slate-100/50 dark:bg-slate-950/40 border border-black/5 dark:border-white/10 rounded-xl leading-relaxed text-xs text-slate-700 dark:text-slate-300 text-left mt-4">
              <span className="font-bold text-amber-600 block mb-1">{language === "en" ? "💡 Book Essence Review:" : "💡 书籍精髓学理复盘："}</span>
              {script?.conclusion || (language === "en" ? 'You have fully mastered the scientific content and formulas of this lesson, well done!' : '您已经圆满掌握了本节课文的科学内含与公式，做得很好！')}
            </div>

            <button onClick={handleNextModule} className={`w-full mt-4 ${st.button}`}>
              {language === "en" ? "Start New Level Adventure 🗺️" : "开启新关卡冒险 🗺️"}
            </button>
          </div>
        )}

        {gameState === 'all-done' && (
          <div className={`${st.card} shadow-lg text-center py-6`}>
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-3xl mx-auto animate-bounce mb-3 text-white">
              👑
            </div>
            <h2 className={`text-xl font-black ${st.title}`}>
              {language === "en" ? "🎓 Book Complete, Great Achievement!" : "🎓 整书贯通，学业大成！"}
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              {language === "en" ? `Congratulations, you have cleared all intelligent scenarios and self-answer test points in 《${bookTitle}》!` : `恭喜，您已全票打通《${bookTitle}》的所有智能场景及自答测试点，登堂入室！`}
            </p>

            <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl text-center space-y-1 max-w-xs mx-auto mt-6">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{language === "en" ? "Final Score Board" : "终战总揽成绩榜"}</div>
              <div className="text-4xl font-extrabold text-amber-500">{score} {language === "en" ? "Points" : "学海绩点"}</div>
              <div className="text-[11px] text-amber-600 font-bold">{language === "en" ? "Title: SS Top-Tier Wisdom Pioneer Scholar" : "荣膺封号：SS 顶阶智慧先锋学者"}</div>
            </div>

            <button onClick={handleRestart} className={`w-full mt-6 ${st.button}`}>
              {language === "en" ? "Restart All Levels 🔄" : "重修整书奇幻关卡 🔄"}
            </button>
          </div>
        )}

      </div>

      <footer className="mt-8 text-center text-[10px] text-slate-550 dark:text-slate-500 flex items-center justify-center gap-1.5 leading-none bg-black/5 dark:bg-white/5 py-2.5 rounded-xl border border-black/5 dark:border-white/10">
        <BookOpen className="w-3.5 h-3.5" /> {language === "en" ? "This client sandbox game is rendered based on your exclusive AI script" : "本客户端沙盒游戏依据您的专属 AI 剧本自适配渲染生成"}
      </footer>

    </div>
  );
}
