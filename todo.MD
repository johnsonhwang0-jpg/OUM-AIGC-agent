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
