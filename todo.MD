# 待处理需求清单

> 通过问答形式累积的需求，最后一起处理。已完成的项目标记 `[x]`，待处理标记 `[ ]`。

---

## 需求 1：TaskManager 最小化到后台执行（已完成）

**背景**：当前 TaskManager 左上角有个返回按钮（`ArrowLeft` icon），容易让人误以为是"关闭/停止自动化任务"。实际上自动化任务在服务端 fire-and-forget 运行，前端离开只是 SSE 断开，任务仍在后台继续。这个现状 UI 上没有体现，用户困惑。

**具体改动**：

1. **TaskManager 左上角返回按钮**
   - 去掉 `ArrowLeft` icon（不要再显示返回箭头）
   - 该按钮定位需要重新审视：是直接移除，还是改为其他形式？

2. **在 TaskManager 最右侧新增"最小化到后台执行"按钮**
   - 位置：放在现有 "Switch to Manual" 按钮（amber 色，`lucide-settings` icon）之后
   - 文案：中文"最小化到后台执行" / 英文"Minimize to Background"
   - 行为：点击后前端关闭 TaskManager 视图（切回首屏项目列表或上一步视图），但**不**取消服务端的自动化任务
   - 视觉提示：建议加一个图标（如 `Minimize2` 或 `ArrowDownToLine`），让用户明确这是"最小化"而非"停止"

3. **配套提示（可选，待定）**
   - 点击"最小化"后，是否在顶栏或全局显示一个迷你进度条/状态指示器（如"后台有 1 个任务运行中"），让用户知道任务仍在跑？
   - 这个属于增量优化，可后续再加。

**涉及文件**：
- `src/components/TaskManager.tsx`（左上角返回按钮 + 新增最小化按钮）
- 可能涉及 `src/App.tsx`（顶栏全局状态指示，若实现配套提示）

**状态**：[x] 已完成
- 移除 TaskManager 左上角 `ArrowLeft` 返回按钮
- 在 "Switch to Manual" 后新增"最小化到后台"按钮（`Minimize2` icon），点击后 `setCurrentProjectId(null)` 返回首页，保留 `automationJobId` 不清空
- 顶栏新增全局后台任务指示器：当 `backgroundJob` 为 running/paused 时显示脉冲圆点 + 进度计数 + "查看"按钮，点击重新进入对应项目的 TaskManager
- 通过 3s 轮询 `/api/automation/:jobId/status` 更新后台任务状态（在 TaskManager 视图时由 SSE 接管，停止轮询）
- HomeView 项目列表展示自动处理状态徽章：running 显示"自动处理中 N/M"，paused 显示"已暂停"
- 后端 `GET /api/projects` 附加 `automationStatus` 字段（批量查询 `getLatestJobsForProjects` 避免 N+1）

---

<!-- 新需求在此追加，保持同样格式：## 需求 N：标题（状态） -->

---

## 需求 2：锁定 banner 增加"暂停任务以编辑"快捷动作（待处理）

**背景**：当前 v1.2.14 的项目内容锁定 banner 只有"打开任务看板 →"按钮。用户在锁定状态下想"我就改一行数据怎么办"时没有出路，只能手动进 TaskManager 找暂停按钮，路径太长。应在 banner 上直接提供"暂停任务以编辑"快捷动作，让用户知道不必干等自动任务完成。

**具体改动**：

1. **锁定 banner 新增"暂停以编辑"按钮**
   - 位置：现有"打开任务看板 →"按钮左侧或右侧
   - 文案：中文"暂停以编辑" / 英文"Pause to Edit"
   - 行为：点击后调用 `/api/automation/:jobId/pause`，暂停成功后 banner 自动切换为 paused 状态文案（仍锁定，但用户明确知道暂停后可手工恢复或继续等）
   - 视觉：amber 色系，与 banner 整体色调一致
   - 仅在 `backgroundJob.status === "running"` 时显示；paused 状态下该按钮无意义（已经暂停）

2. **暂停后引导**
   - paused 状态下 banner 文案改为"已暂停 · 可手工编辑后恢复"或类似，明确告诉用户现在可以改了
   - 但注意：按当前锁定设计，paused 仍锁定。这里需要决策——是放开 paused 的锁定（让用户能改），还是保持锁定让用户先取消任务？
   - **待决策**：paused 状态下是否放开手工编辑？若放开，需调整 `isProjectLocked` 排除 paused；若不放开，banner 按钮文案应改为"取消任务以编辑"。

**涉及文件**：
- `src/App.tsx`（banner 区域 + isProjectLocked 逻辑，若决策放开 paused）
- 可能涉及 `src/hooks/useAutomationJob.ts`（pause 调用）

**状态**：[ ] 待处理
- 待用户决策：paused 状态下是否放开手工编辑

---

## 需求 3：TaskManager 增加"快速重跑单切片"入口（待处理）

**背景**：当前 TaskManager 有 `onEditSlice` 跳到 Step 4 手动操作，但"这个切片 script 不满意，重新生成"或"这个 app-code 有 bug，重新生成"时，用户要回到 Step 4 / Step 5 手动点按钮，路径长。应在 TaskManager 切片列表上提供更直接的重跑入口。

**具体改动**：

1. **每个切片行新增"重跑"下拉或按钮组**
   - 在切片列表每行右侧，提供三个阶段的重跑入口：重跑 Extract / 重跑 Script / 重跑 Build
   - 或简化为：根据该切片当前所处阶段，提供"重跑当前阶段"主按钮 + "重跑其他阶段"次级菜单
   - 行为：调用 `/api/automation/task/:taskId/retry` 或新增 `/api/automation/rerun-slice` 接口，重新执行该切片的指定阶段
   - 重跑前应有确认弹窗（避免误触），提示"将覆盖现有 {stage} 结果"

2. **后端支持单切片单阶段重跑**
   - 现有 `/api/automation/task/:taskId/retry` 是 task 级别重试，需确认是否支持"已完成 task 重新跑"
   - 可能需要新增接口：`POST /api/automation/:jobId/rerun-slice` body `{ moduleId, stage }`，创建新 task 并执行
   - 或扩展现有 retry 接口支持已完成 task

3. **进度看板同步**
   - 重跑后该切片状态回到 running，进度条更新
   - 重跑产生的结果覆盖旧结果（DB UPSERT）

**涉及文件**：
- `src/components/TaskManager.tsx`（切片列表 UI + 重跑按钮）
- `server.ts` 或拆分后的 `routes/automation.ts`（新增/扩展重跑接口）
- `orchestrator.ts`（单切片单阶段执行函数复用）

**状态**：[ ] 待处理

---

## 需求 4：响应式布局适配（待处理）

**背景**：当前三栏布局（AI 面板 + 主内容 + 任务看板）在小屏会挤压。iPad 查看进度体验差，手机基本不可用。自动化任务运行时用户可能想在 iPad/手机上查看进度，当前布局无法满足。

**具体改动**：

1. **断点设计**
   - ≥1280px（桌面）：三栏并排
   - 768-1279px（iPad/小平板）：主内容 + 任务看板可切换 tab，AI 面板折叠为抽屉
   - <768px（手机）：单栏，底部 tab 切换"主内容 / 任务看板 / AI 助手"

2. **AI 面板改为可折叠抽屉**
   - 桌面端保持侧栏，小屏改为右侧抽屉，点击图标唤出
   - 抽屉打开时主内容区不挤压（overlay 模式）

3. **TaskManager 响应式**
   - 桌面端保持当前看板布局
   - 小屏改为竖向卡片列表，阶段进度条改为紧凑横向
   - 切片列表表格在小屏改为卡片

4. **Step 1-5 视图响应式**
   - 检查各步骤在小屏下的表单/表格布局
   - 目录树、模块表格等横向溢出改为可滚动或卡片化

**涉及文件**：
- `src/App.tsx`（整体布局断点）
- `src/components/TaskManager.tsx`（看板响应式）
- `src/index.css`（Tailwind 断点 utilities）
- 各 Step 视图组件（拆分后）

**状态**：[ ] 待处理

---

## 需求 5：后处理 / AI 审核体系（待处理）

**背景**：当前系统在 Autopilot 模式下产出 extract → script → app-code 后，校验/修改完全依赖人工。随着产物增多，需要一个成体系的后处理 + AI 审核层，让 AI 在产物交付给用户前先做一轮自动审核与修正，降低人工负担，同时为 Copilot 模式提供"AI 辅助审核"能力。这是一个完整的体系，不是单点功能。

**可能包含的子方向**（待进一步拆解）：

1. **产物质量审核**
   - extract 产物：页码对齐、章节完整性、文本质量
   - script 产物：语法正确性、与教材内容一致性、互动逻辑合理性
   - app-code 产物：可运行性、与 script 对应关系、潜在 bug
   - 审核结果以分级（pass / warn / fail）+ 问题清单形式呈现

2. **AI 自动修正**
   - 对 warn/fail 项自动调用 AI 修正，修正后再次审核
   - 设置最大修正轮次避免死循环

3. **审核报告**
   - 每个切片/项目生成一份审核报告，记录发现的问题、修正过程、最终结论
   - 报告可作为用户是否采纳产物的决策依据

4. **与现有模式的关系**
   - Autopilot 模式：自动执行全流程后，自动进入 AI 审核阶段，审核通过才交付
   - Copilot 模式：每步产出后可选触发 AI 审核，作为人工审核的辅助

5. **后处理流水线**
   - 可能需要新增 orchestrator 阶段（review/polish）
   - 或独立的后处理服务，产物完成后异步触发

**涉及文件**：
- `orchestrator.ts`（新增审核阶段或 hook）
- `server.ts` / 拆分后的路由（审核接口、报告查询）
- `src/components/TaskManager.tsx`（审核结果展示）
- 可能新增 `reviewer.ts` / `post-processor.ts` 模块
- prompt 模板（审核专用 prompt）

**状态**：[ ] 待处理
- 待进一步细化：审核范围、审核标准、修正策略、报告格式、与 orchestrator 的集成方式

---

## 需求 6：接入 Codex 执行最终 AI Coding（待处理）

**背景**：当前 Step 5（Build App）由系统直接调用 AI 生成 app-code。但 app-code 是最终交付物，质量要求高，且当前 AI 生成代码的能力边界有限。Codex（或类似 coding agent）在代码生成/打磨上更专业。应在最终代码生成环节把 Codex 接进来，让 Codex 承担最后的 AI coding 工作，提升产出的可运行性与工程质量。

**具体改动**：

1. **集成方式**
   - 方案 A：后端调用 Codex CLI / API，把 script + 上下文交给 Codex 生成 app-code
   - 方案 B：导出产物（script + extract）为 Codex 可消费的格式，由用户手动在 Codex 中打开
   - 方案 C：Codex 作为 orchestrator 的一个阶段，接收前序产物，输出最终代码
   - **待决策**：选哪种集成方式，取决于 Codex 的 API/CLI 能力与产品定位

2. **产物传递**
   - 把 extract 产物、script 产物、教材上下文、prompt 模板等组装成 Codex 的输入
   - 明确 Codex 输出格式（单文件 / 多文件 / 项目结构）

3. **回写与预览**
   - Codex 生成的代码回写到项目，替换或并存现有 app-code
   - Step 5 预览支持查看 Codex 产物
   - 保留版本对比（AI 直出 vs Codex 产出）便于回滚

4. **凭据与配置**
   - Codex API key / CLI 路径等配置项
   - 凭据只记录位置，不记录值

**涉及文件**：
- `orchestrator.ts`（新增 codex 阶段或替换现有 app-code 阶段）
- `server.ts` / 拆分后的路由（codex 调用接口）
- `src/components/TaskManager.tsx` + Step 5 视图（产物展示）
- 可能新增 `codex-adapter.ts` / `code-builder.ts` 模块
- prompt 模板（codex 专用 prompt，含上下文组装）
- `.env.example`（新增 codex 配置项占位）

**状态**：[ ] 待处理
- 待决策：集成方式（A/B/C）、Codex 产物格式、是否替换现有 AI 直出
