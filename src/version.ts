/**
 * 应用版本号集中管理
 *
 * 规范：
 *  - 每次完成代码修改并通过验证后，递增 patch（最后一位 +1）
 *  - 用户指定版本号时，按指定版本号更新
 *  - 同时更新 VERSION_HISTORY，记录本次变更内容
 *  - VERSION_UPDATED_AT 由 vite.config.ts 在构建/启动 dev server 时
 *    通过 define 注入 __BUILD_TIME__ 自动生成，无需手动维护
 */

// 由 vite.config.ts 的 define 注入；tsc --noEmit 时声明可见
declare const __BUILD_TIME__: string | undefined;

export const APP_VERSION = "1.2.21";
// 构建时自动注入；兜底用于非 Vite 环境（如纯 tsc）
export const VERSION_UPDATED_AT =
  typeof __BUILD_TIME__ !== "undefined"
    ? __BUILD_TIME__
    : new Date().toISOString().replace("T", " ").substring(0, 19);

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
    version: "1.2.21",
    updatedAt: "2026-06-29 01:00:00",
    gitCommit: "",
    changes: [
      "恢复新建项目时的模式选择入口，但语义改为「初始路径引导」而非「项目标签」：v1.2.15 误删了模式选择的全部价值，本次只恢复其作为视觉引导/教育入口的职责（让用户在创建时知道有两种工作方式），仍保留 v1.2.15 的核心结论（模式不写 DB、不打项目标签、过程中可随时切换）。",
      "NewProjectModal 在项目名下方新增两张可点选卡片：托管模式（Rocket 图标，AI 自动执行全流程，产出后统一校验）/ 审核模式（ClipboardCheck 图标，AI 在人工监督下逐步生产，每步审核后进入下一步）。默认选中托管模式。编辑模式不显示卡片。",
      "NewProjectResult 新增 initialMode: 'managed' | 'review' 字段，仅作初始路径用，不写 DB。",
      "App.tsx handleNewProjectCreated 根据 initialMode 分流：托管模式自动调 useAutomationJob.start(projectId) 启动 orchestrator + setViewMode('task-manager') 进任务看板（失败回退 steps）；审核模式保持现状进 Step 1。",
      "底部 hint 根据所选模式显示不同提示文案。",
      "i18n：新增 7 个翻译键 npmModeLabel/npmModeManaged/npmModeReview/npmModeManagedDesc/npmModeReviewDesc/npmModeManagedHint/npmModeReviewHint，中英双语。",
    ],
  },
  {
    version: "1.2.20",
    updatedAt: "2026-06-29 00:20:00",
    gitCommit: "464b0df",
    changes: [
      "NewProjectModal 接入 i18n：之前弹窗全为硬编码中文，英文模式下也只显示中文。现提取 33 个翻译 key（npm* 前缀）到 LanguageContext 的 zh/en 双语，覆盖标题/副标题/上传提示/进度/错误/按钮等全部文案。带参数的文案（页数、切片数）通过本地 tf() helper 做 {key} 插值。编辑模式和新模式均支持中英切换。",
    ],
  },
  {
    version: "1.2.19",
    updatedAt: "2026-06-29 00:00:00",
    gitCommit: "20c8ab3",
    changes: [
      "修复 totalSlices 永远为 0 的 bug：updateAutomationJob 白名单缺少 totalSlices 字段，orchestrator 调用 updateAutomationJob(jobId, { totalSlices: slices.length }) 被静默忽略，进度条显示 0/0。修复：白名单加入 totalSlices。",
      "修复 ERR_ABORTED：React StrictMode 开发模式双重挂载导致 EventSource 在 CONNECTING 状态被 es.close() 中止，浏览器报 ERR_ABORTED。修复：useAutomationJob 的 SSE useEffect 用 setTimeout(0) 延迟创建 EventSource，StrictMode 第一次挂载的 timer 被 cleanup clearTimeout 取消，只有第二次真正创建连接。生产环境（无 StrictMode）不受影响。",
    ],
  },
  {
    version: "1.2.18",
    updatedAt: "2026-06-28 23:30:00",
    gitCommit: "b078c31",
    changes: [
      "修复 server 重启后僵尸 job 卡在 running 导致的连环问题：①前端 loadProject 误判有活跃任务，建 SSE 后因 orchestrator 已死永远无事件，切换视图时 es.close() 触发 ERR_ABORTED；②projectWriteLock 检测到 running job 锁住项目，用户无法编辑。修复：database.ts 新增 recoverStaleJobs()，server 启动时把所有 status=running 的 job 标记为 failed（error: 'Server restarted, job interrupted'），paused 保留（用户主动暂停的可恢复）。已验证：重启后僵尸 job job-1782658020953-5r883wi 已从 running 变为 failed。",
    ],
  },
  {
    version: "1.2.17",
    updatedAt: "2026-06-28 23:10:00",
    gitCommit: "731be20",
    changes: [
      "消除 AutomationPanel 与 TaskManager 职责重叠：AutomationPanel 精简为纯「开始自动生成」启动入口，删除进度看板/切片列表/下载按钮/SliceRow/StageBadge 等子组件（进度/暂停/取消/下载统一交 TaskManager 全屏看板）。job 启动后 App.tsx 自动切 task-manager 视图。渲染条件加 !automationJobId（有 job 时不渲染启动按钮）。修复切换视图时两个组件争抢同一 job 的 SSE 导致 ERR_ABORTED 的问题。useAutomationJob(null) 不建 SSE 连接，仅用 start()。",
    ],
  },
  {
    version: "1.2.16",
    updatedAt: "2026-06-28 22:40:00",
    gitCommit: "483c1f9",
    changes: [
      "修复 orchestrator 自动模式 extract 步骤被自身创建的活跃 job 锁住的严重 bug：projectWriteLock 判断「有活跃 job 即锁」，但 orchestrator 通过 internalPost 调 /api/projects/:id/extract-pages 时自己就是活跃 job，导致 409 自锁，extract 重试 3 次全部失败。修复方式：orchestrator 的 internalPost 调用统一带 x-internal-call: orchestrator header，projectWriteLock 识别该 header 放行内部编排调用（锁只针对用户手工入口）。同步新增 2 个单元测试覆盖该行为（内部调用放行 / 伪造 header 不放行）。",
    ],
  },
  {
    version: "1.2.15",
    updatedAt: "2026-06-27 14:00:00",
    gitCommit: "354153b",
    changes: [
      "弱化 executionMode 概念：NewProjectModal 新建项目不再强制选择自动/校验模式，直接进入 Step 1；AutomationPanel 移除 ModeToggle 模式切换组件，「开始自动生成」按钮始终显示；App.tsx 移除 executionMode state，视图切换由是否有活跃 automation job 自然表达（有活跃 job 进 task-manager，否则进 steps）",
      "清理根目录约 40 个 test_*.py/check_*.py 一次性调试脚本至 tests/scratch/，根目录只保留生产文件",
      "建立重构测试安全网：新增 tests/textbook-matcher.test.ts（21 个测试，覆盖 calculatePageRange/trimExtractedContent/filterAndFormatLines/calculateAutoPageOffset/findNextSibling/buildHeadingPattern 等 extract 核心纯函数）；新增 tests/project-lock.test.ts（5 个测试，覆盖锁定中间件 409/放行/容错/paused 锁定场景）；package.json 新增 test 脚本（tsx --test tests/*.test.ts），全部 33 测试通过",
      "提取 projectWriteLock 中间件到独立模块 middleware/projectLock.ts（工厂模式支持依赖注入，便于测试），server.ts 改为 import 引用，为后续 server.ts 路由拆分做准备",
    ],
  },
  {
    version: "1.2.14",
    updatedAt: "2026-06-27 10:30:00",
    gitCommit: "c2f3168",
    changes: [
      "新增项目内容锁定功能：自动化任务执行中（running）或暂停（paused）时，禁止手工写操作，避免自动流程与手工修改并发导致数据不一致",
      "后端新增 projectWriteLock 中间件 + getActiveAutomationJob 查询，对 /api/projects/:id 下的关键写接口（PUT 项目/PDF、POST scripts/extracted/app-code/extract-pages）返回 409 Conflict",
      "前端 isProjectLocked 状态驱动 Step 1-5 所有关键写操作按钮/输入框禁用（添加章节、目录标题/页码/删除、raw text、模块新增/删除、AI 重新切片、重新提取、生成/重试脚本、脚本编辑框、开始构建），并显示锁定提示 banner",
      "锁定触发条件仅依赖 backgroundJob.status，与项目初始选择的自动/手工模式解耦：用户可在无活跃任务时自由编辑，启动/暂停任务即锁定，取消/完成任务即解锁",
    ],
  },
  {
    version: "1.2.13",
    updatedAt: "2026-06-26 22:24:02",
    gitCommit: "a09733b",
    changes: [
      "修复 script/app 计数虚高（68/22、29/20）：module_scripts 和 generated_app_code 表加 (projectId, moduleId) 唯一索引，saveModuleScript/saveGeneratedAppCode 改 ON CONFLICT UPSERT（原随机 id + INSERT OR REPLACE 永不冲突导致重复行累积）",
      "getProjectCountStats 计数改 COUNT(DISTINCT moduleId)（双保险，即使有历史重复行也不会虚高）",
      "schema 初始化时自动清理存量重复行：每个 (projectId, moduleId) 只保留 MAX(createdAt) 那行",
      "My Projects 列表移除手工/自动模式标签，只保留自动任务运行状态标记（自动处理中/已暂停）",
    ],
  },
  {
    version: "1.2.12",
    updatedAt: "2026-06-26 18:40:30",
    gitCommit: "cdde110",
    changes: [
      "修复暂停后 script 7/20 误显 completed：getStageStatus 改用 doneCount >= modules.length 判断完成（原 every() 在 task 数 < 切片数时误判）",
      "修复 pause/resume/cancel 反应慢：三个操作加乐观更新 setJob，UI 立即切换状态不等 SSE 回程（orchestrator 协作式中断，实际停止需等当前 AI 调用完成）",
      "修复 cancel 后重启清空已有 script/app-code：runSliceScript 开头查 getModuleScripts 有则 skipped，runSliceAppCode 开头查 getGeneratedAppCode 有则 skipped（与 extract 断点续传逻辑一致）",
    ],
  },
  {
    version: "1.2.11",
    updatedAt: "2026-06-26 17:36:28",
    gitCommit: "e2a4317",
    changes: [
      "修复 MiniStage 误导性绿色：script 就绪在 build 阶段从绿色改为中性灰，只有当前阶段的 completed 才显示绿色完成标志（MiniStage 新增 isCurrent 参数）",
      "TaskManager 顶部 bar 重构为 4 种状态：未启用/已暂停/执行中/全部完成，按状态切换按钮组（启用/恢复/暂停/取消/查看详情/下载全部）；移除启动卡片，看板始终显示；移除冗余的「切换校验模式」按钮（功能与最小化重复）",
      "顶部进度条改为状态 alert：自动模式提示约 30 分钟生成全部互动 HTML 可最小化，手工模式提示可最小化或开启自动化；状态点移至最右，模式标签加粗闪动",
      "左侧时间线改为竖向 stepper：节点用圆点+竖向连接线（completed 实心 emerald/running 实心 cyan 脉冲/failed red/pending 空心灰），6 个节点撑满容器高度，进行中节点显示 N/总数计数",
      "运行中节点按钮新增从上到下流动渐变动效（tm-stage-running 伪元素 translateY 动画，方向与时间线节点向下排列一致）",
      "skipped 状态展示为 completed 绿色样式 + 「from history」小标签区分断点续传复用（统一状态视觉，tmFromHistory 翻译键）",
      "修复 build 阶段不显示进行中状态：getStageStatus 未处理 build→app-code 映射，stageKey='build' 查 t.stage==='build' 永远为空返回 pending",
      "修复 resume 后 task 计数虚高（66/22、24/22）：getPendingTasksForSlice 只查 status='pending' 导致 resume 时查不到已完成 task → 创建重复 task；重命名为 getTasksForSlice 去掉 status 过滤，复用已存在 task",
    ],
  },
  {
    version: "1.2.10",
    updatedAt: "2026-06-26 15:30:00",
    gitCommit: "bcc2da9",
    changes: [
      "自动模式创建项目后直接启动 orchestrator：handleNewProjectCreated 里 auto 模式 POST /api/automation/start 并 setAutomationJobId，进入 TaskManager 即显示看板，无需再点「开始自动生成」按钮",
      "修复最小化 TaskManager 后项目详情页进度不同步：onMinimize 从单纯 setViewMode 改为先 await loadProject 刷新 modules/savedScripts/directoryItems，再切 steps 视图，并 loadProjectList 刷新首页进度（根因：steps 用旧 state modules=[] 看不到已完成切片/脚本/app）",
      "TaskManager 目录提取结果展示分级结构：从平铺改为三级缩进（chapter 青色背景 + BookOpen 图标，section 白色虚线 + CornerDownRight + ml-6 缩进 + 左侧树形线，subsection 更浅 + ml-12），与 TOC 页面视觉一致",
      "TaskManager 切片按钮文案「切换到校验模式编辑此切片」改为「查看详情」（tmEditThisSlice 翻译键，中英双语）",
    ],
  },
  {
    version: "1.2.9",
    updatedAt: "2026-06-26 15:04:21",
    gitCommit: "fa9f101",
    changes: [
      "修复自动模式 extract 页码偏移量（pdfPageOffset）始终为 0 的严重 bug：根因是 server.ts PUT /api/projects/:id 路由解构遗漏 pdfPageOffset 字段，导致前端写入请求被丢弃，DB 永远保持默认值 0，后端 orchestrator 读取不到正确 offset；手工流程因用 React state 不受影响，自动流程后端读 DB 一直错误",
      "修复进入有活跃任务的 TaskManager 仍显示「开始自动生成」按钮的问题：loadProject 不恢复 automationJobId，现 /api/projects/:id 附加 latestJob 字段，loadProject 检测到 running/paused 自动恢复 automationJobId，进入即显示进度",
      "顶栏后台任务指示器合并进任务管理器按钮：删除独立的「后台运行中」指示器，状态（脉冲圆点 + 进度 N/M）直接展示在「任务管理器」按钮内，点击恢复对应项目",
      "My Projects 项目列表新增编辑按钮：复用 NewProjectModal 编辑模式，仅修改项目名称，调用 PUT /api/projects/:id 持久化",
      "自动模式创建项目后直接进入 TaskManager（不再先进 steps 再手动切换）",
    ],
  },
  {
    version: "1.2.8",
    updatedAt: "2026-06-26 13:46:03",
    gitCommit: "19adb14",
    changes: [
      "TaskManager 最小化到后台执行：移除左上角 ArrowLeft 返回按钮，在「切换校验模式」后新增「最小化到后台」按钮（Minimize2 图标），点击后切回步骤视图，服务端任务继续后台运行",
      "顶栏新增全局后台任务指示器：最小化后仍显示脉冲圆点 + 进度计数（N/M）+ 「查看」按钮，点击重新进入对应项目的 TaskManager；通过 3s 轮询 /api/automation/:jobId/status 更新状态（进入 TaskManager 时由 SSE 接管，停止轮询）",
      "My Projects 项目列表展示自动处理状态：running 显示「自动处理中 N/M」脉冲徽章，paused 显示「已暂停」徽章；后端 /api/projects 附加 automationStatus 字段（批量查询 getLatestJobsForProjects 避免 N+1）",
      "自动模式 Extract 步骤不再显示「自动模式/校验模式」切换面板和「开始自动生成」按钮：AutomationPanel 渲染条件增加 executionMode==='manual'，自动模式由后端 orchestrator 处理 extract，避免前端重复触发",
      "修复 changePdfPageOffset 使用 PATCH 与后端 PUT 路由不匹配导致「Failed to save pdfPageOffset」错误",
    ],
  },
  {
    version: "1.2.7",
    updatedAt: "2026-06-26 12:47:33",
    gitCommit: "9f1222c",
    changes: [
      "首屏改造为 split view 内的项目列表：左侧保留 AI 聊天面板，右侧新增 HomeView 组件展示使用说明 + 项目列表，移除原全屏首屏路由",
      "项目列表展示字段：项目名称、切片/脚本/app 完成进度条（ProgressPill 组件可视化 value/total），支持多选 checkbox + 批量删除",
      "后端新增 getProjectCountStats 函数批量统计项目的 scriptCount/appCount，/api/projects 接口返回 sliceCount/scriptCount/appCount，避免 N+1 查询",
      "顶部导航重构：移除原 5 步骤（Import/Slice/Extract/Script/Build App），改为 TaskManager 独立按钮（amber 样式 + Layers 图标）+ 5 步骤（Preview/Slice/Extract/Script/Build App）",
      "step 1 由 Import 改为 Preview（PDF 已在 NewProjectModal 绑定，无需重复上传），删除 step 1 的 5 Steps 说明卡片和 PDF 上传卡片（与 HomeView 重复）",
      "manual 模式也可切换 TaskManager 总览：去掉 executionMode==='auto' 限制，两种模式都能通过顶部按钮切换",
      "返回按钮文案 Home/首页 改为 back/返回，标题只显示项目名称（去掉模式/阶段后缀），移除 banner 新建项目按钮（新建只在首页项目列表操作）",
    ],
  },
  {
    version: "1.2.6",
    updatedAt: "2026-06-25 19:20:00",
    gitCommit: "c226521",
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
