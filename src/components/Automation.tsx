import { useState } from "react";
import { useAutomationJob } from "../hooks/useAutomationJob";

interface AutomationPanelProps {
  projectId: string;
  onJobIdChange: (id: string | null) => void;
  onStarted?: () => void;
}

/**
 * 自动化任务启动面板（Step 3 内嵌）
 *
 * 职责：仅提供「开始自动生成」入口。任务启动后由 App.tsx 切换到 TaskManager
 * 全屏看板展示进度，避免两个组件重复展示进度 + 争抢 SSE 连接。
 *
 * 设计变更（v1.2.17）：原 AutomationPanel 含进度看板 + 切片列表，与 TaskManager
 * 职责重叠，切换视图时 SSE ERR_ABORTED。现精简为纯启动入口；进度/暂停/取消/下载
 * 统一交 TaskManager。
 */
export function AutomationPanel({
  projectId,
  onJobIdChange,
  onStarted,
}: AutomationPanelProps) {
  // jobId 始终 null：本面板不订阅任务进度，只负责启动，不建 SSE 连接
  const { start } = useAutomationJob(null);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const newJobId = await start(projectId);
      onJobIdChange(newJobId);
      // 启动后切到 TaskManager 全屏看板，进度展示由 TaskManager 负责
      onStarted?.();
    } catch (err: any) {
      console.error("启动自动化失败:", err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={handleStart}
        disabled={starting}
        className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
      >
        {starting ? "启动中..." : "▶ 开始自动生成"}
      </button>
    </div>
  );
}
