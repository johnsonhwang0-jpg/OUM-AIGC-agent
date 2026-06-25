/**
 * 应用版本号集中管理
 *
 * 规范：
 *  - 每次完成代码修改并通过验证后，递增 patch（最后一位 +1）
 *  - 用户指定版本号时，按指定版本号更新
 *  - 同时更新 VERSION_HISTORY，记录本次变更内容
 */

export const APP_VERSION = "1.1.2";
export const VERSION_UPDATED_AT = "2026-06-25 11:48:15";

export interface VersionEntry {
  version: string;
  updatedAt: string;
  changes: string[];
}

/**
 * 版本历史（最新在前）
 */
export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "1.1.2",
    updatedAt: "2026-06-25 11:48:15",
    changes: [
      "版本历史记录的更新时间精确到 hh:mm:ss",
    ],
  },
  {
    version: "1.1.1",
    updatedAt: "2026-06-25 11:45:30",
    changes: [
      "新增「自动模式」和「校验模式」双模式架构",
      "模式选择入口提前到第一阶段（上传 PDF + 目录提取完成后）",
      "自动模式：一键启动，orchestrator 自动驱动 切片→内容提取→脚本生成→app 构建",
      "SSE 实时推送任务进度，前端进度看板动态更新",
      "支持暂停/恢复/取消/重试（单任务或全部重试）",
      "断点续传：服务重启后可恢复未完成的自动化任务",
      "新增版本说明 tab，记录版本更新历史",
    ],
  },
];
