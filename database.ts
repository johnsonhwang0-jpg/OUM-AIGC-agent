import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";

let db: Database | null = null;
const DB_PATH = path.join(process.cwd(), "booktogame.db");

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
  name: string;
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  isActive: boolean;
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

  // 迁移：为旧数据库添加缺失的列
  try {
    database.run(`ALTER TABLE projects ADD COLUMN aiMeta TEXT`);
  } catch (e) {
    // 列已存在，忽略
  }
  try {
    database.run(`ALTER TABLE projects ADD COLUMN rawBlueprintData TEXT`);
  } catch (e) {
    // 列已存在，忽略
  }

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

  // Prompt templates table
  database.run(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      systemPrompt TEXT,
      userPromptTemplate TEXT,
      isActive INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Prompt version history table
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

  // Model configurations table
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
  updates: Partial<Pick<Project, "name" | "bookTitle" | "bookContentText" | "directoryItems" | "modules" | "pdfFileName" | "pdfData" | "aiMeta" | "rawBlueprintData">>
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
    createdAt: row[columns.indexOf("createdAt")] as string,
    updatedAt: row[columns.indexOf("updatedAt")] as string
  }));
}

export async function deleteProject(id: string): Promise<void> {
  const database = await getDatabase();
  database.run(`DELETE FROM module_scripts WHERE projectId = ?`, [id]);
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
export async function getAllPromptTemplates(): Promise<PromptTemplate[]> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM prompt_templates ORDER BY createdAt DESC`);
  
  if (result.length === 0) return [];
  
  return result[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    systemPrompt: row[2] as string | null,
    userPromptTemplate: row[3] as string | null,
    isActive: (row[4] as number) === 1,
    createdAt: row[5] as string,
    updatedAt: row[6] as string,
  }));
}

export async function getPromptTemplate(id: string): Promise<PromptTemplate | null> {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM prompt_templates WHERE id = ?`, [id]);
  
  if (result.length === 0 || result[0].values.length === 0) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    systemPrompt: row[2] as string | null,
    userPromptTemplate: row[3] as string | null,
    isActive: (row[4] as number) === 1,
    createdAt: row[5] as string,
    updatedAt: row[6] as string,
  };
}

export async function createPromptTemplate(data: {
  name: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  isActive?: boolean;
}): Promise<PromptTemplate> {
  const database = await getDatabase();
  const id = `pt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  database.run(
    `INSERT INTO prompt_templates (id, name, systemPrompt, userPromptTemplate, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.systemPrompt || null,
      data.userPromptTemplate || null,
      data.isActive ? 1 : 0,
      now,
      now,
    ]
  );
  saveDatabase(database);

  return {
    id,
    name: data.name,
    systemPrompt: data.systemPrompt || null,
    userPromptTemplate: data.userPromptTemplate || null,
    isActive: data.isActive || false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updatePromptTemplate(id: string, data: {
  name?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
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
    isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
  };

  database.run(
    `UPDATE prompt_templates SET name=?, systemPrompt=?, userPromptTemplate=?, isActive=?, updatedAt=? WHERE id=?`,
    [
      updated.name,
      updated.systemPrompt,
      updated.userPromptTemplate,
      updated.isActive ? 1 : 0,
      now,
      id,
    ]
  );
  saveDatabase(database);

  return { ...updated, id, createdAt: existing.createdAt, updatedAt: now };
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
