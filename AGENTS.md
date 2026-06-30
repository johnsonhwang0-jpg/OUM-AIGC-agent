# AGENTS.md

## 关于 Johnson

Johnson 想借助 AI Coding 成为能够独立全栈开发并上架产品的自由职业者。

- 工作哲学：任何重复 3 遍的事情都应 AI 化或自动化。
- 技术决策必须说明“为什么”以及“对用户的影响”，不能只描述实现。
- 默认使用中文沟通；代码、命令、变量名使用英文。
- 结论先行。需求模糊时先给出最合理方案，再询问是否需要调整。
- 从第一性原理出发，不因行业惯例直接照搬；发现方案有问题或有更直接的路径时，应明确指出。

## 项目

- 项目名：`booktogame-ai-agent`
- 项目类型：将教材/PDF内容转化为沉浸式互动模拟或游戏的全栈 Web 应用。
- 前端：React 19、TypeScript、Vite 6、Tailwind CSS 4、Motion。
- 后端：Express、TypeScript、SQL.js，开发环境由 `tsx server.ts` 同时提供前后端服务。
- 本地数据库：`booktogame.db`。
- 默认开发命令：`npm run dev`。
- 默认生产构建检查：`npm run build`。
- 默认类型检查：`npm run lint`。

## 约束先行 + 记忆先行

任何需要写代码、改文件、运行脚本、做方案或整理资料的请求开始前：

1. 完整读取项目根目录的 `AGENTS.md` 和 `MEMORY.md`。
2. 若任一文件缺失，优先从 `~/.codex/templates/` 复制；模板目录缺失时，创建最小可用文件并记录到 `MEMORY.md`。
3. 在这两个文件就绪前，不修改业务文件或外部状态。
4. 工作中发现新的架构决策、踩坑、用户纠正或外部资源位置时，主动更新 `MEMORY.md`。
5. 凭据只记录位置，不记录值；代码中能直接查到的信息不重复复制。
6. 会话结束前，用一句话说明本次新增到 `MEMORY.md` 的内容。

修改 `AGENTS.md` 或 `MEMORY.md` 所定义的流程时，先更新文档，再改变实践。

## 工作方式

- 优先理解完整用户流程，再决定局部实现。
- 预览或 UI 验证必须实际打开浏览器检查；仅启动进程不代表验证通过。
- 保留用户已有改动，不覆盖无关文件。
- `.env`、数据库、上传文件等可能包含用户数据，不在输出中泄露其内容。
- 重要结论应附上可复现的命令、URL 或证据。

## 版本号与版本历史管理

- `package.json` 的 `version` 与 `src/version.ts` 的 `APP_VERSION` 必须同步递增。
- `src/version.ts` 的 `VERSION_HISTORY` 数组头部新增条目，记录该版本变更内容。
- **`updatedAt` 字段必须使用 GitHub 同步时对应 commit 的实际时间**，通过 `git log --format="%ci" <hash>` 获取，不得手写或虚构。
- 流程：先提交代码 → 拿到 commit hash → 用 `git log --format="%ci" <hash>` 查真实时间 → 回填 `gitCommit` 和 `updatedAt` → 再提交一次回填 commit → push。
- `gitCommit` 字段填该版本主 commit 的 7 位 short hash。

