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
