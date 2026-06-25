/**
 * 应用版本号集中管理
 *
 * 规范：
 *  - 每次完成代码修改并通过验证后，递增 patch（最后一位 +1）
 *  - 用户指定版本号时，按指定版本号更新
 *  - 同时更新 VERSION_HISTORY，记录本次变更内容
 */

export const APP_VERSION = "1.2.1";
export const VERSION_UPDATED_AT = "2026-06-25 13:05:00";

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
    version: "1.2.1",
    updatedAt: "2026-06-25 13:05:00",
    changes: [
      "TaskManager 左栏流程阶段文案改为「创建项目 / 目录提取 / 智能切片 / 内容提取 / 脚本生成 / 游戏生成」6 步并支持中英双语切换",
      "左栏点击对应阶段时，右栏展示该阶段的汇总信息（项目信息、目录列表、切片统计、各阶段进度）",
      "修复自动模式任务管理器中切片数据不显示的问题：通过 SSE 监听 parse_book_complete 事件触发项目数据刷新",
      "orchestrator 重构 runJobLoop 为阶段间串行：所有切片先 extract → 再统一 script → 最后统一 app-code，避免切片未完成就进入后续阶段",
      "App.tsx 传入 directoryItems / projectInfo / onRefreshProject 给 TaskManager，新建项目后自动加载项目数据",
      "新增 ProjectInfo 类型规范项目信息数据结构",
    ],
  },
  {
    version: "1.2.0",
    updatedAt: "2026-06-25 12:30:00",
    changes: [
      "新增「新建项目」弹窗：上传 PDF + 自动提取名称 + 选择自动/校验模式",
      "自动模式新增「任务管理器」三栏界面（流程时间线 + 切片列表 + 详情面板）",
      "App.tsx 新增 viewMode 状态，自动模式渲染 TaskManager 覆盖层",
      "顶部 Banner 新增「+ 新建项目」按钮和视图切换按钮",
      "移除 Step 1 的 AutomationPanel（模式选择已前置到新建项目弹窗）",
    ],
  },
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
