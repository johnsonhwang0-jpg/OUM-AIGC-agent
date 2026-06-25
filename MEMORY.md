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
