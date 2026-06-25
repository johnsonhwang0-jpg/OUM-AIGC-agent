import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";

let db: Database | null = null;
const DB_PATH = path.join(process.cwd(), "booktogame.db");
const DB_BACKUP_DIR = path.join(process.cwd(), ".db-backups");

// 数据库 schema 版本号，每次修改 schema 时递增
const CURRENT_SCHEMA_VERSION = 3;

/**
 * 在修改数据库 schema 前创建备份
 * 防止 schema 迁移失败导致数据丢失
 */
function backupDatabaseBeforeMigration(database: Database): void {
  if (!fs.existsSync(DB_BACKUP_DIR)) {
    fs.mkdirSync(DB_BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(DB_BACKUP_DIR, `booktogame-backup-${timestamp}.db`);

  try {
    const data = database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(backupPath, buffer);
    console.log(`💾 数据库迁移前已备份到: ${backupPath}`);
  } catch (e) {
    console.error("⚠️ 数据库备份失败:", e);
  }
}

/**
 * 获取当前数据库 schema 版本
 */
function getSchemaVersion(database: Database): number {
  try {
    const result = database.exec(`SELECT value FROM schema_version WHERE key = 'version'`);
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number;
    }
  } catch (e) {
    // schema_version 表不存在
  }
  return 0;
}

/**
 * 设置数据库 schema 版本
 */
function setSchemaVersion(database: Database, version: number): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);
  database.run(`INSERT OR REPLACE INTO schema_version (key, value) VALUES ('version', ?)`, [version]);
  saveDatabase(database);
}

/**
 * 安全地执行 ALTER TABLE 迁移
 */
function safeAlter(database: Database, sql: string, description: string): void {
  try {
    database.run(sql);
    console.log(`✅ 迁移成功: ${description}`);
  } catch (e: any) {
    // 列已存在或其他错误，静默忽略
    console.log(`⏭️  跳过迁移: ${description} (${e.message})`);
  }
}

export interface Project {
  id: string;
  name: string;
  pdfFileName: string;
  pdfData: string | null;
  bookTitle: string;
  bookContentText: string;
  directoryItems: string;
  modules: string;
  aiMeta: string; // AI调用元数据 JSON
  rawBlueprintData: string; // AI返回的原始切片数据 JSON
  executionMode?: "auto" | "manual"; // 项目级执行模式偏好
  createdAt: string;
  updatedAt: string;
}

export interface ModuleScript {
  id: string;
  projectId: string;
  moduleId: string;
  script: string;
  createdAt: string;
}

export interface ExtractedContent {
  id: string;
  projectId: string;
  moduleId: string;
  content: string;
  createdAt: string;
}

export interface GeneratedAppCode {
  id: string;
  projectId: string;
  moduleId: string;
  code: string;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  aiEntry: string; // "smart-split" | "script-gen" | "app-code"
  name: string;
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  isActive: boolean;
  note: string | null; // 备注：记录测试效果、为什么好/不好
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersion {
  id: string;
  promptTemplateId: string;
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  version: number;
  note: string | null;
  effectRating: string | null;
  createdAt: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  apiKey: string | null;
  baseUrl: string | null;
  maxTokens: number;
  temperature: number;
  topP: number;
  promptTemplateId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== 自动化编排 ====================

export type AutomationJobStatus = "pending" | "running" | "paused" | "completed" | "partial" | "cancelled" | "failed";
export type AutomationTaskStage = "extract" | "script" | "app-code";
export type AutomationTaskStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface AutomationJob {
  id: string;
  projectId: string;
  status: AutomationJobStatus;
  totalSlices: number;
  completedSlices: number;
  failedSlices: number;
  concurrency: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationTask {
  id: string;
  jobId: string;
  projectId: string;
  moduleId: string;
  sliceId: string | null;
  sliceTitle: string | null;
  stage: AutomationTaskStage;
  status: AutomationTaskStatus;
  attempts: number;
  maxAttempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  let database: Database;

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    database = new SQL.Database(buffer);
    console.log("📁 数据库已加载:", DB_PATH);
  } else {
    database = new SQL.Database();
    console.log("🆕 创建新数据库:", DB_PATH);
  }

  // 创建基础表
  database.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pdfFileName TEXT,
      pdfData TEXT,
      bookTitle TEXT,
      bookContentText TEXT,
      directoryItems TEXT,
      modules TEXT,
      aiMeta TEXT,
      rawBlueprintData TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS module_scripts (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      moduleId TEXT NOT NULL,
      script TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_scripts_project ON module_scripts(projectId)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS extracted_content (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      moduleId TEXT NOT NULL,
      content TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_extracted_project ON extracted_content(projectId)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS generated_app_code (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      moduleId TEXT NOT NULL,
      code TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_app_code_project ON generated_app_code(projectId)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      aiEntry TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT 'Untitled',
      systemPrompt TEXT,
      userPromptTemplate TEXT,
      isActive INTEGER DEFAULT 0,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_prompt_templates_entry ON prompt_templates(aiEntry)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      promptTemplateId TEXT NOT NULL,
      systemPrompt TEXT,
      userPromptTemplate TEXT,
      version INTEGER NOT NULL,
      note TEXT,
      effectRating TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (promptTemplateId) REFERENCES prompt_templates(id) ON DELETE CASCADE
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_prompt_versions_template ON prompt_versions(promptTemplateId)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS model_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      modelId TEXT NOT NULL,
      apiKey TEXT,
      baseUrl TEXT,
      maxTokens INTEGER DEFAULT 16000,
      temperature REAL DEFAULT 0.7,
      topP REAL DEFAULT 0.9,
      promptTemplateId TEXT,
      isActive INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (promptTemplateId) REFERENCES prompt_templates(id) ON DELETE SET NULL
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_model_configs_prompt ON model_configs(promptTemplateId)`);

  // ==================== Schema 迁移系统 ====================
  // 检查当前 schema 版本
  const currentVersion = getSchemaVersion(database);

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    console.log(`🔄 Schema 迁移: v${currentVersion} → v${CURRENT_SCHEMA_VERSION}`);
    // 迁移前先备份
    backupDatabaseBeforeMigration(database);
  }

  // v0 → v1: 添加 projects 表缺失的列
  if (currentVersion < 1) {
    safeAlter(database, `ALTER TABLE projects ADD COLUMN aiMeta TEXT`, "projects.aiMeta");
    safeAlter(database, `ALTER TABLE projects ADD COLUMN rawBlueprintData TEXT`, "projects.rawBlueprintData");
    safeAlter(database, `ALTER TABLE prompt_templates ADD COLUMN aiEntry TEXT NOT NULL DEFAULT ''`, "prompt_templates.aiEntry");
    safeAlter(database, `ALTER TABLE prompt_templates ADD COLUMN name TEXT NOT NULL DEFAULT 'Untitled'`, "prompt_templates.name");
    safeAlter(database, `ALTER TABLE prompt_templates ADD COLUMN note TEXT`, "prompt_templates.note");
    setSchemaVersion(database, 1);
  }

  // v1 → v2: 当前版本，无需额外迁移（schema 已包含所有列）
  if (currentVersion < 2) {
    // v2 的 schema 已经通过 CREATE TABLE IF NOT EXISTS 创建
    // 这里不需要额外迁移
    setSchemaVersion(database, 2);
  }

  // v2 → v3: 自动化编排（projects.executionMode + automation_jobs + automation_tasks）
  if (currentVersion < 3) {
    safeAlter(database, `ALTER TABLE projects ADD COLUMN executionMode TEXT DEFAULT 'manual'`, "projects.executionMode");

    database.run(`
      CREATE TABLE IF NOT EXISTS automation_jobs (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        totalSlices INTEGER DEFAULT 0,
        completedSlices INTEGER DEFAULT 0,
        failedSlices INTEGER DEFAULT 0,
        concurrency INTEGER DEFAULT 1,
        startedAt TEXT,
        finishedAt TEXT,
        error TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_auto_jobs_project ON automation_jobs(projectId)`);

    database.run(`
      CREATE TABLE IF NOT EXISTS automation_tasks (
        id TEXT PRIMARY KEY,
        jobId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        moduleId TEXT NOT NULL,
        sliceId TEXT,
        sliceTitle TEXT,
        stage TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        maxAttempts INTEGER DEFAULT 3,
        startedAt TEXT,
        finishedAt TEXT,
        error TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (jobId) REFERENCES automation_jobs(id) ON DELETE CASCADE
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_auto_tasks_job ON automation_tasks(jobId, status)`);
    setSchemaVersion(database, 3);
  }

  saveDatabase(database);
  return database;
}

function saveDatabase(database: Database): void {
  const data = database.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await initDatabase();
  }
  return db;
}

export async function createProject(
  name: string,
  pdfFileName?: string,
  pdfData?: string,
  bookTitle?: string,
  bookContentText?: string,
  directoryItems?: string,
  modules?: string,
  aiMeta?: string,
  rawBlueprintData?: string
): Promise<Project> {
  const database = await getDatabase();
  const id = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT INTO projects (id, name, pdfFileName, pdfData, bookTitle, bookContentText, directoryItems, modules, aiMeta, rawBlueprintData, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      pdfFileName || null,
      pdfData || null,
      bookTitle || "",
      bookContentText || "",
      directoryItems || "",
      modules || "",
      aiMeta || "",
      rawBlueprintData || "",
      now,
      now
    ]
  );

  saveDatabase(database);

  return {
    id,
    name,
    pdfFileName: pdfFileName || "",
    pdfData: pdfData || null,
    bookTitle: bookTitle || "",
    bookContentText: bookContentText || "",
    directoryItems: directoryItems || "",
    modules: modules || "",
    aiMeta: aiMeta || "",
    rawBlueprintData: rawBlueprintData || "",
    createdAt: now,
    updatedAt: now
  };
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "name" | "bookTitle" | "bookContentText" | "directoryItems" | "modules" | "pdfFileName" | "pdfData" | "aiMeta" | "rawBlueprintData" | "executionMode">>
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.bookTitle !== undefined) {
    fields.push("bookTitle = ?");
    values.push(updates.bookTitle);
  }
  if (updates.bookContentText !== undefined) {
    fields.push("bookContentText = ?");
    values.push(updates.bookContentText);
  }
  if (updates.directoryItems !== undefined) {
    fields.push("directoryItems = ?");
    values.push(updates.directoryItems);
  }
  if (updates.modules !== undefined) {
    fields.push("modules = ?");
    values.push(updates.modules);
  }
  if (updates.pdfFileName !== undefined) {
    fields.push("pdfFileName = ?");
    values.push(updates.pdfFileName);
  }
  if (updates.pdfData !== undefined) {
    fields.push("pdfData = ?");
    values.push(updates.pdfData);
  }
  if (updates.aiMeta !== undefined) {
    fields.push("aiMeta = ?");
    values.push(updates.aiMeta);
  }
  if (updates.rawBlueprintData !== undefined) {
    fields.push("rawBlueprintData = ?");
    values.push(updates.rawBlueprintData);
  }
  if (updates.executionMode !== undefined) {
    fields.push("executionMode = ?");
    values.push(updates.executionMode);
  }

  if (fields.length === 0) return;

  fields.push("updatedAt = ?");
  values.push(now);
  values.push(id);

  database.run(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`, values);
  saveDatabase(database);
}

export async function updateProjectPdf(id: string, pdfFileName: string, pdfData: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  database.run(
    `UPDATE projects SET pdfFileName = ?, pdfData = ?, updatedAt = ? WHERE id = ?`,
    [pdfFileName, pdfData, now, id]
  );
  saveDatabase(database);
}

export async function getProject(id: string): Promise<Project | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM projects`);

  if (result.length === 0) {
    return null;
  }

  const columns = result[0].columns;
  const idIndex = columns.indexOf("id");

  const matchingRow = result[0].values.find(row => row[idIndex] === id);

  if (!matchingRow) {
    return null;
  }

  const project: Project = {
    id: matchingRow[idIndex] as string,
    name: (matchingRow[columns.indexOf("name")] as string) || "",
    pdfFileName: (matchingRow[columns.indexOf("pdfFileName")] as string) || "",
    pdfData: matchingRow[columns.indexOf("pdfData")] as string | null,
    bookTitle: (matchingRow[columns.indexOf("bookTitle")] as string) || "",
    bookContentText: (matchingRow[columns.indexOf("bookContentText")] as string) || "",
    directoryItems: (matchingRow[columns.indexOf("directoryItems")] as string) || "",
    modules: (matchingRow[columns.indexOf("modules")] as string) || "",
    aiMeta: (matchingRow[columns.indexOf("aiMeta")] as string) || "",
    rawBlueprintData: (matchingRow[columns.indexOf("rawBlueprintData")] as string) || "",
    executionMode: ((): "auto" | "manual" => {
      const idx = columns.indexOf("executionMode");
      const val = idx >= 0 ? (matchingRow[idx] as string) : null;
      return val === "auto" ? "auto" : "manual";
    })(),
    createdAt: matchingRow[columns.indexOf("createdAt")] as string,
    updatedAt: matchingRow[columns.indexOf("updatedAt")] as string
  };

  return project;
}

export async function getAllProjects(): Promise<Project[]> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM projects ORDER BY updatedAt DESC`);

  if (result.length === 0) {
    return [];
  }

  const columns = result[0].columns;

  return result[0].values.map(row => ({
    id: row[columns.indexOf("id")] as string,
    name: row[columns.indexOf("name")] as string,
    pdfFileName: (row[columns.indexOf("pdfFileName")] as string) || "",
    pdfData: row[columns.indexOf("pdfData")] as string | null,
    bookTitle: (row[columns.indexOf("bookTitle")] as string) || "",
    bookContentText: (row[columns.indexOf("bookContentText")] as string) || "",
    directoryItems: (row[columns.indexOf("directoryItems")] as string) || "",
    modules: (row[columns.indexOf("modules")] as string) || "",
    aiMeta: (row[columns.indexOf("aiMeta")] as string) || "",
    rawBlueprintData: (row[columns.indexOf("rawBlueprintData")] as string) || "",
    executionMode: ((): "auto" | "manual" => {
      const idx = columns.indexOf("executionMode");
      const val = idx >= 0 ? (row[idx] as string) : null;
      return val === "auto" ? "auto" : "manual";
    })(),
    createdAt: row[columns.indexOf("createdAt")] as string,
    updatedAt: row[columns.indexOf("updatedAt")] as string
  }));
}

export async function deleteProject(id: string): Promise<void> {
  const database = await getDatabase();
  database.run(`DELETE FROM module_scripts WHERE projectId = ?`, [id]);
  database.run(`DELETE FROM automation_tasks WHERE projectId = ?`, [id]);
  database.run(`DELETE FROM automation_jobs WHERE projectId = ?`, [id]);
  database.run(`DELETE FROM projects WHERE id = ?`, [id]);
  saveDatabase(database);
}

export async function saveModuleScript(projectId: string, moduleId: string, script: object): Promise<void> {
  const database = await getDatabase();
  const id = `script-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT OR REPLACE INTO module_scripts (id, projectId, moduleId, script, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [id, projectId, moduleId, JSON.stringify(script), now]
  );
  saveDatabase(database);
}

export async function getModuleScripts(projectId: string): Promise<ModuleScript[]> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM module_scripts WHERE projectId = ?`, [projectId]);

  if (result.length === 0) {
    return [];
  }

  const columns = result[0].columns;

  return result[0].values.map(row => ({
    id: row[columns.indexOf("id")] as string,
    projectId: row[columns.indexOf("projectId")] as string,
    moduleId: row[columns.indexOf("moduleId")] as string,
    script: row[columns.indexOf("script")] as string,
    createdAt: row[columns.indexOf("createdAt")] as string
  }));
}

export async function saveExtractedContent(projectId: string, moduleId: string, content: string): Promise<void> {
  const database = await getDatabase();
  const id = `extracted-${projectId}-${moduleId}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT OR REPLACE INTO extracted_content (id, projectId, moduleId, content, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [id, projectId, moduleId, content, now]
  );
  saveDatabase(database);
}

export async function getExtractedContents(projectId: string): Promise<ExtractedContent[]> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM extracted_content WHERE projectId = ?`, [projectId]);

  if (result.length === 0) {
    return [];
  }

  const columns = result[0].columns;

  return result[0].values.map(row => ({
    id: row[columns.indexOf("id")] as string,
    projectId: row[columns.indexOf("projectId")] as string,
    moduleId: row[columns.indexOf("moduleId")] as string,
    content: row[columns.indexOf("content")] as string,
    createdAt: row[columns.indexOf("createdAt")] as string
  }));
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    saveDatabase(db);
    db.close();
    db = null;
  }
}

export async function saveGeneratedAppCode(projectId: string, moduleId: string, code: string): Promise<void> {
  const database = await getDatabase();
  const id = `appcode-${projectId}-${moduleId}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT OR REPLACE INTO generated_app_code (id, projectId, moduleId, code, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [id, projectId, moduleId, code, now]
  );
  saveDatabase(database);
}

export async function getGeneratedAppCode(projectId: string, moduleId: string): Promise<string | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT code FROM generated_app_code WHERE projectId = ? AND moduleId = ?`, [projectId, moduleId]);

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  return result[0].values[0][0] as string;
}

// Prompt Template functions
export async function getAllPromptTemplates(aiEntry?: string): Promise<PromptTemplate[]> {
  const database = await getDatabase();
  const query = aiEntry
    ? `SELECT * FROM prompt_templates WHERE aiEntry = ? ORDER BY isActive DESC, createdAt DESC`
    : `SELECT * FROM prompt_templates ORDER BY isActive DESC, createdAt DESC`;
  const result = database.exec(query, aiEntry ? [aiEntry] : []);

  if (result.length === 0) return [];

  return result[0].values.map((row) => ({
    id: row[0] as string,
    aiEntry: row[1] as string,
    name: row[2] as string,
    systemPrompt: row[3] as string | null,
    userPromptTemplate: row[4] as string | null,
    isActive: (row[5] as number) === 1,
    note: row[6] as string | null,
    createdAt: row[7] as string,
    updatedAt: row[8] as string,
  }));
}

export async function getPromptTemplate(id: string): Promise<PromptTemplate | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM prompt_templates WHERE id = ?`, [id]);

  if (result.length === 0 || result[0].values.length === 0) return null;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    aiEntry: row[1] as string,
    name: row[2] as string,
    systemPrompt: row[3] as string | null,
    userPromptTemplate: row[4] as string | null,
    isActive: (row[5] as number) === 1,
    note: row[6] as string | null,
    createdAt: row[7] as string,
    updatedAt: row[8] as string,
  };
}

export async function createPromptTemplate(data: {
  aiEntry: string;
  name: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  note?: string;
  isActive?: boolean;
}): Promise<PromptTemplate> {
  const database = await getDatabase();
  const id = `pt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT INTO prompt_templates (id, aiEntry, name, systemPrompt, userPromptTemplate, isActive, note, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.aiEntry,
      data.name,
      data.systemPrompt || null,
      data.userPromptTemplate || null,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 0,
      data.note || null,
      now,
      now,
    ]
  );
  saveDatabase(database);

  return {
    id,
    aiEntry: data.aiEntry,
    name: data.name,
    systemPrompt: data.systemPrompt || null,
    userPromptTemplate: data.userPromptTemplate || null,
    isActive: data.isActive !== undefined ? data.isActive : false,
    note: data.note || null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updatePromptTemplate(id: string, data: {
  name?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  note?: string;
  isActive?: boolean;
}): Promise<PromptTemplate | null> {
  const database = await getDatabase();
  const existing = await getPromptTemplate(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated = {
    name: data.name ?? existing.name,
    systemPrompt: data.systemPrompt !== undefined ? data.systemPrompt : existing.systemPrompt,
    userPromptTemplate: data.userPromptTemplate !== undefined ? data.userPromptTemplate : existing.userPromptTemplate,
    note: data.note !== undefined ? data.note : existing.note,
    isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
  };

  database.run(
    `UPDATE prompt_templates SET name=?, systemPrompt=?, userPromptTemplate=?, note=?, isActive=?, updatedAt=? WHERE id=?`,
    [
      updated.name,
      updated.systemPrompt,
      updated.userPromptTemplate,
      updated.note,
      updated.isActive ? 1 : 0,
      now,
      id,
    ]
  );
  saveDatabase(database);

  return { ...existing, ...updated, updatedAt: now };
}

export async function deletePromptTemplate(id: string): Promise<boolean> {
  const database = await getDatabase();
  database.run(`DELETE FROM prompt_templates WHERE id = ?`, [id]);
  saveDatabase(database);
  return true;
}

// Prompt Version functions
export async function getPromptVersions(promptTemplateId: string): Promise<PromptVersion[]> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM prompt_versions WHERE promptTemplateId = ? ORDER BY version DESC`, [promptTemplateId]);
  
  if (result.length === 0) return [];
  
  return result[0].values.map((row) => ({
    id: row[0] as string,
    promptTemplateId: row[1] as string,
    systemPrompt: row[2] as string | null,
    userPromptTemplate: row[3] as string | null,
    version: row[4] as number,
    note: row[5] as string | null,
    effectRating: row[6] as string | null,
    createdAt: row[7] as string,
  }));
}

export async function createPromptVersion(data: {
  promptTemplateId: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  version: number;
  note?: string;
  effectRating?: string;
}): Promise<PromptVersion> {
  const database = await getDatabase();
  const id = `pv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT INTO prompt_versions (id, promptTemplateId, systemPrompt, userPromptTemplate, version, note, effectRating, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.promptTemplateId,
      data.systemPrompt || null,
      data.userPromptTemplate || null,
      data.version,
      data.note || null,
      data.effectRating || null,
      now,
    ]
  );
  saveDatabase(database);

  return {
    id,
    promptTemplateId: data.promptTemplateId,
    systemPrompt: data.systemPrompt || null,
    userPromptTemplate: data.userPromptTemplate || null,
    version: data.version,
    note: data.note || null,
    effectRating: data.effectRating || null,
    createdAt: now,
  };
}

export async function updatePromptVersion(id: string, data: {
  note?: string;
  effectRating?: string;
}): Promise<PromptVersion | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM prompt_versions WHERE id = ?`, [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;

  const row = result[0].values[0];
  const existing: PromptVersion = {
    id: row[0] as string,
    promptTemplateId: row[1] as string,
    systemPrompt: row[2] as string | null,
    userPromptTemplate: row[3] as string | null,
    version: row[4] as number,
    note: row[5] as string | null,
    effectRating: row[6] as string | null,
    createdAt: row[7] as string,
  };

  database.run(
    `UPDATE prompt_versions SET note=?, effectRating=? WHERE id=?`,
    [
      data.note !== undefined ? data.note : existing.note,
      data.effectRating !== undefined ? data.effectRating : existing.effectRating,
      id,
    ]
  );
  saveDatabase(database);

  return { ...existing, note: data.note !== undefined ? data.note : existing.note, effectRating: data.effectRating !== undefined ? data.effectRating : existing.effectRating };
}

export async function deletePromptVersion(id: string): Promise<boolean> {
  const database = await getDatabase();
  database.run(`DELETE FROM prompt_versions WHERE id = ?`, [id]);
  saveDatabase(database);
  return true;
}

// Model Config functions
export async function getAllModelConfigs(): Promise<ModelConfig[]> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM model_configs ORDER BY createdAt DESC`);
  
  if (result.length === 0) return [];
  
  return result[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    provider: row[2] as string,
    modelId: row[3] as string,
    apiKey: row[4] as string | null,
    baseUrl: row[5] as string | null,
    maxTokens: row[6] as number,
    temperature: row[7] as number,
    topP: row[8] as number,
    promptTemplateId: row[9] as string | null,
    isActive: (row[10] as number) === 1,
    createdAt: row[11] as string,
    updatedAt: row[12] as string,
  }));
}

export async function getModelConfig(id: string): Promise<ModelConfig | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM model_configs WHERE id = ?`, [id]);
  
  if (result.length === 0 || result[0].values.length === 0) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    provider: row[2] as string,
    modelId: row[3] as string,
    apiKey: row[4] as string | null,
    baseUrl: row[5] as string | null,
    maxTokens: row[6] as number,
    temperature: row[7] as number,
    topP: row[8] as number,
    promptTemplateId: row[9] as string | null,
    isActive: (row[10] as number) === 1,
    createdAt: row[11] as string,
    updatedAt: row[12] as string,
  };
}

export async function createModelConfig(data: {
  name: string;
  provider: string;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  promptTemplateId?: string;
  isActive?: boolean;
}): Promise<ModelConfig> {
  const database = await getDatabase();
  const id = `mc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT INTO model_configs (id, name, provider, modelId, apiKey, baseUrl, maxTokens, temperature, topP, promptTemplateId, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.provider,
      data.modelId,
      data.apiKey || null,
      data.baseUrl || null,
      data.maxTokens || 16000,
      data.temperature || 0.7,
      data.topP || 0.9,
      data.promptTemplateId || null,
      data.isActive ? 1 : 0,
      now,
      now,
    ]
  );
  saveDatabase(database);

  return {
    id,
    name: data.name,
    provider: data.provider,
    modelId: data.modelId,
    apiKey: data.apiKey || null,
    baseUrl: data.baseUrl || null,
    maxTokens: data.maxTokens || 16000,
    temperature: data.temperature || 0.7,
    topP: data.topP || 0.9,
    promptTemplateId: data.promptTemplateId || null,
    isActive: data.isActive || false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateModelConfig(id: string, data: {
  name?: string;
  provider?: string;
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  promptTemplateId?: string;
  isActive?: boolean;
}): Promise<ModelConfig | null> {
  const database = await getDatabase();
  const existing = await getModelConfig(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated = {
    name: data.name ?? existing.name,
    provider: data.provider ?? existing.provider,
    modelId: data.modelId ?? existing.modelId,
    apiKey: data.apiKey !== undefined ? data.apiKey : existing.apiKey,
    baseUrl: data.baseUrl !== undefined ? data.baseUrl : existing.baseUrl,
    maxTokens: data.maxTokens ?? existing.maxTokens,
    temperature: data.temperature ?? existing.temperature,
    topP: data.topP ?? existing.topP,
    promptTemplateId: data.promptTemplateId !== undefined ? data.promptTemplateId : existing.promptTemplateId,
    isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
  };

  database.run(
    `UPDATE model_configs SET name=?, provider=?, modelId=?, apiKey=?, baseUrl=?, maxTokens=?, temperature=?, topP=?, promptTemplateId=?, isActive=?, updatedAt=? WHERE id=?`,
    [
      updated.name,
      updated.provider,
      updated.modelId,
      updated.apiKey,
      updated.baseUrl,
      updated.maxTokens,
      updated.temperature,
      updated.topP,
      updated.promptTemplateId,
      updated.isActive ? 1 : 0,
      now,
      id,
    ]
  );
  saveDatabase(database);

  return { ...updated, id, createdAt: existing.createdAt, updatedAt: now };
}

export async function deleteModelConfig(id: string): Promise<boolean> {
  const database = await getDatabase();
  database.run(`DELETE FROM model_configs WHERE id = ?`, [id]);
  saveDatabase(database);
  return true;
}

// ==================== 自动化编排 CRUD ====================

function rowToJob(row: any[], columns: string[]): AutomationJob {
  return {
    id: row[columns.indexOf("id")] as string,
    projectId: row[columns.indexOf("projectId")] as string,
    status: row[columns.indexOf("status")] as AutomationJobStatus,
    totalSlices: (row[columns.indexOf("totalSlices")] as number) || 0,
    completedSlices: (row[columns.indexOf("completedSlices")] as number) || 0,
    failedSlices: (row[columns.indexOf("failedSlices")] as number) || 0,
    concurrency: (row[columns.indexOf("concurrency")] as number) || 1,
    startedAt: (row[columns.indexOf("startedAt")] as string) || null,
    finishedAt: (row[columns.indexOf("finishedAt")] as string) || null,
    error: (row[columns.indexOf("error")] as string) || null,
    createdAt: row[columns.indexOf("createdAt")] as string,
    updatedAt: row[columns.indexOf("updatedAt")] as string,
  };
}

function rowToTask(row: any[], columns: string[]): AutomationTask {
  return {
    id: row[columns.indexOf("id")] as string,
    jobId: row[columns.indexOf("jobId")] as string,
    projectId: row[columns.indexOf("projectId")] as string,
    moduleId: row[columns.indexOf("moduleId")] as string,
    sliceId: (row[columns.indexOf("sliceId")] as string) || null,
    sliceTitle: (row[columns.indexOf("sliceTitle")] as string) || null,
    stage: row[columns.indexOf("stage")] as AutomationTaskStage,
    status: row[columns.indexOf("status")] as AutomationTaskStatus,
    attempts: (row[columns.indexOf("attempts")] as number) || 0,
    maxAttempts: (row[columns.indexOf("maxAttempts")] as number) || 3,
    startedAt: (row[columns.indexOf("startedAt")] as string) || null,
    finishedAt: (row[columns.indexOf("finishedAt")] as string) || null,
    error: (row[columns.indexOf("error")] as string) || null,
    createdAt: row[columns.indexOf("createdAt")] as string,
    updatedAt: row[columns.indexOf("updatedAt")] as string,
  };
}

export async function createAutomationJob(projectId: string, totalSlices: number, concurrency: number = 1): Promise<AutomationJob> {
  const database = await getDatabase();
  const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT INTO automation_jobs (id, projectId, status, totalSlices, completedSlices, failedSlices, concurrency, startedAt, finishedAt, error, createdAt, updatedAt)
     VALUES (?, ?, 'pending', ?, 0, 0, ?, NULL, NULL, NULL, ?, ?)`,
    [id, projectId, totalSlices, concurrency, now, now]
  );
  saveDatabase(database);

  return {
    id,
    projectId,
    status: "pending",
    totalSlices,
    completedSlices: 0,
    failedSlices: 0,
    concurrency,
    startedAt: null,
    finishedAt: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getAutomationJob(jobId: string): Promise<AutomationJob | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_jobs WHERE id = ?`, [jobId]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToJob(result[0].values[0], result[0].columns);
}

export async function getLatestAutomationJob(projectId: string): Promise<AutomationJob | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_jobs WHERE projectId = ? ORDER BY createdAt DESC LIMIT 1`, [projectId]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToJob(result[0].values[0], result[0].columns);
}

export async function updateAutomationJob(jobId: string, updates: Partial<AutomationJob>): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  const allowed: (keyof AutomationJob)[] = ["status", "completedSlices", "failedSlices", "concurrency", "startedAt", "finishedAt", "error"];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key] as any);
    }
  }
  if (fields.length === 0) return;

  fields.push("updatedAt = ?");
  values.push(now);
  values.push(jobId);

  database.run(`UPDATE automation_jobs SET ${fields.join(", ")} WHERE id = ?`, values);
  saveDatabase(database);
}

export async function createAutomationTask(data: {
  jobId: string;
  projectId: string;
  moduleId: string;
  sliceId?: string;
  sliceTitle?: string;
  stage: AutomationTaskStage;
  maxAttempts?: number;
}): Promise<AutomationTask> {
  const database = await getDatabase();
  const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT INTO automation_tasks (id, jobId, projectId, moduleId, sliceId, sliceTitle, stage, status, attempts, maxAttempts, startedAt, finishedAt, error, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, NULL, NULL, NULL, ?, ?)`,
    [id, data.jobId, data.projectId, data.moduleId, data.sliceId || null, data.sliceTitle || null, data.stage, data.maxAttempts || 3, now, now]
  );
  saveDatabase(database);

  return {
    id,
    jobId: data.jobId,
    projectId: data.projectId,
    moduleId: data.moduleId,
    sliceId: data.sliceId || null,
    sliceTitle: data.sliceTitle || null,
    stage: data.stage,
    status: "pending",
    attempts: 0,
    maxAttempts: data.maxAttempts || 3,
    startedAt: null,
    finishedAt: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getAutomationTasksByJob(jobId: string): Promise<AutomationTask[]> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_tasks WHERE jobId = ? ORDER BY createdAt ASC`, [jobId]);
  if (result.length === 0) return [];
  return result[0].values.map(row => rowToTask(row, result[0].columns));
}

export async function getAutomationTask(taskId: string): Promise<AutomationTask | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_tasks WHERE id = ?`, [taskId]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToTask(result[0].values[0], result[0].columns);
}

export async function updateAutomationTask(taskId: string, updates: Partial<AutomationTask>): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  const allowed: (keyof AutomationTask)[] = ["status", "attempts", "startedAt", "finishedAt", "error"];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key] as any);
    }
  }
  if (fields.length === 0) return;

  fields.push("updatedAt = ?");
  values.push(now);
  values.push(taskId);

  database.run(`UPDATE automation_tasks SET ${fields.join(", ")} WHERE id = ?`, values);
  saveDatabase(database);
}

// 获取某个切片在该 job 下处于 pending 的任务（用于断点续传）
export async function getPendingTasksForSlice(jobId: string, moduleId: string): Promise<AutomationTask[]> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_tasks WHERE jobId = ? AND moduleId = ? AND status = 'pending' ORDER BY createdAt ASC`, [jobId, moduleId]);
  if (result.length === 0) return [];
  return result[0].values.map(row => rowToTask(row, result[0].columns));
}
