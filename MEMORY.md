# MEMORY.md

## 项目定位

- 项目名：`booktogame-ai-agent`。
- 目标：把教材或 PDF 内容处理为可运行、可预览、可下载的沉浸式互动模拟/游戏。
- 当前工作目录：`/Users/johnsonhwang/Desktop/OUM-AIGC-V2-immersive-simulation/booktogame-ai-agent`。

## 技术与运行

- 前端使用 React 19 + TypeScript + Vite 6 + Tailwind CSS 4。
- 后端使用 Express + TypeScript，由 `tsx server.ts` 启动。
- 持久化使用 SQL.js，本地数据库文件位于项目根目录 `booktogame.db`。
- 常用命令：
  - 开发：`npm run dev`
  - 类型检查：`npm run lint`
  - 生产构建：`npm run build`

## 工作约定

- 先读取 `AGENTS.md` 和本文件，再执行项目任务。
- UI 预览要通过浏览器检查页面身份、首屏内容、控制台和至少一个主要交互。
- 不记录 `.env` 中的凭据值，只记录凭据文件位置。
- `uploads/` 和 `booktogame.db` 可能包含用户生成的数据，不随意清理或覆盖。

## 已知事项

- 2026-06-25：项目根目录最初缺少 `AGENTS.md` 和 `MEMORY.md`。
- 2026-06-25：预期模板目录 `~/.codex/templates/` 不存在，因此依据用户提供的规则和仓库结构创建了最小可用版本。
- 2026-06-25：工作区已有未跟踪的 `uploads/pdf_images/proj-*` 目录，属于用户数据，后续操作必须保留。
- 2026-06-25：本地开发入口为 `http://localhost:8080`；`server.ts` 在开发模式中把 Vite 作为 Express 中间件挂载，因此前端页面和 `/api/*` 共用 8080 端口。
- 2026-06-25：核心产品流程为 5 阶段：导入 PDF → AI 教材切片 → 原文提取/映射 → 生成沉浸式模拟脚本 → 生成、预览并下载独立 HTML 游戏。
- 2026-06-25：已有项目可从 SQL.js 数据库恢复目录、切片、脚本、提取内容和生成代码；浏览器实测成功加载一个包含 171 个目录节点、14 个切片的项目。
- 2026-06-25：浏览器实测 `http://localhost:8080` 首屏、项目列表展开和项目恢复均正常，未发现控制台 warning/error。
- 2026-06-25：`server.ts:1308` 曾把布尔值传给 DashScope 的 `maxTokens` 参数；本次已改为显式传入 `6144`，`npm run lint` 已恢复通过。
- 2026-06-25：三处 AI 调用并未统一接入“模型管理”配置：`model_configs` 表当前为空，slice 强制使用 DeepSeek `deepseek-v4-flash`，script 仅依据进程启动时的 `AI_PROVIDER` 分支，build app 仅依据前端传入的模型字符串在 DeepSeek/Qwen 间二选一。
- 2026-06-25：`.env` 中 DeepSeek 与 DashScope 的密钥和当前模型均通过最小上游请求验证（HTTP 200）；因此 API 基础连通性不是当前主因。
- 2026-06-25：更正先前诊断：不能用 HTTP 200 和存在 `slices` 判断 slice 的 AI 调用成功，因为 `/api/parse-book` 在上游失败或 JSON 解析失败时也返回 HTTP 200 和启发式模板。必须检查 `_meta.error`；此前约 9.6 秒的最小 slice 结果不能作为真实 AI 成功证据。
- 2026-06-25：DashScope script 分支存在确定性参数错误：`callDashScope(finalPromptText, finalSystemInstruction, "", false)` 把 `false` 传给 `maxTokens`，实际形成 `max_tokens: false`，DashScope 返回 HTTP 400 `Range of max_tokens should be [1, 131072]`；应把 `false` 放在第 5 个 `jsonMode` 参数，并显式传入数值 token 上限。
- 2026-06-25：已启用的 prompt 模板使用双花括号变量，但服务端替换规则不一致；smart-split 的 `{{bookTitle}}` 不会被当前 `{title}` 规则替换，其他双花括号变量替换后会残留一层花括号。这主要影响提示词正确性和生成质量，不是网络连通性问题。
- 2026-06-25：使用最近项目的 171 个目录节点完整复现 slice：约 60.8 秒后返回 HTTP 200，但 `_meta.error` 为 `AI API调用失败: terminated，使用启发式fallback`，生成的 10 个切片是本地启发式模板。
- 2026-06-25：绕过本地服务直接发送同一份约 13.5KB 的非流式 DeepSeek 请求，约 61.1 秒出现 `UND_ERR_SOCKET: other side closed`；socket 已写出完整请求但只读取约 651 bytes，说明连接由 DeepSeek 对端或中间网络/CDN关闭。
- 2026-06-25：同一完整请求改为 `stream: true` 后约 1.7 秒收到 SSE 首包，约 56 秒收到首段正文，并持续保持连接。因此当前非中国出口下的主要故障是长耗时 DeepSeek 非流式请求在约 60 秒被关闭；小型终端测试能快速结束，所以会成功。
- 2026-06-25：`server.ts` 已存在 `callDeepSeekStream`，但 slice、script、build app 三个主入口均未使用；slice 的 fallback 又被包装为 HTTP 200，导致前端无法区分真实 AI 成功和降级结果。
- 2026-06-25：网络排查补充：shell 配置、当前环境、launchctl、npm 和 macOS `scutil --proxy` 均未发现显式 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY`；但机器存在 `utun10` 透明隧道，Node 请求使用本地地址 `172.19.0.1` 出口，因此流量由系统级隧道路由而不是环境变量代理接管。
- 2026-06-25：DNS 缓存不是主要原因：完整 slice 的非流式失败可在全新启动的独立 Node 进程中稳定复现，而同一进程的小请求和流式大请求成功；仅重启长期运行服务无法解决。
- 2026-06-25：IPv6 不是主要原因：失败请求的 socket 明确连接 IPv4 `36.150.244.216:443`。
- 2026-06-25：TLS/证书不是主要原因：同一目标、同一 Prompt 的流式请求成功完成 TLS、返回 HTTP 200 并持续收到 SSE 数据；故障发生在请求建立后等待非流式完整响应的阶段。
- 2026-06-25：当前最符合证据的网络层解释是透明隧道/出口线路或 DeepSeek 边缘节点对约 60 秒无正文的长非流式连接进行关闭；流式传输能持续产生数据并保持连接。
- 2026-06-25：海外调用修复采用“上游 SSE 流式读取、Express 对前端仍返回原 JSON”架构；公共客户端位于 `ai-stream.ts`，覆盖 DeepSeek 和 DashScope。
- 2026-06-25：DeepSeek `deepseek-v4-flash` 对结构化长任务启用 thinking 时会先消耗大量推理 token；请求增加 `thinking: { type: "disabled" }` 后，真实 171 节点 Slice 在当前海外出口约 39.2 秒完成，`_meta.error` 为空且未触发 fallback。
- 2026-06-25：真实长请求验证：Script 约 42.3 秒返回 17,443 字符；DeepSeek Build App 约 53.9 秒返回 29,891 字符完整 HTML。
- 2026-06-25：流式客户端支持保留中断前的正文，并能从“残缺前缀 + 模型重新输出的完整 JSON”中恢复最后一份可解析 JSON。
- 2026-06-25：提示词变量统一由 `prompt-template.ts` 处理，同时支持 `{{variable}}` 与 `{variable}`；真实 Slice 验证无未替换变量。
- 2026-06-25：Slice fallback 响应增加 `degraded` 和 `fallbackType`；前端检测到 `_meta.error` 或降级标记后进入错误态，不再保存为正常 AI 切片。
- 2026-06-25：完成双模式（自动模式/校验模式）全自动化流程开发。核心文件：`orchestrator.ts`（任务编排器）、`src/hooks/useAutomationJob.ts`（SSE 监听）、`src/components/Automation.tsx`（控制面板）。数据库新增 `automation_jobs`、`automation_tasks` 表及 `projects.executionMode` 字段（Schema v2→v3 迁移）。`server.ts` 新增 `/api/automation/*` 路由（start/status/stream/pause/resume/cancel/retry/download-all）。任务编排驱动 extract→script→app-code 流水线，支持重试（3 次，退避 0/10s/30s）、断点续传（已完成阶段自动跳过）、SSE 实时推送。实测：13 切片项目，首个切片 extract→script→app-code 全链路打通，HTML 产出正确。
- 2026-06-25：修复 `orchestrator.ts` 中 `backoffs[0] = 0` 被 `||` 吞掉的 bug：`0 || 60_000` 返回 60 秒等待，导致首次尝试就卡 60 秒。改用 `??` 运算符修复。
- 2026-06-25：模式切换 API 为 `PUT /api/projects/:id/execution-mode`，body `{ executionMode: "auto" | "manual" }`。前端 `App.tsx` 在第三阶段顶部渲染 `AutomationPanel`，支持模式切换、启动/暂停/恢复/取消/重试、进度看板和切片列表。
- 2026-06-25：修复 TaskManager 切片状态显示"等待中"而非"进行中"：`startAutomationJob` 创建 Job 时 DB 默认 status="pending"，直到 `runJobLoop`（parseBook 完成后）才更新为 "running"。期间 `isRunning=false`，前端 `getStageStatus` 对 slice 阶段返回 "pending"。修复：`orchestrator.ts` 创建 Job 后立即 `updateAutomationJob({ status: "running" })` 并 emit `job_progress`，确保切片生成阶段侧边栏显示"进行中"。
- 2026-06-25：修复自动模式 extract 阶段对话框疯狂弹消息 + 灰屏（根因一）：`App.tsx` 在 `activeStep===3` 时 useEffect 自动批量提取，与后端 orchestrator 的 extract 流程并发执行，同一切片被提取两次，频繁 setState 触发渲染崩溃。修复：useEffect 在 `executionMode === "auto"` 时直接 return，自动模式由 orchestrator 独占 extract。
- 2026-06-25：修复自动模式 extract 阶段对话框疯狂弹消息 + 灰屏（根因二，主因）：`App.tsx` 传给 TaskManager 的 `onRefreshProject` 是**内联箭头函数**，每次渲染引用都变。TaskManager 的 `useEffect(..., [parseBookDone, onRefreshProject])` 因此无限循环：`parseBookDone` true → `loadProject` → `addAgentMessage` → 重新渲染 → `onRefreshProject` 引用又变 → useEffect 再触发 → 消息堆积 → React 崩溃灰屏。修复：TaskManager 用 `useRef` 保存 `onRefreshProject`，useEffect 只依赖 `parseBookDone`。**此为 React 内联函数 + useEffect 依赖项的典型陷阱，后续所有传给子组件的回调必须用 useCallback 或 ref 稳定引用**。
- 2026-06-25：修复自动模式 extract 结果错误（与手动模式不一致）根因一：`App.tsx` 中手动调整 `pdfPageOffset`（+/-/输入/重新计算）只更新 React state，**未保存到 DB**。后端 orchestrator 从 DB 读到旧值 → 页码偏移不对 → extract 错误页面。修复：新增 `changePdfPageOffset` 统一入口（useCallback 依赖 currentProjectId），同时更新 state 和 PATCH `/api/projects/:id`。**所有需要后端读取的状态修改必须同步 DB**。
- 2026-06-25：修复自动模式 extract 结果错误根因二：`orchestrator.ts` 的 `runSliceExtract` 在 `slice.pageRange` 存在但正则不匹配时，`startPrinted/endPrinted` 保持默认 1/10，**不回退到 `calculatePageRange`**。前端 `getExtractedTextForModuleAsync` 在同样情况下回退。修复：正则不匹配时回退到 `calculatePageRange`（与前端一致）。同时新增 extract 诊断日志（slice title/pageRange/coveredChapters/printed/offset/physical），便于排查。
- 2026-06-25：版本升级 v1.2.5：本次修复涉及 3 个文件（orchestrator.ts、src/App.tsx、src/components/TaskManager.tsx），解决 TaskManager 状态显示、灰屏、extract 结果错误三类问题。
- 2026-06-25：版本升级 v1.2.6：自动模式与手动模式完全对齐。通过端到端对比测试验证 3 个 module × 3 阶段（extract/script/app-code）= 9 项对比全部一致。
- 2026-06-25：自动模式 extract 结果错误根因三（v1.2.6 核心 bug）：`orchestrator.ts` 的 `runSliceExtract` 页码正则与前端不一致。后端 `/P\.?(\d+).../i`（点号可选）+ `/(\d+)\s*[-–—]\s*(\d+)/`（纯数字），前端 `/P\.(\d+)(?:-(\d+))?/`（点号必需）。导致 `P15-30` / `15-30` 格式：前端回退 calculatePageRange，后端直接用数字 → 两个入口算出不同页码 → 提取不同页面内容。修复：后端正则改为与前端完全一致。**自动模式和手动模式必须使用同一套 shared 函数和相同的正则/默认值/拼接逻辑，不能各自实现**。
- 2026-06-25：自动模式 extract 拼接格式与前端不一致：后端 `+= formatted + "\n\n"`（多了 \n\n），前端 `+= formattedLines`。修复：与前端一致。trimExtractedContent 后端 `if (coveredChapters)` 条件调用，前端总是调用。修复：与前端一致。默认 endPrinted 后端 10，前端 startPrinted。修复：与前端一致。
- 2026-06-25：自动模式 script/app-code 字段不一致：SliceMeta 缺 `chapterIndex` 字段。script 的 `chapterIndex` 后端用 `slice.sliceId || slice.coveredChapters`，前端用 `mod.chapterIndex`。app-code 的 `chapterTitle` 后端用 `slice.title`，前端用 `${mod.chapterIndex} · ${mod.title}`。修复：SliceMeta 新增 `chapterIndex?: string`，两个阶段字段映射与前端完全一致。
- 2026-06-25：自动模式崩溃灰屏根因三（v1.2.6）：orchestrator 断点续传分支 emit `task_complete` **缺 taskId**。前端 `useAutomationJob` 的 `task_complete` 监听器 `findIndex(t => t.id === data.taskId)` 找不到（taskId=undefined → -1），触发 `fetchSnapshot(jobId)`。N 个切片 × 3 阶段 × 2 事件（task_update + task_complete）= **6N 次 fetchSnapshot**，每次都 `fetch + setTasks + setJob`，React 处理大量并发状态更新 → 渲染队列积压 → 后半段崩溃灰屏。修复：断点续传分支先查找/创建 task 标记 skipped，emit 时带 taskId。**所有 SSE 事件 emit 时必须包含 taskId，否则前端会触发 fetchSnapshot 风暴**。
- 2026-06-25：前端 useAutomationJob 防抖优化：task 事件找不到 taskId 时不再立即 `fetchSnapshot`，改为 `scheduleSnapshot` 防抖（300ms 合并），避免 N 个事件 → N 次 fetchSnapshot → setTasks 风暴。新增 `pendingSnapshotRef` 和 `scheduleSnapshot` useCallback。
- 2026-06-25：orchestrator 性能优化：`runJobLoop` 阶段 1 提前查一次 `project + extracted_contents` 传给 `runSliceExtract` 复用。此前每个切片都 `getProject + queryExtracted`，N 切片 = 2N 次 DB 查询。修复后 N 切片 = 2 次。`runSliceExtract` 函数签名新增 `project?` 和 `existingExtracts?` 参数。
- 2026-06-25：**工作约定（React 内联函数 + useEffect 依赖陷阱）**：传给子组件的回调函数必须用 `useCallback` 或 `useRef` 稳定引用，否则每次渲染引用都变会导致依赖该回调的 `useEffect` 无限循环。此为灰屏问题的典型根因。
- 2026-06-25：**工作约定（状态修改需同步 DB）**：所有需要后端读取的状态修改（如 pdfPageOffset）必须同步保存到 DB，不能只更新 React state。否则后端 orchestrator 从 DB 读到旧值导致行为不一致。
- 2026-06-25：**工作约定（两个入口一套逻辑）**：自动模式（orchestrator）和手动模式（前端 App.tsx）在 extract/script/app-code 三阶段必须使用同一套 shared 函数（calculatePageRange / filterAndFormatLines / trimExtractedContent）和相同的正则/默认值/拼接逻辑，不能各自实现。修改任一端时必须同步另一端，并通过端到端对比测试验证。
- 2026-06-25：**工作约定（SSE 事件 emit 规范）**：所有 SSE 事件 emit 时必须包含 taskId（如 task_update/task_complete/task_failed），否则前端 useAutomationJob 的监听器 findIndex 找不到会触发 fetchSnapshot 风暴。断点续传分支也必须先创建/查找 task 再 emit。
- 2026-06-27：版本升级 v1.2.14：新增项目内容锁定功能。后端 `projectWriteLock` 中间件 + `getActiveAutomationJob` 查询，对关键写接口返回 409；前端 `isProjectLocked` 状态（依赖 `backgroundJob.status`）驱动 Step 1-5 写操作按钮禁用 + 锁定 banner。锁定触发条件仅依赖活跃任务状态（running/paused），与项目初始 executionMode 解耦。
- 2026-06-27：版本升级 v1.2.15：弱化 executionMode 概念 + 建立重构测试安全网。
  - **executionMode 弱化**：NewProjectModal 新建项目不再强制选模式；AutomationPanel 移除 ModeToggle；App.tsx 移除 executionMode state，视图切换由是否有活跃 automation job 决定（有活跃 job→task-manager，否则→steps）。projects.executionMode 字段仍保留（DB 兼容），但前端不再依赖它做视图分支。Step 2「智能切片」按钮和 Step 3 AutomationPanel 不再受 manual 模式条件限制，随时可用。
  - **调试脚本清理**：根目录约 40 个 test_*.py/check_*.py 一次性调试脚本迁移至 tests/scratch/，根目录只保留生产文件（pdf_extractor_oxide.py 等生产脚本保留）。
  - **测试安全网建立**：新增 `npm test` 脚本（`tsx --test tests/*.test.ts`）。新增 tests/textbook-matcher.test.ts（21 测试，覆盖 shared/textbookMatcher.ts 的 extract 核心纯函数）；新增 tests/project-lock.test.ts（5 测试，覆盖锁定中间件）。全部 33 测试通过。**约定：测试用 node:test + tsx，characterization 风格（先记录现有真实行为，重构后行为不变即通过）**。
  - **projectWriteLock 提取**：从 server.ts 内联定义提取到 middleware/projectLock.ts，采用工厂模式 `createProjectWriteLock(getActiveJob)` 支持依赖注入，默认导出 `projectWriteLock`（用 database.js 的 getActiveAutomationJob）。server.ts 改为 import 引用。此为 server.ts 路由拆分的第一步，也是测试可注入的前提。
- 2026-06-27：**工作约定（测试先行于重构）**：对无测试安全网的大重构（如 server.ts 拆分），先为核心纯函数和中间件建立 characterization 测试，再做重构。测试反映当前真实行为（而非理想行为），重构后测试仍通过即验证行为不变。
- 2026-06-27：**待办（todo.MD）**：3 项 UX 改进已记录到 todo.MD 待处理——①锁定 banner 增加「暂停以编辑」快捷动作；②缺「快速重跑单切片」入口；③三栏布局响应式适配（iPad 小屏）。后续 server.ts 路由拆分（projects/ai/automation/prompts）+ shared service 提取（替代 internalPost 自调用）也已排期，需在测试安全网扩充后进行。
- 2026-06-28：**严重 bug 修复 v1.2.16**：orchestrator 自动模式 extract 步骤被 projectWriteLock 自锁。根因：锁判断「有活跃 job 即锁」，但 orchestrator 自己就是活跃 job，通过 internalPost 调 /api/projects/:id/extract-pages 时被 409 拦截，extract 重试 3 次全失败。修复：orchestrator internalPost 统一带 `x-internal-call: orchestrator` header，projectWriteLock 识别该 header 放行内部编排调用（锁只针对用户手工入口）。**教训：锁中间件必须区分「用户手工入口」和「内部编排调用」，否则 orchestrator 会自己锁自己。** 新增 2 个单元测试覆盖该行为。此 bug 也加速了待办第4项「提取 shared service 替代 internalPost」的必要性——若 orchestrator 不走 HTTP 而走 shared service 函数，就不会有这种自锁问题。
