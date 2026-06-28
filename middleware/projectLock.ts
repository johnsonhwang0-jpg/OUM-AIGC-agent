import type { Request, Response, NextFunction } from "express";
import { getActiveAutomationJob } from "../database.js";

/**
 * 内容锁定中间件：自动化任务执行期间（running / paused）禁止手工写入
 * 前端禁用关键操作按钮 + 后端兜底返回 409，避免双入口并发写入冲突
 * 应用范围：updateProject / updateProjectPdf / saveModuleScript
 *           / saveExtractedContent / saveGeneratedAppCode / extract-pages
 * 不应用：execution-mode 切换、automation 任务控制、GET 读取、项目删除
 *
 * 放行规则：orchestrator 通过 internalPost 调用的写接口带 x-internal-call: orchestrator
 * header，锁不拦截内部编排调用（锁只针对用户手工入口）。
 * 否则 orchestrator 会被自己创建的活跃 job 锁住，无法执行 extract 等步骤。
 */
export function createProjectWriteLock(
  getActiveJob: (projectId: string) => Promise<{ id: string; status: string } | null>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      if (!projectId) return next();
      // orchestrator 内部编排调用放行，避免自己锁自己
      if (req.get("x-internal-call") === "orchestrator") return next();
      const activeJob = await getActiveJob(projectId);
      if (activeJob) {
        return res.status(409).json({
          error: "Project is locked by an active automation job",
          jobId: activeJob.id,
          jobStatus: activeJob.status,
        });
      }
      next();
    } catch (err) {
      console.error("projectWriteLock check failed:", err);
      // 锁检查失败不阻塞业务，但记录错误
      next();
    }
  };
}

export const projectWriteLock = createProjectWriteLock(getActiveAutomationJob);
