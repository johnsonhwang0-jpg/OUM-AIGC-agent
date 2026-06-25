/**
 * 应用版本号集中管理
 *
 * 规范：
 *  - 每次完成代码修改并通过验证后，递增 patch（最后一位 +1）
 *  - 用户指定版本号时，按指定版本号更新
 *  - 同时更新 VERSION_HISTORY，记录本次变更内容
 */

export const APP_VERSION = "1.2.6";
export const VERSION_UPDATED_AT = "2026-06-25 19:20:00";

export interface VersionEntry {
  version: string;
  updatedAt: string;
  changes: string[];
  /**
   * 该版本对应的 git commit short hash（7 位）。
   * - 已提交版本：回填对应 commit 的 short hash
   * - 未提交版本：留空字符串，前端显示「未提交」
   * 回滚方式：git reset --hard <hash> 或 git checkout <hash>
   */
  gitCommit?: string;
}

/**
 * 版本历史（最新在前）
 */
export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "1.2.6",
    updatedAt: "2026-06-25 19:20:00",
    gitCommit: "", // 本次会话改动，尚未 commit
    changes: [
      "修复自动模式 extract 结果错误：orchestrator runSliceExtract 正则从 /P\\.?(\\d+).../i 改为 /P\\.(\\d+)(?:-(\\d+))?/（与前端完全一致），避免 P15-30 等格式前后端算出不同页码",
      "修复自动模式 extract 拼接格式与前端不一致：filterAndFormatLines 拼接从 += formatted + \\n\\n 改为 += formattedLines（与前端一致），trimExtractedContent 从条件调用改为总是调用",
      "修复自动模式 extract 默认 endPrinted=10 与前端不一致：改为 endPrinted=startPrinted（与前端一致）",
      "修复自动模式 script/app-code 字段不一致：SliceMeta 新增 chapterIndex 字段，script chapterIndex 从 slice.sliceId||coveredChapters 改为 slice.chapterIndex||slice.sliceId（与前端 mod.chapterIndex 一致），app-code chapterTitle 从 slice.title 改为 `${chapterIndex} · ${title}`（与前端一致）",
      "修复自动模式崩溃灰屏：orchestrator 断点续传分支 emit task_complete 缺 taskId，导致前端 useAutomationJob 每个事件都触发 fetchSnapshot 风暴（N 切片 × 3 阶段 × 2 事件 = 6N 次 fetchSnapshot），React 渲染队列积压崩溃；修复为先查找/创建 task 再 emit 带 taskId",
      "修复前端 useAutomationJob task 事件找不到 taskId 时立即 fetchSnapshot：改为 scheduleSnapshot 防抖（300ms 合并），避免 fetchSnapshot 风暴",
      "优化性能：runJobLoop 阶段 1 提前查一次 project + extracted_contents 传给 runSliceExtract 复用，避免每个切片重复 DB 查询（N 切片从 2N 次降到 2 次）",
      "通过端到端对比测试验证：3 个 module × 3 阶段（extract/script/app-code）= 9 项对比全部一致",
    ],
  },
  {
    version: "1.2.5",
    updatedAt: "2026-06-25 17:30:00",
    gitCommit: "34b7443",
    changes: [
      "修复 TaskManager 切片阶段显示「等待中」而非「进行中」：orchestrator 创建 Job 后立即设 status=running 并 emit job_progress，避免 parseBook 期间 isRunning=false",
      "修复自动模式 extract 阶段对话框疯狂弹消息 + 灰屏（根因一）：App.tsx activeStep===3 的批量提取 useEffect 在 executionMode==='auto' 时跳过，避免与 orchestrator 并发提取",
      "修复自动模式 extract 阶段对话框疯狂弹消息 + 灰屏（根因二，主因）：TaskManager 的 onRefreshProject 内联箭头函数每次渲染引用都变，导致 useEffect 无限循环；改用 useRef 稳定引用，useEffect 只依赖 parseBookDone",
      "修复自动模式 extract 结果错误（根因一）：App.tsx 手动调整 pdfPageOffset 只更新 state 未保存 DB，orchestrator 读到旧值；新增 changePdfPageOffset 统一入口同步 PATCH /api/projects/:id",
      "修复自动模式 extract 结果错误（根因二）：orchestrator 在 slice.pageRange 正则不匹配时不回退到 calculatePageRange（与前端不一致），导致 startPrinted/endPrinted 保持默认 1/10 提取错误页面",
      "orchestrator runSliceExtract 新增诊断日志（slice title/pageRange/coveredChapters/printed/offset/physical），便于排查前后端页码不一致",
    ],
  },
  {
    version: "1.2.4",
    updatedAt: "2026-06-25 16:49:50",
    gitCommit: "598fc54",
    changes: [
      "VersionEntry 新增 gitCommit 字段，回填历史版本对应的 commit short hash（1.2.1→f532eb5、1.2.0→2355b27、1.1.x→fc416b1）",
      "新增 /api/git-info 路由，通过 child_process execSync 读取当前 HEAD hash + 是否有未提交更改 + 分支名",
      "VersionTab UI 显示 git 状态：顶部「Git HEAD」栏显示当前 HEAD + dirty/clean 状态；每个版本卡片右侧显示 commit hash 按钮，点击复制 git reset --hard <hash> 回滚命令",
      "当前 HEAD 对应的版本卡片高亮显示「当前」标识，未提交版本显示「未提交」标签",
    ],
  },
  {
    version: "1.2.3",
    updatedAt: "2026-06-25 16:39:53",
    gitCommit: "", // 本次会话改动，尚未 commit
    changes: [
      "新增「版本备注」功能：SystemSettings 版本说明 tab 下每个版本增加可编辑备注框，失焦自动保存到 DB（version_notes 表）",
      "数据库迁移 v5：新增 version_notes 表（version PRIMARY KEY, note, updatedAt）",
      "新增 /api/version-notes GET/PUT 路由，支持读取全部备注与保存单个版本备注",
      "VersionTab UI 区分代码变更列表（version.ts 维护）与用户备注（DB 持久化），两者独立",
    ],
  },
  {
    version: "1.2.2",
    updatedAt: "2026-06-25 16:33:38",
    gitCommit: "", // 本次会话改动，尚未 commit
    changes: [
      "新增 shared/textbookMatcher.ts 共享纯函数层：抽离 calculatePageRange / filterAndFormatLines / trimExtractedContent / calculateAutoPageOffset，新增 PageRef 最小接口，前后端共用同一份 extract 逻辑",
      "数据库迁移 v4：projects 表新增 pdfPageOffset 字段，持久化印刷页→物理页偏移量，确保自动模式能读取前端计算的页码偏差",
      "前端 App.tsx：新建项目 / 重新提取 PDF 时将 pdfPageOffset 持久化到 DB；loadProject 时从 DB 恢复",
      "orchestrator 删除 computePageRange 复刻实现，import shared 纯函数；runSliceExtract 复刻手动模式 6 步流程（页码计算→offset 应用→extract-pages→filterAndFormatLines→图片嵌入→trimExtractedContent）",
      "orchestrator 新增 getSavedPrompt 复用 /api/prompt-templates，确保自动模式 AI 返回语言与手动模式一致",
    ],
  },
  {
    version: "1.2.1",
    updatedAt: "2026-06-25 13:05:00",
    gitCommit: "f532eb5",
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
    gitCommit: "2355b27",
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
    gitCommit: "fc416b1",
    changes: [
      "版本历史记录的更新时间精确到 hh:mm:ss",
    ],
  },
  {
    version: "1.1.1",
    updatedAt: "2026-06-25 11:45:30",
    gitCommit: "fc416b1",
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
