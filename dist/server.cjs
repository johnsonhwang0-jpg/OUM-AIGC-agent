var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// database.ts
var database_exports = {};
__export(database_exports, {
  closeDatabase: () => closeDatabase,
  createAutomationJob: () => createAutomationJob,
  createAutomationTask: () => createAutomationTask,
  createModelConfig: () => createModelConfig,
  createProject: () => createProject,
  createPromptTemplate: () => createPromptTemplate,
  createPromptVersion: () => createPromptVersion,
  deleteModelConfig: () => deleteModelConfig,
  deleteProject: () => deleteProject,
  deletePromptTemplate: () => deletePromptTemplate,
  deletePromptVersion: () => deletePromptVersion,
  getAllModelConfigs: () => getAllModelConfigs,
  getAllProjects: () => getAllProjects,
  getAllPromptTemplates: () => getAllPromptTemplates,
  getAllVersionNotes: () => getAllVersionNotes,
  getAutomationJob: () => getAutomationJob,
  getAutomationTask: () => getAutomationTask,
  getAutomationTasksByJob: () => getAutomationTasksByJob,
  getDatabase: () => getDatabase,
  getExtractedContents: () => getExtractedContents,
  getGeneratedAppCode: () => getGeneratedAppCode,
  getLatestAutomationJob: () => getLatestAutomationJob,
  getModelConfig: () => getModelConfig,
  getModuleScripts: () => getModuleScripts,
  getPendingTasksForSlice: () => getPendingTasksForSlice,
  getProject: () => getProject,
  getPromptTemplate: () => getPromptTemplate,
  getPromptVersions: () => getPromptVersions,
  saveExtractedContent: () => saveExtractedContent,
  saveGeneratedAppCode: () => saveGeneratedAppCode,
  saveModuleScript: () => saveModuleScript,
  setVersionNote: () => setVersionNote,
  updateAutomationJob: () => updateAutomationJob,
  updateAutomationTask: () => updateAutomationTask,
  updateModelConfig: () => updateModelConfig,
  updateProject: () => updateProject,
  updateProjectPdf: () => updateProjectPdf,
  updatePromptTemplate: () => updatePromptTemplate,
  updatePromptVersion: () => updatePromptVersion
});
function backupDatabaseBeforeMigration(database) {
  if (!import_fs.default.existsSync(DB_BACKUP_DIR)) {
    import_fs.default.mkdirSync(DB_BACKUP_DIR, { recursive: true });
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const backupPath = import_path.default.join(DB_BACKUP_DIR, `booktogame-backup-${timestamp}.db`);
  try {
    const data = database.export();
    const buffer = Buffer.from(data);
    import_fs.default.writeFileSync(backupPath, buffer);
    console.log(`\u{1F4BE} \u6570\u636E\u5E93\u8FC1\u79FB\u524D\u5DF2\u5907\u4EFD\u5230: ${backupPath}`);
  } catch (e) {
    console.error("\u26A0\uFE0F \u6570\u636E\u5E93\u5907\u4EFD\u5931\u8D25:", e);
  }
}
function getSchemaVersion(database) {
  try {
    const result = database.exec(`SELECT value FROM schema_version WHERE key = 'version'`);
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
  } catch (e) {
  }
  return 0;
}
function setSchemaVersion(database, version) {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);
  database.run(`INSERT OR REPLACE INTO schema_version (key, value) VALUES ('version', ?)`, [version]);
  saveDatabase(database);
}
function safeAlter(database, sql, description) {
  try {
    database.run(sql);
    console.log(`\u2705 \u8FC1\u79FB\u6210\u529F: ${description}`);
  } catch (e) {
    console.log(`\u23ED\uFE0F  \u8DF3\u8FC7\u8FC1\u79FB: ${description} (${e.message})`);
  }
}
async function initDatabase() {
  const SQL = await (0, import_sql.default)();
  let database;
  if (import_fs.default.existsSync(DB_PATH)) {
    const buffer = import_fs.default.readFileSync(DB_PATH);
    database = new SQL.Database(buffer);
    console.log("\u{1F4C1} \u6570\u636E\u5E93\u5DF2\u52A0\u8F7D:", DB_PATH);
  } else {
    database = new SQL.Database();
    console.log("\u{1F195} \u521B\u5EFA\u65B0\u6570\u636E\u5E93:", DB_PATH);
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
  const currentVersion = getSchemaVersion(database);
  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    console.log(`\u{1F504} Schema \u8FC1\u79FB: v${currentVersion} \u2192 v${CURRENT_SCHEMA_VERSION}`);
    backupDatabaseBeforeMigration(database);
  }
  if (currentVersion < 1) {
    safeAlter(database, `ALTER TABLE projects ADD COLUMN aiMeta TEXT`, "projects.aiMeta");
    safeAlter(database, `ALTER TABLE projects ADD COLUMN rawBlueprintData TEXT`, "projects.rawBlueprintData");
    safeAlter(database, `ALTER TABLE prompt_templates ADD COLUMN aiEntry TEXT NOT NULL DEFAULT ''`, "prompt_templates.aiEntry");
    safeAlter(database, `ALTER TABLE prompt_templates ADD COLUMN name TEXT NOT NULL DEFAULT 'Untitled'`, "prompt_templates.name");
    safeAlter(database, `ALTER TABLE prompt_templates ADD COLUMN note TEXT`, "prompt_templates.note");
    setSchemaVersion(database, 1);
  }
  if (currentVersion < 2) {
    setSchemaVersion(database, 2);
  }
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
  if (currentVersion < 4) {
    safeAlter(database, `ALTER TABLE projects ADD COLUMN pdfPageOffset INTEGER DEFAULT 0`, "projects.pdfPageOffset");
    setSchemaVersion(database, 4);
  }
  if (currentVersion < 5) {
    database.run(`
      CREATE TABLE IF NOT EXISTS version_notes (
        version TEXT PRIMARY KEY,
        note TEXT NOT NULL DEFAULT '',
        updatedAt TEXT NOT NULL
      )
    `);
    setSchemaVersion(database, 5);
  }
  saveDatabase(database);
  return database;
}
function saveDatabase(database) {
  const data = database.export();
  const buffer = Buffer.from(data);
  import_fs.default.writeFileSync(DB_PATH, buffer);
}
async function getDatabase() {
  if (!db) {
    db = await initDatabase();
  }
  return db;
}
async function createProject(name, pdfFileName, pdfData, bookTitle, bookContentText, directoryItems, modules, aiMeta, rawBlueprintData) {
  const database = await getDatabase();
  const id = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
async function updateProject(id, updates) {
  const database = await getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const fields = [];
  const values = [];
  if (updates.name !== void 0) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.bookTitle !== void 0) {
    fields.push("bookTitle = ?");
    values.push(updates.bookTitle);
  }
  if (updates.bookContentText !== void 0) {
    fields.push("bookContentText = ?");
    values.push(updates.bookContentText);
  }
  if (updates.directoryItems !== void 0) {
    fields.push("directoryItems = ?");
    values.push(updates.directoryItems);
  }
  if (updates.modules !== void 0) {
    fields.push("modules = ?");
    values.push(updates.modules);
  }
  if (updates.pdfFileName !== void 0) {
    fields.push("pdfFileName = ?");
    values.push(updates.pdfFileName);
  }
  if (updates.pdfData !== void 0) {
    fields.push("pdfData = ?");
    values.push(updates.pdfData);
  }
  if (updates.aiMeta !== void 0) {
    fields.push("aiMeta = ?");
    values.push(updates.aiMeta);
  }
  if (updates.rawBlueprintData !== void 0) {
    fields.push("rawBlueprintData = ?");
    values.push(updates.rawBlueprintData);
  }
  if (updates.executionMode !== void 0) {
    fields.push("executionMode = ?");
    values.push(updates.executionMode);
  }
  if (updates.pdfPageOffset !== void 0) {
    fields.push("pdfPageOffset = ?");
    values.push(updates.pdfPageOffset);
  }
  if (fields.length === 0) return;
  fields.push("updatedAt = ?");
  values.push(now);
  values.push(id);
  database.run(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`, values);
  saveDatabase(database);
}
async function updateProjectPdf(id, pdfFileName, pdfData) {
  const database = await getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  database.run(
    `UPDATE projects SET pdfFileName = ?, pdfData = ?, updatedAt = ? WHERE id = ?`,
    [pdfFileName, pdfData, now, id]
  );
  saveDatabase(database);
}
async function getProject(id) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM projects`);
  if (result.length === 0) {
    return null;
  }
  const columns = result[0].columns;
  const idIndex = columns.indexOf("id");
  const matchingRow = result[0].values.find((row) => row[idIndex] === id);
  if (!matchingRow) {
    return null;
  }
  const project = {
    id: matchingRow[idIndex],
    name: matchingRow[columns.indexOf("name")] || "",
    pdfFileName: matchingRow[columns.indexOf("pdfFileName")] || "",
    pdfData: matchingRow[columns.indexOf("pdfData")],
    bookTitle: matchingRow[columns.indexOf("bookTitle")] || "",
    bookContentText: matchingRow[columns.indexOf("bookContentText")] || "",
    directoryItems: matchingRow[columns.indexOf("directoryItems")] || "",
    modules: matchingRow[columns.indexOf("modules")] || "",
    aiMeta: matchingRow[columns.indexOf("aiMeta")] || "",
    rawBlueprintData: matchingRow[columns.indexOf("rawBlueprintData")] || "",
    executionMode: (() => {
      const idx = columns.indexOf("executionMode");
      const val = idx >= 0 ? matchingRow[idx] : null;
      return val === "auto" ? "auto" : "manual";
    })(),
    pdfPageOffset: (() => {
      const idx = columns.indexOf("pdfPageOffset");
      const val = idx >= 0 ? matchingRow[idx] : 0;
      return typeof val === "number" ? val : 0;
    })(),
    createdAt: matchingRow[columns.indexOf("createdAt")],
    updatedAt: matchingRow[columns.indexOf("updatedAt")]
  };
  return project;
}
async function getAllProjects() {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM projects ORDER BY updatedAt DESC`);
  if (result.length === 0) {
    return [];
  }
  const columns = result[0].columns;
  return result[0].values.map((row) => ({
    id: row[columns.indexOf("id")],
    name: row[columns.indexOf("name")],
    pdfFileName: row[columns.indexOf("pdfFileName")] || "",
    pdfData: row[columns.indexOf("pdfData")],
    bookTitle: row[columns.indexOf("bookTitle")] || "",
    bookContentText: row[columns.indexOf("bookContentText")] || "",
    directoryItems: row[columns.indexOf("directoryItems")] || "",
    modules: row[columns.indexOf("modules")] || "",
    aiMeta: row[columns.indexOf("aiMeta")] || "",
    rawBlueprintData: row[columns.indexOf("rawBlueprintData")] || "",
    executionMode: (() => {
      const idx = columns.indexOf("executionMode");
      const val = idx >= 0 ? row[idx] : null;
      return val === "auto" ? "auto" : "manual";
    })(),
    pdfPageOffset: (() => {
      const idx = columns.indexOf("pdfPageOffset");
      const val = idx >= 0 ? row[idx] : 0;
      return typeof val === "number" ? val : 0;
    })(),
    createdAt: row[columns.indexOf("createdAt")],
    updatedAt: row[columns.indexOf("updatedAt")]
  }));
}
async function deleteProject(id) {
  const database = await getDatabase();
  database.run(`DELETE FROM module_scripts WHERE projectId = ?`, [id]);
  database.run(`DELETE FROM automation_tasks WHERE projectId = ?`, [id]);
  database.run(`DELETE FROM automation_jobs WHERE projectId = ?`, [id]);
  database.run(`DELETE FROM projects WHERE id = ?`, [id]);
  saveDatabase(database);
}
async function saveModuleScript(projectId, moduleId, script) {
  const database = await getDatabase();
  const id = `script-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  database.run(
    `INSERT OR REPLACE INTO module_scripts (id, projectId, moduleId, script, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [id, projectId, moduleId, JSON.stringify(script), now]
  );
  saveDatabase(database);
}
async function getModuleScripts(projectId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM module_scripts WHERE projectId = ?`, [projectId]);
  if (result.length === 0) {
    return [];
  }
  const columns = result[0].columns;
  return result[0].values.map((row) => ({
    id: row[columns.indexOf("id")],
    projectId: row[columns.indexOf("projectId")],
    moduleId: row[columns.indexOf("moduleId")],
    script: row[columns.indexOf("script")],
    createdAt: row[columns.indexOf("createdAt")]
  }));
}
async function saveExtractedContent(projectId, moduleId, content) {
  const database = await getDatabase();
  const id = `extracted-${projectId}-${moduleId}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  database.run(
    `INSERT OR REPLACE INTO extracted_content (id, projectId, moduleId, content, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [id, projectId, moduleId, content, now]
  );
  saveDatabase(database);
}
async function getExtractedContents(projectId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM extracted_content WHERE projectId = ?`, [projectId]);
  if (result.length === 0) {
    return [];
  }
  const columns = result[0].columns;
  return result[0].values.map((row) => ({
    id: row[columns.indexOf("id")],
    projectId: row[columns.indexOf("projectId")],
    moduleId: row[columns.indexOf("moduleId")],
    content: row[columns.indexOf("content")],
    createdAt: row[columns.indexOf("createdAt")]
  }));
}
async function closeDatabase() {
  if (db) {
    saveDatabase(db);
    db.close();
    db = null;
  }
}
async function saveGeneratedAppCode(projectId, moduleId, code) {
  const database = await getDatabase();
  const id = `appcode-${projectId}-${moduleId}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  database.run(
    `INSERT OR REPLACE INTO generated_app_code (id, projectId, moduleId, code, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [id, projectId, moduleId, code, now]
  );
  saveDatabase(database);
}
async function getGeneratedAppCode(projectId, moduleId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT code FROM generated_app_code WHERE projectId = ? AND moduleId = ?`, [projectId, moduleId]);
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  return result[0].values[0][0];
}
async function getAllPromptTemplates(aiEntry) {
  const database = await getDatabase();
  const query = aiEntry ? `SELECT * FROM prompt_templates WHERE aiEntry = ? ORDER BY isActive DESC, createdAt DESC` : `SELECT * FROM prompt_templates ORDER BY isActive DESC, createdAt DESC`;
  const result = database.exec(query, aiEntry ? [aiEntry] : []);
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    id: row[0],
    aiEntry: row[1],
    name: row[2],
    systemPrompt: row[3],
    userPromptTemplate: row[4],
    isActive: row[5] === 1,
    note: row[6],
    createdAt: row[7],
    updatedAt: row[8]
  }));
}
async function getPromptTemplate(id) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM prompt_templates WHERE id = ?`, [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return {
    id: row[0],
    aiEntry: row[1],
    name: row[2],
    systemPrompt: row[3],
    userPromptTemplate: row[4],
    isActive: row[5] === 1,
    note: row[6],
    createdAt: row[7],
    updatedAt: row[8]
  };
}
async function createPromptTemplate(data) {
  const database = await getDatabase();
  const id = `pt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  database.run(
    `INSERT INTO prompt_templates (id, aiEntry, name, systemPrompt, userPromptTemplate, isActive, note, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.aiEntry,
      data.name,
      data.systemPrompt || null,
      data.userPromptTemplate || null,
      data.isActive !== void 0 ? data.isActive ? 1 : 0 : 0,
      data.note || null,
      now,
      now
    ]
  );
  saveDatabase(database);
  return {
    id,
    aiEntry: data.aiEntry,
    name: data.name,
    systemPrompt: data.systemPrompt || null,
    userPromptTemplate: data.userPromptTemplate || null,
    isActive: data.isActive !== void 0 ? data.isActive : false,
    note: data.note || null,
    createdAt: now,
    updatedAt: now
  };
}
async function updatePromptTemplate(id, data) {
  const database = await getDatabase();
  const existing = await getPromptTemplate(id);
  if (!existing) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = {
    name: data.name ?? existing.name,
    systemPrompt: data.systemPrompt !== void 0 ? data.systemPrompt : existing.systemPrompt,
    userPromptTemplate: data.userPromptTemplate !== void 0 ? data.userPromptTemplate : existing.userPromptTemplate,
    note: data.note !== void 0 ? data.note : existing.note,
    isActive: data.isActive !== void 0 ? data.isActive : existing.isActive
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
      id
    ]
  );
  saveDatabase(database);
  return { ...existing, ...updated, updatedAt: now };
}
async function deletePromptTemplate(id) {
  const database = await getDatabase();
  database.run(`DELETE FROM prompt_templates WHERE id = ?`, [id]);
  saveDatabase(database);
  return true;
}
async function getPromptVersions(promptTemplateId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM prompt_versions WHERE promptTemplateId = ? ORDER BY version DESC`, [promptTemplateId]);
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    id: row[0],
    promptTemplateId: row[1],
    systemPrompt: row[2],
    userPromptTemplate: row[3],
    version: row[4],
    note: row[5],
    effectRating: row[6],
    createdAt: row[7]
  }));
}
async function createPromptVersion(data) {
  const database = await getDatabase();
  const id = `pv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      now
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
    createdAt: now
  };
}
async function updatePromptVersion(id, data) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM prompt_versions WHERE id = ?`, [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  const existing = {
    id: row[0],
    promptTemplateId: row[1],
    systemPrompt: row[2],
    userPromptTemplate: row[3],
    version: row[4],
    note: row[5],
    effectRating: row[6],
    createdAt: row[7]
  };
  database.run(
    `UPDATE prompt_versions SET note=?, effectRating=? WHERE id=?`,
    [
      data.note !== void 0 ? data.note : existing.note,
      data.effectRating !== void 0 ? data.effectRating : existing.effectRating,
      id
    ]
  );
  saveDatabase(database);
  return { ...existing, note: data.note !== void 0 ? data.note : existing.note, effectRating: data.effectRating !== void 0 ? data.effectRating : existing.effectRating };
}
async function deletePromptVersion(id) {
  const database = await getDatabase();
  database.run(`DELETE FROM prompt_versions WHERE id = ?`, [id]);
  saveDatabase(database);
  return true;
}
async function getAllVersionNotes() {
  const database = await getDatabase();
  const result = database.exec(`SELECT version, note, updatedAt FROM version_notes ORDER BY version DESC`);
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    version: row[0],
    note: row[1],
    updatedAt: row[2]
  }));
}
async function setVersionNote(version, note) {
  const database = await getDatabase();
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  database.run(
    `INSERT INTO version_notes (version, note, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(version) DO UPDATE SET note = excluded.note, updatedAt = excluded.updatedAt`,
    [version, note, updatedAt]
  );
  saveDatabase(database);
  return { version, note, updatedAt };
}
async function getAllModelConfigs() {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM model_configs ORDER BY createdAt DESC`);
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    id: row[0],
    name: row[1],
    provider: row[2],
    modelId: row[3],
    apiKey: row[4],
    baseUrl: row[5],
    maxTokens: row[6],
    temperature: row[7],
    topP: row[8],
    promptTemplateId: row[9],
    isActive: row[10] === 1,
    createdAt: row[11],
    updatedAt: row[12]
  }));
}
async function getModelConfig(id) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM model_configs WHERE id = ?`, [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return {
    id: row[0],
    name: row[1],
    provider: row[2],
    modelId: row[3],
    apiKey: row[4],
    baseUrl: row[5],
    maxTokens: row[6],
    temperature: row[7],
    topP: row[8],
    promptTemplateId: row[9],
    isActive: row[10] === 1,
    createdAt: row[11],
    updatedAt: row[12]
  };
}
async function createModelConfig(data) {
  const database = await getDatabase();
  const id = `mc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      data.maxTokens || 16e3,
      data.temperature || 0.7,
      data.topP || 0.9,
      data.promptTemplateId || null,
      data.isActive ? 1 : 0,
      now,
      now
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
    maxTokens: data.maxTokens || 16e3,
    temperature: data.temperature || 0.7,
    topP: data.topP || 0.9,
    promptTemplateId: data.promptTemplateId || null,
    isActive: data.isActive || false,
    createdAt: now,
    updatedAt: now
  };
}
async function updateModelConfig(id, data) {
  const database = await getDatabase();
  const existing = await getModelConfig(id);
  if (!existing) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = {
    name: data.name ?? existing.name,
    provider: data.provider ?? existing.provider,
    modelId: data.modelId ?? existing.modelId,
    apiKey: data.apiKey !== void 0 ? data.apiKey : existing.apiKey,
    baseUrl: data.baseUrl !== void 0 ? data.baseUrl : existing.baseUrl,
    maxTokens: data.maxTokens ?? existing.maxTokens,
    temperature: data.temperature ?? existing.temperature,
    topP: data.topP ?? existing.topP,
    promptTemplateId: data.promptTemplateId !== void 0 ? data.promptTemplateId : existing.promptTemplateId,
    isActive: data.isActive !== void 0 ? data.isActive : existing.isActive
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
      id
    ]
  );
  saveDatabase(database);
  return { ...updated, id, createdAt: existing.createdAt, updatedAt: now };
}
async function deleteModelConfig(id) {
  const database = await getDatabase();
  database.run(`DELETE FROM model_configs WHERE id = ?`, [id]);
  saveDatabase(database);
  return true;
}
function rowToJob(row, columns) {
  return {
    id: row[columns.indexOf("id")],
    projectId: row[columns.indexOf("projectId")],
    status: row[columns.indexOf("status")],
    totalSlices: row[columns.indexOf("totalSlices")] || 0,
    completedSlices: row[columns.indexOf("completedSlices")] || 0,
    failedSlices: row[columns.indexOf("failedSlices")] || 0,
    concurrency: row[columns.indexOf("concurrency")] || 1,
    startedAt: row[columns.indexOf("startedAt")] || null,
    finishedAt: row[columns.indexOf("finishedAt")] || null,
    error: row[columns.indexOf("error")] || null,
    createdAt: row[columns.indexOf("createdAt")],
    updatedAt: row[columns.indexOf("updatedAt")]
  };
}
function rowToTask(row, columns) {
  return {
    id: row[columns.indexOf("id")],
    jobId: row[columns.indexOf("jobId")],
    projectId: row[columns.indexOf("projectId")],
    moduleId: row[columns.indexOf("moduleId")],
    sliceId: row[columns.indexOf("sliceId")] || null,
    sliceTitle: row[columns.indexOf("sliceTitle")] || null,
    stage: row[columns.indexOf("stage")],
    status: row[columns.indexOf("status")],
    attempts: row[columns.indexOf("attempts")] || 0,
    maxAttempts: row[columns.indexOf("maxAttempts")] || 3,
    startedAt: row[columns.indexOf("startedAt")] || null,
    finishedAt: row[columns.indexOf("finishedAt")] || null,
    error: row[columns.indexOf("error")] || null,
    createdAt: row[columns.indexOf("createdAt")],
    updatedAt: row[columns.indexOf("updatedAt")]
  };
}
async function createAutomationJob(projectId, totalSlices, concurrency = 1) {
  const database = await getDatabase();
  const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    updatedAt: now
  };
}
async function getAutomationJob(jobId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_jobs WHERE id = ?`, [jobId]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToJob(result[0].values[0], result[0].columns);
}
async function getLatestAutomationJob(projectId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_jobs WHERE projectId = ? ORDER BY createdAt DESC LIMIT 1`, [projectId]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToJob(result[0].values[0], result[0].columns);
}
async function updateAutomationJob(jobId, updates) {
  const database = await getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const fields = [];
  const values = [];
  const allowed = ["status", "completedSlices", "failedSlices", "concurrency", "startedAt", "finishedAt", "error"];
  for (const key of allowed) {
    if (updates[key] !== void 0) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  fields.push("updatedAt = ?");
  values.push(now);
  values.push(jobId);
  database.run(`UPDATE automation_jobs SET ${fields.join(", ")} WHERE id = ?`, values);
  saveDatabase(database);
}
async function createAutomationTask(data) {
  const database = await getDatabase();
  const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    updatedAt: now
  };
}
async function getAutomationTasksByJob(jobId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_tasks WHERE jobId = ? ORDER BY createdAt ASC`, [jobId]);
  if (result.length === 0) return [];
  return result[0].values.map((row) => rowToTask(row, result[0].columns));
}
async function getAutomationTask(taskId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_tasks WHERE id = ?`, [taskId]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToTask(result[0].values[0], result[0].columns);
}
async function updateAutomationTask(taskId, updates) {
  const database = await getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const fields = [];
  const values = [];
  const allowed = ["status", "attempts", "startedAt", "finishedAt", "error"];
  for (const key of allowed) {
    if (updates[key] !== void 0) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  fields.push("updatedAt = ?");
  values.push(now);
  values.push(taskId);
  database.run(`UPDATE automation_tasks SET ${fields.join(", ")} WHERE id = ?`, values);
  saveDatabase(database);
}
async function getPendingTasksForSlice(jobId, moduleId) {
  const database = await getDatabase();
  const result = database.exec(`SELECT * FROM automation_tasks WHERE jobId = ? AND moduleId = ? AND status = 'pending' ORDER BY createdAt ASC`, [jobId, moduleId]);
  if (result.length === 0) return [];
  return result[0].values.map((row) => rowToTask(row, result[0].columns));
}
var import_sql, import_fs, import_path, db, DB_PATH, DB_BACKUP_DIR, CURRENT_SCHEMA_VERSION;
var init_database = __esm({
  "database.ts"() {
    import_sql = __toESM(require("sql.js"), 1);
    import_fs = __toESM(require("fs"), 1);
    import_path = __toESM(require("path"), 1);
    db = null;
    DB_PATH = import_path.default.join(process.cwd(), "booktogame.db");
    DB_BACKUP_DIR = import_path.default.join(process.cwd(), ".db-backups");
    CURRENT_SCHEMA_VERSION = 4;
  }
});

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
var import_vite = require("vite");

// ai-stream.ts
function getErrorMessage(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.message || raw;
  } catch {
    return raw;
  }
}
function extractCompleteJsonContent(raw) {
  const normalized = raw.trim().replace(/\s*```\s*$/i, "").trim();
  for (let index = 0; index < normalized.length; index++) {
    if (normalized[index] !== "{") continue;
    const candidate = normalized.slice(index).trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
    }
  }
  return null;
}
async function collectOpenAIStream(response) {
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`AI API error: ${response.status} - ${getErrorMessage(raw)}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("AI API streaming response has no body");
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason = null;
  const processEvent = (event) => {
    const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n").trim();
    if (!data) return false;
    if (data === "[DONE]") return true;
    const parsed = JSON.parse(data);
    const choice = parsed?.choices?.[0];
    content += choice?.delta?.content || "";
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    return false;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      for (const event of events) {
        if (processEvent(event)) {
          await reader.cancel();
          return { content, finishReason, interrupted: false };
        }
      }
    }
  } catch (error) {
    if (buffer.trim()) {
      try {
        processEvent(buffer);
      } catch {
      }
    }
    if (!content) throw error;
    return { content, finishReason, interrupted: true };
  }
  buffer += decoder.decode();
  if (buffer.trim()) processEvent(buffer);
  return { content, finishReason, interrupted: false };
}
async function streamChatCompletion(options) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(options.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stop: null,
      stream: true,
      stream_options: { include_usage: true },
      ...options.thinking ? { thinking: { type: options.thinking } } : {},
      ...options.jsonMode ? { response_format: { type: "json_object" } } : {}
    })
  });
  return collectOpenAIStream(response);
}

// prompt-template.ts
function applyPromptTemplate(template, variables) {
  return Object.entries(variables).reduce((result, [key, value]) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}|\\{${escapedKey}\\}`, "g"), value);
  }, template);
}

// server.ts
init_database();

// orchestrator.ts
init_database();

// shared/textbookMatcher.ts
function calculatePageRange(covered, directoryItems) {
  const parseSectionNumbers = (str) => {
    const match = str.trim().match(/(\d+(?:\.\d+)*)/);
    if (!match) return null;
    return match[1].split(".").map((x) => parseInt(x, 10));
  };
  const isDescendant = (target, item) => {
    if (item.length < target.length) return false;
    for (let i = 0; i < target.length; i++) {
      if (item[i] !== target[i]) return false;
    }
    return true;
  };
  const findIndex = (nums) => {
    for (let i = 0; i < directoryItems.length; i++) {
      const itemNums = parseSectionNumbers(directoryItems[i].title);
      if (!itemNums) continue;
      if (itemNums.length === nums.length && itemNums.every((n, j) => n === nums[j])) {
        return i;
      }
    }
    return -1;
  };
  const coveredTrimmed = covered.trim();
  const rangeMatch = coveredTrimmed.match(/(\d+(?:\.\d+)*)\s*[-~—至]\s*(\d+(?:\.\d+)*)/);
  let startNums;
  let endNums;
  if (rangeMatch) {
    startNums = parseSectionNumbers(rangeMatch[1]);
    endNums = parseSectionNumbers(rangeMatch[2]);
  } else {
    startNums = parseSectionNumbers(coveredTrimmed);
    endNums = startNums;
  }
  if (!startNums || !endNums) {
    return { startPage: "", endPage: "", found: false };
  }
  const startIndex = findIndex(startNums);
  if (startIndex === -1) {
    return { startPage: "", endPage: "", found: false };
  }
  const endIndex = findIndex(endNums);
  if (endIndex === -1) {
    return { startPage: "", endPage: "", found: false };
  }
  const startPage = directoryItems[startIndex].page || "";
  let endPage = "";
  for (let k = endIndex + 1; k < directoryItems.length; k++) {
    const nextNums = parseSectionNumbers(directoryItems[k].title);
    if (!nextNums) continue;
    if (isDescendant(endNums, nextNums)) continue;
    endPage = directoryItems[k].page || "";
    break;
  }
  if (!endPage && directoryItems[endIndex].page) {
    endPage = directoryItems[endIndex].page;
  }
  return { startPage, endPage, found: true };
}
function buildHeadingPattern(chapterNum) {
  const escaped = chapterNum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^#{1,6}\\s+${escaped}(?:\\s|$)`, "i");
}
function findNextSibling(chapterNum, directoryItems) {
  const parseSection = (str) => {
    const match = str.trim().match(/^(\d+(?:\.\d+)*)/);
    if (!match) return null;
    return match[1].split(".").map((x) => parseInt(x, 10));
  };
  const targetNums = parseSection(chapterNum);
  if (!targetNums) return null;
  const level = targetNums.length;
  let targetIndex = -1;
  for (let i = 0; i < directoryItems.length; i++) {
    const nums = parseSection(directoryItems[i].title);
    if (!nums) continue;
    if (nums.length === level && nums.every((n, j) => n === targetNums[j])) {
      targetIndex = i;
      break;
    }
  }
  if (targetIndex === -1) return null;
  for (let i = targetIndex + 1; i < directoryItems.length; i++) {
    const nums = parseSection(directoryItems[i].title);
    if (!nums) continue;
    if (nums.length === level) {
      const isNext = nums.slice(0, -1).every((n, j) => n === targetNums[j]) && nums[nums.length - 1] === targetNums[targetNums.length - 1] + 1;
      if (isNext) {
        return nums.join(".");
      }
    }
    if (nums.length === level && nums[0] > targetNums[0]) {
    }
  }
  const nextTopicNum = targetNums[0] + 1;
  for (let i = 0; i < directoryItems.length; i++) {
    const nums = parseSection(directoryItems[i].title);
    if (!nums) continue;
    if (nums.length === level && nums[0] === nextTopicNum) {
      return nums.join(".");
    }
  }
  return null;
}
function trimExtractedContent(mdContent, coveredChapters, directoryItems) {
  const covered = coveredChapters.trim();
  if (!covered) return mdContent;
  const rangeMatch = covered.match(/(\d+(?:\.\d+)*)\s*[-~—至]\s*(\d+(?:\.\d+)*)/);
  let startChapter;
  let endChapter;
  if (rangeMatch) {
    startChapter = rangeMatch[1];
    endChapter = rangeMatch[2];
  } else {
    startChapter = covered;
    endChapter = covered;
  }
  const lines = mdContent.split("\n");
  let startIndex = 0;
  const startPattern = buildHeadingPattern(startChapter);
  for (let i = 0; i < lines.length; i++) {
    if (startPattern.test(lines[i].trim())) {
      startIndex = i;
      break;
    }
  }
  const nextSibling = findNextSibling(endChapter, directoryItems);
  let endIndex = lines.length;
  if (nextSibling) {
    const endPattern = buildHeadingPattern(nextSibling);
    for (let i = startIndex; i < lines.length; i++) {
      if (endPattern.test(lines[i].trim())) {
        endIndex = i;
        break;
      }
    }
  }
  const trimmedLines = lines.slice(startIndex, endIndex);
  return trimmedLines.join("\n").trim();
}
function filterAndFormatLines(lines, directoryItems) {
  const hasMarkdownHeadings = lines.some((line) => /^#{1,6}\s/.test(line.trim()));
  if (hasMarkdownHeadings) {
    const filteredLines2 = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        filteredLines2.push("");
        continue;
      }
      if (/^#{1,6}\s/.test(trimmed)) {
        filteredLines2.push(line);
        continue;
      }
      if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
        filteredLines2.push(line);
        continue;
      }
      if (/^\|/.test(trimmed)) {
        filteredLines2.push(line);
        continue;
      }
      if (/^[•\-]?\s*\d+\s*[•\-]?$/.test(trimmed)) continue;
      if (/^(?:第\s*\d+\s*页|page\s*\d+|\b\d+\s*[-—]\s*页\b)/i.test(trimmed)) continue;
      if (/(?:出版社|Publishing|Copyright|All\s+rights\s+reserved|版权所有|©)/i.test(trimmed) && trimmed.length < 80) continue;
      if (/(?:www\.|http:\/\/|https:\/\/)/i.test(trimmed) && trimmed.length < 80) continue;
      if (/(?:ISBN|ISSN)\s*[\d\-]+/i.test(trimmed) && trimmed.length < 80) continue;
      if (/^(?:Topic|Chapter|Unit|Section)\s+\d+\s+[A-Z\s]+\d{1,3}$/i.test(trimmed)) continue;
      if (/^\d{1,3}$/.test(trimmed) && trimmed.length <= 3) continue;
      filteredLines2.push(line);
    }
    return filteredLines2.join("\n").trim() || "*(\u7ECF\u8FC7\u667A\u80FD\u964D\u566A\u8FC7\u6EE4\uFF0C\u672A\u5305\u542B\u975E\u8003\u70B9\u6838\u5FC3\u6587\u672C)*";
  }
  const topicNames = [];
  if (Array.isArray(directoryItems)) {
    for (const item of directoryItems) {
      const title = item.title || "";
      const topicMatch = title.match(/^(Topic\s+\d+.*)$/i);
      if (topicMatch) {
        topicNames.push(topicMatch[1].toUpperCase());
      }
    }
  }
  const headerPatterns = [];
  if (topicNames.length > 0) {
    for (const topicName of topicNames) {
      const escapedName = topicName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      headerPatterns.push(new RegExp(`^\\d{1,3}\\s+${escapedName}$`));
      headerPatterns.push(new RegExp(`^${escapedName}\\s+\\d{1,3}$`));
    }
  }
  headerPatterns.push(/^(?:Topic|Chapter|Unit|Section)\s+\d+\s+[A-Z\s]+\d{1,3}$/i);
  const footerPatterns = [
    /(?:出版社|Publishing|Copyright|All\s+rights\s+reserved|版权所有|©)/i,
    /(?:www\.|http:\/\/|https:\/\/)/i,
    /(?:ISBN|ISSN)\s*[\d\-]+/i
  ];
  const isHeaderOrFooter = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^[•\-]?\s*\d+\s*[•\-]?$/.test(trimmed)) return true;
    if (/^(?:第\s*\d+\s*页|page\s*\d+)/i.test(trimmed)) return true;
    if (footerPatterns.some((pat) => pat.test(trimmed)) && trimmed.length < 80) return true;
    const cleaned = trimmed.replace(/[^A-Za-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    if (/^[A-Za-z0-9\s]+$/.test(cleaned)) {
      if (headerPatterns.some((pat) => pat.test(cleaned))) return true;
    }
    return false;
  };
  const filteredLines = [];
  for (const line of lines) {
    if (!line.trim()) {
      filteredLines.push("");
      continue;
    }
    if (isHeaderOrFooter(line)) continue;
    filteredLines.push(line);
  }
  return filteredLines.join("\n").trim() || "*(\u7ECF\u8FC7\u667A\u80FD\u964D\u566A\u8FC7\u6EE4\uFF0C\u672A\u5305\u542B\u975E\u8003\u70B9\u6838\u5FC3\u6587\u672C)*";
}

// orchestrator.ts
var sseClients = /* @__PURE__ */ new Map();
function registerSseClient(jobId, res) {
  if (!sseClients.has(jobId)) sseClients.set(jobId, /* @__PURE__ */ new Set());
  sseClients.get(jobId).add(res);
}
function unregisterSseClient(jobId, res) {
  const clients = sseClients.get(jobId);
  if (!clients) return;
  clients.delete(res);
  if (clients.size === 0) sseClients.delete(jobId);
}
function emit(jobId, event) {
  const clients = sseClients.get(jobId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event.event}
data: ${JSON.stringify(event.data)}

`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
    }
  }
}
async function internalPost(path3, body) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
  const url = `http://localhost:${port}${path3}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    throw new Error(json.error || `Internal ${path3} failed: ${res.status}`);
  }
  return json;
}
async function internalGet(path3) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
  const url = `http://localhost:${port}${path3}`;
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    throw new Error(json.error || `Internal GET ${path3} failed: ${res.status}`);
  }
  return json;
}
async function getSavedPrompt(aiEntry) {
  try {
    const data = await internalGet(`/api/prompt-templates?aiEntry=${aiEntry}`);
    if (Array.isArray(data) && data.length > 0) {
      const active = data.find((p) => p.isActive) || data[0];
      return {
        systemPrompt: active.systemPrompt || void 0,
        userPromptTemplate: active.userPromptTemplate || void 0
      };
    }
  } catch (e) {
    console.warn(`[orchestrator] getSavedPrompt(${aiEntry}) failed, using defaults:`, e);
  }
  return {};
}
function parseModules(modulesJson) {
  try {
    const parsed = JSON.parse(modulesJson);
    const arr = Array.isArray(parsed) ? parsed : parsed.slices || parsed.modules || [];
    return arr;
  } catch {
    return [];
  }
}
function parseDirectoryItems(dirJson) {
  try {
    return JSON.parse(dirJson);
  } catch {
    return [];
  }
}
async function runTaskWithRetry(jobId, projectId, slice, stage, existingTask, runOnce) {
  let task = existingTask;
  if (!task) {
    task = await createAutomationTask({
      jobId,
      projectId,
      moduleId: slice.id,
      sliceId: slice.sliceId || null,
      sliceTitle: slice.title,
      stage
    });
  }
  if (task.status === "completed") return task;
  if (task.status === "skipped") return task;
  const maxAttempts = task.maxAttempts || 3;
  const backoffs = [0, 1e4, 3e4];
  for (let attempt = task.attempts; attempt < maxAttempts; attempt++) {
    const idx = Math.min(attempt, backoffs.length - 1);
    const waitMs = backoffs[idx] ?? 6e4;
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
    await updateAutomationTask(task.id, {
      status: "running",
      attempts: attempt + 1,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      finishedAt: null,
      error: null
    });
    emit(jobId, {
      event: "task_update",
      data: { taskId: task.id, moduleId: slice.id, sliceId: slice.sliceId, stage, status: "running", attempt: attempt + 1 }
    });
    try {
      await runOnce();
      await updateAutomationTask(task.id, { status: "completed", finishedAt: (/* @__PURE__ */ new Date()).toISOString(), error: null });
      emit(jobId, {
        event: "task_complete",
        data: { taskId: task.id, moduleId: slice.id, sliceId: slice.sliceId, stage, status: "completed" }
      });
      return task;
    } catch (err) {
      const errMsg = err?.message || String(err);
      console.error(`[orchestrator] task ${task.id} (${slice.sliceId || slice.id} / ${stage}) attempt ${attempt + 1} failed:`, errMsg);
      await updateAutomationTask(task.id, { status: "failed", error: errMsg });
      emit(jobId, {
        event: "task_failed",
        data: { taskId: task.id, moduleId: slice.id, sliceId: slice.sliceId, stage, status: "failed", error: errMsg, attempt: attempt + 1, retryable: attempt + 1 < maxAttempts }
      });
      if (attempt + 1 >= maxAttempts) {
        return task;
      }
    }
  }
  return task;
}
async function runSliceExtract(jobId, projectId, bookTitle, slice, directoryItems, hasPdf, model) {
  const job = await getAutomationJob(jobId);
  if (job && (job.status === "cancelled" || job.status === "paused")) {
    return { extracted: false, content: "" };
  }
  const project = await getProject(projectId);
  let extractedContent = "";
  if (hasPdf && project?.pdfData) {
    const { getExtractedContents: queryExtracted } = await Promise.resolve().then(() => (init_database(), database_exports));
    const existingExtracts = await queryExtracted(projectId);
    const matchedExtract0 = existingExtracts.find((e) => e.moduleId === slice.id);
    if (matchedExtract0?.content) {
      extractedContent = matchedExtract0.content;
      emit(jobId, { event: "task_complete", data: { moduleId: slice.id, sliceId: slice.sliceId, stage: "extract", status: "skipped" } });
    } else {
      const existingExtractTasks = await getPendingTasksForSlice(jobId, slice.id);
      const extractTask = existingExtractTasks.find((t) => t.stage === "extract") || null;
      await runTaskWithRetry(jobId, projectId, slice, "extract", extractTask, async () => {
        let startPrinted = 1;
        let endPrinted = 10;
        if (slice.pageRange) {
          const m = slice.pageRange.match(/P\.?(\d+)(?:\s*[-–—]\s*P?\.?(\d+))?/i) || slice.pageRange.match(/(\d+)\s*[-–—]\s*(\d+)/);
          if (m) {
            startPrinted = parseInt(m[1], 10);
            endPrinted = m[2] ? parseInt(m[2], 10) : startPrinted;
          } else {
            const range = calculatePageRange(slice.coveredChapters || "", directoryItems);
            if (range.found && range.startPage) {
              startPrinted = parseInt(range.startPage, 10) || 1;
              endPrinted = range.endPage ? parseInt(range.endPage, 10) || startPrinted : startPrinted;
            }
          }
        } else if (slice.coveredChapters) {
          const range = calculatePageRange(slice.coveredChapters, directoryItems);
          if (range.found && range.startPage) {
            startPrinted = parseInt(range.startPage, 10) || 1;
            endPrinted = range.endPage ? parseInt(range.endPage, 10) || startPrinted : startPrinted;
          }
        }
        const pdfPageOffset = project?.pdfPageOffset ?? 0;
        const activeStartPhysical = Math.max(1, startPrinted + pdfPageOffset);
        const activeEndPhysical = Math.max(activeStartPhysical, endPrinted + pdfPageOffset);
        console.log(`[orchestrator] extract slice="${slice.title}" pageRange="${slice.pageRange}" coveredChapters="${slice.coveredChapters}" \u2192 printed=${startPrinted}-${endPrinted} offset=${pdfPageOffset} \u2192 physical=${activeStartPhysical}-${activeEndPhysical}`);
        const result = await internalPost(`/api/projects/${projectId}/extract-pages`, {
          startPage: activeStartPhysical,
          endPage: activeEndPhysical
        });
        const pages = result.pages || [];
        if (!pages || pages.length === 0) {
          throw new Error("PDF \u63D0\u53D6\u5185\u5BB9\u4E3A\u7A7A");
        }
        let mdOutput = "";
        for (const page of pages) {
          const lines = (page.content || "").split("\n");
          const formatted = filterAndFormatLines(lines, directoryItems);
          mdOutput += formatted + "\n\n";
          if (page.images && page.images.length > 0) {
            mdOutput += "\n\n";
            for (const img of page.images) {
              mdOutput += `![${img.filename || ""}](${img.url || ""})

`;
            }
          }
          mdOutput += "\n\n";
        }
        if (slice.coveredChapters) {
          mdOutput = trimExtractedContent(mdOutput, slice.coveredChapters, directoryItems);
        }
        extractedContent = mdOutput.trim();
        if (!extractedContent) {
          throw new Error("PDF \u63D0\u53D6\u5185\u5BB9\u4E3A\u7A7A\uFF08\u8FC7\u6EE4/\u88C1\u526A\u540E\uFF09");
        }
        await saveExtractedContent(projectId, slice.id, extractedContent);
      });
    }
  } else {
    const skipTask = await createAutomationTask({
      jobId,
      projectId,
      moduleId: slice.id,
      sliceId: slice.sliceId || null,
      sliceTitle: slice.title,
      stage: "extract"
    });
    await updateAutomationTask(skipTask.id, { status: "skipped", finishedAt: (/* @__PURE__ */ new Date()).toISOString() });
    emit(jobId, { event: "task_complete", data: { taskId: skipTask.id, moduleId: slice.id, sliceId: slice.sliceId, stage: "extract", status: "skipped" } });
  }
  return { extracted: true, content: extractedContent };
}
async function runSliceScript(jobId, projectId, bookTitle, slice, extractedContent, model) {
  const job = await getAutomationJob(jobId);
  if (job && (job.status === "cancelled" || job.status === "paused")) {
    return { scripted: false, markdown: "" };
  }
  let scriptMarkdown = "";
  const { getExtractedContents: getExtractedContents2 } = await Promise.resolve().then(() => (init_database(), database_exports));
  const extractedRows = await getExtractedContents2(projectId);
  const matchedExtract = extractedRows.find((e) => e.moduleId === slice.id);
  const contentForScript = matchedExtract?.content || extractedContent || `General academic curriculum rules relative to ${slice.title}`;
  const existingScriptTasks = await getPendingTasksForSlice(jobId, slice.id);
  const scriptTask = existingScriptTasks.find((t) => t.stage === "script") || null;
  await runTaskWithRetry(jobId, projectId, slice, "script", scriptTask, async () => {
    const scriptPrompt = await getSavedPrompt("script-gen");
    const result = await internalPost("/api/generate-script", {
      bookTitle,
      chapterTitle: slice.title,
      chapterIndex: slice.sliceId || slice.coveredChapters || "",
      coveredChapters: slice.coveredChapters || "",
      summary: slice.summary,
      infoDensity: slice.infoDensity,
      cohesionDetail: slice.cohesionDetail,
      designRationale: slice.designRationale,
      extractedContent: contentForScript.substring(0, 8e3),
      systemPrompt: scriptPrompt.systemPrompt,
      userPromptTemplate: scriptPrompt.userPromptTemplate
    });
    scriptMarkdown = result.markdown || "";
    if (!scriptMarkdown) throw new Error("AI \u672A\u8FD4\u56DE\u811A\u672C\u5185\u5BB9");
    if (result._meta?.error || result._meta?.degraded) {
      throw new Error(result._meta?.error || "AI \u8FD4\u56DE\u964D\u7EA7\u7ED3\u679C");
    }
    await saveModuleScript(projectId, slice.id, {
      id: slice.id,
      moduleId: slice.id,
      kind: "simulation_blueprint_markdown",
      markdown: scriptMarkdown,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  return { scripted: true, markdown: scriptMarkdown };
}
async function runSliceAppCode(jobId, projectId, bookTitle, slice, scriptMarkdown, model) {
  const job = await getAutomationJob(jobId);
  if (job && (job.status === "cancelled" || job.status === "paused")) {
    return { built: false };
  }
  const { getModuleScripts: getModuleScripts2 } = await Promise.resolve().then(() => (init_database(), database_exports));
  const scripts = await getModuleScripts2(projectId);
  const matchedScript = scripts.find((s) => s.moduleId === slice.id);
  let finalMarkdown = scriptMarkdown;
  if (!finalMarkdown && matchedScript) {
    try {
      const parsed = JSON.parse(matchedScript.script);
      finalMarkdown = parsed.markdown || "";
    } catch {
      finalMarkdown = matchedScript.script;
    }
  }
  if (!finalMarkdown) {
    const skipTask = await createAutomationTask({
      jobId,
      projectId,
      moduleId: slice.id,
      sliceId: slice.sliceId || null,
      sliceTitle: slice.title,
      stage: "app-code"
    });
    await updateAutomationTask(skipTask.id, { status: "skipped", finishedAt: (/* @__PURE__ */ new Date()).toISOString(), error: "\u65E0\u53EF\u7528\u811A\u672C" });
    emit(jobId, { event: "task_complete", data: { taskId: skipTask.id, moduleId: slice.id, sliceId: slice.sliceId, stage: "app-code", status: "skipped" } });
    return { built: false };
  }
  const existingAppTasks = await getPendingTasksForSlice(jobId, slice.id);
  const appTask = existingAppTasks.find((t) => t.stage === "app-code") || null;
  await runTaskWithRetry(jobId, projectId, slice, "app-code", appTask, async () => {
    const appPrompt = await getSavedPrompt("app-code");
    const result = await internalPost("/api/generate-app-code", {
      bookTitle,
      chapterTitle: slice.title,
      coveredChapters: slice.coveredChapters || "",
      scriptMarkdown: finalMarkdown,
      model,
      systemPrompt: appPrompt.systemPrompt,
      userPromptTemplate: appPrompt.userPromptTemplate
    });
    const code = result.code || "";
    if (!code) throw new Error("AI \u672A\u8FD4\u56DE HTML \u4EE3\u7801");
    await saveGeneratedAppCode(projectId, slice.id, code);
  });
  return { built: true };
}
async function runSlicePipeline(jobId, projectId, bookTitle, slice, directoryItems, hasPdf, model) {
  const job = await getAutomationJob(jobId);
  if (job && (job.status === "cancelled" || job.status === "paused")) {
    return { extracted: false, scripted: false, built: false };
  }
  const { extracted, content } = await runSliceExtract(jobId, projectId, bookTitle, slice, directoryItems, hasPdf, model);
  if (!extracted) return { extracted: false, scripted: false, built: false };
  const job2 = await getAutomationJob(jobId);
  if (job2 && (job2.status === "cancelled" || job2.status === "paused")) {
    return { extracted: true, scripted: false, built: false };
  }
  const { scripted, markdown } = await runSliceScript(jobId, projectId, bookTitle, slice, content, model);
  if (!scripted) return { extracted: true, scripted: false, built: false };
  const job3 = await getAutomationJob(jobId);
  if (job3 && (job3.status === "cancelled" || job3.status === "paused")) {
    return { extracted: true, scripted: true, built: false };
  }
  const { built } = await runSliceAppCode(jobId, projectId, bookTitle, slice, markdown, model);
  return { extracted: true, scripted: true, built };
}
async function ensureModulesGenerated(projectId, jobId) {
  const project = await getProject(projectId);
  if (!project) throw new Error("\u9879\u76EE\u4E0D\u5B58\u5728");
  const existing = parseModules(project.modules);
  if (existing.length > 0) return existing;
  const directoryItems = parseDirectoryItems(project.directoryItems);
  if (directoryItems.length === 0) {
    throw new Error("\u9879\u76EE\u65E0\u76EE\u5F55\u6570\u636E\uFF0C\u65E0\u6CD5\u81EA\u52A8\u5207\u7247");
  }
  emit(jobId, { event: "parse_book_start", data: { projectId, status: "running" } });
  const smartSplitPrompt = await getSavedPrompt("smart-split");
  const result = await internalPost("/api/parse-book", {
    title: project.bookTitle || project.name || "\u672A\u547D\u540D\u6559\u6750",
    fullText: project.bookContentText || "",
    directoryStructure: directoryItems,
    systemPrompt: smartSplitPrompt.systemPrompt,
    userPromptTemplate: smartSplitPrompt.userPromptTemplate
  });
  if (result._meta?.error || result._meta?.degraded) {
    throw new Error(result._meta?.error || "AI \u5207\u7247\u964D\u7EA7\uFF0C\u8BF7\u91CD\u8BD5");
  }
  const rawSlices = result.slices || result.modules || [];
  if (rawSlices.length === 0) {
    throw new Error("AI \u672A\u8FD4\u56DE\u5207\u7247");
  }
  const { updateProject: updateProject2 } = await Promise.resolve().then(() => (init_database(), database_exports));
  const modules = rawSlices.map((mod, index) => ({
    ...mod,
    id: mod.id || `mod-${index + 1}-${Date.now()}`,
    sliceId: mod.sliceId || `S${index + 1}`,
    chapterIndex: mod.chapterIndex || mod.sliceId || `S${index + 1}`,
    scriptStatus: "pending"
  }));
  await updateProject2(projectId, { modules: JSON.stringify(modules), rawBlueprintData: JSON.stringify(result) });
  emit(jobId, { event: "parse_book_complete", data: { projectId, sliceCount: modules.length, status: "completed" } });
  return modules;
}
async function startAutomationJob(projectId, options = {}) {
  const project = await getProject(projectId);
  if (!project) throw new Error("\u9879\u76EE\u4E0D\u5B58\u5728");
  const directoryItems = parseDirectoryItems(project.directoryItems);
  const hasPdf = !!(project.pdfFileName && project.pdfData);
  const model = options.model || "deepseek-v4-flash";
  let job = await getLatestAutomationJob(projectId);
  if (!job || job.status !== "running" && job.status !== "paused") {
    job = await createAutomationJob(projectId, 0, options.concurrency || 1);
  }
  job.status = "running";
  await updateAutomationJob(job.id, { status: "running", startedAt: (/* @__PURE__ */ new Date()).toISOString() });
  emit(job.id, { event: "job_progress", data: { jobId: job.id, status: "running" } });
  (async () => {
    try {
      const slices = await ensureModulesGenerated(projectId, job.id);
      await updateAutomationJob(job.id, { totalSlices: slices.length });
      await runJobLoop(job.id, projectId, project.bookTitle, slices, directoryItems, hasPdf, model);
    } catch (err) {
      console.error(`[orchestrator] job ${job.id} crashed:`, err);
      await updateAutomationJob(job.id, {
        status: "failed",
        error: err?.message || String(err),
        finishedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      emit(job.id, { event: "job_failed", data: { jobId: job.id, error: err?.message || String(err) } });
    }
  })();
  return job;
}
async function runJobLoop(jobId, projectId, bookTitle, slices, directoryItems, hasPdf, model) {
  const job = await getAutomationJob(jobId);
  if (!job) return;
  await updateAutomationJob(jobId, {
    status: "running",
    startedAt: job.startedAt || (/* @__PURE__ */ new Date()).toISOString()
  });
  emit(jobId, { event: "job_progress", data: { jobId, completed: job.completedSlices, total: job.totalSlices, status: "running" } });
  const succeededExtract = [];
  const succeededScript = [];
  let completed = 0;
  let failed = 0;
  const checkStatus = async () => {
    const current = await getAutomationJob(jobId);
    if (!current || current.status === "cancelled") return "cancelled";
    if (current.status === "paused") return "paused";
    return "continue";
  };
  for (const slice of slices) {
    const status = await checkStatus();
    if (status === "cancelled") break;
    if (status === "paused") {
      emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, status: "paused" } });
      return;
    }
    const { getExtractedContents: queryExtracted } = await Promise.resolve().then(() => (init_database(), database_exports));
    const existingExtracts = await queryExtracted(projectId);
    const matchedExtract = existingExtracts.find((e) => e.moduleId === slice.id);
    emit(jobId, { event: "slice_start", data: { jobId, moduleId: slice.id, sliceId: slice.sliceId, title: slice.title, stage: "extract" } });
    try {
      const { extracted, content } = await runSliceExtract(jobId, projectId, bookTitle, slice, directoryItems, hasPdf, model);
      if (extracted) {
        succeededExtract.push({ slice, content: content || matchedExtract?.content || "" });
      } else {
        failed += 1;
      }
    } catch (err) {
      console.error(`[orchestrator] extract slice ${slice.sliceId || slice.id} failed:`, err);
      failed += 1;
    }
    await updateAutomationJob(jobId, { failedSlices: failed });
    emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, failed, status: "running", stage: "extract" } });
  }
  for (const { slice, content } of succeededExtract) {
    const status = await checkStatus();
    if (status === "cancelled") break;
    if (status === "paused") {
      emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, status: "paused" } });
      return;
    }
    emit(jobId, { event: "slice_start", data: { jobId, moduleId: slice.id, sliceId: slice.sliceId, title: slice.title, stage: "script" } });
    try {
      const { scripted, markdown } = await runSliceScript(jobId, projectId, bookTitle, slice, content, model);
      if (scripted) {
        succeededScript.push({ slice, markdown });
      } else {
      }
    } catch (err) {
      console.error(`[orchestrator] script slice ${slice.sliceId || slice.id} failed:`, err);
    }
    emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, failed, status: "running", stage: "script" } });
  }
  for (const { slice, markdown } of succeededScript) {
    const status = await checkStatus();
    if (status === "cancelled") break;
    if (status === "paused") {
      emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, status: "paused" } });
      return;
    }
    emit(jobId, { event: "slice_start", data: { jobId, moduleId: slice.id, sliceId: slice.sliceId, title: slice.title, stage: "app-code" } });
    try {
      const { built } = await runSliceAppCode(jobId, projectId, bookTitle, slice, markdown, model);
      if (built) {
        completed += 1;
      } else {
        failed += 1;
      }
    } catch (err) {
      console.error(`[orchestrator] app-code slice ${slice.sliceId || slice.id} failed:`, err);
      failed += 1;
    }
    await updateAutomationJob(jobId, { completedSlices: completed, failedSlices: failed });
    emit(jobId, { event: "job_progress", data: { jobId, completed, total: slices.length, failed, status: "running", stage: "app-code" } });
  }
  const finalJob = await getAutomationJob(jobId);
  const allFailed = failed === slices.length && slices.length > 0;
  let finalStatus;
  if (finalJob?.status === "cancelled") {
    finalStatus = "cancelled";
  } else if (failed === 0) {
    finalStatus = "completed";
  } else if (completed > 0) {
    finalStatus = "partial";
  } else {
    finalStatus = allFailed ? "partial" : "completed";
  }
  await updateAutomationJob(jobId, {
    status: finalStatus,
    completedSlices: completed,
    failedSlices: failed,
    finishedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  emit(jobId, {
    event: finalStatus === "completed" ? "job_complete" : "job_finished",
    data: { jobId, completed, failed, total: slices.length, status: finalStatus }
  });
}
async function pauseJob(jobId) {
  await updateAutomationJob(jobId, { status: "paused" });
  emit(jobId, { event: "job_progress", data: { jobId, status: "paused" } });
}
async function resumeJob(jobId) {
  const job = await getAutomationJob(jobId);
  if (!job) throw new Error("Job \u4E0D\u5B58\u5728");
  if (job.status !== "paused" && job.status !== "partial") {
    throw new Error(`\u5F53\u524D\u72B6\u6001 ${job.status} \u4E0D\u53EF\u6062\u590D`);
  }
  const project = await getProject(job.projectId);
  if (!project) throw new Error("\u9879\u76EE\u4E0D\u5B58\u5728");
  const slices = parseModules(project.modules);
  const directoryItems = parseDirectoryItems(project.directoryItems);
  const hasPdf = !!(project.pdfFileName && project.pdfData);
  await updateAutomationJob(jobId, { status: "running", finishedAt: null });
  runJobLoop(jobId, job.projectId, project.bookTitle, slices, directoryItems, hasPdf, "deepseek-v4-flash").catch((err) => {
    console.error(`[orchestrator] job ${jobId} resume crashed:`, err);
  });
}
async function cancelJob(jobId) {
  await updateAutomationJob(jobId, { status: "cancelled", finishedAt: (/* @__PURE__ */ new Date()).toISOString() });
  emit(jobId, { event: "job_progress", data: { jobId, status: "cancelled" } });
}
async function retryTask(taskId) {
  const task = await getAutomationTask(taskId);
  if (!task) throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
  const job = await getAutomationJob(task.jobId);
  if (!job) throw new Error("Job \u4E0D\u5B58\u5728");
  const project = await getProject(task.projectId);
  if (!project) throw new Error("\u9879\u76EE\u4E0D\u5B58\u5728");
  const slices = parseModules(project.modules);
  const slice = slices.find((s) => s.id === task.moduleId);
  if (!slice) throw new Error("\u5207\u7247\u4E0D\u5B58\u5728");
  const directoryItems = parseDirectoryItems(project.directoryItems);
  const hasPdf = !!(project.pdfFileName && project.pdfData);
  await updateAutomationTask(taskId, { status: "pending", attempts: 0, error: null, startedAt: null, finishedAt: null });
  runSlicePipeline(task.jobId, task.projectId, project.bookTitle, slice, directoryItems, hasPdf, "deepseek-v4-flash").then(async () => {
    const tasks = await getAutomationTasksByJob(task.jobId);
    const moduleTasks = tasks.filter((t) => t.moduleId === slice.id);
    const allDone = moduleTasks.every((t) => t.status === "completed" || t.status === "skipped");
    if (allDone) {
      const freshJob = await getAutomationJob(task.jobId);
      if (freshJob) {
        await updateAutomationJob(task.jobId, {
          completedSlices: freshJob.completedSlices + 1,
          failedSlices: Math.max(0, freshJob.failedSlices - 1)
        });
      }
    }
    emit(task.jobId, { event: "task_complete", data: { taskId, moduleId: slice.id, stage: task.stage, status: "completed" } });
  }).catch((err) => {
    console.error(`[orchestrator] retry task ${taskId} failed:`, err);
    emit(task.jobId, { event: "task_failed", data: { taskId, error: err.message } });
  });
}
async function retryAllFailed(jobId) {
  const tasks = await getAutomationTasksByJob(jobId);
  const failed = tasks.filter((t) => t.status === "failed");
  for (const t of failed) {
    await retryTask(t.id);
  }
}
async function getJobSnapshot(jobId) {
  const job = await getAutomationJob(jobId);
  const tasks = await getAutomationTasksByJob(jobId);
  return { job, tasks };
}

// server.ts
var SERVER_VERSION = "v1.2.1-stage-serial";
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
app.use("/api/pdf-images", import_express.default.static(import_path2.default.join(process.cwd(), "uploads", "pdf_images")));
var AI_PROVIDER = process.env.AI_PROVIDER || "deepseek";
async function callDeepSeek(prompt, systemPrompt = "", model = "", maxTokens = 4096, jsonMode = true) {
  try {
    const deepseekModel = model || process.env.DEEPSEEK_MODEL || "deepseek-chat";
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY || "";
    if (!deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }
    let accumulated = "";
    const maxRounds = 5;
    for (let round = 0; round < maxRounds; round++) {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ];
      if (accumulated) {
        messages.push({ role: "assistant", content: accumulated });
        messages.push({ role: "user", content: "\u7EE7\u7EED\uFF0C\u4E0D\u8981\u505C\u3002\u5982\u679C\u4EE3\u7801\u8FD8\u6CA1\u5199\u5B8C\uFF0C\u8BF7\u63A5\u7740\u4E0A\u4E00\u6BB5\u7EE7\u7EED\u8F93\u51FA\u5269\u4F59\u90E8\u5206\u3002" });
      }
      let result = null;
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          result = await streamChatCompletion({
            url: "https://api.deepseek.com/chat/completions",
            apiKey: deepseekApiKey,
            model: deepseekModel,
            messages,
            maxTokens,
            jsonMode: jsonMode && round === 0,
            thinking: "disabled"
          });
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (attempt === 2) throw err;
          console.warn("DeepSeek fetch aborted, retrying once...");
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
      if (!result) {
        throw lastError || new Error("DeepSeek API request failed");
      }
      const content = result.content;
      const finishReason = result.finishReason;
      accumulated += content;
      console.log(`DeepSeek round ${round + 1}: +${content.length} chars, finish_reason=${finishReason}, interrupted=${result.interrupted}`);
      const completeJson = jsonMode ? extractCompleteJsonContent(accumulated) : null;
      if (completeJson) {
        accumulated = completeJson;
        console.log(`DeepSeek JSON completed after round ${round + 1}; stopping without waiting for [DONE].`);
        break;
      }
      if (finishReason !== "length" && !result.interrupted) {
        break;
      }
    }
    return accumulated;
  } catch (error) {
    console.error("DeepSeek call failed:", error);
    throw error;
  }
}
async function callDashScope(prompt, systemPrompt = "", model = "", maxTokens = 4096, jsonMode = true) {
  try {
    const dashscopeModel = model || process.env.DASHSCOPE_MODEL || "qwen-plus";
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY || "";
    const baseUrl = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    if (!dashscopeApiKey) {
      throw new Error("DASHSCOPE_API_KEY is not configured");
    }
    let accumulated = "";
    const maxRounds = 5;
    for (let round = 0; round < maxRounds; round++) {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ];
      if (accumulated) {
        messages.push({ role: "assistant", content: accumulated });
        messages.push({ role: "user", content: "\u7EE7\u7EED\uFF0C\u4E0D\u8981\u505C\u3002\u5982\u679C\u4EE3\u7801\u8FD8\u6CA1\u5199\u5B8C\uFF0C\u8BF7\u63A5\u7740\u4E0A\u4E00\u6BB5\u7EE7\u7EED\u8F93\u51FA\u5269\u4F59\u90E8\u5206\u3002" });
      }
      const result = await streamChatCompletion({
        url: `${baseUrl}/chat/completions`,
        apiKey: dashscopeApiKey,
        model: dashscopeModel,
        messages,
        maxTokens,
        jsonMode: jsonMode && round === 0
      });
      const content = result.content;
      const finishReason = result.finishReason;
      accumulated += content;
      console.log(`DashScope round ${round + 1}: +${content.length} chars, finish_reason=${finishReason}, interrupted=${result.interrupted}`);
      const completeJson = jsonMode ? extractCompleteJsonContent(accumulated) : null;
      if (completeJson) {
        accumulated = completeJson;
        console.log(`DashScope JSON completed after round ${round + 1}; stopping without waiting for [DONE].`);
        break;
      }
      if (finishReason !== "length" && !result.interrupted) {
        break;
      }
    }
    return accumulated;
  } catch (error) {
    console.error("DashScope call failed:", error);
    throw error;
  }
}
var aiInstance = null;
function getGenAI() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("\u26A0\uFE0F Warning: GEMINI_API_KEY environment variable is not set!");
    }
    aiInstance = new import_genai.GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiInstance;
}
async function callOllama(prompt, systemPrompt = "", model = "", jsonMode = true) {
  try {
    const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
    const ollamaModel = model || process.env.OLLAMA_MODEL || "llama3.1:8b";
    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        system: systemPrompt,
        ...jsonMode ? { format: "json" } : {},
        stream: false
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    const data = await response.json();
    return data.response || "";
  } catch (error) {
    console.error("Ollama call failed:", error);
    throw error;
  }
}
async function callHuggingFace(prompt, systemPrompt = "", model = "") {
  try {
    const hfModel = model || process.env.HUGGINGFACE_MODEL || "Qwen/Qwen2-7B-Instruct";
    const hfToken = process.env.HUGGINGFACE_TOKEN || "";
    const fullPrompt = systemPrompt ? `<|system|>${systemPrompt}</s><|user|>${prompt}</s><|assistant|>` : prompt;
    const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...hfToken && { "Authorization": `Bearer ${hfToken}` }
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 2048,
          temperature: 0.7,
          top_p: 0.95,
          repetition_penalty: 1,
          return_full_text: false
        }
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return data[0]?.generated_text || data?.generated_text || "";
  } catch (error) {
    console.error("Hugging Face call failed:", error);
    throw error;
  }
}
function cleanCoveredChapters(covered, fallbackIndex) {
  if (!covered) return fallbackIndex || "1.1";
  let str = covered.replace(/[Cc]hapter|[Ss]ection|[Tt]opic|第|章|节|课/gi, "").replace(/[\s\uFEFF\xA0]+/g, "").trim();
  str = str.replace(/[&以及+和与、,，]/g, "-");
  const matches = str.match(/\d+(?:\.\d+)?/g);
  if (matches && matches.length >= 2) {
    const first = matches[0];
    let last = matches[matches.length - 1];
    if (first.includes(".") && !last.includes(".")) {
      const major = first.split(".")[0];
      last = `${major}.${last}`;
    }
    if (first === last) {
      return first;
    }
    return `${first}-${last}`;
  } else if (matches && matches.length === 1) {
    return matches[0];
  }
  return str || fallbackIndex || "1.1";
}
function convertOldMockToNewFormat(oldMock) {
  const slices = (oldMock.modules || []).map((mod, idx) => ({
    sliceId: `S${idx + 1}`,
    title: mod.title || `\u5207\u7247${idx + 1}`,
    coveredChapters: mod.coveredChapters || `${idx + 1}.1`,
    summary: {
      learnedPoints: [
        `\u80FD\u7406\u89E3${mod.title || "\u672C\u8282"}\u7684\u6838\u5FC3\u6982\u5FF5`,
        `\u80FD\u63CF\u8FF0${mod.summary || "\u76F8\u5173\u77E5\u8BC6\u70B9"}\u7684\u5173\u952E\u7279\u5F81`,
        `\u80FD\u8FD0\u7528${mod.title || "\u672C\u8282"}\u77E5\u8BC6\u89E3\u51B3\u5B9E\u9645\u95EE\u9898`
      ],
      practicalProblems: [
        `\u5F53\u9047\u5230${mod.title || "\u672C\u8282"}\u76F8\u5173\u573A\u666F\u65F6\uFF0C\u4F60\u80FD\u8FD0\u7528\u6838\u5FC3\u77E5\u8BC6\u8FDB\u884C\u5206\u6790`,
        `\u5F53\u9700\u8981\u5E94\u7528${mod.title || "\u672C\u8282"}\u6982\u5FF5\u65F6\uFF0C\u4F60\u80FD\u505A\u51FA\u6B63\u786E\u51B3\u7B56`
      ]
    },
    infoDensity: {
      conceptCount: mod.infoDensity ? 3 : 4,
      factCount: mod.infoDensity ? 2 : 3,
      abstractLevel: "\u4E2D",
      nestingLevel: "\u4E24\u5C42",
      suggestedMinutes: "10-15",
      rationale: mod.infoDensity || "\u8BE5\u5207\u7247\u4FE1\u606F\u91CF\u9002\u4E2D\uFF0C\u53EF\u572810-15\u5206\u949F\u5185\u5B8C\u6210\u5B66\u4E60\uFF0C\u4E0D\u4F1A\u9020\u6210\u8BA4\u77E5\u8FC7\u8F7D\u3002"
    },
    cohesionDetail: {
      cohesionType: "\u65F6\u5E8F\u9012\u8FDB",
      mechanism: mod.cohesionDetail || "\u8BE5\u5207\u7247\u5185\u7684\u77E5\u8BC6\u70B9\u56F4\u7ED5\u540C\u4E00\u6559\u5B66\u4E3B\u9898\u7EC4\u7EC7\uFF0C\u903B\u8F91\u9012\u8FDB\u5173\u8054\uFF0C\u5F62\u6210\u5B8C\u6574\u5B66\u4E60\u5355\u5143\u3002",
      coreQuestion: `\u5982\u4F55\u638C\u63E1${mod.title || "\u672C\u8282"}\u7684\u6838\u5FC3\u77E5\u8BC6\u5E76\u5E94\u7528\u4E8E\u5B9E\u8DF5\uFF1F`
    },
    designRationale: mod.designRationale || `\u5B66\u751F\u901A\u8FC7\u672C\u5207\u7247\u5B66\u4E60${mod.title || "\u6838\u5FC3\u6982\u5FF5"}\uFF0C\u7406\u89E3\u77E5\u8BC6\u70B9\u4E4B\u95F4\u7684\u5173\u8054\uFF0C\u5E76\u80FD\u8FD0\u7528\u8FD9\u4E9B\u77E5\u8BC6\u5206\u6790\u548C\u89E3\u51B3\u5B9E\u9645\u95EE\u9898\u3002`
  }));
  return {
    bookTitle: oldMock.title || "\u672A\u77E5\u6559\u6750",
    totalSlices: slices.length,
    slices
  };
}
function parseJsonResponse(text) {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1];
  }
  return JSON.parse(cleaned);
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/projects", async (req, res) => {
  try {
    const projects = await getAllProjects();
    console.log("\u{1F4CB} GET /api/projects returning:", projects.length, "projects");
    res.json(projects);
  } catch (error) {
    console.error("\u274C Failed to get projects:", error);
    res.status(500).json({ error: "Failed to get projects" });
  }
});
app.get("/api/projects/:id", async (req, res) => {
  try {
    console.log("\u{1F4E5} GET /api/projects/:id called:", req.params.id);
    const project = await getProject(req.params.id);
    console.log("\u{1F4CB} Project found:", project ? "yes" : "no", project);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error("\u274C Failed to get project:", error);
    res.status(500).json({ error: "Failed to get project" });
  }
});
app.post("/api/projects", async (req, res) => {
  try {
    const { name, pdfFileName, pdfData, bookTitle, bookContentText, directoryItems, modules } = req.body;
    console.log("\u{1F4E5} POST /api/projects called with:", { name, pdfFileName: pdfFileName ? "yes" : "no", pdfData: pdfData ? "yes" : "no" });
    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }
    const project = await createProject(name, pdfFileName, pdfData, bookTitle, bookContentText, directoryItems, modules);
    console.log("\u2705 Project created in DB:", project.id);
    res.json(project);
  } catch (error) {
    console.error("\u274C Failed to create project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});
app.put("/api/projects/:id", async (req, res) => {
  try {
    const { name, bookTitle, bookContentText, directoryItems, modules, pdfFileName, pdfData, aiMeta, rawBlueprintData } = req.body;
    await updateProject(req.params.id, { name, bookTitle, bookContentText, directoryItems, modules, pdfFileName, pdfData, aiMeta, rawBlueprintData });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});
app.put("/api/projects/:id/pdf", async (req, res) => {
  try {
    const { pdfFileName, pdfData } = req.body;
    await updateProjectPdf(req.params.id, pdfFileName, pdfData);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update project PDF:", error);
    res.status(500).json({ error: "Failed to update project PDF" });
  }
});
app.delete("/api/projects/:id", async (req, res) => {
  try {
    await deleteProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});
app.get("/api/projects/:id/scripts", async (req, res) => {
  try {
    const scripts = await getModuleScripts(req.params.id);
    res.json(scripts);
  } catch (error) {
    console.error("Failed to get scripts:", error);
    res.status(500).json({ error: "Failed to get scripts" });
  }
});
app.post("/api/projects/:id/scripts", async (req, res) => {
  try {
    const { moduleId, script } = req.body;
    await saveModuleScript(req.params.id, moduleId, script);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to save script:", error);
    res.status(500).json({ error: "Failed to save script" });
  }
});
app.get("/api/projects/:id/extracted", async (req, res) => {
  try {
    const contents = await getExtractedContents(req.params.id);
    res.json(contents);
  } catch (error) {
    console.error("Failed to get extracted content:", error);
    res.status(500).json({ error: "Failed to get extracted content" });
  }
});
app.post("/api/projects/:id/extracted", async (req, res) => {
  try {
    const { moduleId, content } = req.body;
    await saveExtractedContent(req.params.id, moduleId, content);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to save extracted content:", error);
    res.status(500).json({ error: "Failed to save extracted content" });
  }
});
app.post("/api/projects/:id/app-code", async (req, res) => {
  try {
    const { moduleId, code } = req.body;
    await saveGeneratedAppCode(req.params.id, moduleId, code);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to save app code:", error);
    res.status(500).json({ error: "Failed to save app code" });
  }
});
app.get("/api/projects/:id/app-code/:moduleId", async (req, res) => {
  try {
    const code = await getGeneratedAppCode(req.params.id, req.params.moduleId);
    res.json({ code: code || null });
  } catch (error) {
    console.error("Failed to get app code:", error);
    res.status(500).json({ error: "Failed to get app code" });
  }
});
app.post("/api/projects/:id/extract-pages", async (req, res) => {
  try {
    const { startPage, endPage } = req.body;
    const project = await getProject(req.params.id);
    if (!project || !project.pdfData) {
      return res.status(404).json({ error: "PDF data not found" });
    }
    const { exec } = await import("child_process");
    const path3 = await import("path");
    const scriptPath = path3.join(process.cwd(), "pdf_extractor_oxide.py");
    const imageOutputDir = path3.join(process.cwd(), "uploads", "pdf_images", req.params.id);
    const inputJson = JSON.stringify({
      pdfData: project.pdfData,
      startPage: startPage || 1,
      endPage: endPage || 9999,
      imageOutputDir
    });
    const result = await new Promise((resolve, reject) => {
      const python = exec(`python3 "${scriptPath}"`, { maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          console.error("Python \u63D0\u53D6\u9519\u8BEF:", stderr);
          reject(new Error(`PDF \u63D0\u53D6\u5931\u8D25: ${stderr || error.message}`));
          return;
        }
        if (stderr) {
          console.error("Python stderr:", stderr);
        }
        try {
          const data = JSON.parse(stdout);
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(new Error(`\u89E3\u6790 Python \u8F93\u51FA\u5931\u8D25: ${stdout.substring(0, 200)}`));
        }
      });
      python.stdin?.write(inputJson);
      python.stdin?.end();
    });
    const baseUrl = `/api/pdf-images/${req.params.id}`;
    const pagesWithUrls = result.pages.map((page) => ({
      ...page,
      images: (page.images || []).map((img) => ({
        ...img,
        url: `${baseUrl}/${img.filename}`
      }))
    }));
    res.json({ ...result, pages: pagesWithUrls });
  } catch (error) {
    console.error("Failed to extract pages:", error);
    res.status(500).json({ error: `Failed to extract pages: ${error.message}` });
  }
});
app.get("/api/projects/:id/images", async (req, res) => {
  try {
    const imageDir = import_path2.default.join(process.cwd(), "uploads", "pdf_images", req.params.id);
    const fs2 = await import("fs");
    if (!fs2.existsSync(imageDir)) {
      return res.json({ images: [] });
    }
    const files = fs2.readdirSync(imageDir);
    const images = files.filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f)).map((filename) => ({
      filename,
      path: import_path2.default.join(imageDir, filename),
      url: `/api/pdf-images/${req.params.id}/${filename}`
    }));
    res.json({ images });
  } catch (error) {
    console.error("Failed to list images:", error);
    res.status(500).json({ error: `Failed to list images: ${error.message}` });
  }
});
app.post("/api/parse-book", async (req, res) => {
  try {
    const { title, fullText, directoryStructure, systemPrompt, userPromptTemplate } = req.body;
    console.log("\n\u{1F4DA} ========== PARSE BOOK API CALL ==========");
    console.log("\u{1F4D5} Book Title (dynamic from frontend):", title);
    console.log("\u{1F4C2} Directory Structure length:", directoryStructure?.length || 0);
    if (directoryStructure && directoryStructure.length > 0) {
      console.log("\u{1F4CB} First 5 directory items:", JSON.stringify(directoryStructure.slice(0, 5), null, 2));
    }
    console.log("\u{1F4CF} fullText length:", fullText?.length || 0);
    console.log("\u{1F916} AI Provider:", process.env.AI_PROVIDER || "deepseek");
    console.log("\u{1F9E0} Model:", process.env.DEEPSEEK_MODEL || "deepseek-chat");
    console.log("==========================================\n");
    if (!title) {
      return res.status(400).json({ error: "Missing book title." });
    }
    let directoryText = "";
    if (directoryStructure && directoryStructure.length > 0) {
      directoryText = "\u3010\u6559\u6750\u76EE\u5F55 - \u624B\u98CE\u7434\u5C42\u7EA7\u7ED3\u6784\u3011\n";
      directoryText += "\u8BF4\u660E\uFF1A\u4EE5\u4E0B\u662F\u6559\u6750\u7684\u5B8C\u6574\u76EE\u5F55\uFF0C\u91C7\u7528\u624B\u98CE\u7434\u5C42\u7EA7\u7ED3\u6784\uFF08\u7236\u7EA7 \u2192 \u5B50\u7EA7 \u2192 \u5B59\u7EA7\uFF09\u3002\n";
      directoryText += "\u7F29\u8FDB\u5C42\u7EA7\u8868\u793A\u7236\u5B50\u5173\u7CFB\uFF1A\u65E0\u7F29\u8FDB = \u9876\u7EA7(Topic/\u7AE0)\uFF0C2\u7A7A\u683C\u7F29\u8FDB = \u8282(1.1/1.2)\uFF0C4\u7A7A\u683C\u7F29\u8FDB = \u5C0F\u8282(1.1.1/1.1.2)\u3002\n";
      directoryText += "\u6BCF\u4E2A\u7AE0\u8282\u540E\u9762\u7684 (P.X) \u662F\u8BE5\u7AE0\u8282\u7684\u8D77\u59CB\u9875\u7801\u3002\n";
      directoryText += "\u26A0\uFE0F \u91CD\u8981\u63D0\u793A\uFF1A\u7AE0\u8282\u7F16\u53F7\u662F\u5B8C\u6574\u7684\uFF0C\u4F8B\u5982 1.1.1 \u8868\u793A\u7B2C1\u7AE0\u7B2C1\u8282\u7684\u7B2C1\u5C0F\u8282\uFF0C\u5B83\u548C 1.1\u30011.2 \u662F\u4E0D\u540C\u5C42\u7EA7\u7684\u7F16\u53F7\u3002\u586B\u5199 coveredChapters \u65F6\u5FC5\u987B\u4F7F\u7528\u5B8C\u6574\u7684\u7F16\u53F7\uFF01\n\n";
      directoryStructure.forEach((item) => {
        const pageStr = item.page ? ` (P.${item.page})` : "";
        const indent = item.type === "chapter" ? "" : item.type === "section" ? "  " : "    ";
        directoryText += `${indent}${item.title}${pageStr}
`;
      });
    } else {
      return res.status(400).json({ error: "\u672A\u63D0\u4F9B\u6709\u6548\u7684\u76EE\u5F55\u6570\u636E\uFF0C\u65E0\u6CD5\u8FDB\u884C\u5207\u7247\u3002\u8BF7\u5148\u4E0A\u4F20\u6216\u9009\u62E9\u8BFE\u672C\u3002" });
    }
    const systemInstruction = `\u4F60\u662F\u4E00\u540D\u4E3A\u6559\u5E08/\u8BFE\u7A0B\u8BBE\u8BA1\u8005\u63D0\u4F9B\u670D\u52A1\u7684\u6559\u5B66\u5207\u7247\u4E13\u5BB6\u3002\u6211\u5C06\u7ED9\u4F60\u4E00\u672C\u4E66\u7684\u76EE\u5F55\uFF0C\u8BF7\u4F60\u5E2E\u6211\u5C06\u5176\u5207\u5206\u6210\u591A\u4E2A\u6559\u5B66\u5207\u7247\uFF0C\u6BCF\u4E2A\u5207\u7247\u7528\u4E8E\u540E\u7EED\u8BBE\u8BA1\u4E92\u52A8\u5185\u5BB9\u3002
 
\u4E00\u3001\u6838\u5FC3\u5207\u7247\u539F\u5219
\u4FE1\u606F\u8D1F\u8377\u63A7\u5236\uFF1A\u6BCF\u4E2A\u5207\u7247\u5305\u542B 3-6 \u4E2A\u6838\u5FC3\u6982\u5FF5\uFF08\u6216 5-10 \u6761\u5177\u4F53\u7B56\u7565/\u4E8B\u5B9E\uFF09\uFF0C\u5BF9\u5E94 8-18 \u5206\u949F\u7684\u5B66\u4E60\u65F6\u957F
\u77E5\u8BC6\u5185\u805A\u6027\uFF1A\u6BCF\u4E2A\u5207\u7247\u5185\u7684\u77E5\u8BC6\u70B9\u5FC5\u987B\u80FD\u5171\u540C\u56DE\u7B54\u4E00\u4E2A\u5B8C\u6574\u7684\u5B50\u95EE\u9898\u6216\u5B8C\u6210\u4E00\u4E2A\u95ED\u73AF\u7684\u5B50\u4EFB\u52A1
\u7AE0\u8282\u8986\u76D6\u683C\u5F0F\uFF1A\u4F7F\u7528 a-b \u683C\u5F0F\u8868\u793A\u8FDE\u7EED\u7AE0\u8282\uFF08\u5982 2.1-2.3\uFF09\uFF0C\u5355\u4E2A\u7AE0\u8282\u5199\u6210 a\uFF08\u5982 5.2\uFF09
\u4E8C\u3001\u8F93\u51FA\u683C\u5F0F\u8981\u6C42
\u8BF7\u8F93\u51FA\u7EAF JSON \u683C\u5F0F\uFF0C\u7ED3\u6784\u5982\u4E0B\uFF1A
{
  "bookTitle": "\u4ECE\u76EE\u5F55\u4E2D\u63D0\u53D6\u7684\u4E66\u540D",
  "totalSlices": 22,
  "slices": [
    {
      "sliceId": "S1",
      "title": "\u5207\u7247\u4E3B\u9898\u540D\u79F0\uFF08\u4E00\u53E5\u8BDD\uFF0C\u8BA9\u5B66\u751F\u77E5\u9053\u8FD9\u4E2A\u5207\u7247\u5728\u8BB2\u4EC0\u4E48\uFF09",
      "coveredChapters": "1.1-1.2/1.1/1.1.1-1.1.5",
      "summary": {
        "learnedPoints": [
          "\u80FD\u8BF4\u51FA/\u7406\u89E3/\u533A\u5206XXX\uFF08\u5177\u4F53\u53EF\u9648\u8FF0\u7684\u77E5\u8BC6\u70B9\uFF09",
          "\u80FD\u63CF\u8FF0XXX\u7684X\u4E2A\u9636\u6BB5/\u7C7B\u578B",
          "\u80FD\u89E3\u91CAXXX\u4E0EXXX\u7684\u5173\u7CFB"
        ],
        "practicalProblems": [
          "\u5F53...\u65F6\uFF0C\u4F60\u80FD...\uFF08\u5177\u4F53\u573A\u666F\u5316\u63CF\u8FF0\uFF09",
          "\u5F53...\u65F6\uFF0C\u4F60\u80FD..."
        ]
      },
      "infoDensity": {
        "conceptCount": 4,
        "factCount": 2,
        "abstractLevel": "\u4F4E/\u4E2D/\u9AD8",
        "nestingLevel": "\u65E0/\u4E24\u5C42/\u4E09\u5C42",
        "suggestedMinutes": "8-12",
        "rationale": "\u75282-3\u53E5\u8BDD\u8BF4\u660E\uFF1A\u4E3A\u4EC0\u4E48\u8FD9\u4E2A\u8D1F\u8377\u662F\u5408\u7406\u7684\uFF1F"
      },
      "cohesionDetail": {
        "cohesionType": "\u56E0\u679C\u94FE/\u65F6\u5E8F\u9012\u8FDB/\u5BF9\u6BD4\u4E89\u9E23/\u95EE\u9898-\u89E3\u51B3\u94FE/\u5206\u7C7B\u5E76\u5217/\u5DE5\u5177\u6027\u5185\u805A/\u89E3\u91CA\u6027\u9012\u8FDB",
        "mechanism": "\u75283-4\u53E5\u8BDD\u8BF4\u660E\u77E5\u8BC6\u70B9\u4E4B\u95F4\u7684\u5177\u4F53\u8FDE\u63A5\u65B9\u5F0F\uFF08\u5982\uFF1AA\u5BFC\u81F4B\uFF0CB\u51B3\u5B9AC\uFF1B\u524D3\u4E2A\u6982\u5FF5\u5171\u540C\u652F\u6491\u7B2C4\u4E2A\uFF1B\u4E24\u4E2A\u8003\u70B9\u5E76\u5217\u4F46\u5171\u540C\u670D\u52A1\u4E8E\u4E00\u4E2A\u76EE\u7684\uFF09",
        "coreQuestion": "\u7528\u4E00\u53E5\u8BDD\u6982\u62EC\uFF1A\u8FD9\u4E2A\u5207\u7247\uFF0C\u51E0\u4E2A\u77E5\u8BC6\u70B9\u5171\u540C\u6307\u5411\u7684\u540C\u4E00\u4E2A\u6838\u5FC3\u95EE\u9898\u662F\u4EC0\u4E48\uFF1F"
      },
      "designRationale": "\u7ED3\u5408\u672C\u5207\u7247\u6240\u6709\u77E5\u8BC6\u70B9\uFF0C\u63CF\u8FF0 2-3 \u4E2A\u7EFC\u5408\u5E94\u7528\u573A\u666F\uFF1A\u5F53\u5B66\u4E60\u8005\u5728\u4EC0\u4E48\u5177\u4F53\u60C5\u5883\u4E0B\uFF0C\u9700\u8981\u540C\u65F6\u8FD0\u7528\u8FD9\u4E9B\u77E5\u8BC6\u70B9\u6765\u89E3\u51B3\u4EC0\u4E48\u5B9E\u9645\u95EE\u9898\u3002\u8981\u63CF\u8FF0\u5B8C\u6574\u7684\u95EE\u9898\u573A\u666F\uFF0C\u800C\u975E\u5B64\u7ACB\u5730\u5BF9\u5E94\u5355\u4E2A\u77E5\u8BC6\u70B9\u3002"
    }
  ]
}
\u4E09\u3001\u5B57\u6BB5\u8BE6\u7EC6\u586B\u5199\u89C4\u8303
\u5B57\u6BB5 	 \u586B\u5199\u8981\u6C42
sliceId 	 S1, S2, S3\u2026 \u6309\u987A\u5E8F\u7F16\u53F7
title 	 \u4E00\u53E5\u8BDD\u4E3B\u9898\uFF0C\u5EFA\u8BAE\u7528"\u52A8\u8BCD+\u540D\u8BCD"\u6216"\u6838\u5FC3\u95EE\u9898"\u5F62\u5F0F
coveredChapters 	 \u4F7F\u7528 a-b \u683C\u5F0F\uFF0C\u5982 2.1-2.3\uFF1B\u5355\u8282\u5199 3.5
			\u26A0\uFE0F \u6781\u5176\u91CD\u8981\uFF1AcoveredChapters \u4E2D\u7684\u7AE0\u8282\u7F16\u53F7\u5FC5\u987B\u4E25\u683C\u6765\u81EA\u4E0A\u65B9\u76EE\u5F55\u4E2D\u5B9E\u9645\u5B58\u5728\u7684\u7AE0\u8282\uFF01
			\u4F8B\u5982\uFF1A\u5982\u679C\u76EE\u5F55\u4E2D\u53EA\u6709 3.1 \u5230 3.7\uFF0C\u90A3\u4E48 coveredChapters \u6700\u591A\u53EA\u80FD\u5199\u5230 3.7\uFF0C\u7EDD\u5BF9\u4E0D\u80FD\u5199 3.8 \u6216 3.9\uFF01
			\u8BF7\u5148\u5728\u76EE\u5F55\u4E2D\u627E\u5230\u4F60\u8981\u8986\u76D6\u7684\u7AE0\u8282\u8303\u56F4\uFF0C\u786E\u8BA4\u8D77\u6B62\u7AE0\u8282\u90FD\u771F\u5B9E\u5B58\u5728\u4E8E\u76EE\u5F55\u4E2D\uFF0C\u518D\u586B\u5199 coveredChapters\u3002
			\u26A0\uFE0F \u5C42\u7EA7\u7F16\u53F7\u89C4\u5219\uFF08\u6781\u5176\u91CD\u8981\uFF0C\u8BF7\u4ED4\u7EC6\u9605\u8BFB\uFF09\uFF1A
			\u76EE\u5F55\u91C7\u7528\u591A\u7EA7\u7F16\u53F7\uFF0C\u4F8B\u5982 Topic 1 \u4E0B\u9762\u6709 1.1\u30011.2\uFF0C\u800C 1.1 \u4E0B\u9762\u53EF\u80FD\u8FD8\u6709 1.1.1\u30011.1.2...1.1.7\u3002
			\u5982\u679C\u4F60\u60F3\u8986\u76D6\u7684\u662F 1.1 \u4E0B\u9762\u7684\u5B50\u7AE0\u8282\uFF08\u5982 1.1.1 \u5230 1.1.4\uFF09\uFF0CcoveredChapters \u5FC5\u987B\u5199\u6210 "1.1.1-1.1.4"\uFF0C\u7EDD\u5BF9\u4E0D\u80FD\u5199\u6210 "1.1-1.4"\uFF01
			"1.1-1.4" \u8868\u793A\u7684\u662F 1.1\u30011.2\u30011.3\u30011.4 \u8FD9\u56DB\u4E2A\u540C\u7EA7\u7AE0\u8282\uFF0C\u800C\u4E0D\u662F 1.1 \u4E0B\u9762\u7684\u5B50\u7AE0\u8282\uFF01
			\u586B\u5199\u524D\u8BF7\u5148\u786E\u8BA4\uFF1A\u4F60\u8981\u8986\u76D6\u7684\u7AE0\u8282\u5728\u76EE\u5F55\u4E2D\u662F\u54EA\u4E00\u5C42\u7EA7\u7684\uFF1F\u5B83\u4EEC\u7684\u5B8C\u6574\u7F16\u53F7\u662F\u4EC0\u4E48\uFF1F\u7136\u540E\u628A\u5B8C\u6574\u7F16\u53F7\u5199\u8FDB coveredChapters\u3002
			\u274C \u9519\u8BEF\u793A\u4F8B\uFF1A\u5982\u679C\u76EE\u5F55\u4E2D 1.1 \u4E0B\u9762\u6709 1.1.1~1.1.5\uFF0C\u5199\u6210 "1.1-1.5"\uFF08\u8FD9\u662F\u9519\u7684\uFF011.5 \u548C 1.1.5 \u662F\u5B8C\u5168\u4E0D\u540C\u7684\u7AE0\u8282\uFF09
			\u2705 \u6B63\u786E\u793A\u4F8B\uFF1A\u5982\u679C\u76EE\u5F55\u4E2D 1.1 \u4E0B\u9762\u6709 1.1.1~1.1.5\uFF0C\u5199\u6210 "1.1.1-1.1.5"\uFF08\u8FD9\u624D\u662F\u5BF9\u7684\uFF01\uFF09
			\u274C \u9519\u8BEF\u793A\u4F8B\uFF1A\u5982\u679C\u76EE\u5F55\u4E2D Topic 1 \u4E0B\u9762\u53EA\u6709 1.1\u30011.2\u30011.3\u30011.4\uFF0C\u5199\u6210 "1.1-1.5"\uFF08\u8FD9\u662F\u9519\u7684\uFF011.5 \u4E0D\u5B58\u5728\uFF01\uFF09
			\u2705 \u6B63\u786E\u793A\u4F8B\uFF1A\u5982\u679C\u76EE\u5F55\u4E2D Topic 1 \u4E0B\u9762\u53EA\u6709 1.1\u30011.2\u30011.3\u30011.4\uFF0C\u5199\u6210 "1.1-1.4"\uFF08\u8FD9\u624D\u662F\u5BF9\u7684\uFF01\uFF09
summary.learnedPoints 	 3-5\u6761\uFF0C\u6BCF\u6761\u4EE5"\u80FD\u2026"\u5F00\u5934\uFF0C\u53EF\u9A8C\u8BC1
summary.practicalProblems 	 2-3\u6761\uFF0C\u683C\u5F0F\u4E3A"\u5F53\u3010\u5177\u4F53\u573A\u666F\u3011\u65F6\uFF0C\u4F60\u80FD\u3010\u5177\u4F53\u884C\u52A8\u3011"
infoDensity.conceptCount 	 \u7EAF\u7406\u8BBA\u6982\u5FF5\u7684\u6570\u91CF\uFF08\u5982"\u5173\u952E\u671F\u5047\u8BF4""ZPD"\uFF09
infoDensity.factCount 	 \u5177\u4F53\u4E8B\u5B9E/\u7B56\u7565/\u6B65\u9AA4\u7684\u6570\u91CF\uFF08\u5982"9\u7C7BESL\u6D3B\u52A8"\uFF09
infoDensity.abstractLevel 	 \u4F4E=\u53EF\u7ACB\u5373\u64CD\u4F5C\uFF1B\u4E2D=\u9700\u7B80\u5355\u63A8\u7406\uFF1B\u9AD8=\u9700\u7406\u8BBA\u7406\u89E3
infoDensity.nestingLevel 	 \u65E0=\u5E76\u5217\uFF1B\u4E24\u5C42=\u6982\u5FF5\u4E0B\u6709\u5B50\u6982\u5FF5\uFF1B\u4E09\u5C42=\u9700\u591A\u6B65\u63A8\u7406
infoDensity.suggestedMinutes 	 \u57FA\u4E8EconceptCount\xD72~3\u5206\u949F + factCount\xD70.5~1\u5206\u949F\u4F30\u7B97
infoDensity.rationale 	 \u5FC5\u987B\u5305\u542B\u5224\u65AD\u7ED3\u8BBA+\u4F9D\u636E\uFF0C\u5982\u8D85\u9650\u5219\u7ED9\u51FA\u62C6\u5206\u5EFA\u8BAE
cohesionDetail.cohesionType 	 \u4ECE\u62EC\u53F7\u4E2D\u9009\u62E9\u6700\u5339\u914D\u7684\u4E00\u9879
cohesionDetail.mechanism 	 \u660E\u786E\u5199\u51FA"X\u8FDE\u63A5Y""A\u652F\u6491B""C\u548CD\u5171\u540C\u6307\u5411E"
cohesionDetail.coreQuestion 	 \u4E00\u4E2A\u5B8C\u6574\u7684\u95EE\u53E5\uFF0C\u805A\u7126\u591A\u4E2A\u77E5\u8BC6\u70B9\u7684\u5171\u540C\u6307\u5411
designRationale 	 \u63CF\u8FF02-3\u4E2A\u7EFC\u5408\u5E94\u7528\u573A\u666F\uFF0C\u8BF4\u660E\u5B8C\u6574\u7684\u95EE\u9898\u573A\u666F
\u56DB\u3001\u91CD\u8981\u63D0\u9192
\u5982\u679C\u67D0\u4E00\u7AE0/\u8282\u7684\u4FE1\u606F\u8D1F\u8377\u8FC7\u9AD8\uFF08conceptCount > 7 \u6216 abstractLevel=\u9AD8 \u4E14 conceptCount > 5\uFF09\uFF0C\u8BF7\u5728 infoDensity.rationale \u4E2D\u660E\u786E\u5EFA\u8BAE"\u62C6\u5206\u4E3A2\u4E2A\u5207\u7247"
\u5982\u679C\u67D0\u4E00\u7AE0/\u8282\u7684\u4FE1\u606F\u8D1F\u8377\u8FC7\u4F4E\uFF08conceptCount < 2 \u4E14 factCount < 3\uFF09\uFF0C\u8BF7\u5408\u5E76\u5230\u76F8\u90BB\u5207\u7247
\u6BCF\u4E2A\u5207\u7247\u5FC5\u987B\u80FD\u8BA9\u4E00\u4E2A\u666E\u901A\u6559\u5E08/\u5B66\u751F\u5728 20 \u5206\u949F\u5185\u5B8C\u6210\u7406\u89E3\uFF08\u4E0D\u542B\u7EC3\u4E60\uFF09
\u8F93\u51FA\u5FC5\u987B\u662F\u6709\u6548\u7684\u7EAF JSON\uFF0C\u4E0D\u8981\u5305\u542B\u6CE8\u91CA\u6216\u989D\u5916\u6587\u5B57`;
    const promptMessage = `\u8BF7\u4E3A\u4EE5\u4E0B\u4E66\u7C4D\u8FDB\u884C\u6559\u5B66\u5207\u7247\uFF0C\u4E66\u7C4D\u540D\u79F0\uFF1A"${title}"\u3002

${directoryText}

\u8BF7\u4E25\u683C\u6309\u7167\u4E0A\u8FF0\u76EE\u5F55\u7ED3\u6784\u8FDB\u884C\u5207\u7247\uFF0C\u53EA\u4F7F\u7528\u6211\u63D0\u4F9B\u7684\u4E66\u540D\u548C\u76EE\u5F55\u4FE1\u606F\uFF0C\u4E0D\u8981\u4F7F\u7528\u4F60\u8BAD\u7EC3\u6570\u636E\u4E2D\u7684\u4EFB\u4F55\u5176\u4ED6\u8BFE\u672C\u5185\u5BB9\u3002

\u26A0\uFE0F \u5173\u4E8E coveredChapters \u5B57\u6BB5\u7684\u7279\u522B\u63D0\u9192\uFF1A
1. \u76EE\u5F55\u91C7\u7528\u624B\u98CE\u7434\u5C42\u7EA7\u7ED3\u6784\uFF0C\u4F8B\u5982 Topic 3 \u4E0B\u9762\u53EF\u80FD\u6709 3.1\u30013.2\u30013.3...3.7\uFF0C\u4F46\u53EF\u80FD\u6CA1\u6709 3.8 \u6216 3.9\u3002\u4F60\u5728\u586B\u5199 coveredChapters \u65F6\uFF0C\u5FC5\u987B\u5148\u786E\u8BA4\u76EE\u5F55\u4E2D\u5B9E\u9645\u5B58\u5728\u54EA\u4E9B\u7AE0\u8282\u7F16\u53F7\uFF0C\u53EA\u80FD\u4F7F\u7528\u76EE\u5F55\u4E2D\u771F\u5B9E\u5B58\u5728\u7684\u7AE0\u8282\uFF01
2. \u6CE8\u610F\u591A\u5C42\u7EA7\u7F16\u53F7\u7684\u533A\u522B\uFF1A\u5982\u679C 3.1 \u4E0B\u9762\u6709\u5B50\u7AE0\u8282 3.1.1\u30013.1.2...3.1.5\uFF0C\u4F60\u60F3\u8986\u76D6\u8FD9\u4E9B\u5B50\u7AE0\u8282\u65F6\uFF0CcoveredChapters \u5FC5\u987B\u5199\u6210 "3.1.1-3.1.5"\uFF0C\u7EDD\u5BF9\u4E0D\u80FD\u5199\u6210 "3.1-3.5"\uFF08\u8FD9\u8868\u793A\u7684\u662F 3.1\u30013.2\u30013.3\u30013.4\u30013.5 \u4E94\u4E2A\u540C\u7EA7\u7AE0\u8282\uFF09\uFF01
3. \u586B\u5199\u524D\u8BF7\u5148\u786E\u8BA4\u4F60\u8981\u8986\u76D6\u7684\u7AE0\u8282\u5728\u76EE\u5F55\u4E2D\u7684\u5B8C\u6574\u7F16\u53F7\uFF0C\u7136\u540E\u628A\u5B8C\u6574\u7F16\u53F7\u5199\u8FDB coveredChapters\u3002`;
    const finalSystemInstruction = systemPrompt || systemInstruction;
    let finalPromptMessage;
    if (userPromptTemplate) {
      finalPromptMessage = applyPromptTemplate(userPromptTemplate, {
        title,
        bookTitle: title,
        directoryText
      });
    } else {
      finalPromptMessage = promptMessage;
    }
    console.log("\n\u{1F4DD} ========== PROMPT MESSAGE SENT TO AI ==========");
    console.log("Title used:", title);
    console.log("Directory text length:", directoryText.length);
    console.log("Directory text first 500 chars:", directoryText.substring(0, 500));
    console.log("Directory text last 300 chars:", directoryText.substring(directoryText.length - 300));
    console.log("Full prompt message first 1500 chars:", finalPromptMessage.substring(0, 1500));
    console.log("==========================================\n");
    let outputText;
    const sliceModel = "deepseek-v4-flash";
    console.log(`\u{1F504} [parse-book] Forcing DeepSeek model: ${sliceModel}`);
    outputText = await callDeepSeek(finalPromptMessage, finalSystemInstruction, sliceModel, 16384);
    try {
      const resultObj = parseJsonResponse(outputText);
      if (resultObj && Array.isArray(resultObj.slices)) {
        resultObj.slices = resultObj.slices.map((slice, index) => {
          const fallbackIdx = `${index + 1}.1`;
          return {
            ...slice,
            coveredChapters: cleanCoveredChapters(slice.coveredChapters, fallbackIdx),
            infoDensity: slice.infoDensity || {
              conceptCount: 3,
              factCount: 2,
              abstractLevel: "\u4E2D",
              nestingLevel: "\u4E24\u5C42",
              suggestedMinutes: "10-15",
              rationale: "\u8BE5\u5207\u7247\u6DB5\u76D63-4\u4E2A\u7D27\u5BC6\u76F8\u5173\u7684\u6838\u5FC3\u6982\u5FF5\uFF0C\u4FE1\u606F\u91CF\u9002\u4E2D\uFF0C\u53EF\u572810-15\u5206\u949F\u5185\u5B8C\u6210\u5B66\u4E60\uFF0C\u4E0D\u4F1A\u9020\u6210\u8BA4\u77E5\u8FC7\u8F7D\u3002"
            },
            cohesionDetail: slice.cohesionDetail || {
              cohesionType: "\u65F6\u5E8F\u9012\u8FDB",
              mechanism: "\u8BE5\u5207\u7247\u5185\u7684\u77E5\u8BC6\u70B9\u5728\u903B\u8F91\u4E0A\u9012\u8FDB\u5173\u8054\uFF0C\u56F4\u7ED5\u540C\u4E00\u6559\u5B66\u4E3B\u9898\u7EC4\u7EC7\uFF0C\u5F62\u6210\u5B8C\u6574\u7684\u5B66\u4E60\u5355\u5143\u3002",
              coreQuestion: "\u672C\u5207\u7247\u8981\u56DE\u7B54\u7684\u6838\u5FC3\u95EE\u9898\u662F\u4EC0\u4E48\uFF1F"
            },
            designRationale: slice.designRationale || "\u5B66\u751F\u901A\u8FC7\u672C\u5207\u7247\u5B66\u4E60\u6838\u5FC3\u6982\u5FF5\uFF0C\u7406\u89E3\u77E5\u8BC6\u70B9\u4E4B\u95F4\u7684\u5173\u8054\uFF0C\u5E76\u80FD\u8FD0\u7528\u8FD9\u4E9B\u77E5\u8BC6\u5206\u6790\u548C\u89E3\u51B3\u5B9E\u9645\u95EE\u9898\u3002",
            summary: slice.summary || {
              learnedPoints: ["\u672C\u5207\u7247\u6DB5\u76D6\u7684\u6838\u5FC3\u77E5\u8BC6\u70B9"],
              practicalProblems: ["\u5F53...\u65F6\uFF0C\u4F60\u80FD..."]
            }
          };
        });
      }
      res.json({
        ...resultObj,
        _meta: {
          model: sliceModel,
          provider: "deepseek",
          systemInstruction: finalSystemInstruction,
          userPrompt: finalPromptMessage
        }
      });
    } catch (parseErr) {
      console.error("JSON parsing failed, raw response was:", outputText);
      const blueprint = getHeuristicOrMockBlueprint(title, fullText, directoryStructure);
      res.json({
        ...blueprint,
        _meta: {
          model: sliceModel,
          provider: "deepseek",
          degraded: true,
          fallbackType: "heuristic",
          systemInstruction,
          userPrompt: promptMessage,
          error: "AI JSON\u89E3\u6790\u5931\u8D25\uFF0C\u4F7F\u7528\u542F\u53D1\u5F0Ffallback",
          rawResponse: outputText.substring(0, 2e3)
        }
      });
    }
  } catch (error) {
    console.error("Error splitting chapters via AI:", error);
    try {
      console.warn("\u26A0\uFE0F AI API call failed. Falling back to dynamic directory-based slicing...");
      const blueprint = getHeuristicOrMockBlueprint(
        req.body.title || "\u6807\u51C6\u6559\u6750\u4E2D\u7684\u6838\u5FC3\u8BFE\u9898",
        req.body.fullText || "",
        req.body.directoryStructure || []
      );
      res.json({
        ...blueprint,
        _meta: {
          model: "deepseek-v4-flash",
          provider: "deepseek",
          degraded: true,
          fallbackType: "heuristic",
          systemInstruction: "",
          userPrompt: "",
          error: `AI API\u8C03\u7528\u5931\u8D25: ${error.message}\uFF0C\u4F7F\u7528\u542F\u53D1\u5F0Ffallback`
        }
      });
    } catch (innerErr) {
      res.status(500).json({ error: error.message || "External endpoint processing error" });
    }
  }
});
function getHeuristicOrMockBlueprint(title, fullText, directoryStructure = []) {
  const normTitle = (title || "").toLowerCase();
  if (directoryStructure && directoryStructure.length >= 3) {
    const chapters = directoryStructure.filter((item) => item.type === "chapter");
    const sections = directoryStructure.filter((item) => item.type === "section");
    const itemsToSlice = chapters.length >= 2 ? chapters : directoryStructure;
    let chunkSize2 = 1;
    if (itemsToSlice.length > 18) {
      chunkSize2 = Math.ceil(itemsToSlice.length / 16);
    }
    const matchedSlices2 = [];
    let seqIdx2 = 1;
    for (let i = 0; i < itemsToSlice.length; i += chunkSize2) {
      const chunk = itemsToSlice.slice(i, i + chunkSize2);
      if (chunk.length === 0) continue;
      const firstItem = chunk[0];
      const lastItem = chunk[chunk.length - 1];
      const firstNumMatch = firstItem.title.match(/(\d+(?:\.\d+)?)/);
      const lastNumMatch = lastItem.title.match(/(\d+(?:\.\d+)?)/);
      const firstNum = firstNumMatch ? firstNumMatch[1] : `${seqIdx2}.1`;
      const lastNum = lastNumMatch ? lastNumMatch[1] : firstNum;
      let rawCovered = firstNum === lastNum ? firstNum : `${firstNum}-${lastNum}`;
      const titleParts = chunk.map((c) => {
        const cleanTitle2 = c.title.replace(/^\d+(?:\.\d+)?\s*[-–—.:：、\s]+/, "").trim();
        return cleanTitle2 || c.title;
      });
      const combinedTitle = titleParts.join(" \u4E0E ");
      const cleanTitle = combinedTitle.length > 50 ? combinedTitle.substring(0, 47) + "..." : combinedTitle;
      const combinedSummary = titleParts.join("\uFF0C") + "\u6838\u5FC3\u8003\u70B9\u53CA\u539F\u7406\u8FD0\u7528\u8BBA\u8BC1";
      matchedSlices2.push({
        chapterIndex: String(seqIdx2).padStart(2, "0"),
        title: cleanTitle,
        coveredChapters: cleanCoveredChapters(rawCovered, firstNum),
        summary: combinedSummary
      });
      seqIdx2++;
    }
    const enrichedSlices2 = matchedSlices2.map((slice) => {
      const normLine = slice.title.toLowerCase();
      let gameType = "quiz";
      let gameTitle = `${slice.title}\u6838\u5FC3\u6982\u5FF5\u901A\u5173`;
      if (normLine.includes("\u8BA1\u7B97") || normLine.includes("\u516C\u5F0F") || normLine.includes("\u7269\u7406") || normLine.includes("\u6570\u5B66") || normLine.includes("\u65B9\u7A0B") || normLine.includes("\u91CF")) {
        gameType = "math-quest";
        gameTitle = `${slice.title}\uFF1A\u5B9A\u91CF\u8BA1\u7B97\u4E0E\u6570\u636E\u63A8\u6F14\u8BCA\u65AD`;
      } else if (normLine.includes("\u4EE3\u7801") || normLine.includes("\u7F16\u7A0B") || normLine.includes("\u903B\u8F91") || normLine.includes("\u7B97\u6CD5") || normLine.includes("\u51FD\u6570")) {
        gameType = "coding-puzzle";
        gameTitle = `${slice.title}\uFF1A\u903B\u8F91\u6392\u969C\u4E0E\u7A0B\u5E8F\u9664\u9519\u6311\u6218`;
      } else if (normLine.includes("\u6982\u5FF5") || normLine.includes("\u5206\u7C7B") || normLine.includes("\u5339\u914D") || normLine.includes("\u5BF9\u5E94") || normLine.includes("\u5173\u8054")) {
        gameType = "cross-match";
        gameTitle = `${slice.title}\uFF1A\u6838\u5FC3\u6982\u5FF5\u77E5\u8BC6\u5339\u914D\u8FDE\u7EBF`;
      } else if (normLine.includes("\u6545\u4E8B") || normLine.includes("\u51B3\u7B56") || normLine.includes("\u6289\u62E9") || normLine.includes("\u5267\u60C5") || normLine.includes("\u5386\u53F2")) {
        gameType = "interactive-story";
        gameTitle = `${slice.title}\uFF1A\u60C5\u5883\u5267\u60C5\u4E0E\u56E0\u679C\u6289\u62E9\u5206\u652F`;
      } else {
        gameType = "quiz";
        gameTitle = `${slice.title}\uFF1A\u7EFC\u5408\u63A8\u6F14\u4E0E\u6DF1\u5EA6\u5E94\u7528\u901A\u5173`;
      }
      const gameRules = `\u5C0A\u656C\u7684\u5B66\u5458\uFF0C\u8BF7\u8FDB\u5165\u5173\u4E8E "${slice.title}" \u7684\u4EA4\u4E92\u8BBA\u8BC1\u8BAD\u7EC3\u8231\u3002\u6311\u6218\u89C4\u5219\uFF1A\u5728\u6A21\u62DF\u7684\u5371\u673A\u73AF\u5883\u6216\u6838\u5FC3\u573A\u666F\u4E0B\uFF0C\u901A\u8FC7\u4E00\u7CFB\u5217\u6DF1\u5EA6\u5B66\u79D1\u5224\u65AD\u548C\u60C5\u5883\u51B3\u7B56\uFF0C\u5DE9\u56FA\u60A8\u5728 [${slice.title}] \u4E2D\u6240\u5B66\u7684\u6838\u5FC3\u903B\u8F91\u3002`;
      return {
        chapterIndex: slice.chapterIndex,
        title: slice.title,
        coveredChapters: slice.coveredChapters,
        summary: {
          learnedPoints: [`\u80FD\u7406\u89E3${slice.title}\u7684\u6838\u5FC3\u6982\u5FF5`, `\u80FD\u63CF\u8FF0${slice.title}\u7684\u5173\u952E\u7279\u5F81`, `\u80FD\u8FD0\u7528${slice.title}\u77E5\u8BC6\u89E3\u51B3\u5B9E\u9645\u95EE\u9898`],
          practicalProblems: [`\u5F53\u9047\u5230${slice.title}\u76F8\u5173\u573A\u666F\u65F6\uFF0C\u4F60\u80FD\u8FD0\u7528\u6838\u5FC3\u77E5\u8BC6\u8FDB\u884C\u5206\u6790`, `\u5F53\u9700\u8981\u5E94\u7528${slice.title}\u6982\u5FF5\u65F6\uFF0C\u4F60\u80FD\u505A\u51FA\u6B63\u786E\u51B3\u7B56`]
        },
        gameType,
        gameTitle,
        gameRules,
        duration: "10\u5206\u949F",
        designRationale: `\u901A\u8FC7\u573A\u666F\u5F0F\u4EA4\u4E92\uFF0C\u5C06 [${slice.title}] \u62BD\u8C61\u89C4\u5F8B\u8F6C\u5316\u4E3A\u7D27\u8FEB\u7684\u7CFB\u7EDF\u7EA7\u51B3\u7B56\uFF0C\u5F3A\u5316\u6DF1\u5C42\u5E94\u7528\u8BA4\u77E5\u3002`,
        infoDensity: {
          conceptCount: 3,
          factCount: 2,
          abstractLevel: "\u4E2D",
          nestingLevel: "\u4E24\u5C42",
          suggestedMinutes: "10-15",
          rationale: "\u8BE5\u5207\u7247\u4FE1\u606F\u91CF\u9002\u4E2D\uFF0C\u53EF\u572810-15\u5206\u949F\u5185\u5B8C\u6210\u5B66\u4E60\uFF0C\u4E0D\u4F1A\u9020\u6210\u8BA4\u77E5\u8FC7\u8F7D\u3002"
        },
        cohesionDetail: {
          cohesionType: "\u65F6\u5E8F\u9012\u8FDB",
          mechanism: `\u8BE5\u5207\u7247\u5185\u7684\u77E5\u8BC6\u70B9\u56F4\u7ED5"${slice.title}"\u8FD9\u4E00\u6559\u5B66\u4E3B\u9898\u7EC4\u7EC7\uFF0C\u903B\u8F91\u9012\u8FDB\u5173\u8054\uFF0C\u5F62\u6210\u5B8C\u6574\u5B66\u4E60\u5355\u5143\u3002`,
          coreQuestion: `\u5982\u4F55\u638C\u63E1${slice.title}\u7684\u6838\u5FC3\u77E5\u8BC6\u5E76\u5E94\u7528\u4E8E\u5B9E\u8DF5\uFF1F`
        }
      };
    });
    return {
      bookTitle: (title || "Custom Textbook").endsWith("\u300B") ? title || "Custom Textbook" : `\u300A${title || "Custom Textbook"}\u300B`,
      totalSlices: enrichedSlices2.length,
      slices: enrichedSlices2
    };
  }
  const lines = (fullText || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 3 && l.length < 120);
  const sectionLines = [];
  const sectionRegex = /^(?:[Ss]ection|[Tt]opic|[Cc]hapter|第)?\s*(\d+(?:\.\d+)?)(?:章|节|课)?\s*[:：.\-、\s]+\s*(.*)$/;
  const chineseChapterRegex = /^第\s*([一二三四五六七八九十百0-9]+)\s*[章节部分讲]\s*[:：.\-、\s]*(.*)$/;
  for (const line of lines) {
    if (line.length < 4 || line.length > 120) continue;
    let match = line.match(sectionRegex);
    if (match) {
      const num = match[1];
      const rest = match[2].trim();
      if (rest.length > 2 && rest.length < 90) {
        if (!sectionLines.some((sl) => sl.sectionNum === num || sl.text === rest)) {
          sectionLines.push({ sectionNum: num, text: rest });
        }
      }
    } else {
      match = line.match(chineseChapterRegex);
      if (match) {
        const num = match[1];
        const rest = match[2].trim();
        if (rest.length > 2 && rest.length < 90) {
          if (!sectionLines.some((sl) => sl.sectionNum === num || sl.text === rest)) {
            sectionLines.push({ sectionNum: num, text: rest });
          }
        }
      }
    }
  }
  if (sectionLines.length < 3 && lines.length > 5) {
    const chunkSize2 = Math.max(1, Math.floor(lines.length / 5));
    for (let i = 0; i < 5 && i * chunkSize2 < lines.length; i++) {
      const snippet = lines[i * chunkSize2];
      sectionLines.push({ sectionNum: `1.${i + 1}`, text: snippet.length > 40 ? snippet.substring(0, 37) + "..." : snippet });
    }
  }
  if (sectionLines.length < 3) {
    const rawMock = getMockBlueprint(title);
    return convertOldMockToNewFormat(rawMock);
  }
  const baseBlueprint = getMockBlueprint(title);
  const baseModules = baseBlueprint.modules;
  let chunkSize = 1;
  if (sectionLines.length > 18) {
    chunkSize = Math.ceil(sectionLines.length / 16);
  }
  const matchedSlices = [];
  let seqIdx = 1;
  for (let i = 0; i < sectionLines.length; i += chunkSize) {
    const chunk = sectionLines.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const firstSec = chunk[0];
    const lastSec = chunk[chunk.length - 1];
    let rawCovered = "";
    if (firstSec.sectionNum === lastSec.sectionNum) {
      rawCovered = firstSec.sectionNum;
    } else {
      rawCovered = `${firstSec.sectionNum}-${lastSec.sectionNum}`;
    }
    const combinedTitle = chunk.map((c) => c.text).join(" \u4E0E ");
    const cleanTitle = combinedTitle.length > 50 ? combinedTitle.substring(0, 47) + "..." : combinedTitle;
    const combinedSummary = chunk.map((c) => c.text).join("\uFF0C") + "\u6838\u5FC3\u8003\u70B9\u53CA\u539F\u7406\u8FD0\u7528\u8BBA\u8BC1";
    matchedSlices.push({
      chapterIndex: String(seqIdx).padStart(2, "0"),
      title: cleanTitle,
      coveredChapters: cleanCoveredChapters(rawCovered, firstSec.sectionNum),
      summary: combinedSummary
    });
    seqIdx++;
  }
  const enrichedSlices = matchedSlices.map((slice, i) => {
    const templateMod = baseModules[i % baseModules.length];
    const normLine = slice.title.toLowerCase();
    let gameType = "quiz";
    let gameTitle = `${slice.title}\u6838\u5FC3\u6982\u5FF5\u901A\u5173`;
    if (normLine.includes("\u8BA1\u7B97") || normLine.includes("\u516C\u5F0F") || normLine.includes("\u6570") || normLine.includes("\u7269\u7406") || normLine.includes("\u6570\u5B66") || normLine.includes("\u65B9\u7A0B") || normLine.includes("\u91CF")) {
      gameType = "math-quest";
      gameTitle = `${slice.title}\uFF1A\u5B9A\u91CF\u8BA1\u7B97\u4E0E\u6570\u636E\u63A8\u6F14\u8BCA\u65AD`;
    } else if (normLine.includes("\u4EE3\u7801") || normLine.includes("\u7F16\u7A0B") || normLine.includes("\u903B\u8F91") || normLine.includes("\u7B97\u6CD5") || normLine.includes("\u51FD\u6570") || normLine.includes("\u811A\u672C") || normLine.includes("\u6E90") || normLine.includes("\u7A0B\u5E8F")) {
      gameType = "coding-puzzle";
      gameTitle = `${slice.title}\uFF1A\u903B\u8F91\u6392\u969C\u4E0E\u7A0B\u5E8F\u9664\u9519\u6311\u6218`;
    } else if (normLine.includes("\u6982\u5FF5") || normLine.includes("\u5206\u7C7B") || normLine.includes("\u5339\u914D") || normLine.includes("\u5BF9\u5E94") || normLine.includes("\u5173\u8054")) {
      gameType = "cross-match";
      gameTitle = `${slice.title}\uFF1A\u6838\u5FC3\u6982\u5FF5\u77E5\u8BC6\u5339\u914D\u8FDE\u7EBF`;
    } else if (normLine.includes("\u6545\u4E8B") || normLine.includes("\u51B3\u7B56") || normLine.includes("\u9009\u62E9") || normLine.includes("\u6289\u62E9") || normLine.includes("\u5267\u60C5") || normLine.includes("\u5386\u53F2")) {
      gameType = "interactive-story";
      gameTitle = `${slice.title}\uFF1A\u60C5\u5883\u5267\u60C5\u4E0E\u56E0\u679C\u6289\u62E9\u5206\u652F`;
    } else {
      gameType = "quiz";
      gameTitle = `${slice.title}\uFF1A\u7EFC\u5408\u63A8\u6F14\u4E0E\u6DF1\u5EA6\u5E94\u7528\u901A\u5173`;
    }
    const gameRules = `\u5C0A\u656C\u7684\u5B66\u5458\uFF0C\u8BF7\u8FDB\u5165\u5173\u4E8E \u201C${slice.title}\u201D \u7684\u4EA4\u4E92\u8BBA\u8BC1\u8BAD\u7EC3\u8231\u3002\u6311\u6218\u89C4\u5219\uFF1A\u5728\u6A21\u62DF\u7684\u5371\u673A\u73AF\u5883\u6216\u6838\u5FC3\u573A\u666F\u4E0B\uFF0C\u901A\u8FC7\u4E00\u7CFB\u5217\u6DF1\u5EA6\u5B66\u79D1\u5224\u65AD\u548C\u60C5\u5883\u51B3\u7B56\uFF0C\u5DE9\u56FA\u60A8\u5728 [${slice.title}] \u4E2D\u6240\u5B66\u7684\u6838\u5FC3\u903B\u8F91\u3002`;
    return {
      chapterIndex: slice.chapterIndex,
      title: slice.title,
      coveredChapters: slice.coveredChapters,
      summary: `${slice.title}\u76F8\u5173\u7684\u6838\u5FC3\u6982\u5FF5\u7F51\u7EDC\u4E0E\u5B9E\u8DF5\u8003\u70B9`,
      gameType,
      gameTitle,
      gameRules,
      duration: "10\u5206\u949F",
      designRationale: `\u901A\u8FC7\u573A\u666F\u5F0F\u4EA4\u4E92\uFF0C\u5C06 [${slice.title}] \u62BD\u8C61\u89C4\u5F8B\u8F6C\u5316\u4E3A\u7D27\u8FEB\u7684\u7CFB\u7EDF\u7EA7\u51B3\u7B56\uFF0C\u5F3A\u5316\u6DF1\u5C42\u5E94\u7528\u8BA4\u77E5\u3002`,
      infoDensity: "\u7ECF\u8FC7\u4FE1\u606F\u5BC6\u5EA6\u88C1\u5207\uFF0C\u672C\u5355\u5143\u6838\u5FC3\u5B66\u4E60\u8D1F\u8377\u5DF2\u88AB\u7CBE\u7B80\u63A7\u5236\u4E3A 3 \u4E2A\u5173\u952E\u7EA7\u5DEE\uFF0C\u786E\u4FDD\u4E0D\u4EA7\u751F\u8BA4\u77E5\u8FC7\u5EA6\u75B2\u52B3\u3002",
      cohesionDetail: `\u672C\u5207\u7247\u7684\u5173\u952E\u77E5\u8BC6\u56E0\u5B50\u5728\u7ED3\u6784\u4E0A\u5177\u6709\u6781\u5F3A\u7684\u7269\u7406\u56E0\u679C or \u903B\u8F91\u94FE\u6761\u4F9D\u8D56\u3002\u8BBE\u8BA1\u7EDF\u4E00\u6311\u6218\u80FD\u6781\u5927\u51F8\u663E\u8FD9\u4E00\u5185\u805A\u7ED3\u6784\u3002`
    };
  });
  return {
    bookTitle: (title || "Custom Textbook").endsWith("\u300B") ? title || "Custom Textbook" : `\u300A${title || "Custom Textbook"}\u300B`,
    totalSlices: enrichedSlices.length,
    slices: enrichedSlices
  };
}
app.post("/api/generate-script", async (req, res) => {
  try {
    let {
      bookTitle,
      chapterTitle,
      chapterIndex,
      summary,
      infoDensity,
      cohesionDetail,
      designRationale,
      extractedContent,
      systemPrompt,
      userPromptTemplate
    } = req.body;
    if (!chapterTitle) {
      return res.status(400).json({ error: "Missing required chapter metadata (chapterTitle)." });
    }
    const systemInstruction = `\u4F60\u662F\u4E00\u540D"\u6559\u5B66\u6A21\u62DF\u4EA7\u54C1\u8BBE\u8BA1\u5E08 + \u4E92\u52A8\u5B66\u4E60\u811A\u672C\u67B6\u6784\u5E08"\u3002

\u4F60\u7684\u4EFB\u52A1\u4E0D\u662F\u751F\u6210 quiz\u3001\u9009\u62E9\u9898\u3001\u5224\u65AD\u9898\u3001\u586B\u7A7A\u9898\u3001\u9898\u5E93\u3001\u5267\u60C5\u95EE\u7B54\u6216\u6362\u76AE\u95EF\u5173\u3002
\u4F60\u7684\u4EFB\u52A1\u662F\u628A\u4E00\u4E2A\u6559\u5B66\u5207\u7247\u8F6C\u5316\u4E3A\u4E00\u4EFD\u53EF\u4EA4\u7ED9 AI coding agent \u5B9E\u73B0\u7684"\u6C89\u6D78\u5F0F\u3001\u95EE\u9898\u9A71\u52A8\u7684\u4E92\u52A8\u6A21\u62DF\u5668\u751F\u6210\u811A\u672C"\u3002

\u8FD9\u4EFD\u811A\u672C\u5E94\u8BE5\u4E13\u6CE8\u63CF\u8FF0\u529F\u80FD\u3001\u4EA4\u4E92\u548C\u7528\u6237\u4F53\u9A8C\uFF08UX\uFF09\uFF0C\u4E0D\u8981\u6307\u5B9A\u4EFB\u4F55\u89C6\u89C9\u6837\u5F0F\uFF08\u989C\u8272\u3001\u5B57\u4F53\u3001\u5E03\u5C40\u3001\u52A8\u753B\u7B49\uFF09\u3002\u89C6\u89C9\u8BBE\u8BA1\u7531\u540E\u7EED\u7684 AI coding agent \u8D1F\u8D23\u3002

\u6838\u5FC3\u539F\u5219\uFF1A
1. \u6BCF\u4E2A\u6A21\u62DF\u5FC5\u987B\u56F4\u7ED5\u4E00\u4E2A\u7EFC\u5408\u95EE\u9898\u573A\u666F\u3002\u5B66\u751F\u8FDB\u5165\u5177\u4F53\u60C5\u5883\uFF0C\u626E\u6F14\u5177\u4F53\u89D2\u8272\uFF0C\u9762\u5BF9\u5FC5\u987B\u4F7F\u7528\u672C\u5207\u7247\u77E5\u8BC6\u624D\u80FD\u89E3\u51B3\u7684\u4EFB\u52A1\u3002
2. \u4E92\u52A8\u5FC5\u987B\u662F"\u5E94\u7528\u77E5\u8BC6\u5E72\u9884\u573A\u666F"\uFF0C\u4E0D\u662F"\u56DE\u5FC6\u77E5\u8BC6\u56DE\u7B54\u95EE\u9898"\u3002\u5B66\u751F\u5E94\u89C2\u5BDF\u573A\u666F\u3001\u8C03\u6574\u53D8\u91CF\u3001\u9009\u62E9\u7B56\u7565\u3001\u5B89\u6392\u6B65\u9AA4\u3001\u8BCA\u65AD\u539F\u56E0\u3001\u5206\u914D\u8D44\u6E90\u3001\u9884\u6D4B\u540E\u679C\u6216\u4F18\u5316\u65B9\u6848\u3002
3. \u77E5\u8BC6\u70B9\u5FC5\u987B\u53D8\u6210\u573A\u666F\u673A\u5236\u3002\u5207\u7247\u4E2D\u7684\u6982\u5FF5\u3001\u5173\u7CFB\u3001\u6D41\u7A0B\u3001\u5224\u65AD\u6807\u51C6\u5FC5\u987B\u6620\u5C04\u4E3A\u53EF\u89C2\u5BDF\u5BF9\u8C61\u3001\u72B6\u6001\u53D8\u91CF\u3001\u7528\u6237\u64CD\u4F5C\u3001\u53CD\u9988\u89C4\u5219\u3001\u6210\u529F/\u5931\u8D25\u6761\u4EF6\u3002
4. \u53CD\u9988\u5FC5\u987B\u4F53\u73B0\u56E0\u679C\u3002\u6BCF\u6B21\u64CD\u4F5C\u540E\u7684\u53CD\u9988\u8981\u8BF4\u660E\u573A\u666F\u53D1\u751F\u4E86\u4EC0\u4E48\u53D8\u5316\u3001\u4E3A\u4EC0\u4E48\u4F1A\u8FD9\u6837\u3001\u5BF9\u5E94\u6559\u6750\u4E2D\u7684\u54EA\u4E2A\u673A\u5236\u3001\u4E0B\u4E00\u6B65\u5E94\u5982\u4F55\u8C03\u6574\u3002
5. \u4E0D\u540C\u5B66\u79D1\u5E94\u751F\u6210\u4E0D\u540C\u6A21\u62DF\u5F62\u6001\uFF0C\u4F8B\u5982\u5E94\u6025\u5904\u7F6E\u3001\u8BFE\u5802/\u89D2\u8272\u5B9E\u8DF5\u3001\u53D8\u91CF\u5B9E\u9A8C\u5BA4\u3001\u8BCA\u65AD\u51B3\u7B56\u3001\u7CFB\u7EDF\u4F18\u5316\u3001\u6D41\u7A0B\u642D\u5EFA\u3001\u60C5\u5883\u63A8\u7406\u3001\u8BC1\u636E\u7814\u5224\u7B49\u3002\u4E0D\u8981\u5957\u7528\u56FA\u5B9A\u73A9\u6CD5\u6A21\u677F\u3002

\u8F93\u51FA\u8981\u6C42\uFF1A
- \u4F7F\u7528\u4E2D\u6587\u3002
- \u8F93\u51FA\u7ED3\u6784\u5316 Markdown\uFF0C\u4E0D\u8981\u8F93\u51FA JSON\uFF0C\u4E0D\u8981\u8F93\u51FA\u4EE3\u7801\u3002
- \u8FD9\u4EFD Markdown \u5C06\u88AB AI coding agent \u76F4\u63A5\u7528\u6765\u751F\u6210\u7F51\u9875\u5E94\u7528\uFF0C\u6240\u4EE5\u5FC5\u987B\u5177\u4F53\u3001\u53EF\u5B9E\u73B0\u3001\u53EF\u4EA4\u4E92\u3002
- \u4E0D\u8981\u6307\u5B9A\u4EFB\u4F55\u89C6\u89C9\u6837\u5F0F\uFF08\u989C\u8272\u3001\u5B57\u4F53\u3001\u5E03\u5C40\u3001\u52A8\u753B\u3001\u56FE\u6807\u7B49\uFF09\uFF0C\u53EA\u63CF\u8FF0\u529F\u80FD\u3001\u4EA4\u4E92\u903B\u8F91\u548C\u7528\u6237\u4F53\u9A8C\u3002
- \u5FC5\u987B\u5305\u542B\u6BCF\u4E2A\u6B65\u9AA4\u7684\u4EA4\u4E92\u573A\u666F\u3001\u7528\u6237\u64CD\u4F5C\u3001\u4EA4\u4E92\u7ED3\u679C\u3001\u5173\u8054\u77E5\u8BC6\u70B9\u3002

\u7981\u6B62\uFF1A
- "\u8BF7\u9009\u62E9\u6B63\u786E\u7B54\u6848"
- A/B/C/D \u7B54\u9898\u5361
- \u5224\u65AD\u9898/\u586B\u7A7A\u9898/\u5355\u7EAF\u95EE\u7B54
- \u53EA\u6709\u5267\u60C5\uFF0C\u6CA1\u6709\u53EF\u64CD\u4F5C\u5BF9\u8C61\u6216\u72B6\u6001\u53D8\u5316
- \u53EA\u6709\u8BB2\u89E3\uFF0C\u6CA1\u6709\u6A21\u62DF\u4EFB\u52A1
- \u6BCF\u4E2A\u9636\u6BB5\u53EA\u662F\u4E00\u4E2A quiz question
- \u6307\u5B9A\u989C\u8272\u3001\u5B57\u4F53\u3001\u5E03\u5C40\u3001\u52A8\u753B\u7B49\u89C6\u89C9\u6837\u5F0F`;
    const promptText = `\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u6559\u5B66\u5207\u7247\uFF0C\u751F\u6210\u4E00\u4EFD\u201C\u53EF\u4EA4\u7ED9 AI coding \u5B9E\u73B0\u7684\u6C89\u6D78\u5F0F\u5B66\u4E60\u6A21\u62DF\u5668\u811A\u672C\u201D\u3002

\u6559\u6750\u540D\u79F0\uFF1A
${bookTitle || "Textbook"}

\u6559\u5B66\u5207\u7247\uFF1A
${chapterIndex || ""} - ${chapterTitle}

\u5207\u7247\u5B66\u4E60\u76EE\u6807\uFF1A
${typeof summary === "string" ? summary : JSON.stringify(summary, null, 2)}

\u4FE1\u606F\u5BC6\u5EA6\u4E0E\u77E5\u8BC6\u5185\u805A\u5206\u6790\uFF1A
${typeof infoDensity === "string" ? infoDensity : JSON.stringify(infoDensity || {}, null, 2)}
${typeof cohesionDetail === "string" ? cohesionDetail : JSON.stringify(cohesionDetail || {}, null, 2)}

\u6559\u5B66\u8BBE\u8BA1\u7406\u7531\uFF1A
${designRationale || "\u672A\u63D0\u4F9B"}

\u6559\u6750\u539F\u6587\uFF1A
${(extractedContent || "General academic curriculum rules relative to " + chapterTitle).substring(0, 8e3)}

\u8BF7\u8F93\u51FA\u4EE5\u4E0B5\u4E2A\u90E8\u5206\u7684\u7ED3\u6784\u5316 Markdown\uFF1A

# 1. \u6559\u5B66\u5207\u7247\u7406\u89E3
- **\u6838\u5FC3\u77E5\u8BC6\u70B9**\uFF1A\u5217\u51FA\u672C\u5207\u7247\u7684\u5173\u952E\u6982\u5FF5\u3001\u539F\u7406\u3001\u6D41\u7A0B\u6216\u5224\u65AD\u6807\u51C6
- **\u7EFC\u5408\u5B9E\u8DF5\u60C5\u666F**\uFF1A\u8FD9\u4E9B\u77E5\u8BC6\u70B9\u7EC4\u7EC7\u5728\u4E00\u8D77\uFF0C\u662F\u7528\u6765\u7406\u89E3\u3001\u9762\u5BF9\u3001\u89E3\u51B3\u4EC0\u4E48\u6837\u7684\u7EFC\u5408\u6027\u5927\u95EE\u9898/\u5927\u60C5\u666F\u7684\uFF1F\u63CF\u8FF0\u4E00\u4E2A\u8D2F\u7A7F\u6574\u4E2A\u6A21\u62DF\u7684\u5927\u573A\u666F

# 2. \u6574\u4F53\u6D41\u7A0B\u7B80\u8981\u8BBE\u8BA1
- \u63CF\u8FF0\u6574\u4E2A\u6A21\u62DF\u7684\u903B\u8F91\u6D41\u7A0B\u548C\u60C5\u666F\u63A8\u8FDB
- \u6BCF\u4E2A\u73AF\u8282\u5982\u4F55\u628A\u5BF9\u5E94\u7684\u77E5\u8BC6\u70B9\u878D\u5165\u5B9E\u8DF5\u6848\u4F8B
- \u73AF\u8282\u4E4B\u95F4\u7684\u6545\u4E8B\u8854\u63A5\u5982\u4F55\u4FDD\u6301\u60C5\u666F\u7684\u5408\u7406\u6027\u3001\u8FDE\u8D2F\u6027\u3001\u6D41\u7545\u6027

# 3. \u6A21\u62DF\u811A\u672C\u4E92\u52A8\u6D41\u7A0B\u8BBE\u8BA1
\u8F93\u51FA\u5206\u6B65\u9AA4\u7684\u8BE6\u7EC6\u6D41\u7A0B\uFF0C\u6BCF\u4E2A\u6B65\u9AA4\u5305\u542B\uFF1A
- **\u6B65\u9AA4\u7F16\u53F7**\uFF1A\u5982"\u7B2C\u4E00\u6B65"\u3001"\u7B2C\u4E8C\u6B65"
- **\u4EA4\u4E92\u573A\u666F\u63CF\u8FF0**\uFF1A\u5728\u5927\u60C5\u666F\u4E2D\u9047\u5230\u4E86\u4EC0\u4E48\u5C0F\u6D41\u7A0B\u8282\u70B9\uFF1F\u5F53\u524D\u573A\u666F\u662F\u4EC0\u4E48\uFF1F\u9700\u8981\u7528\u6237\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\uFF1F
- **\u7528\u6237\u4EA4\u4E92\u65B9\u5F0F**\uFF1A\u7528\u6237\u5177\u4F53\u600E\u4E48\u64CD\u4F5C\uFF1F\uFF08\u5982\u62D6\u62FD\u6392\u5E8F\u3001\u8C03\u6574\u6ED1\u5757\u3001\u9009\u62E9\u7B56\u7565\u3001\u5206\u914D\u8D44\u6E90\u3001\u8BCA\u65AD\u539F\u56E0\u3001\u9884\u6D4B\u540E\u679C\u7B49\uFF09
- **\u4EA4\u4E92\u7ED3\u679C\u53CD\u9988**\uFF1A\u6BCF\u79CD\u64CD\u4F5C\u4F1A\u8FD4\u56DE\u4EC0\u4E48\u7ED3\u679C\uFF1F\u573A\u666F\u5982\u4F55\u53D8\u5316\uFF1F\u4E3A\u4EC0\u4E48\u8FD9\u6837\u53D8\u5316\uFF1F
- **\u5173\u8054\u77E5\u8BC6\u70B9**\uFF1A\u8FD9\u4E2A\u6B65\u9AA4\u5BF9\u5E94\u6559\u5B66\u5207\u7247\u4E2D\u7684\u54EA\u4E9B\u77E5\u8BC6\u70B9\uFF1F

# 4. \u603B\u7ED3 Feedback \u8BBE\u8BA1
- \u57FA\u4E8E\u7528\u6237\u5728\u6240\u6709\u6B65\u9AA4\u4E2D\u7684\u6574\u4F53\u4E92\u52A8\u8FC7\u7A0B\uFF0C\u6700\u540E\u7ED9\u51FA\u4EC0\u4E48\u6837\u7684\u603B\u7ED3\u6027\u53CD\u9988\uFF1F
- \u53CD\u9988\u5E94\u6DB5\u76D6\u54EA\u4E9B\u7EF4\u5EA6\uFF1F\uFF08\u5982\u77E5\u8BC6\u5E94\u7528\u6B63\u786E\u6027\u3001\u51B3\u7B56\u5408\u7406\u6027\u3001\u9057\u6F0F\u7684\u5173\u952E\u70B9\u7B49\uFF09
- \u5982\u4F55\u6839\u636E\u7528\u6237\u7684\u8868\u73B0\u7ED9\u51FA\u5DEE\u5F02\u5316\u7684\u53CD\u9988\uFF1F

# 5. \u7279\u6B8A\u8981\u6C42\u8BF4\u660E
- \u8BED\u8A00\u8981\u6C42\uFF08\u5982\u4F7F\u7528\u4E2D\u6587/\u82F1\u6587\uFF09
- \u4E0D\u8981\u51FA\u73B0\u8BFE\u540E\u53CD\u601D\u586B\u7A7A\u7B49\u4E0E\u6A21\u62DF\u65E0\u5173\u7684\u5185\u5BB9
- \u5176\u4ED6\u9700\u8981\u6CE8\u610F\u7684\u4E8B\u9879

\u8BF7\u786E\u4FDD\u5B83\u4E0D\u662F\u9898\u5E93\uFF0C\u800C\u662F\u4E00\u4E2A\u5B66\u751F\u53EF\u4EE5\u901A\u8FC7\u89C2\u5BDF\u3001\u5E72\u9884\u3001\u9A8C\u8BC1\u3001\u4FEE\u6B63\u6765\u5B8C\u6210\u7684\u4E92\u52A8\u6A21\u62DF\u5668\u3002`;
    const finalSystemInstruction = systemPrompt || systemInstruction;
    let finalPromptText;
    if (userPromptTemplate) {
      finalPromptText = applyPromptTemplate(userPromptTemplate, {
        bookTitle: bookTitle || "Textbook",
        chapterTitle: chapterTitle || "",
        chapterIndex: String(chapterIndex || ""),
        summary: typeof summary === "string" ? summary : JSON.stringify(summary || {}, null, 2),
        infoDensity: typeof infoDensity === "string" ? infoDensity : JSON.stringify(infoDensity || {}, null, 2),
        cohesionDetail: typeof cohesionDetail === "string" ? cohesionDetail : JSON.stringify(cohesionDetail || {}, null, 2),
        designRationale: designRationale || "\u672A\u63D0\u4F9B",
        extractedContent: (extractedContent || "General academic curriculum rules relative to " + chapterTitle).substring(0, 8e3)
      });
    } else {
      finalPromptText = promptText;
    }
    let outputText;
    if (AI_PROVIDER === "deepseek") {
      console.log(`\u{1F504} Using DeepSeek (deepseek-v4-flash) for scenario script generation...`);
      outputText = await callDeepSeek(finalPromptText, finalSystemInstruction, "deepseek-v4-flash", 6144, false);
    } else if (AI_PROVIDER === "dashscope") {
      console.log("\u{1F504} Using DashScope (\u901A\u4E49\u5343\u95EE) for scenario script generation...");
      outputText = await callDashScope(finalPromptText, finalSystemInstruction, "", 6144, false);
    } else if (AI_PROVIDER === "ollama") {
      console.log("\u{1F504} Using Ollama for scenario script generation...");
      outputText = await callOllama(finalPromptText, finalSystemInstruction, "", false);
    } else if (AI_PROVIDER === "huggingface") {
      console.log("\u{1F504} Using Hugging Face for scenario script generation...");
      outputText = await callHuggingFace(finalPromptText, finalSystemInstruction);
    } else if (AI_PROVIDER === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      if (!key || key.trim() === "" || key.trim() === "your-actual-gemini-api-key-here") {
        return res.status(401).json({
          error: "GEMINI_API_KEY \u672A\u914D\u7F6E",
          message: "\u8BF7\u5728 .env \u6587\u4EF6\u4E2D\u8BBE\u7F6E\u6709\u6548\u7684 Google Gemini API Key\uFF0C\u6216\u8005\u8BBE\u7F6E AI_PROVIDER=dashscope \u4F7F\u7528\u963F\u91CC\u4E91\u901A\u4E49\u5343\u95EE\u3002",
          detail: "\u5F53\u524D\u65E0\u6CD5\u8C03\u7528 AI \u6A21\u578B\u751F\u6210\u573A\u666F\u811A\u672C\uFF0C\u8BF7\u5148\u914D\u7F6E API Key \u6216\u5207\u6362\u5230 DashScope\u3002"
        });
      }
      const ai = getGenAI();
      console.log("\u{1F504} Using Gemini for scenario script generation...");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalPromptText,
        config: {
          systemInstruction: finalSystemInstruction
        }
      });
      outputText = response.text;
      if (!outputText) {
        throw new Error("No output generated from Gemini model.");
      }
    }
    res.json({
      markdown: outputText.trim(),
      _meta: {
        model: AI_PROVIDER === "deepseek" ? process.env.DEEPSEEK_SCRIPT_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat" : AI_PROVIDER,
        provider: AI_PROVIDER,
        systemInstruction: finalSystemInstruction,
        userPrompt: finalPromptText
      }
    });
  } catch (error) {
    console.error("Error generating scenario script:", error);
    res.status(500).json({ error: error.message || "External endpoint processing error" });
  }
});
app.post("/api/generate-app-code", async (req, res) => {
  try {
    const { bookTitle, chapterTitle, coveredChapters, scriptMarkdown, model, systemPrompt, userPromptTemplate } = req.body;
    if (!scriptMarkdown || typeof scriptMarkdown !== "string") {
      return res.status(400).json({ error: "Missing scriptMarkdown." });
    }
    const defaultSystemInstruction = `\u4F60\u662F\u4E00\u4E2A\u9876\u7EA7\u7684\u5168\u6808\u5DE5\u7A0B\u5E08\uFF0C\u5FC5\u987B\u8F93\u51FA\u53EF\u76F4\u63A5\u8FD0\u884C\u7684\u5B8C\u6574\u4EE3\u7801\uFF0C\u6CE8\u91CDUI\u7F8E\u611F\u548C\u4EA4\u4E92\u7EC6\u8282\uFF0C\u5982\u679C\u4EE3\u7801\u88AB\u622A\u65AD\u8981\u4E3B\u52A8\u91CD\u8BD5\u3002\u53EA\u9700\u8981\u8F93\u51FA\u4EE3\u7801\uFF0C\u4E0D\u9700\u8981\u89E3\u91CA\u6587\u5B57\u3002`;
    const defaultPromptText = `\u6839\u636E\u4EE5\u4E0B\u8981\u6C42\uFF0C\u5E2E\u6211\u5B9E\u73B0\u4E00\u4E2Aweb\u7AEF\u7684html\u3002\u8FD9\u662F\u4E00\u4E2A\u573A\u666F\u6A21\u62DF\u6E38\u620F\uFF0C\u8BA9\u5B66\u751F\u901A\u8FC7\u8FD9\u4E2A\u6A21\u62DF\u6E38\u620F\uFF0C\u5C06\u6240\u5B66\u7684\u77E5\u8BC6\u8FDB\u884C\u5E94\u7528\uFF0C\u5B66\u4EE5\u81F4\u7528\u3002\u6211\u5E0C\u671B\u6574\u4F53\u4E92\u52A8\u662F\u6C89\u6D78\u5F0F\u7684\uFF0C\u5C31\u662F\u6BCF\u4E2A\u64CD\u4F5C\u90FD\u6709\u4E30\u5BCC\u7684\u53EF\u89C6\u5316\u7684\u573A\u666F\u753B\u9762\u3002\u5E76\u4E14\u6211\u5E0C\u671B\u4E0D\u8981\u6240\u6709\u5185\u5BB9\u90FD\u662F\u5C40\u9650\u5728\u4E00\u4E2A\u9875\u9762\u4E0A\u7684\uFF0C\u800C\u662F\u4E00\u4E2A\u884C\u4E3A\u53EF\u80FD\u5C31\u662F\u5728\u4E00\u4E2A\u9875\u9762\u4E0A\u5B8C\u6210\u3002\u5B8C\u6210\u8FD9\u4E2A\u884C\u4E3A\u53EF\u80FD\u5C31\u9700\u8981\u8FDB\u5165\u5230\u65B0\u573A\u666F\u4E86\u3002

\u4EE5\u4E0B\u662F\u8BE5\u7AE0\u8282\u7684\u4E92\u52A8\u811A\u672C\u5185\u5BB9\uFF0C\u8BF7\u6839\u636E\u811A\u672C\u4E2D\u7684\u573A\u666F\u3001\u89D2\u8272\u3001\u4EA4\u4E92\u6D41\u7A0B\u3001\u53CD\u9988\u89C4\u5219\u7B49\u6765\u5B9E\u73B0HTML\u573A\u666F\u6A21\u62DF\u6E38\u620F\uFF1A

${scriptMarkdown}`;
    const systemInstruction = systemPrompt || defaultSystemInstruction;
    const promptText = userPromptTemplate ? applyPromptTemplate(userPromptTemplate, {
      scriptMarkdown,
      bookTitle: bookTitle || "",
      chapterTitle: chapterTitle || ""
    }) : defaultPromptText;
    let outputText;
    const selectedModel = model || "deepseek-v4-flash";
    if (selectedModel === "qwen3.7-plus") {
      outputText = await callDashScope(promptText, systemInstruction, "qwen3.7-plus", 32e3, false);
    } else {
      outputText = await callDeepSeek(promptText, systemInstruction, "deepseek-v4-flash", 32e3, false);
    }
    let code = outputText.trim();
    code = code.replace(/^```(?:html|HTML)?\s*\n?/i, "");
    code = code.replace(/\n?\s*```$/i, "");
    code = code.replace(/```(?:html|HTML)?\s*\n?/gi, "");
    code = code.trim();
    res.json({ code, model: selectedModel });
  } catch (error) {
    console.error("Error generating app code:", error);
    res.status(500).json({ error: error.message || "Failed to generate app code" });
  }
});
app.post("/api/recommend-scenario", async (req, res) => {
  try {
    const { chapterTitle, summary, gameType, designRationale } = req.body;
    if (!chapterTitle || !gameType) {
      return res.status(400).json({ error: "Missing required chapter meta (chapterTitle, gameType)." });
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      let gameTitle = "\u5FAE\u7F29\u5B87\u5B99\uFF1A\u672A\u77E5\u5E73\u8861\u6001\u8C03\u63A7";
      let gameRules = "\u5F53\u524D\u7269\u7406\u7CFB\u7EDF\u5904\u4E8E\u7D27\u6025\u6CC4\u9732\u4E34\u754C\u72B6\u6001\u3002\u4F60\u5C06\u626E\u6F14\u7279\u9063\u5371\u673A\u5904\u7F6E\u4E13\u5458\uFF0C\u5FC5\u987B\u4F9D\u9760\u5BF9\u672C\u5355\u5143\u77E5\u8BC6\u70B9\u7684\u7CFB\u7EDF\u5185\u5316\uFF0C\u5B9E\u65F6\u8BCA\u65AD\u5404\u7C7B\u504F\u5DEE\u53D8\u91CF\uFF0C\u5E73\u8861\u4E0D\u7A33\u5B9A\u6027\uFF0C\u505A\u51FA\u660E\u667A\u7684\u5173\u952E\u6027\u51B3\u7B56\u4EE5\u62EF\u6551\u8BBE\u65BD\u3002";
      if (gameType === "interactive-story") {
        gameTitle = `\u300A${chapterTitle}\uFF1A\u5371\u673A\u51B3\u7B56\u98CE\u66B4\u300B`;
        gameRules = `\u4F60\u88AB\u7D27\u6025\u6295\u9001\u5230\u4E00\u5904\u9762\u4E34\u89E3\u4F53\u5371\u673A\u7684\u79D1\u5B66\u57FA\u7AD9\uFF01\u5F53\u524D\u7684\u6838\u5FC3\u6311\u6218\u662F\uFF1A\u5982\u4F55\u5229\u7528 [${summary}] \u7684\u76F8\u4E92\u4F5C\u7528\u94FE\u6761\u5236\u6B62\u707E\u96BE\u3002\u4F60\u5FC5\u987B\u5728\u6570\u4E2A\u6D89\u53CA\u751F\u6B7B\u6743\u8861\u548C\u903B\u8F91\u94FE\u51B2\u7A81\u7684\u9009\u9879\u4E2D\u505A\u51FA\u6838\u5FC3\u9009\u62E9\uFF0C\u6BCF\u4E00\u6B65\u90FD\u4F1A\u8BF1\u53D1\u7269\u7406\u7CFB\u7EDF\u7684\u8FDE\u9501\u5D29\u6E83\u6216\u6551\u8D4E\u3002`;
      } else if (gameType === "quiz") {
        gameTitle = `\u300A${chapterTitle}\uFF1A\u591A\u7EF4\u8BCA\u65AD\u5927\u5BC6\u5BA4\u300B`;
        gameRules = `\u4F60\u88AB\u9501\u5728\u4E86\u4E00\u53F0\u66B4\u8D70\u7684\u4EBA\u9020\u53CD\u5E94\u8231\u4E2D\uFF01\u7CFB\u7EDF\u4E3B\u63A7\u8111\u629B\u51FA\u4E86\u4E00\u7CFB\u5217\u5173\u4E8E [${summary}] \u7684\u6DF1\u5EA6\u53CD\u76F4\u89C9\u73B0\u8C61\u8BCA\u65AD\u3002\u4F60\u5FC5\u987B\u62C5\u4EFB\u903B\u8F91\u6392\u969C\u4E13\u5BB6\uFF0C\u5728\u9650\u65F6\u5185\u8BCA\u65AD\u5E76\u8BBA\u8BC1\u6B63\u786E\u7684\u6210\u56E0\u4EE5\u89E3\u9501\u6C14\u95F8\u5B89\u5168\u534F\u8BAE\u3002`;
      } else if (gameType === "coding-puzzle") {
        gameTitle = `\u300A${chapterTitle}\uFF1A\u903B\u8F91\u91CD\u6784\u4E0E\u6570\u636E\u963B\u65AD\u884C\u52A8\u300B`;
        gameRules = `\u53D7\u963B\u4E8E [${summary}] \u7269\u7406\u6570\u636E\u6D41\u7684\u5F02\u5E38\u6EA2\u51FA\uFF0C\u63A7\u5236\u4E2D\u67A2\u4EE3\u7801\u5927\u9762\u79EF\u762B\u75EA\u3002\u4F5C\u4E3A\u903B\u8F91\u67B6\u6784\u5E08\uFF0C\u4F60\u9700\u8981\u8BCA\u65AD\u6EA2\u51FA\u6F0F\u6D1E\uFF0C\u91CD\u7F6E\u7269\u7406\u5B88\u6052\u5B9A\u5F8B\u7684\u6570\u636E\u7ED3\u6784\uFF0C\u4FEE\u8865\u5931\u8861\u7684\u4EE3\u7801\u63A7\u5236\u5F8B\uFF0C\u5728\u6EA2\u51FA\u7EA2\u7EBF\u524D\u91CD\u5EFA\u6570\u636E\u7F51\u3002`;
      } else if (gameType === "math-quest") {
        gameTitle = `\u300A${chapterTitle}\uFF1A\u7CBE\u5BC6\u8BA1\u7B97\u7A81\u56F4\u534F\u8BAE\u300B`;
        gameRules = `\u707E\u96BE\u5DF2\u7ECF\u8FDB\u5165\u7269\u7406\u7A81\u51FB\u671F\uFF01\u8981\u5F3A\u884C\u6291\u5236\u53C2\u6570\u66B4\u6DA8\uFF0C\u4F60\u5FC5\u987B\u5316\u8EAB\u5B89\u5168\u8BA1\u7B97\u603B\u6307\u6325\uFF0C\u5728\u6781\u5C0F\u7684\u65F6\u95F4\u7A97\u53E3\u91CC\u5BF9 [${summary}] \u8FDB\u884C\u53C2\u6570\u6781\u503C\u5E73\u8861\u3001\u53CD\u5E94\u516C\u5F0F\u5BF9\u9F50\u3001\u4EE5\u53CA\u6D41\u91CF\u8BA1\u7B97\uFF0C\u7CBE\u51C6\u5C06\u6307\u9488\u56DE\u8C03\u5230\u5B89\u5168\u533A\u95F4\u3002`;
      }
      return res.json({ gameTitle, gameRules });
    }
    const ai = getGenAI();
    const systemInstruction = `You are a creative educational writer and interactive gamification designer (\u4E2D\u6587\u73AF\u5883).
Your sole task is to recommend a highly polished, high-tension educational game title and a concise, high-cognition gameplay conflict description based on the provided core concepts and preferred game mechanics.

Instructions for generation:
1. "gameTitle" must be a punchy, dramatic sci-fi, fantasy, historic, or high-concept narrative title (e.g., "\u91D1\u65AF\u9650\u754C\u5F15\u529B\u5931\u8861\u6F0F\u6C14\u8B66\u62A5", "\u6CF0\u5766\u9738\u6743\u7EC8\u7ED3\u4E0E\u79E9\u5E8F\u8FC7\u6E21", "\u6570\u636E\u9B54\u5492\u91CD\u6784\u963B\u65AD\u534F\u8BAE"). It should capture attention instantly.
2. "gameRules" must be a concise paragraph (100-150 words in Chinese) describing:
   - The virtual role/occupation of the player.
   - The urgent crisis or trigger event they face.
   - The cognitive conflict they must resolve using the target concepts (avoid simple quiz memory lookup; frame it as a trade-off, diagnostic study, or logic repair).
   - What the player must do to gain victory.
   
Respond strictly in JSON format matching the schema. Do not use markdown wraps.`;
    const promptText = `Suggest a dramatic game title and gameplay scenario ruleset for:
- Concept Chapter Slice: "${chapterTitle}"
- Target Core Concepts: [${summary}]
- Gamification Mechanic Mode: "${gameType}"
- Pedagogical Objective: "${designRationale || "None"}"`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            gameTitle: { type: import_genai.Type.STRING, description: "A beautifully crafted, high-traction game title." },
            gameRules: { type: import_genai.Type.STRING, description: "Detailed 1-paragraph game objective/rules in Chinese explaining the crisis, role, and key choices." }
          },
          required: ["gameTitle", "gameRules"]
        }
      }
    });
    const parsed = parseJsonResponse(response.text);
    res.json(parsed);
  } catch (error) {
    console.error("Error recommending scenario:", error);
    res.status(500).json({ error: error.message || "External recommender error" });
  }
});
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, currentBookTitle } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required." });
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      const lastMsg = messages[messages.length - 1]?.text?.toLowerCase() || "";
      let reply = "\u4F60\u597D\uFF01\u6211\u662F\u4F60\u7684 AI \u5B66\u4E60\u6E38\u620F\u7B56\u5212\u4E13\u5BB6\u3002\u6709\u4EC0\u4E48\u5173\u4E8E\u5F53\u524D\u8BFE\u672C\u3001\u7AE0\u8282\u62C6\u5206\u6216\u4E92\u52A8\u6E38\u620F\u73A9\u6CD5\u8BBE\u8BA1\u7684\uFF0C\u5C3D\u7BA1\u95EE\u6211\uFF01";
      if (lastMsg.includes("\u5EFA\u8BAE") || lastMsg.includes("\u63A8\u8350") || lastMsg.includes("\u73A9\u6CD5")) {
        reply = "\u6211\u53EF\u4EE5\u4E3A\u4F60\u914D\u7F6E\u591A\u79CD\u6E38\u620F\uFF1A\u77E5\u8BC6\u5927\u6BD4\u62FC (Quiz)\u3001\u8FDE\u7EBF\u642D\u914D (Match)\u3001\u6587\u672C\u586B\u7A7A (Blank Fill)\u3001\u63A2\u9669\u6289\u62E9\u6587\u672C\u5192\u9669 (Story Quest)\u3001\u4EE3\u7801\u7EA0\u9519\u9B54\u5492 (Coding Puzzle) \u6216\u8005\u662F \u7B97\u672F\u901F\u7B97\u95EF\u5173 (Math Quest)\uFF01";
      } else if (lastMsg.includes("\u7AE0\u8282") || lastMsg.includes("\u76EE\u5F55")) {
        reply = "\u8BFE\u4EF6\u6700\u597D\u5212\u5206\u4E3A 3-6 \u4E2A\u72EC\u7ACB\u6A21\u5757\u3002\u4F60\u53EF\u4EE5\u5728 Step 2 \u9875\u9762\u5BF9\u6BCF\u4E2A\u7AE0\u8282\u6807\u9898\u548C\u5177\u4F53\u7684\u6E38\u620F\u89C4\u5219\u8FDB\u884C\u5B8C\u5168\u5B9A\u5236\u7684\u6C49\u5316\u4E0E\u4FEE\u6539\uFF01";
      }
      return res.json({ reply });
    }
    const ai = getGenAI();
    const contentsPayload = messages.map((m) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contentsPayload,
      config: {
        systemInstruction: `You are an expert educational gamification consultant and curriculum advisor.
Support the user in organizing, outlining, and refining highly immersive educational simulations based on textbooks.
Reply in Chinese, keep answers insightful and focused on scenario design.`
      }
    });
    return res.json({ reply: response.text });
  } catch (error) {
    console.error("Error in conversational API:", error);
    res.status(500).json({ error: error.message || "Failed to engage Gemini chat." });
  }
});
function getMockBlueprint(title) {
  const normTitle = (title || "").toLowerCase();
  if (normTitle.includes("\u5B87\u5B99") || normTitle.includes("astro") || normTitle.includes("stellar") || normTitle.includes("\u6052\u661F")) {
    return {
      title: "\u300A\u5B87\u5B99\u8D77\u6E90\u4E0E\u6052\u661F\u7269\u7406\u300B",
      modules: [
        {
          chapterIndex: "01",
          title: "\u8D85\u5F15\u529B\u6052\u661F\u80DA\u80CE\u63A7\u5236",
          coveredChapters: "Topic 1.1",
          summary: "\u91D1\u65AF\u4E0D\u7A33\u5B9A\u6027, \u5F15\u529B\u52BF\u80FD, \u6C14\u4F53\u584C\u7F29\u4E34\u754C\u70B9",
          gameType: "math-quest",
          gameTitle: "\u661F\u4E91\u5931\u8861\u72B6\u6001\u5BF9\u51C6\uFF1A\u907F\u514D\u9ED1\u6D1E\u8FC7\u65E9\u574D\u7F29",
          gameRules: "\u661F\u4E91\u5F15\u529B\u5931\u8861\u6F0F\u6C14\u8B66\u62A5\u54CD\u8D77\uFF01\u73A9\u5BB6\u5FC5\u987B\u901A\u8FC7\u6743\u8861\u6C14\u4F53\u6E29\u5EA6\u3001\u5F15\u529B\u81EA\u8F6C\u52A8\u80FD\uFF0C\u8BCA\u65AD\u584C\u7F29\u963B\u529B\u53C2\u6570\uFF0C\u5E76\u5728\u91D1\u65AF\u6781\u9650\u4E34\u754C\u70B9\u524D\u6267\u884C\u5411\u5FC3\u6C14\u65CB\u5BF9\u51B2\u7B56\u7565\uFF0C\u8FEB\u4F7F\u5B66\u5458\u5E73\u8861\u591A\u4E2A\u70ED\u529B\u5B66\u53D8\u91CF\u7EF4\u6301\u661F\u6838\u5904\u4E8E\u80DA\u80CE\u671F\u5E73\u8861\u72B6\u6001\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u907F\u514D\u8BA9\u81EA\u5B66\u8005\u53BB\u6B7B\u8BB0\u786C\u80CC\u91D1\u65AF\u81E8\u754C\u6761\u4EF6\uFF0C\u800C\u662F\u5728\u9AD8\u5EA6\u7D27\u5F20\u7684\u661F\u4E91\u6CC4\u9732\u707E\u96BE\u4E2D\u626E\u6F14\u7A7A\u95F4\u79D1\u5B66\u5BB6\uFF0C\u901A\u8FC7\u8C03\u8282\u8D28\u91CF\u53CA\u5411\u5FC3\u538B\u529B\u7406\u89E3\u5F15\u529B\u70ED\u5E73\u8861\u5BF9\u661F\u4F53\u6210\u578B\u7684\u5F71\u54CD\u3002"
        },
        {
          chapterIndex: "02",
          title: "\u4F4E\u6E29\u539F\u661F\u76D8\u6E4D\u6D41\u5BF9\u51C6",
          coveredChapters: "Topic 1.2",
          summary: "\u5438\u79EF\u76D8\u7ED3\u6784, \u6E4D\u6D41\u7C98\u6EDE, \u78C1\u6D41\u4F53\u529B\u5B66\u5E73\u8861",
          gameType: "cross-match",
          gameTitle: "\u6052\u661F\u6700\u521D\u661F\u9AA8\u62FC\u88C5\uFF1A\u514B\u670D\u539F\u661F\u76D8\u7D0A\u4E71\u98CE\u66B4",
          gameRules: "\u539F\u661F\u76D8\u7269\u8D28\u6D41\u52A8\u901F\u7387\u5904\u4E8E\u5931\u8861\u5D29\u6E83\u8FB9\u7F18\u3002\u73A9\u5BB6\u626E\u6F14\u8F68\u9053\u91CD\u529B\u4FEE\u6B63\u5B98\uFF0C\u9700\u8981\u8BCA\u65AD\u78C1\u573A\u963B\u5C3C\u3001\u91CD\u529B\u4E0D\u7A33\u5B9A\u6027\u5206\u5E03\uFF0C\u5E76\u8C03\u914D\u51B7\u51DD\u5C18\u7C92\u7684\u6469\u64E6\u963B\u529B\u548C\u5411\u5FC3\u964D\u901F\u5EA6\uFF0C\u786E\u4FDD\u6D41\u4F53\u7C98\u6EDE\u7CFB\u6570\u5E73\u6ED1\u5EA6\uFF0C\u907F\u514D\u76D8\u4F53\u81EA\u53D1\u788E\u88C2\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u901A\u8FC7\u63A7\u5236\u7C98\u6EDE\u53D8\u91CF\u8BCA\u65AD\u539F\u661F\u76D8\u6F14\u5316\uFF0C\u4F7F\u5B66\u751F\u6DF1\u5EA6\u8BA4\u77E5\u6C14\u4F53\u6469\u64E6\u751F\u70ED\u5E76\u91CA\u653E\u5F15\u529B\u673A\u68B0\u80FD\u7684\u8FC7\u7A0B\uFF0C\u800C\u975E\u5B64\u7ACB\u5B66\u4E60\u6469\u64E6\u5E38\u6570\u3002"
        },
        {
          chapterIndex: "03",
          title: "\u661F\u98CE\u629B\u6D12\u4E0E\u89D2\u52A8\u91CF\u6EA2\u6D41",
          coveredChapters: "Topic 1.3",
          summary: "\u53CC\u6781\u5916\u6D41, \u89D2\u52A8\u91CF\u6D41\u5931, \u5F3A\u78C1\u91CD\u8054",
          gameType: "interactive-story",
          gameTitle: "\u89D2\u52A8\u91CF\u5927\u6CC4\u6D2A\uFF1A\u633D\u6551\u81EA\u8F6C\u89E3\u4F53\u7684\u4E00\u7EBF\u9009\u62E9",
          gameRules: "\u80DA\u80CE\u6052\u661F\u8F6C\u901F\u7531\u4E8E\u7269\u8D28\u6781\u5316\u5438\u6536\u6500\u5347\u81F3\u74E6\u89E3\u7EA2\u7EBF\uFF01\u4F60\u9700\u8981\u7ACB\u523B\u505A\u51FA\u51B3\u65AD\uFF1A\u662F\u901A\u8FC7\u5F00\u8F9F\u5F3A\u53CC\u6781\u6C14\u6D41\u5916\u6CC4\u52A8\u80FD\uFF0C\u8FD8\u662F\u4F9D\u8D56\u78C1\u585E\u91CD\u8054\u5F15\u53D1\u5927\u8000\u6591\u653E\u7535\u3002\u6BCF\u4E00\u6B21\u51B3\u7B56\u90FD\u5728\u5F15\u529B\u6536\u655B\u4E0E\u7269\u8D28\u5F7B\u5E95\u98DE\u6563\u7684\u751F\u6B7B\u5E73\u8861\u70B9\u4E0A\u5F98\u5F8A\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5C06\u6052\u661F\u89D2\u52A8\u91CF\u5B88\u6052\u7269\u7406\u5C4F\u969C\u5305\u88C5\u6210\u51B3\u7B56\uFF0C\u8FEB\u4F7F\u5B66\u751F\u63A8\u6F14\u2018\u81EA\u8F6C\u963B\u529B\u5FC5\u987B\u6D41\u5931\u3001\u6052\u661F\u65B9\u53EF\u51DD\u805A\u2019\u7684\u7269\u7406\u56E0\u679C\u3002"
        },
        {
          chapterIndex: "04",
          title: "\u8D28\u5B50-\u8D28\u5B50\u94FE\u77AC\u95F4\u70B9\u51C6",
          coveredChapters: "Topic 2.1",
          summary: "pp\u94FE\u4E00\u9636\u53CD\u5E94, \u6B63\u7535\u5B50\u6E6E\u706D, \u5F3A\u76F8\u4E92\u4F5C\u7528\u52BF\u5792",
          gameType: "quiz",
          gameTitle: "\u6838\u533A\u70B9\u706B\u534F\u8BAE\uFF1A\u514B\u670D\u5F3A\u5E93\u4ED1\u6392\u65A5\u529B\u7684\u6838\u805A\u53D8\u53CD\u5E94",
          gameRules: "\u539F\u6052\u661F\u4E2D\u5FC3\u6E29\u5EA6\u5DF2\u6500\u5347\u81F31000\u4E07\u5F00\u5C14\u6587\uFF0C\u4F46\u5F31\u76F8\u4E92\u4F5C\u7528\u5BFC\u81F4\u8D28\u5B50\u878D\u5408\u6210\u53CC\u8D28\u5B50\uFF08\u6C26-2\uFF09\u5728\u6781\u9650\u8870\u53D8\u3002\u4F60\u5FC5\u987B\u7CBE\u786E\u8C03\u5EA6\u91CF\u5B50\u96A7\u9053\u6548\u5E94\u53D1\u751F\u6982\u7387\u3002\u8BBA\u8BC1\u5728\u6781\u5C0F\u52BF\u5792\u4E0B\uFF0C\u5982\u4F55\u8C03\u5EA6\u5FAE\u89C2\u7C92\u5B50\u7684\u5E73\u5747\u52A8\u80FD\u514B\u670D\u70B9\u706B\u7194\u65AD\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u4E0D\u518D\u6B7B\u8BB0\u786C\u80CC\u6838\u805A\u53D8\u6E29\u5EA6\uFF0C\u800C\u662F\u5C06\u52BF\u5792\u514B\u670D\u53CA\u6838\u529B\u4E3B\u5BFC\u5305\u88C5\u6210\u5FAE\u89C2\u9AD8\u8D1F\u8377\u7A81\u56F4\u535A\u5F08\u3002"
        },
        {
          chapterIndex: "05",
          title: "\u78B3\u6C2E\u6C27\u5FAA\u73AF\u9AD8\u6E29\u70B9\u706B",
          coveredChapters: "Topic 2.2",
          summary: "CNO\u5FAA\u73AF\u50AC\u5316, \u9AD8\u6E29\u6E29\u6807\u6307\u6570, \u6838\u5FC3\u5BC6\u5EA6\u8DC3\u5347",
          gameType: "math-quest",
          gameTitle: "\u8D85\u8D28\u91CF\u7EA2\u5DE8\u661F\u5185\u6838\u53CD\u5E94\uFF1A\u7D27\u6025\u5E73\u6291CNO\u6838\u80FD\u8F93\u51FA\u66B4\u6DA8",
          gameRules: "\u9AD8\u8D28\u91CF\u6838\u5FC3\u6E29\u5EA6\u98D9\u5347\u81F32000\u4E07\u5EA6\uFF0CCNO\u6E29\u6807\u51C6\u6570\u544817\u6B21\u65B9\u6307\u6781\u7EA7\u66B4\u6DA8\uFF01\u73A9\u5BB6\u5FC5\u987B\u5316\u8EAB\u91CD\u529B\u70ED\u6838\u603B\u63A7\u5B98\uFF0C\u7D27\u6025\u8BA1\u7B97\u5E76\u6CE8\u5165\u5FAE\u91CF\u6C26-4\u6D41\u4F53\u4EE5\u964D\u4F4E\u6838\u5FC3\u9759\u538B\uFF0C\u63A7\u5236\u56E0\u78B3\u50AC\u5316\u5242\u5F15\u53D1\u7684\u81EA\u6BC1\u94FE\u6761\u3002",
          duration: "12\u5206\u949F",
          designRationale: "\u6781\u9AD8\u9636\u7684\u975E\u7EBF\u6027\u6307\u6570\u516C\u5F0F\u5728\u4E8B\u6545\u538B\u529B\u4E0B\u5C55\u793A\uFF0C\u8FEB\u4F7F\u5B66\u751F\u6DF1\u5EA6\u638C\u63E1\u5927\u8D28\u91CF\u6052\u661F\u5185\u90E8\u6E29\u63A7\u6781\u5EA6\u8106\u5F31\u7684\u6838\u5FC3\u673A\u5236\u3002"
        },
        {
          chapterIndex: "06",
          title: "\u8F90\u5C04\u5C42\u5149\u5B50\u4E07\u8F7D\u8FF7\u5BAB\u7A7F\u8D8A",
          coveredChapters: "Topic 3.1",
          summary: "\u8F90\u5C04\u963B\u5C3C, \u5149\u5B50\u5E73\u5747\u81EA\u7531\u7A0B, \u5EB7\u666E\u987F\u4E0D\u900F\u660E\u5EA6",
          gameType: "coding-puzzle",
          gameTitle: "\u9003\u9038\u5149\u5B50\u6563\u5C04\u8F68\u8FF9\uFF1A\u4FEE\u6B63\u4E0D\u900F\u660E\u4F20\u5BFC\u4EE3\u7801",
          gameRules: "\u6838\u53CD\u5E94\u4EA7\u751F\u7684\u5149\u5B50\u5728\u7A7F\u8D8A20\u4E07\u516C\u91CC\u81F4\u5BC6\u8F90\u5C04\u5C42\u65F6\u88AB\u7269\u8D28\u65E0\u5C3D\u6563\u5C04\uFF0C\u4EE3\u7801\u5BFB\u8DEF\u7CFB\u7EDF\u5904\u4E8E\u6EA2\u51FA\u6545\u969C\u3002\u4F60\u5FC5\u987B\u91CD\u6784\u5149\u5B50\u6E38\u8D70\u6B65\u6570\u8BA1\u7B97\u4EE3\u7801\u4E0E\u6563\u5C04\u6982\u7387\u5206\u914D\u8868\uFF0C\u8BCA\u65AD\u8F90\u5C04\u4E0D\u900F\u660E\u5EA6\u7684\u52A8\u6001\u963B\u529B\u5E76\u758F\u901A\u5149\u80FD\u5411\u5916\u4F20\u9012\u7269\u7406\u5927\u52A8\u8109\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u4F7F\u5B66\u751F\u8BA4\u77E5\u867D\u7136\u5149\u901F\u6781\u5FEB\uFF0C\u4F46\u7531\u4E8E\u6781\u9AD8\u4E0D\u900F\u660E\u5EA6\u5F62\u6210\u7684\u2018\u6F2B\u6B65\u2019\uFF0C\u662F\u4FDD\u6301\u6052\u661F\u5916\u58F3\u4E0D\u4F1A\u77AC\u95F4\u574D\u584C\u7684\u5E55\u540E\u7A33\u5B9A\u4FDD\u969C\u3002"
        },
        {
          chapterIndex: "07",
          title: "\u5BF9\u6D41\u6CE1\u6E4D\u6D41\u6CB8\u817E\u963B\u5C3C",
          coveredChapters: "Topic 3.2",
          summary: "\u963F\u57FA\u7C73\u5FB7\u6D6E\u529B, \u7EDD\u70ED\u6E29\u5EA6\u68AF\u5EA6, \u6DF7\u5408\u957F\u7406\u8BBA",
          gameType: "cross-match",
          gameTitle: "\u6052\u661F\u6700\u5916\u5C42\u5DE8\u6D6A\u5BF9\u6D41\uFF1A\u6D41\u4F53\u529B\u5B66\u4E0D\u7A33\u5B9A\u6027\u5BF9\u6297",
          gameRules: "\u968F\u7740\u6052\u661F\u5916\u5C42\u6E29\u5EA6\u9AA4\u964D\u3001\u4E0D\u900F\u660E\u5EA6\u66B4\u589E\uFF0C\u8F90\u5C04\u5C42\u5DF2\u65E0\u6CD5\u5BA3\u6CC4\u80FD\u91CF\u3002\u5E9E\u5927\u7684\u9AD8\u70ED\u5BF9\u6D41\u6CE1\u6B63\u4EE5\u51E0\u9A6C\u8D6B\u901F\u5EA6\u7FFB\u6EDA\u6012\u543C\u3002\u73A9\u5BB6\u4F5C\u4E3A\u6D6E\u529B\u53C2\u6570\u63A7\u5236\u5458\uFF0C\u5FC5\u987B\u7CBE\u786E\u914D\u5BF9\u7EDD\u70ED\u81A8\u80C0\u7387\u4E0E\u5B9E\u9645\u6E29\u5EA6\u68AF\u5EA6\u7684\u504F\u5DEE\u7B49\u7EA7\uFF0C\u5E73\u606F\u5931\u63A7\u7684\u80FD\u91CF\u55B7\u6D8C\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5339\u914D\u4E0D\u7A33\u5B9A\u6027\u6D41\u4F53\u53D8\u91CF\uFF0C\u63ED\u793A\u7269\u7406\u5BF9\u6D41\u542F\u52A8\u7684\u4E34\u754C\u6761\u4EF6\uFF08\u53F2\u74E6\u897F\u5224\u636E\uFF09\u3002"
        },
        {
          chapterIndex: "08",
          title: "\u592A\u9633\u9ED1\u5B50\u5F3A\u78C1\u626D\u7ED3\u8BCA\u65AD",
          coveredChapters: "Topic 3.3",
          summary: "\u53D1\u7535\u673A\u6548\u5E94, \u78C1\u91CD\u8054\u7206\u53D1, \u7535\u6D46\u963B\u5C3C",
          gameType: "quiz",
          gameTitle: "\u8000\u6591\u5927\u7206\u53D1\u8B66\u544A\uFF1A\u9ED1\u5B50\u6781\u6027\u78C1\u7EF3\u6298\u65AD\u5E72\u9884",
          gameRules: "\u5DEE\u52A8\u81EA\u8F6C\u5BFC\u81F4\u8D64\u9053\u53D1\u7535\u673A\u4EA7\u751F\u7684\u78C1\u529B\u7EBF\u53D1\u751F\u767E\u4E07\u6B21\u6781\u9650\u626D\u7ED5\u3002\u4F60\u5FC5\u987B\u7D27\u6025\u5BF9\u51C6\u4E24\u4E2A\u5E26\u6709\u9AD8\u80FD\u53CD\u5DEE\u6781\u6027\u7684\u78C1\u6D41\uFF0C\u8BCA\u65AD\u5176\u78C1\u5F20\u529B\u79EF\u805A\u91CF\u5E76\u4E0B\u8FBE\u6CC4\u653E\u7535\u78C1\u9600\u6307\u4EE4\u3002\u5982\u679C\u8BBA\u8BC1\u8BCA\u65AD\u5931\u8D25\uFF0C\u8000\u6591\u7206\u53D1\u5C06\u77AC\u95F4\u70E7\u7A7F\u8FD1\u8F68\u63A2\u6D4B\u536B\u661F\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5C06\u9ED1\u5B50\u673A\u5236\u3001\u53D1\u7535\u673A\u539F\u7406\u53CA\u78C1\u91CD\u8054\u7A81\u53D8\u5728\u4E8B\u6545\u80CC\u666F\u4E2D\u5448\u73B0\uFF0C\u4F7F\u9ED1\u5B50\u4E0D\u5355\u662F\u4E0D\u53D1\u5149\u7684\u6D1E\uFF0C\u800C\u662F\u9AD8\u78C1\u80FD\u9AD8\u5E94\u529B\u70B9\u3002"
        },
        {
          chapterIndex: "09",
          title: "\u6838\u5FC3\u6C22\u71C3\u5C3D\u7EA2\u5DE8\u661F\u5927\u5D29\u88C2",
          coveredChapters: "Topic 4.1",
          summary: "\u58F3\u5C42\u6C22\u805A\u53D8, \u6838\u5FC3\u6536\u7F29\u5347\u6E29, \u5916\u90E8\u70ED\u81A8\u80C0\u4E0D\u5E73\u8861",
          gameType: "interactive-story",
          gameTitle: "\u6052\u661F\u58F3\u5C42\u70B9\u706B\u4E34\u754C\u70B9\uFF1A\u5DE8\u661F\u81A8\u80C0\u707E\u96BE\u4E0B\u7684\u536B\u661F\u91CD\u8F68",
          gameRules: "\u6052\u661F\u6838\u5FC3\u6C22\u8017\u5C3D\u5F00\u59CB\u584C\u7F29\uFF0C\u800C\u5916\u5C42\u5374\u7531\u4E8E\u5F3A\u70C8\u7684\u58F3\u5C42\u5F15\u71C3\u53D1\u751F\u4E86\u6307\u6570\u5F0F\u72C2\u9000\u81A8\u80C0\u3002\u4F60\u4F5C\u4E3A\u8F68\u9053\u57FA\u7AD9\u9886\u822A\u957F\uFF0C\u6B63\u906D\u9047\u6BCD\u661F\u5916\u5927\u6C14\u6C14\u963B\u6025\u901F\u541E\u566C\u3002\u4F60\u5FC5\u987B\u5728\u7ACB\u523B\u62C9\u5347\u8F68\u9053\u727A\u7272\u71C3\u6599\uFF0C\u8FD8\u662F\u6DF1\u5165\u5916\u6C14\u5C42\u501F\u529B\u5927\u6C14\u5239\u8F66\u4E2D\u505A\u51FA\u6781\u9AD8\u98CE\u9669\u7684\u6743\u8861\u6295\u7968\u9009\u62E9\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u7406\u89E3\u6052\u661F\u6838\u5FC3\u6536\u7F29\u4F34\u968F\u5916\u58F3\u81A8\u80C0\u7684\u2018\u955C\u50CF\u6F14\u5316\u5F8B\u2019\uFF0C\u5C06\u70ED\u8D28\u52A8\u529B\u5B66\u5316\u4E3A\u7A7A\u95F4\u81EA\u6551\u7684\u7269\u7406\u51B3\u7B56\u80CC\u666F\u3002"
        },
        {
          chapterIndex: "10",
          title: "\u6C26\u95EA0.1\u79D2\u751F\u6B7B\u5371\u673A\u81EA\u6551",
          coveredChapters: "Topic 4.2",
          summary: "\u7535\u5B50\u7B80\u5E76\u538B\u529B, \u70ED\u5931\u63A7\u673A\u5236, \u4E09\u963F\u5C14\u6CD5\u53CD\u5E94\u963B\u5C3C",
          gameType: "math-quest",
          gameTitle: "\u7B80\u5E76\u6838\u5FC3\u78B3\u7206\u53D1\u63A7\u5236\uFF1A\u5236\u6B62\u6C26\u70ED\u5931\u63A7\u5D29\u584C",
          gameRules: "\u7B80\u5E76\u6838\u5FC3\u5185\u90E8\u7531\u4E8E\u6E29\u5EA6\u5347\u9AD8\u5374\u65E0\u6CD5\u81A8\u80C0\u6563\u70ED\uFF0C\u4E09\u963F\u5C14\u6CD5\u6838\u805A\u53D8\u901F\u7387\u4EE540\u6B21\u65B9\u6781\u9650\u7EA7\u66B4\u6DA8\uFF01\u8B66\u62A5\u62C9\u54CD\uFF01\u73A9\u5BB6\u5FC5\u987B\u5728\u4E00\u5F20\u590D\u6742\u7684\u6838\u53CD\u5E94\u622A\u9762\u4E0A\uFF0C\u8BA1\u7B97\u51FA\u91CF\u5B50\u7B80\u5E76\u6001\u5411\u6B63\u5E38\u6297\u538B\u6C14\u6001\u8F6C\u53D8\u7684\u77AC\u95F4\u70ED\u503C\u5E38\u6570\u5DEE\u5E76\u65BD\u52A0\u5F15\u529B\u6324\u538B\u5E72\u6270\u5E72\u9884\u3002",
          duration: "11\u5206\u949F",
          designRationale: "\u5229\u7528\u7206\u7834\u7684\u6B7B\u673A\u98CE\u9669\u4F20\u8FBE\u7535\u5B50\u7B80\u5E76\u538B\u529B\u4E0E\u6E29\u5EA6\u89E3\u8026\u3001\u4ECE\u800C\u7F3A\u4E4F\u5B89\u5168\u8D1F\u53CD\u9988\u8C03\u8282\u8FD9\u4E00\u767D\u77EE\u661F\u81F3\u8981\u7269\u7406\u673A\u5236\u3002"
        },
        {
          chapterIndex: "11",
          title: "s-\u8FC7\u7A0B\u91CD\u5143\u7D20\u6355\u83B7",
          coveredChapters: "Topic 4.3",
          summary: "\u7F13\u6162\u4E2D\u5B50\u6355\u83B7, \u8D1D\u5854\u8870\u53D8\u671F\u9650, \u94C1\u6838\u4EE5\u4E0A\u5143\u7D20\u5408\u6210",
          gameType: "coding-puzzle",
          gameTitle: "\u70BC\u91D1\u672F\u6838\u5FC3\uFF1A\u6355\u83B7\u661F\u9645\u7F13\u6162\u6D41\u52A8\u4E2D\u5B50",
          gameRules: "\u7EA2\u5DE8\u661F\u8FB9\u7F18\u8109\u51B2\u9707\u8361\uFF0C\u81EA\u7531\u4E2D\u5B50\u6D41\u4EE5\u6781\u6162\u901F\u649E\u51FB\u91CD\u6838\u3002\u7531\u4E8E\u8D1D\u5854\u8870\u53D8\u534A\u8870\u671F\u5904\u4E8E\u52A8\u6001\u6CE2\u6BB5\uFF0C\u4F60\u5FC5\u987B\u8BCA\u65AD\u5176\u6355\u83B7\u7A97\u53E3\u3002\u91CD\u6392\u4E2D\u5B50\u5438\u6536\u53CA\u80FD\u7EA7\u8870\u53D8\u6392\u5E8F\uFF0C\u4FEE\u590D\u5143\u7D20\u5468\u671F\u8868\u94C1\u6838\u4EE5\u4E0A\u5408\u91D1\u6F14\u66FF\u987A\u5E8F\uFF0C\u907F\u514D\u751F\u6210\u77ED\u547D\u975E\u7A33\u540C\u4F4D\u7D20\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u901A\u8FC7\u62FC\u8865\u8870\u53D8\u94FE\uFF0C\u8BA9\u81EA\u5B66\u8005\u6DF1\u5EA6\u6D88\u5316\u534A\u8870\u671F\u4E0E\u4E2D\u5B50\u6D41\u5BC6\u5EA6\u7684\u5339\u914D\u89C4\u5F8B\uFF08s-\u8FC7\u7A0B\u4E0Er-\u8FC7\u7A0B\u672C\u8D28\u5BF9\u7ACB\uFF09\u3002"
        },
        {
          chapterIndex: "12",
          title: "\u767D\u77EE\u661F\u5438\u79EF\u76D8\u6F6E\u6C50\u6EA2\u6D41",
          coveredChapters: "Topic 5.1",
          summary: "\u7F57\u6C0F\u6781\u9650\u6EA2\u6D41, \u5438\u79EF\u76D8\u52A8\u91CF\u5B88\u6052, \u8FB9\u754C\u6EA2\u6D41\u5207\u65AD",
          gameType: "cross-match",
          gameTitle: "\u4F34\u661F\u503E\u6CE8\u5927\u52AB\u63A0\uFF1A\u4FDD\u62A4\u6781\u7B80\u6838\u5FC3\u8D28\u91CF\u8FB9\u754C",
          gameRules: "\u4F34\u661F\u7269\u8D28\u5DF2\u7ECF\u8D8A\u8FC7\u91CD\u529B\u5E73\u8861\u70B9\uFF08\u62C9\u683C\u6717\u65E5L1\u70B9\uFF09\uFF0C\u5411\u767D\u77EE\u661F\u8868\u9762\u75AF\u72C2\u6E85\u843D\uFF0C\u5916\u58F3\u6838\u80FD\u6B63\u5931\u63A7\u5347\u6E29\uFF01\u73A9\u5BB6\u9700\u8981\u5BF9\u9F50\u5E76\u5339\u914D\u6EA2\u6D41\u901F\u7387\u3001\u89D2\u52A8\u91CF\u6563\u5931\u53CA\u58F3\u5C42\u6838\u70ED\u66B4\u8D70\u9608\u503C\uFF0C\u7CBE\u51C6\u51B3\u7B56\u4F55\u65F6\u5207\u65AD\u91CD\u529B\u7EA0\u7F20\u5E26\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5C06\u53CC\u661F\u7CFB\u7EDF\u7684\u5F15\u529B\u62C9\u626F\u548C\u8D28\u91CF\u6EA2\u6D41\u8BBE\u8BA1\u4E3A\u591A\u53C2\u6570\u5E73\u8861\u5BF9\u9F50\u6311\u6218\uFF0C\u8BA9\u7F57\u6C0F\u6781\u9650\u7684\u89E3\u6790\u5BCC\u6709\u6781\u5F3A\u7684\u4E3B\u52A8\u5E94\u7528\u60C5\u5883\u3002"
        },
        {
          chapterIndex: "13",
          title: "Ia\u8D85\u65B0\u661F\u96F6\u70B9\u70ED\u6838\u8D77\u7206",
          coveredChapters: "Topic 5.2",
          summary: "\u78B3\u95EA\u5931\u63A7\u7206\u70B8, \u94B1\u5FB7\u62C9\u585E\u5361\u6781\u9650\u7A81\u7834, \u72ED\u4E49\u76F8\u5BF9\u8BBA\u538B\u5F3A",
          gameType: "quiz",
          gameTitle: "1.44\u500D\u8D28\u91CF\u5927\u9632\u7EBF\uFF1A\u62E6\u622A\u78B3\u71C3\u7194\u65AD\u94FE\u6761",
          gameRules: "\u767D\u77EE\u661F\u79EF\u805A\u8D28\u91CF\u57281.4398\u500D\u592A\u9633\u8D28\u91CF\u6781\u9650\u8DF3\u52A8\uFF01\u7CFB\u7EDF\u5F15\u529B\u5DF2\u7ECF\u538B\u57AE\u4E86\u76F8\u5BF9\u8BBA\u6027\u7535\u5B50\u7B80\u5E76\u538B\uFF0C\u6781\u901F\u584C\u7F29\u6B63\u5728\u89E6\u53D1\u541E\u566C\u4E00\u5207\u7684\u78B3\u6838\u70B9\u706B\u3002\u4E3A\u4E86\u963B\u6B62Ia\u578B\u81EA\u7206\u51B2\u51FB\u6CE2\u6495\u788E\u5468\u8FB9\u7684\u884C\u661F\u6E2F\uFF0C\u4F60\u5FC5\u987B\u8FC5\u901F\u8BCA\u65AD\u80FD\u91CF\u5806\u7684\u6E29\u5EA6\u5E76\u51B3\u7B56\u662F\u5426\u6CC4\u538B\u6CC4\u8D28\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u901A\u8FC7\u751F\u6B7B\u9632\u7EBF\u7A81\u51FA1.44M\u2609\u4F5C\u4E3A\u7535\u5B50\u8FB9\u754C\u795E\u5723\u4E0D\u53EF\u4FB5\u72AF\u7684\u7269\u7406\u6027\u8D28\uFF0C\u5F3A\u5316\u5B66\u751F\u5728\u96F6\u754C\u70B9\u505A\u51FA\u6781\u9650\u63A8\u7406\u7684\u6280\u80FD\u3002"
        },
        {
          chapterIndex: "14",
          title: "\u4E2D\u5B50\u661F\u4E2D\u5B50\u7B80\u5E76\u538B\u6297\u8861",
          coveredChapters: "Topic 5.3",
          summary: "\u8D85\u6D41\u8D28\u4E2D\u5B50\u6001, \u5965\u672C\u6D77\u9ED8\u6781\u9650, \u6781\u7AEF\u91CF\u5B50\u7B80\u5E76",
          gameType: "interactive-story",
          gameTitle: "\u5F15\u529B\u66B4\u98CE\u773C\u5E95\uFF1A\u7EF4\u6301\u4E2D\u5B50\u661F\u6700\u540E\u6C14\u963B\u9632\u7EBF",
          gameRules: "\u5F3A\u5F15\u529B\u5DF2\u5C06\u8D28\u5B50\u4E0E\u7535\u5B50\u538B\u788E\u878D\u5408\u6210\u4E2D\u5B50\u6D41\uFF0C\u5916\u90E8\u8D28\u91CF\u6B63\u7EE7\u7EED\u5806\u79EF\uFF01\u4E2D\u5B50\u7B80\u5E76\u538B\u9632\u7EBF\u5F00\u59CB\u5C40\u90E8\u677E\u52A8\u3002\u4F60\u4F5C\u4E3A\u8D85\u5927\u5F15\u529B\u5C4F\u969C\u603B\u5EFA\u9020\u5E08\uFF0C\u9762\u4E34\u4E0D\u5BB9\u6709\u5931\u7684\u51B3\u7B56\u6295\u7968\uFF1A\u662F\u4E3B\u52A8\u53D1\u5C04\u7C92\u5B50\u6D41\u629B\u6D12\u591A\u4F59\u5305\u5C42\u8D28\u91CF\uFF0C\u8FD8\u662F\u7528\u5F3A\u60EF\u6027\u89D2\u52A8\u91CF\u504F\u8F6C\u6781\u5F3A\u78C1\u6C14\u3002\u6BCF\u4E00\u6B65\u6289\u62E9\u90FD\u4F1A\u5F15\u53D1\u4E0D\u5F52\u8DEF\u6F14\u5316\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u4F7F\u5B66\u751F\u7406\u89E3\u4E2D\u5B50\u661F\u751F\u5B58\u6CD5\u5219\u3002\u5B83\u7684\u6781\u9650\u5C31\u662F\u5965\u672C\u6D77\u9ED8\u9650\u5236\uFF0C\u82E5\u5728\u60CA\u5FC3\u52A8\u9B44\u7684\u9009\u62E9\u91CC\u5931\u8D25\uFF0C\u5C31\u4E0D\u53EF\u963B\u62E6\u5730\u6ED1\u843D\u8FDB\u6052\u661F\u6F14\u5316\u7684\u7EC8\u5C40\u6DF1\u6E0A\u3002"
        },
        {
          chapterIndex: "15",
          title: "\u53F2\u74E6\u897F\u9ED1\u6D1E\u65F6\u7A7A\u91CD\u529B\u6297\u8861",
          coveredChapters: "Topic 6.1",
          summary: "\u53F2\u74E6\u897F\u534A\u5F84, \u4E8B\u4EF6\u89C6\u754C\u5916\u4FA7\u7EA2\u79FB, \u6F6E\u6C50\u5F15\u529B\u526A\u5207",
          gameType: "math-quest",
          gameTitle: "\u89C6\u754C\u5371\u673A\u7A81\u56F4\uFF1A\u5149\u901F\u8FB9\u7F18\u7684\u65F6\u7A7A\u5F52\u56E0\u8BCA\u65AD",
          gameRules: "\u98DE\u8239\u5C3E\u7AEF\u5916\u58F3\u5DF2\u56E0\u9ED1\u6D1E\u6781\u4E0D\u5747\u5300\u7684\u6F6E\u6C50\u526A\u5207\u529B\u53D1\u751F\u5267\u70C8\u70ED\u53D8\u5F62\u3002\u4FE1\u53F7\u7531\u4E8E\u5F15\u529B\u7EA2\u79FB\u51E0\u8FD1\u65AD\u7EDD\u3002\u4F60\u5FC5\u987B\u8BCA\u65AD\u524D\u540E\u4E24\u7AEF\u5F15\u529B\u5DEE\u5E38\u6570\uFF0C\u9006\u63A8\u5F53\u4E0B\u7684\u53F2\u74E6\u897F\u534A\u5F84\u4E34\u754C\u5E76\u8BBE\u5B9A\u9003\u9038\u53D1\u52A8\u673A\u7684\u53D8\u8F68\u5207\u89D2\u3002\u4F60\u9700\u8981\u5728\u6495\u88C2\u6216\u6D41\u5931\u4E2D\u5EFA\u7ACB\u65F6\u7A7A\u7A81\u56F4\u8F68\u8FF9\u822A\u7EBF\u6570\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u901A\u8FC7\u9ED1\u6D1E\u6781\u9650\u9003\u751F\u6848\u4F8B\uFF0C\u4F7F\u96BE\u4EE5\u7406\u89E3\u7684\u5F15\u529B\u7EA2\u79FB\u53CA\u6F6E\u6C50\u5207\u5E94\u529B\u516C\u5F0F\u5316\u4E3A\u9003\u751F\u504F\u89D2\u8BA1\u7B97\u7684\u7D27\u8FEB\u56E0\u679C\u63A8\u6F14\uFF0C\u8FBE\u6210\u5927\u5E08\u5C42\u7EA7\u7684\u76F4\u89C9\u7269\u7406\u5185\u5316\u3002"
        }
      ]
    };
  }
  if (normTitle.includes("\u795E\u8BDD") || normTitle.includes("greek") || normTitle.includes("myth") || normTitle.includes("\u5386\u53F2") || normTitle.includes("\u6587\u5B66")) {
    return {
      title: "\u300A\u53E4\u5E0C\u814A\u7F57\u9A6C\u795E\u8BDD\u63A2\u6C42\u300B",
      modules: [
        {
          chapterIndex: "01",
          title: "\u6DF7\u6C8C\u6DF1\u6E0A\u6CD5\u5219\u91CD\u5EFA",
          coveredChapters: "Topic 1.1",
          summary: "\u5B87\u5B99\u8D77\u6E90\u795E\u8C31, \u6CF0\u5766\u795E\u6743\u5BF9\u6297, \u79E9\u5E8F\u6784\u5EFA\u539F\u7406",
          gameType: "interactive-story",
          gameTitle: "\u6CF0\u5766\u9738\u6743\u7EC8\u7ED3\u4E0E\u795E\u4EE3\u8FC7\u6E21\u5927\u6218\u7565",
          gameRules: "\u514B\u6D1B\u8BFA\u65AF\u6B63\u6B8B\u9177\u541E\u566C\u4ED6\u7684\u5B50\u55E3\uFF0C\u76D6\u4E9A\u7684\u6CEA\u6C34\u4E0E\u5B99\u65AF\u7684\u53DB\u4E71\u7269\u5728\u6697\u5904\u6D8C\u52A8\u3002\u4F60\u4F5C\u4E3A\u5965\u6797\u5339\u65AF\u9996\u5E2D\u547D\u8FD0\u795E\u5B98\uFF0C\u9700\u8981\u8C03\u548C\u5148\u77E5\u666E\u7F57\u7C73\u4FEE\u65AF\u7684\u529B\u91CF\uFF0C\u5728\u6697\u9ED1\u6CF0\u5766\u7684\u7EDD\u5BF9\u96F7\u9706\u653B\u52BF\u4E0B\u6743\u8861\u6218\u672F\uFF0C\u53D1\u5E03\u547D\u8FD0\u76DF\u7EA6\u3002\u6BCF\u4E2A\u6CD5\u4EE4\u90FD\u5728\u51E1\u4EBA\u5B89\u5168\u4E0E\u795E\u4E0D\u673D\u6743\u5A01\u95F4\u8FDB\u884C\u8270\u96BE\u7B56\u7565\u6743\u8861\u6295\u7968\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u4ECE\u795E\u5B66\u79E9\u5E8F\u5EFA\u7ACB\u6F14\u5316\uFF0C\u5E2E\u52A9\u5B66\u751F\u7406\u89E3\u795E\u6743\u8FC7\u6E21\u4E0D\u53EA\u662F\u5355\u7EAF\u6740\u622E\uFF0C\u800C\u662F\u793E\u4F1A\u5951\u7EA6\u3001\u7406\u6027\u6CD5\u5219\u5BF9\u91CE\u86EE\u5929\u7136\u529B\u91CF\u7684\u53D6\u4EE3\u8FC7\u7A0B\u3002"
        },
        {
          chapterIndex: "02",
          title: "\u6CF0\u5766\u4E4B\u6218\u7684\u8C61\u5F81\u548C\u66F4\u8FED",
          coveredChapters: "Topic 1.2",
          summary: "\u81EA\u7136\u5D07\u62DC\u4E0E\u4EBA\u795E\u540C\u5F62, \u4E16\u4EE3\u593A\u6743\u5BBF\u547D, \u7406\u6027\u610F\u5FD7\u5347\u534E",
          gameType: "cross-match",
          gameTitle: "\u5929\u547D\u5DE8\u53D8\u6C99\u76D8\uFF1A\u51FB\u7A7F\u514B\u6D1B\u8BFA\u65AF\u7684\u5BBF\u547D\u95ED\u73AF",
          gameRules: "\u514B\u6D1B\u8BFA\u65AF\u4E0D\u4FE1\u4EFB\u4EFB\u4F55\u65B0\u751F\u7684\u529B\u91CF\uFF0C\u5176\u8179\u4E2D\u8BF8\u795E\u6E34\u671B\u89C9\u9192\u89E3\u8131\u3002\u4F60\u9700\u8981\u626E\u6F14\u5929\u754C\u8C0B\u81E3\uFF0C\u5206\u6790\u65E7\u6CF0\u5766\u5DE8\u7075\u795E\u80FD\u7F3A\u9677\uFF0C\u5339\u914D\u5B99\u65AF\u8054\u519B\u4E2D\u7684\u591A\u80A1\u52BF\u529B\uFF08\u767E\u624B\u5DE8\u4EBA\u3001\u72EC\u773C\u5DE8\u4EBA\u7B49\uFF09\u5E76\u8BBE\u5B9A\u7CBE\u51C6\u7684\u5077\u88AD\u3001\u9632\u5B88\u65F6\u673A\uFF0C\u901A\u8FC7\u9AD8\u96BE\u5EA6\u65F6\u5E8F\u8C03\u6821\u7A81\u56F4\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u901A\u8FC7\u8C0B\u7565\u5206\u914D\uFF0C\u5F15\u5BFC\u5B66\u751F\u9886\u4F1A\u2018\u6CF0\u5766\u4EE3\u8868\u72C2\u66B4\u81EA\u7136\uFF0C\u5965\u6797\u5339\u65AF\u8C61\u5F81\u5F8B\u6CD5\u89C4\u8303\u2019\u8FD9\u4E00\u6838\u5FC3\u5B97\u6559\u5B66\u6F14\u66FF\u5B9E\u8D28\u3002"
        },
        {
          chapterIndex: "03",
          title: "\u6CE2\u585E\u51AC\u6D77\u9646\u795E\u6743\u5212\u5B9A",
          coveredChapters: "Topic 2.1",
          summary: "\u6D77\u6D0B\u81EA\u7136\u5C5E\u6027, \u5730\u9707\u5D29\u88C2\u56FE\u817E, \u795E\u6743\u529B\u56FE\u8C31",
          gameType: "quiz",
          gameTitle: "\u4E09\u53C9\u621F\u72C2\u6F9C\u5E72\u9884\uFF1A\u5E73\u606F\u7231\u7434\u6D77\u6012\u543C\u6D77\u6E2F",
          gameRules: "\u66B4\u98CE\u96E8\u6D77\u5578\u6B63\u8981\u628A\u5E0C\u814A\u5E9E\u5927\u7684\u8FD4\u4E61\u8239\u961F\u62CD\u788E\u5728\u81F4\u547D\u6697\u7901\u4E0A\uFF01\u4F60\u4F5C\u4E3A\u4ED6\u7684\u795E\u5E99\u5927\u796D\u53F8\uFF0C\u9762\u4E34\u6C34\u624B\u6781\u5EA6\u6050\u614C\u7684\u54D7\u53D8\u66B4\u4E71\u3002\u4F60\u5FC5\u987B\u5206\u6790\u6CE2\u585E\u51AC\u6D77\u6D0B\u3001\u5730\u9707\u591A\u76F8\u56FE\u817E\u795E\u529B\u7684\u89E6\u53D1\u5F52\u56E0\uFF0C\u5411\u56FD\u738B\u548C\u6C34\u624B\u63D0\u4F9B\u5728\u795E\u660E\u72C2\u6012\u80CC\u540E\u7684\u6DF1\u5C42\u7406\u6027\u5E73\u606F\u8BBA\u8BC1\u6307\u5357\uFF0C\u505A\u51FA\u5B89\u629A\u4E0E\u796D\u7940\u535A\u5F08\u9009\u62E9\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u4E0D\u53EA\u662F\u7B80\u5355\u586B\u9E2D\u5F0F\u8BB0\u719F\u8C01\u662F\u6D77\u795E\uFF0C\u800C\u662F\u901A\u8FC7\u5BF9\u81EA\u7136\u707E\u53D8\u548C\u795E\u6027\u5173\u8054\u7684\u5256\u6790\uFF0C\u638C\u63E1\u53E4\u4EBA\u5BF9\u6D77\u6D0B\u65E0\u9650\u656C\u754F\u4E0B\u7684\u4FE1\u4EF0\u673A\u5236\u3002"
        },
        {
          chapterIndex: "04",
          title: "\u96C5\u5178\u5A1C\u536B\u57CE\u57CE\u9632\u51B3\u7B56",
          coveredChapters: "Topic 2.2",
          summary: "\u57CE\u90A6\u5B88\u62A4\u5951\u7EA6, \u667A\u6167\u7B56\u7565\u5BF9\u6297, \u6A44\u6984\u6811\u7684\u793E\u4F1A\u9690\u55BB",
          gameType: "math-quest",
          gameTitle: "\u96C5\u5178\u5B88\u62A4\u547D\u540D\u5927\u6218\uFF1A\u6A44\u6984\u751F\u547D\u529B\u5BF9\u6297\u72C2\u66B4\u6F6E\u6C50",
          gameRules: "\u96C5\u5178\u9762\u4E34\u6CE2\u585E\u51AC\u7684\u4E09\u53C9\u621F\u6D77\u6CC9\u4FB5\u8680\uFF0C\u751F\u5B58\u5371\u673A\u8FEB\u5728\u7709\u776B\u3002\u800C\u96C5\u5178\u5A1C\u7684\u6A44\u6984\u679D\u5219\u8C61\u5F81\u7740\u519C\u8015\u4E0E\u548C\u5E73\u7684\u57FA\u77F3\u3002\u5355\u4EBA\u5B66\u751F\u626E\u6F14\u9996\u5E2D\u5185\u9601\u5B98\uFF0C\u9700\u8981\u901A\u8FC7\u590D\u6742\u7684\u793E\u4F1A\u8D44\u6E90\u5E73\u8861\u8BA1\u7B97\u6A21\u578B\uFF0C\u8BC4\u4F30\u4E24\u5C0A\u795E\u660E\u5404\u81EA\u8D50\u798F\u5728\u767E\u5E74\u8DE8\u5EA6\u91CC\u5BF9\u96C5\u5178\u57CE\u90A6\u7CAE\u98DF\u4EA7\u91CF\u3001\u822A\u6D77\u4F18\u52BF\u7684\u6700\u7EC8\u526A\u5207\u6548\u80FD\uFF0C\u5B8C\u6210\u51B3\u5B9A\u57CE\u90A6\u56FD\u8FD0\u7684\u5723\u9009\u51B3\u7B56\u3002",
          duration: "11\u5206\u949F",
          designRationale: "\u5C06\u795E\u8BDD\u7ADE\u4E89\u8F6C\u5316\u4E3A\u6781\u5176\u73B0\u5B9E\u7684\u57CE\u90A6\u56FD\u5BB6\u89C4\u5212\uFF0C\u4F7F\u6A44\u6984\u4E0E\u9A6C\u7684\u8BBE\u8BA1\u5F7B\u5E95\u53D8\u4E3A\u793E\u4F1A\u751F\u4EA7\u529B\u89C6\u89D2\u7684\u535A\u5F08\u53CD\u63A8\u3002"
        },
        {
          chapterIndex: "05",
          title: "\u51A5\u5E9C\u5E7D\u51A5\u9B42\u5883\u88C1\u5224",
          coveredChapters: "Topic 2.3",
          summary: "\u51A5\u6CB3\u5BA1\u5224\u903B\u8F91, \u5584\u6076\u9B42\u7075\u5206\u6D41, \u547D\u8FD0\u79E9\u5E8F\u795E\u5370",
          gameType: "coding-puzzle",
          gameTitle: "\u963F\u683C\u9686\u6CB3\u6E21\u53E3\uFF1A\u4FEE\u6B63\u4EA1\u9B42\u5206\u6D41\u5BA1\u5224\u5224\u5B9A",
          gameRules: "\u51A5\u6CB3\u66B4\u6DA8\uFF0C\u6570\u4EE5\u5343\u4E07\u8BA1\u7684\u6B7B\u8005\u7075\u9B42\u5728\u5BA1\u5224\u6CD5\u5EAD\u524D\u53D1\u751F\u8E29\u8E0F\u3001\u65E0\u671B\u547C\u53F7\uFF01\u6CD5\u5B98\u7C73\u8BFA\u65AF\u5224\u65AD\u79E9\u5E8F\u7B97\u6CD5\u94FE\u906D\u9047\u8BC5\u5492\u7BE1\u6539\u3002\u73A9\u5BB6\u5FC5\u987B\u4F5C\u4E3A\u6CD5\u95E8\u76D1\u62A4\u4F7F\u8005\uFF0C\u6839\u636E\u53E4\u5E0C\u814A\u2018\u672A\u5165\u571F\u8005\u3001\u5927\u6076\u4E4B\u4EBA\u3001\u82F1\u96C4\u4EA1\u9B42\u2019\u591A\u7EA7\u5F8B\u6CD5\uFF0C\u7D27\u6025\u6392\u67E5\u5E76\u91CD\u65B0\u7F16\u6392\u903B\u8F91\u5C42\u4EE3\u7801\uFF0C\u9632\u6B62\u65E0\u5E8F\u4EA1\u7075\u503E\u8986\u6B7B\u795E\u5927\u6BBF\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5C06\u6B7B\u540E\u4E16\u754C\u7684\u9636\u5C42\u5206\u6D41\u4E0E\u5224\u5B9A\u903B\u8F91\u7ED3\u5408\uFF0C\u53CD\u6620\u53E4\u5E0C\u814A\u5BF9\u751F\u524D\u5FB7\u884C\u3001\u846C\u793C\u5C0A\u91CD\u548C\u4E16\u9053\u516C\u6B63\u7684\u6CD5\u5F8B\u5FC3\u7406\u5E95\u8272\u3002"
        },
        {
          chapterIndex: "06",
          title: "\u666E\u7F57\u7C73\u4FEE\u65AF\u706B\u79CD\u6388\u4EBA\u5951\u7EA6",
          coveredChapters: "Topic 2.4",
          summary: "\u5077\u76D7\u5929\u706B\u672C\u8D28, \u5B99\u65AF\u53CD\u5411\u60E9\u6212, \u9884\u77E5\u80FD\u529B\u535A\u5F08",
          gameType: "interactive-story",
          gameTitle: "\u9AD8\u52A0\u7D22\u5DE8\u5CA9\u5CED\u58C1\uFF1A\u9762\u4E34\u98DE\u9E70\u5544\u809D\u7684\u7EC8\u6781\u5BF9\u5CD9",
          gameRules: "\u592A\u9633\u6218\u8F66\u5929\u706B\u88AB\u4E0B\u51E1\u76D7\u53D6\uFF0C\u5B99\u65AF\u72C2\u6012\uFF0C\u8981\u628A\u666E\u7F57\u7C73\u4FEE\u65AF\u6B7B\u9501\u60AC\u5D16\u3002\u4F60\u9700\u8981\u5728\u9009\u62E9\u5411\u795E\u6743\u4F4E\u5934\u64A4\u56DE\u77E5\u8BC6\uFF0C\u8FD8\u662F\u5F7B\u5E95\u627F\u62C5\u4E07\u5E74\u6298\u78E8\u8BA9\u706B\u79CD\u5728\u6587\u660E\u5730\u6BEF\u5F0F\u64AD\u79CD\u4E2D\u505A\u51FA\u7EC8\u6781\u62F7\u95EE\u6289\u62E9\uFF0C\u5E76\u5411\u6F58\u591A\u62C9\u76D2\u5B50\u7684\u91CA\u653E\u63D0\u51FA\u6DF1\u5C42\u903B\u8F91\u6743\u8861\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5F15\u5BFC\u5B66\u5458\u5728\u5927\u4E49\u4E0E\u4E2A\u4EBA\u6781\u7AEF\u75DB\u82E6\u7684\u714E\u71AC\u4E2D\u81EA\u51B3\u8FA9\u62A4\uFF0C\u6DF1\u523B\u7406\u89E3\u795E\u8BDD\u4E2D\u2018\u5929\u706B\u76D7\u53D6\u8C61\u5F81\u7740\u72EC\u7ACB\u7406\u6027\u548C\u4E0D\u5C48\u670D\u795E\u5A01\u7684\u89C9\u9192\u5386\u7A0B\u2019\u3002"
        },
        {
          chapterIndex: "07",
          title: "\u5FB7\u5C14\u6590\u5BBF\u547D\u5927\u6BBF\u7684\u53CD\u8BBD",
          coveredChapters: "Topic 3.1",
          summary: "\u5FB7\u5C14\u6590\u795E\u8C15, \u5BBF\u547D\u60B2\u5267\u53CD\u8BBD, \u6027\u683C\u5C40\u9650\u5F52\u56E0",
          gameType: "quiz",
          gameTitle: "\u8BA4\u8BC6\u4F60\u81EA\u5DF1\uFF1A\u7834\u89E3\u795E\u8C15\u5BF9\u53CD\u6297\u82F1\u96C4\u7684\u53CC\u91CD\u7EDE\u6740",
          gameRules: "\u5927\u5730\u4E0A\u6700\u9A84\u50B2\u7684\u738B\u5B50\u8BD5\u56FE\u7ED5\u8FC7\u2018\u5FC5\u5F11\u5176\u7236\u2019\u7684\u68A6\u9B47\u9884\u8A00\u3002\u4F60\u4F5C\u4E3A\u963F\u6CE2\u7F57\u4E4B\u773C\u5927\u796D\u53F8\uFF0C\u9700\u8981\u8FDE\u73AF\u8BBA\u8BC1\u9762\u5BF9\u5BBF\u547D\u9884\u8A00\u65F6\uFF0C\u82F1\u96C4\u6BCF\u4E00\u6B65\u5145\u6EE1\u7406\u6027\u9A84\u50B2\uFF08Hubris\uFF09\u7684\u9003\u907F\u51B3\u5B9A\u662F\u5982\u4F55\u6070\u6070\u5728\u903B\u8F91\u94FE\u6761\u4E2D\u4EB2\u624B\u7EC7\u5C31\u4E86\u5BBF\u547D\u7F51\u515C\uFF08\u5982\u4FC4\u72C4\u6D66\u65AF\u738B\uFF09\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5F7B\u5E95\u6839\u9664\u795E\u8BDD\u662F\u7B80\u5355\u5DE7\u5408\u7684\u6D45\u8584\u89C2\u5FF5\uFF0C\u5F15\u5BFC\u5B66\u751F\u7406\u89E3\u53E4\u5E0C\u814A\u5B66\u8005\u5BF9\u4EBA\u610F\u5FD7\u6297\u8861\u5929\u547D\u3001\u5374\u53C8\u53D7\u6027\u683C\u5C40\u9650\u9650\u5236\u7684\u5B8F\u4EAE\u60B2\u5267\u5BBF\u547D\u95ED\u73AF\u8BE0\u91CA\u3002"
        },
        {
          chapterIndex: "08",
          title: "Perseus\u7F8E\u675C\u838E\u9B54\u955C\u730E\u6740",
          coveredChapters: "Topic 3.2",
          summary: "\u89C6\u7EBF\u77F3\u5316\u673A\u5236, \u96C5\u5178\u5A1C\u76FE\u724C\u53CD\u5149, \u82F1\u96C4\u7B56\u7565\u6B66\u88C5",
          gameType: "cross-match",
          gameTitle: "\u6208\u5C14\u8D21\u9B54\u5973\u5DE2\u7A74\uFF1A\u955C\u9762\u7269\u7406\u5149\u5B66\u53CD\u5C04\u6781\u9650\u6311\u6218",
          gameRules: "\u7F8E\u675C\u838E\u6012\u7741\u53CC\u76EE\uFF0C\u51E1\u4E0E\u5176\u5BF9\u89C6\u8005\u77AC\u95F4\u78B3\u5316\u3002\u4F5C\u4E3A\u5E26\u8DEF\u796D\u53F8\u7684\u4F60\uFF0C\u6B63\u534F\u52A9\u73C0\u5C14\u4FEE\u65AF\u3002\u4F60\u5FC5\u987B\u5728\u6C99\u76D8\u4E0A\u5C06\u96C5\u5178\u5A1C\u4E4B\u76FE\u7684\u5B8C\u7F8E\u504F\u89D2\u53CD\u5C04\u673A\u5236\uFF0C\u4E0E\u8D6B\u5C14\u58A8\u65AF\u98DE\u978B\u7684\u901F\u5EA6\u963B\u5C3C\u8FDB\u884C\u7CBE\u786E\u5BF9\u9F50\uFF0C\u7B97\u51C6\u6298\u5C04\u8DEF\u7EBF\u5236\u5BFC\u82F1\u96C4\u5728\u5B8C\u5168\u4E0D\u5E73\u89C6\u76F2\u533A\u65A9\u4E0B\u9996\u7EA7\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u7528\u51E0\u4F55\u5BF9\u9F50\u6311\u6218\u4F7F\u81EA\u5B66\u8005\u8BA4\u8BC6\u5230\u82F1\u96C4\u5947\u8FF9\u5E76\u975E\u4EC5\u9760\u795E\u4ED9\u5F00\u6302\uFF0C\u66F4\u662F\u5728\u7EDD\u5BF9\u81F4\u547D\u5C40\u9650\u4E0B\u7528\u7CBE\u7EC6\u5DE5\u5177\u548C\u8BA1\u7B97\u8FBE\u5230\u7684\u795E\u8C0B\u5947\u7EDD\u3002"
        },
        {
          chapterIndex: "09",
          title: "\u5965\u9769\u963F\u65AF\u725B\u5708\u6CC4\u6D2A\u6D41\u63A7",
          coveredChapters: "Topic 4.1",
          summary: "\u8D6B\u62C9\u514B\u52D2\u65AF\u5341\u4E8C\u4F1F\u4E1A, \u6CB3\u6D41\u52A8\u529B\u7269\u7406\u5B66, \u5C48\u8FB1\u8BD5\u70BC\u8F6C\u5316",
          gameType: "math-quest",
          gameTitle: "\u5927\u6CB3\u6539\u9053\u7EDD\u6280\uFF1A\u5728\u65E5\u843D\u524D\u758F\u901A\u4E07\u5934\u725B\u5708\u6DE4\u7ED3",
          gameRules: "\u4E09\u5341\u5E74\u672A\u6E05\u7684\u51E0\u4E07\u5934\u725B\u7684\u725B\u7CAA\u6DE4\u6CE5\u5806\u79EF\u5982\u5C71\uFF0C\u50B2\u6162\u56FD\u738B\u9650\u4F60\u4E00\u5929\u5168\u626B\u3002\u4F60\u73B0\u5728\u5FC5\u987B\u8BA1\u7B97\u963F\u5C14\u6590\u4FC4\u65AF\u6CB3\u7684\u622A\u6D41\u622A\u9762\uFF0C\u6C42\u5F97\u6700\u5927\u77AC\u65F6\u6C34\u52A8\u91CF\u51B2\u51FB\u80FD\u91CF\uFF0C\u7CBE\u51C6\u5E73\u8861\u5927\u6CB3\u51B2\u51FB\u529B\u4E0D\u81F3\u4E8E\u8F70\u788E\u57CE\u9632\u5730\u8868\u6216\u6E05\u626B\u5931\u8D25\u7684\u53CC\u91CD\u7269\u7406\u6781\u9650\u3002",
          duration: "12\u5206\u949F",
          designRationale: "\u5C06\u4F1F\u4E1A\u5305\u5B55\u5728\u7CBE\u786E\u6C34\u5229\u5DE5\u7A0B\u4E0B\uFF0C\u4F7F\u8D6B\u62C9\u514B\u52D2\u65AF\u7528\u667A\u8C0B\u6218\u80DC\u65E0\u8C13\u6B7B\u529B\u7684\u5927\u5E08\u98CE\u8303\u4E00\u8DC3\u800C\u4E0A\u3002"
        },
        {
          chapterIndex: "10",
          title: "\u51A5\u6CB3\u6E21\u8F6E\u963F\u9686\u5951\u7EA6\u5E73\u8861",
          coveredChapters: "Topic 4.2",
          summary: "\u4E0D\u673D\u4E4B\u8EAF\u4E0E\u51E1\u4FD7\u6781\u6027, \u51A5\u6CB3\u5951\u7EA6\u8A93\u8A00, \u7269\u7406\u4F24\u5BB3\u4F20\u9012",
          gameType: "interactive-story",
          gameTitle: "\u65AF\u63D0\u514B\u65AF\u771F\u706B\u6D17\u793C\uFF1A\u963F\u5580\u7409\u65AF\u7684\u7EDD\u6B7B\u6B7B\u89D2\u66B4\u9732",
          gameRules: "\u6D77\u4E2D\u4ED9\u5973\u5FD2\u63D0\u65AF\u6B63\u7528\u51A5\u6CB3\u4E4B\u6C34\u6D78\u6CE1\u5A74\u513F\uFF0C\u7948\u6C42\u5168\u8EAB\u91D1\u521A\u4E0D\u574F\u3002\u7136\u800C\u7531\u4E8E\u63D0\u63E1\u5176\u811A\u8E1D\uFF0C\u5176\u811A\u8E35\u6210\u4E3A\u552F\u4E00\u80FD\u88AB\u6495\u5F00\u7684\u751F\u95E8\u3002\u4F60\u4F5C\u4E3A\u547D\u8FD0\u5B88\u62A4\u5B98\uFF0C\u9700\u8981\u6295\u7968\u51B3\u5B9A\u5728\u8FD9\u573A\u795E\u5723\u6297\u6027\u4E0E\u8106\u5F31\u7269\u7406\u6B7B\u8109\u5E76\u5B58\u7684\u5386\u53F2\u53D8\u5C40\u4E0B\uFF0C\u5982\u4F55\u90E8\u7F72\u5175\u529B\u786E\u4FDD\u963F\u5580\u7409\u65AF\u4E00\u751F\u7684\u6218\u7565\u5236\u80DC\u6982\u7387\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u7406\u89E3\u795E\u4E0D\u574F\u4E0E\u51E1\u4FD7\u6B7B\u7ED3\u540C\u5728\u7684\u5BBF\u547D\u9690\u55BB\uFF0C\u4F7F\u5B66\u751F\u4F53\u5473\u51FA\u53E4\u5178\u82F1\u96C4\u4E0D\u706D\u4E0E\u4E0D\u53EF\u633D\u56DE\u7684\u6BC1\u706D\u6B7B\u751F\u7F20\u7ED3\u54F2\u5B66\u3002"
        },
        {
          chapterIndex: "11",
          title: "\u91D1\u82F9\u679C\u963F\u7279\u62C9\u65AF\u91CD\u8D1F\u6B3A\u9A97",
          coveredChapters: "Topic 4.3",
          summary: "\u53CC\u5411\u535A\u5F08\u5BF9\u6297, \u91CD\u529B\u5E38\u6570\u7F6E\u6362, \u5DE7\u667A\u4EE3\u66FF\u66B4\u529B",
          gameType: "coding-puzzle",
          gameTitle: "\u82CD\u7A79\u91CD\u529B\u4EA4\u6362\u7B97\u6CD5\uFF1A\u4ECE\u5DE8\u4EBA\u80A9\u8180\u4E0A\u53D6\u56DE\u91D1\u82F9\u679C",
          gameRules: "\u963F\u7279\u62C9\u65AF\u8BF1\u9A97\u4F60\u66FF\u4ED6\u4E3E\u8D77\u503E\u8986\u7684\u84DD\u5929\u82CD\u7A79\uFF0C\u5E76\u72DE\u7B11\u8981\u626C\u957F\u8FDC\u53BB\uFF0C\u91CD\u538B\u6B63\u8981\u628A\u4F60\u7684\u5168\u8EAB\u9AA8\u9ABC\u7C89\u788E\u6210\u6E23\uFF01\u4F60\u5FC5\u987B\u4EE5\u9AD8\u7CBE\u5EA6\u903B\u8F91\u62FC\u63A5\u2018\u5BFB\u627E\u66FF\u4EE3\u91CD\u529B\u70B9\u3001\u5DE8\u4EBA\u56DE\u5F52\u6761\u4EF6\u6821\u9A8C\u3001\u4E34\u65F6\u57AB\u80A9\u535A\u5F08\u6B3A\u7792\u2019\u7684\u4EE3\u7801\u94FE\uFF0C\u5728\u795E\u7EA7\u7EDD\u5BF9\u529B\u91CF\u6297\u8861\u7EA2\u7EBF\u7206\u9707\u4E4B\u524D\u8BA9\u4E24\u4E24\u7269\u7406\u91CD\u8377\u4E92\u6362\u590D\u4F4D\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u7A81\u663E\u667A\u6027\u535A\u5F08\u5BF9\u5355\u7EAF\u66B4\u529B\u4E0A\u9650\u7684\u78BE\u538B\uFF0C\u628A\u8FD9\u4E00\u5BD3\u8A00\u5F7B\u5E95\u5185\u5316\u5230\u8F6F\u4EF6\u653B\u9632\u535A\u5F08\u53CA\u5FC3\u7406\u89D2\u529B\u7684\u7B97\u6CD5\u5EFA\u6784\u91CC\u3002"
        },
        {
          chapterIndex: "12",
          title: "\u7279\u6D1B\u4F0A\u6D41\u8A00\u5D29\u89E3\u8F3F\u8AD6\u6218",
          coveredChapters: "Topic 5.1",
          summary: "\u62C9\u5965\u5B54\u8B66\u706F, \u7279\u6D1B\u4F0A\u6728\u9A6C\u8C36\u7EAC, \u8206\u8BBA\u60C5\u62A5\u53CD\u653B",
          gameType: "quiz",
          gameTitle: "\u62C9\u5965\u5B54\u4E4B\u6012\uFF1A\u51FB\u6E83\u796D\u53F8\u5BF9\u6728\u9A6C\u7684\u771F\u4F2A\u8D28\u7591",
          gameRules: "\u8001\u796D\u53F8\u62C9\u5965\u5B54\u6B63\u5BF9\u5E02\u6C11\u9AD8\u547C\u2018\u8B66\u60D5\u5E0C\u814A\u4EBA\u54EA\u6015\u5E26\u7740\u793C\u7269\uFF01\u2019\uFF0C\u5E76\u63B7\u51FA\u6295\u77DB\u51FB\u7A7F\u6728\u9A6C\u53D1\u51FA\u7A7A\u6D1E\u56DE\u54CD\uFF0C\u7279\u6D1B\u4F0A\u9AD8\u5C42\u9762\u4E34\u5F7B\u5E95\u62D2\u7EDD\u8BA1\u5212\u7684\u6781\u9650\u6B7B\u5C40\uFF0C\u4F60\u7684\u5185\u5E94\u8EAB\u4EFD\u5371\u60AC\u4E00\u7EBF\u3002\u4F60\u5FC5\u987B\u8BCA\u65AD\u6728\u9A6C\u796D\u7940\u795E\u660E\u5929\u7F5A\u7684\u5B97\u6559\u6050\u60E7\u5FC3\u7406\uFF0C\u8BBA\u8BC1\u91CA\u653E\u53CD\u5411\u8206\u8BBA\u6D41\u8A00\u51FB\u788E\u796D\u53F8\u6000\u7591\u5927\u7F51\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5C06\u519B\u4E8B\u5947\u8C0B\u5305\u88C5\u4E3A\u9AD8\u5EA6\u590D\u6742\u7684\u5FC3\u7406\u4FE1\u606F\u5BF9\u6297\u4E0E\u5371\u673A\u63A7\u5236\uFF0C\u8BA9\u53E4\u795E\u7F5A\u5728\u4EBA\u667A\u8C0B\u5212\u4E0B\u5F70\u663E\u5176\u60CA\u4EBA\u7684\u5386\u53F2\u5F52\u56E0\u903B\u8F91\u3002"
        },
        {
          chapterIndex: "13",
          title: "\u963F\u5580\u7409\u65AF\u795E\u6012\u72C2\u6F9C",
          coveredChapters: "Topic 5.2",
          summary: "\u6218\u795E\u7279\u8D28\u72C2\u70ED, \u5E15\u7279\u7F57\u514B\u6D1B\u65AF\u590D\u4EC7, \u6218\u5C40\u503E\u659C\u62D0\u70B9",
          gameType: "interactive-story",
          gameTitle: "\u631A\u53CB\u4E4B\u6B7B\u7EA2\u7EBF\u7A81\u8D8A\uFF1A\u6124\u6012\u4E4B\u795E\u7684\u6740\u622E\u4E0E\u7406\u667A\u5E73\u8861",
          gameRules: "\u5E15\u7279\u7F57\u514B\u6D1B\u65AF\u88AB\u8D6B\u514B\u6258\u8033\u67AD\u9996\uFF0C\u72C2\u98CE\u4E2D\u60B2\u66F2\u56DE\u65CB\uFF0C\u963F\u5580\u7409\u65AF\u7684\u7EDD\u6B7B\u6218\u72C2\uFF08Furor\uFF09\u7A81\u7834\u5FC3\u7406\u8B66\u6212\u3002\u4F60\u9700\u8981\u6295\u7968\u548C\u51B3\u7B56\u662F\u5426\u4E0B\u53D1\u5168\u65B0\u8D6B\u6CD5\u4F0A\u65AF\u6258\u65AF\u795E\u94C1\u6218\u8863\uFF0C\u5728\u5E73\u4E71\u3001\u590D\u4EC7\u8FFD\u9003\u4E0E\u5BF9\u7279\u6D1B\u4F0A\u795E\u5723\u6CB3\u795E\u6781\u5EA6\u5192\u72AF\u5BFC\u81F4\u7684\u72C2\u6F9C\u5DE8\u53E3\u4E4B\u95F4\u5236\u5BFC\u5BBF\u547D\u9000\u654C\u8F68\u9053\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u6DF1\u5C42\u4F53\u609F\u60B2\u5267\u82F1\u96C4\u4E3A\u4E86\u590D\u4EC7\u4E0D\u60DC\u5C06\u5168\u4E16\u754C\u5316\u4E3A\u5E9F\u571F\u7684\u6781\u7AEF\u7CBE\u795E\u72B6\u6001\uFF0C\u6DF1\u523B\u900F\u5C04\u82F1\u96C4\u8363\u8A89\u673A\u5236\u80CC\u540E\u7684\u6781\u7AEF\u6BC1\u706D\u7834\u574F\u54F2\u5B66\u3002"
        },
        {
          chapterIndex: "14",
          title: "\u6728\u9A6C\u7A7A\u6210\u8BA1\u79D2\u6570\u6F5C\u5165",
          coveredChapters: "Topic 5.3",
          summary: "\u7A7A\u95F4\u6F5C\u5165\u65F6\u95F4\u6D41, \u5185\u90E8\u8FDE\u9501\u5F00\u542F, \u6218\u5C40\u4FE1\u606F\u5B8C\u5168\u6027",
          gameType: "coding-puzzle",
          gameTitle: "\u7279\u6D1B\u4F0A\u57CE\u9632\u5185\u819B\uFF1A\u7F16\u6392\u5BC2\u9759\u5F00\u5408\u7A81\u51FB\u8DEF\u5F84",
          gameRules: "\u7279\u6D1B\u4F0A\u57CE\u5DF2\u559D\u9189\u6C89\u7761\uFF0C\u6728\u9A6C\u4E2D\u5E0C\u814A\u4F0F\u5175\u8981\u5728\u795E\u660E\u796D\u6708\u843D\u5230\u5929\u5E55\u4E09\u5206\u4E4B\u4E8C\u70B9\u77AC\u65F6\u5F00\u542F\u51FA\u53E3\u3002\u7531\u4E8E\u6728\u9A6C\u8231\u53E3\u4F20\u52A8\u673A\u68B0\u5361\u987F\u3002\u4F60\u9700\u8981\u91CD\u6392\u7A81\u51FB\u961F\u5458\u9759\u97F3\u7D22\u964D\u3001\u6E05\u9664\u6697\u54E8\u3001\u5927\u5F00\u57CE\u95E8\u4E09\u4E2A\u6838\u5FC3\u7B97\u5B50\u7684\u8FD0\u884C\u6392\u5E8F\uFF0C\u901A\u8FC7\u5B8C\u7F8E\u7684\u65F6\u95F4\u6D41\u63A7\u5236\u4EE3\u7801\u6821\u51C6\u964D\u6E29\u7A81\u5165\u9632\u7EBF\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5728\u5371\u673A\u56DB\u4F0F\u7684\u65F6\u95F4\u7CBE\u5EA6\u6781\u9650\u91CC\uFF0C\u8FEB\u4F7F\u5B66\u5458\u4F53\u5473\u7A7A\u95F4\u6F5C\u5165\u5728\u65E0\u58F0\u9759\u97F3\u7EA6\u675F\u4E0B\u7684\u6781\u5EA6\u9AD8\u538B\u5DE5\u7A0B\u7F16\u6392\u3002"
        },
        {
          chapterIndex: "15",
          title: "\u585E\u58EC\u4E3B\u6845\u6746\u535A\u5F08\u5951\u7EA6",
          coveredChapters: "Topic 6.1",
          summary: "\u5965\u5FB7\u8D5B\u5951\u7EA6, \u884C\u4E3A\u7ECF\u6D4E\u81EA\u5F8B\u673A\u5236, \u4FE1\u606F\u63A5\u6536\u81EA\u51B3",
          gameType: "interactive-story",
          gameTitle: "\u5730\u72F1\u4E4B\u97F3\u5973\u5996\u5C16\u5578\uFF1A\u6346\u7ED1\u6845\u6746\u4E0B\u7684\u65E0\u8A00\u6307\u4EE4\u603B\u51B3\u9009",
          gameRules: "\u5973\u5996\u81F4\u547D\u585E\u58EC\u4E4B\u6B4C\u76F4\u8FBE\u5FC3\u9AD3\uFF0C\u8981\u628A\u4F60\u5F15\u5411\u541E\u566C\u6B7B\u4EA1\u7684\u7901\u77F3\uFF0C\u5965\u5FB7\u4FEE\u65AF\u88AB\u6346\u7ED1\u7684\u6845\u6746\u5DF2\u5728\u5267\u70C8\u6447\u6643\u5E76\u52D2\u51FA\u8840\u8FF9\uFF0C\u7406\u667A\u5D29\u6BC1\u3002\u5982\u82E5\u677E\u5F00\uFF0C\u98DE\u8239\u5C06\u5728\u6ED4\u5929\u6D77\u6D6A\u4E2D\u649E\u7901\u800C\u901D\u3002\u4F60\u5FC5\u987B\u5728\u75DB\u82E6\u5267\u6BD2\u6298\u78E8\u4E2D\uFF0C\u901A\u8FC7\u6307\u5934\u6253\u51FA\u65E0\u58F0\u95EA\u5C4F\u6307\u4EE4\u5728\u4E0D\u80FD\u5F00\u53E3\u7684\u7EDD\u88C2\u610F\u5FD7\u6495\u626F\u4E2D\uFF0C\u6307\u6325\u8033\u585E\u5C01\u5B58\u7684\u6C34\u624B\u4FDD\u6301\u98CE\u66B4\u5207\u504F\u89D2\u822A\u9053\u9003\u51FA\u751F\u5929\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u4F5C\u4E3A\u884C\u4E3A\u7ECF\u6D4E\u5B66\u548C\u535A\u5F08\u8BBA\u5723\u5178\u4E2D\u7684\u2018\u9884\u5148\u627F\u8BFA\u5951\u7EA6\u2019\uFF08Commitment Device\uFF09\u4E4B\u6E90\uFF0C\u8BA9\u5B66\u8005\u4F9D\u9760\u4EA4\u4E92\u5728\u5185\u5FC3\u786E\u7ACB\u2018\u9884\u5148\u9650\u5236\u4EFB\u6027\u3001\u65B9\u80FD\u6323\u8131\u4EBA\u9053\u6B7B\u89D2\u2019\u7684\u601D\u7EF4\u8DC3\u8FC1\u3002"
        }
      ]
    };
  }
  if (normTitle.includes("python") || normTitle.includes("code") || normTitle.includes("\u7F16\u7A0B") || normTitle.includes("wizard")) {
    return {
      title: "\u300APython\u9B54\u6CD5\u5361\u724C\u5B66\u9662\u300B",
      modules: [
        {
          chapterIndex: "01",
          title: "\u5185\u5B58\u5B9D\u7BB1\u9B54\u529B\u5C01\u88C5",
          coveredChapters: "Topic 1.1",
          summary: "\u53D8\u91CF\u5185\u5B58\u5BFB\u5740, \u6570\u636E\u7C7B\u578B\u8F6C\u6362, \u903B\u8F91\u5E03\u5C14\u80FD",
          gameType: "coding-puzzle",
          gameTitle: "\u9B54\u6CD5\u6EA2\u6D41\u5371\u673A\uFF1A\u7194\u70BC\u4E0D\u7A33\u5B9A\u6570\u636E\u7B26\u6587",
          gameRules: "\u5723\u6BBF\u9B54\u529B\u6C34\u6676\u56E0\u5185\u5B58\u6CC4\u6F0F\u53D1\u751F\u72C2\u66B4\u9707\u8361\uFF01\u4F5C\u4E3A\u5B9E\u4E60\u7ED3\u5370\u5E08\uFF0C\u4F60\u9700\u8981\u5FEB\u901F\u5728\u4E00\u884C\u884C\u62A5\u9519\u6307\u9488\u4E2D\uFF0C\u627E\u51FA\u6DF7\u5408\u7C7B\u578B\u7531\u4E8E\u9690\u5F0F\u5F3A\u8F6C\uFF08\u628Astr\u4E0Eint\u76F4\u63A5\u76F8\u52A0\uFF09\u5BFC\u81F4\u7684\u6CD5\u672F\u5D29\u584C\uFF0C\u62FC\u8865\u5E76\u5C01\u88C5\u7C7B\u578B\u68C0\u6D4B\u4FDD\u62A4\u5C42\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u8BA9\u521D\u5B66\u8005\u4E0D\u518D\u89C9\u5F97\u6570\u636E\u7C7B\u578B\u662F\u5E72\u762A\u7684\u8BED\u6CD5\u6761\u76EE\uFF0C\u800C\u662F\u5728\u6A21\u62DF\u2018\u81F4\u547D\u5185\u5B58\u81A8\u80C0\u2019\u7684\u5B9E\u6218\u8BCA\u65AD\u4E2D\u7406\u89E3\u5176\u7269\u7406\u5B58\u50A8\u5F00\u9500\u4E0E\u9650\u5236\u3002"
        },
        {
          chapterIndex: "02",
          title: "\u53D8\u91CF\u7EA0\u7F20\u4E0E\u5730\u5740\u6D45\u590D\u5236",
          coveredChapters: "Topic 1.2",
          summary: "\u53EF\u53D8\u5BF9\u8C61\u4E0E\u4E0D\u53EF\u53D8\u5BF9\u8C61, \u5185\u5B58\u5F15\u7528\u57FA\u5740, id()\u6307\u9488\u6821\u9A8C",
          gameType: "cross-match",
          gameTitle: "\u8840\u8109\u5B6A\u751F\u8840\u5203\uFF1A\u89E3\u9664\u514B\u9686\u62A4\u8155\u7684\u53D8\u91CF\u7EA0\u7F20\u5371\u673A",
          gameRules: "\u4F60\u70BC\u5236\u7684\u2018\u529B\u91CF\u5361\u724CA\u2019\uFF08List\u5217\u8868\u5BF9\u8C61\uFF09\u5728\u88AB\u76F4\u63A5\u590D\u5236\u7ED9\u2018\u9B54\u6CD5\u5361\u724CB\u2019\uFF08B = A\uFF09\u540E\uFF0C\u5BF9B\u8FFD\u52A0\u589E\u76CA\u5C45\u7136\u5BFC\u81F4A\u7684\u5185\u5B58\u5C5E\u6027\u4E5F\u79BB\u5947\u81A8\u80C0\u5E76\u8FC7\u8F7D\u62A5\u9500\uFF01\u4F60\u5FC5\u987B\u8BCA\u65AD\u51FA\u5F15\u7528\u62F7\u8D1D\u5171\u4EAB\u51B2\u7A81\uFF0C\u5728\u591A\u6761\u6DF1\u5EA6\u514B\u9686\uFF08copy.deepcopy\uFF09\u3001\u539F\u6837\u5F15\u7528\u8FDE\u7EBF\u5339\u914D\u4E2D\u5207\u65AD\u540C\u6E90\u8840\u8109\u5171\u4EAB\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5728\u53D8\u91CF\u7EA0\u7F20\u6C61\u67D3\u7684\u91CD\u538B\u4E0B\uFF0C\u8BA9\u5B66\u8005\u6DF1\u5EA6\u4F53\u4F1A\u5E76\u7406\u89E3\u53EF\u53D8\u5BF9\u8C61\uFF08Mutable\uFF09\u8D4B\u503C\u80CC\u540E\u7684\u7269\u7406\u6307\u9488\u6982\u5FF5\uFF0C\u5F7B\u5E95\u514B\u670D\u5185\u5B58\u5E7D\u7075\u3002"
        },
        {
          chapterIndex: "03",
          title: "\u5F3A\u7C7B\u578B\u4E0E\u52A0\u53F7\u96F7\u9E23\u963B\u51FB",
          coveredChapters: "Topic 1.3",
          summary: "\u5F3A\u7C7B\u578B\u62E6\u622A\u673A\u5236, TypeCheck\u9759\u6001\u89C4\u5219, \u9690\u5F0F\u5F02\u5E38\u5904\u7406",
          gameType: "quiz",
          gameTitle: "\u62FC\u63A5\u7194\u7089\u7206\u6CB8\uFF1A\u62E6\u622APython\u89E3\u91CA\u5668Type\u62A5\u9519\u72C2\u6F6E",
          gameRules: "\u9AD8\u7089\u5185\u6B63\u51B6\u70BC\u2018\u5408\u91D1\u9B54\u6DB2\u2019\u3002\u5B66\u5F92\u56E0\u62FC\u9519\u516C\u5F0F\uFF1A'Flux' + 99\uFF0C\u4FC3\u4F7F\u7CFB\u7EDF\u53D1\u51FA\u96F7\u9E23\u7EA2\u8272TypeError\u3002\u9AD8\u7089\u6E29\u5EA6\u9661\u9AD8\u3002\u4F60\u5FC5\u987B\u4F5C\u4E3A\u603B\u63A7\u5236\u5E08\u7D27\u6025\u8BBA\u8BC1\u6B64\u62A5\u9519\u5F52\u56E0\uFF0C\u63A8\u6F14JavaScript\u9690\u5F0F\u8F6C\u6362\u5728\u8FD9\u6BB5\u4EE3\u7801\u4E2D\u7684\u5DEE\u5F02\uFF0C\u5E76\u6267\u884C\u663E\u5F0F\u6570\u636E\u62E6\u622A\u5F3A\u8F6C\u534F\u8BAE\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5BF9\u6BD4\u5F3A\u5F31\u7C7B\u578B\uFF0C\u8BA9\u521D\u5B66\u8005\u5728\u5927\u8111\u5185\u5EFA\u7ACB\u8D77\u575A\u633A\u7684\u7C7B\u578B\u9632\u7EBF\uFF0C\u4E0D\u56E0\u9690\u5F0F\u9519\u8BEF\u5E9F\u6B62\u4E86\u5DE5\u7A0B\u5E94\u7528\u3002"
        },
        {
          chapterIndex: "04",
          title: "If-Else \u5723\u5149\u6289\u62E9\u6298\u8FD4",
          coveredChapters: "Topic 2.1",
          summary: "\u903B\u8F91\u95E8\u5224\u65AD, \u5D4C\u5957\u6761\u4EF6\u8FB9\u754C, \u7279\u6743\u5B89\u5168\u62E6\u622A",
          gameType: "quiz",
          gameTitle: "\u5723\u95E8\u6289\u62E9\u94C1\u536B\uFF1A\u5B88\u62A4\u6838\u5FC3\u9B54\u529B\u8FB9\u754C",
          gameRules: "\u591A\u540D\u88AB\u6697\u9ED1\u9B54\u6CD5\u5BC4\u751F\u7684\u8BE1\u5F02\u4EBA\u5076\u8BD5\u56FE\u5F3A\u95EF\u5B89\u5168\u68C0\u6D4B\u5723\u95E8\u3002\u73A9\u5BB6\u626E\u6F14\u8FB9\u9632\u5BA1\u8BA1\u5723\u9A91\u58EB\u3002\u4F60\u9700\u8981\u8FDE\u7EED\u5206\u6790\u4E09\u91CD\u5D4C\u5957If\u6761\u4EF6\u5206\u652F\u5728\u6781\u51B7\u3001\u6781\u70ED\u6781\u9650\u72B6\u6001\u4E0B\u7684\u8BA1\u7B97\u6D41\uFF0C\u8BCA\u65AD\u590D\u6742\u5E03\u5C14\u903B\u8F91\u4E0E\u5E03\u5C14\u77ED\u8DEF\u6C42\u503C\u903B\u8F91\uFF0C\u505A\u51FA\u767E\u5206\u4E4B\u767E\u7CBE\u51C6\u7684\u653E\u884C\u6216\u683C\u6740\u51B3\u7B56\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u7528\u7D27\u5F20\u7684\u5173\u9632\u6289\u62E9\uFF0C\u8FEB\u4F7F\u5B66\u5458\u5F7B\u5E95\u653B\u514B\u5D4C\u5957\u8FB9\u754C\u3001\u6761\u4EF6\u4F18\u5148\u7EA7\u53CA\u77ED\u8DEF\u8BA1\u7B97\u7B49\u5BB9\u6613\u6DF7\u6DC6\u7684\u9AD8\u8BA4\u77E5\u75DB\u70B9\u3002"
        },
        {
          chapterIndex: "05",
          title: "\u54E8\u5175\u53D8\u91CF\u6781\u7AEF\u89E6\u53D1\u5C4F\u853D",
          coveredChapters: "Topic 2.2",
          summary: "\u8FB9\u754C\u503C\u5224\u5B9A, Sentinel\u54E8\u5175\u534F\u8BAE, True/False\u53D8\u91CF\u8DC3\u8FC1",
          gameType: "interactive-story",
          gameTitle: "\u9B54\u6CD5\u62A4\u76FE\u5D29\u5F00\u70B9\uFF1A\u5BFB\u627E\u51B3\u5B9A\u751F\u6B7B\u7684\u90A3\u4E2A\u903B\u8F91\u54E8\u5175",
          gameRules: "\u5BD2\u971C\u62A4\u76FE\u5728\u5916\u56F4\u7531\u4E8E\u70ED\u80FD\u653B\u51FB\u5448\u73B0\u590D\u6742\u7684\u538B\u529B\u6446\u5E45\u3002\u54E8\u5175\u5E03\u5C14\u53D8\u91CF`is_breached`\u7531\u4E8E\u591A\u91CD\u9632\u7EBF\u5224\u65AD\u5EF6\u8FDF\u53D1\u751F\u5931\u6548\u3002\u4F60\u9700\u8981\u8FDE\u7EED\u505A\u51FA\u6218\u672F\u6307\u4EE4\uFF0C\u51B3\u5B9A\u5728\u4F55\u79CD\u5B89\u5168\u4F59\u91CF\u91CD\u7F6E\u6B64\u6838\u5FC3\u903B\u8F91\u54E8\u5175\uFF0C\u786E\u4FDD\u62A4\u76FE\u4E0D\u4F1A\u56E0\u6781\u5C0F\u503C\u6EA2\u51FA\u800C\u6084\u7136\u5D29\u88C2\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u901A\u8FC7\u6218\u672F\u51B3\u7B56\u900F\u89C6\u72B6\u6001\u673A\uFF08StateMachine\uFF09\u5728\u903B\u8F91\u5F00\u53D1\u4E2D\u7684\u81F3\u9AD8\u53EF\u9760\u6027\uFF0C\u57F9\u517B\u5B66\u751F\u54E8\u5175\u9632\u5FA1\u7406\u5FF5\u3002"
        },
        {
          chapterIndex: "06",
          title: "For/While \u5343\u91CD\u65E0\u9650\u70BC\u754C",
          coveredChapters: "Topic 3.1",
          summary: "\u5FAA\u73AF\u6B65\u957F\u7EA6\u675F, \u6B7B\u5FAA\u73AF\u8FB9\u754C\u4E2D\u65AD, Break\u8DF3\u8F6C",
          gameType: "math-quest",
          gameTitle: "\u65E0\u9650\u6DF1\u6E0A\u9003\u9038\uFF1A\u8BA1\u7B97\u5E76\u65A9\u65AD\u6B7B\u9501\u6CD5\u9635",
          gameRules: "\u4F60\u88AB\u53CD\u53DB\u8005\u6254\u8FDB\u4E86\u4E00\u4E2A\u5728\u65E0\u9650\u8FED\u4EE3\u4E2D\u6025\u901F\u5347\u6E29\u7684While\u6CD5\u9635\u3002\u6E29\u5EA6\u6BCF\u5FAA\u73AF\u4E00\u6B21\u589E\u52A0\u4E00\u4E2A\u56E0\u5B50\u3002\u5B66\u5458\u5FC5\u987B\u7B97\u51C6\u53D8\u503C\u7684\u6781\u901F\u8DC3\u8FC1\u8303\u56F4\uFF0C\u8BCA\u65AD\u51FA\u7531\u4E8E\u63A7\u5236\u53D8\u91CF\u672A\u81EA\u589E\u5BFC\u81F4\u7684\u6B65\u957F\u9501\uFF0C\u7528\u7CBE\u786E\u8BA1\u7B97\u6C42\u5F97Break\u6CD5\u672F\u65BD\u5C55\u7684\u4E34\u754C\u5E27\u6570\u4EE5\u65A9\u65AD\u65E0\u9650\u6B7B\u70BC\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5C06\u7A7A\u6D1E\u7684Loop\u8BED\u6CD5\u4E0E\u6B7B\u5FAA\u73AF\u5E26\u6765\u7684\u70ED\u80FD\u5347\u6E29\u7B49\u91CF\u9F50\u89C2\uFF0C\u4F7F\u5B66\u751F\u81EA\u7136\u800C\u7136\u751F\u6210\u5BF9\u5FAA\u73AF\u7EC8\u6B62\u56E0\u5B50\u7684\u6761\u4EF6\u8B66\u6212\u5FC3\u3002"
        },
        {
          chapterIndex: "07",
          title: "\u60F0\u6027\u6C42\u503C\u6781\u9650\u7B97\u529B\u89E3\u56F4",
          coveredChapters: "Topic 3.2",
          summary: "range()\u751F\u6210\u5668\u7CBE\u7EC6\u5185\u5B58\u5F00\u9500, Iterator\u8FED\u4EE3\u539F\u7406, Yield\u5EF6\u8FDF\u8BA1\u7B97",
          gameType: "coding-puzzle",
          gameTitle: "\u8FDC\u53E4\u8D85\u5927\u578B\u5217\u8868\u5927\u5835\u8F66\uFF1A\u7528\u60F0\u6027\u53D1\u751F\u6307\u9488\u89E3\u51B3\u6EA2\u51FA\u6545\u969C",
          gameRules: "\u6570\u636E\u5E93\u88AB\u5343\u4E07\u884C\u8D85\u5927\u9B54\u6CD5\u539F\u4F53\u6570\u636E\u5305\u963B\u585E\u3002\u65E7\u5FAA\u73AF\u4EE3\u7801\u56E0\u8BD5\u56FE\u5168\u52A0\u8F7D\u81F3\u5217\u8868\uFF08List\uFF09\u4E2D\u5F15\u53D1\u60B2\u5267\u7684\u5185\u5B58OOM\u5927\u6B7B\u673A\u3002\u4F60\u9700\u8981\u8BCA\u65AD\u8FED\u4EE3\u6D41\u5E76\u5FEB\u901F\u91CD\u7F16\uFF0C\u5C06\u5E9E\u5927\u7684\u9759\u6001\u8303\u56F4\u8BA1\u7B97\u6539\u5199\u6210\u60F0\u6027\u53D1\u751F\u6307\u9488\uFF0C\u5F7B\u5E95\u758F\u901A\u5185\u5B58\u5835\u6B7B\u5927\u52A8\u8109\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5C06\u60F0\u6027\u6C42\u503C\u4E0E\u7269\u7406\u5185\u5B58\u5F00\u9500\u6302\u94A9\uFF0C\u8BA9\u81EA\u5B66\u8005\u6DF1\u5EA6\u60CA\u53F9\u4E8E\u8FED\u4EE3\u53D1\u751F\u5668\u5BF9\u7EF4\u6301\u9AD8\u5E76\u53D1\u3001\u8F7B\u91CF\u5BB9\u5668\u7684\u6838\u5FC3\u7B97\u529B\u610F\u4E49\u3002"
        },
        {
          chapterIndex: "08",
          title: "\u5217\u8868\u767E\u5B9D\u80F6\u56CA\u5927\u91CD\u6392",
          coveredChapters: "Topic 4.1",
          summary: "\u591A\u7EF4\u5217\u8868\u5207\u7247, \u5185\u5B58\u5F15\u7528\u5730\u5740, \u5143\u7D20\u5B89\u5168\u5254\u9664",
          gameType: "cross-match",
          gameTitle: "\u5723\u7269\u6B66\u5668\u5E93\u6536\u7EB3\uFF1A\u591A\u7EA7\u5217\u8868\u767E\u5B9D\u683C\u7CBE\u51C6\u5BF9\u9F50",
          gameRules: "\u5F3A\u5927\u7684\u8FDC\u53E4\u6B66\u5668\u5728\u6781\u9AD8\u6E29\u9707\u8361\u4E2D\u53D1\u751F\u4E86\u4E71\u5E8F\u6C61\u67D3\uFF0C\u4E71\u5957\u7684\u5217\u8868\u7D22\u5F15\u5C06\u6CD5\u4F24\u548C\u7269\u4F24\u5C5E\u6027\u5B8C\u5168\u91CD\u5408\u98A0\u5012\u3002\u5355\u4EBA\u5B66\u8005\u9700\u8981\u5C06\u7531\u4E8E\u53D8\u503C\u5BFC\u81F4\u7684\u5F15\u7528\u5171\u4EAB\u6D45\u62F7\u8D1D\u51B2\u7A81\u4E00\u4E00\u8BCA\u65AD\uFF0C\u5C06\u5217\u8868\u6DF1\u62F7\u8D1D\u3001\u533A\u95F4\u9006\u5E8F\u5207\u7247\u89C4\u5219\u4E0E\u6B66\u5668\u5E93\u4FEE\u590D\u903B\u8F91\u8FDB\u884C\u5B8C\u7F8E\u8FDE\u7EBF\u5339\u914D\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5BF9\u9F50\u5185\u5B58\u6DF1\u6D45\u62F7\u8D1D\u53CA\u7D22\u5F15\u8D8A\u754C\u6982\u5FF5\uFF0C\u4EE5\u56FE\u5F62\u6B66\u5668\u91CD\u6392\u5E8F\u4E3A\u8F7D\u4F53\uFF0C\u8BA9\u5B66\u5458\u6DF1\u523B\u4E86\u89E3\u5185\u5B58\u5730\u5740\u53D8\u503C\u7684\u9677\u9631\u3002"
        },
        {
          chapterIndex: "09",
          title: "\u591A\u7EF4\u5207\u7247\u8D8A\u754C\u9632\u7EBF\u62E6\u622A",
          coveredChapters: "Topic 4.2",
          summary: "Slice\u4E09\u56E0\u5B50\u7D22\u5F15\u8FB9\u754C, \u6B65\u957F\u65B9\u5411\u81EA\u9002\u5E94, IndexError\u9632\u5FA1",
          gameType: "quiz",
          gameTitle: "\u5DE8\u86C7\u9B54\u866B\u8EAB\u4F53\u6495\u88C2\u6848\uFF1A\u4E09\u7EF4\u80FD\u91CF\u6838\u7CBE\u5BC6\u5207\u7247\u6355\u6349",
          gameRules: "\u9B54\u866B\u6B63\u56E0\u6781\u5DEE\u81EA\u8F6C\u53D1\u751F\u65AD\u8282\uFF0C\u5176\u529B\u91CF\u5C5E\u6027\u50A8\u5728[start:stop:step]\u7684\u591A\u7EF4\u5411\u91CF\u4E2D\u3002\u4F60\u4F5C\u4E3A\u80FD\u91CF\u963B\u788D\u5B98\uFF0C\u5FC5\u987B\u63A8\u6F14\u5F53step\u4E3A-1\u65F6\u7684\u7A7A\u95F4\u6781\u6027\u7FFB\u8F6C\u903B\u8F91\uFF0C\u8BCA\u65AD\u51FA\u5207\u7247\u5728\u7A7A\u7D22\u5F15\u4E0B\u7684\u8FB9\u754C\u81EA\u9002\u5E94\u4F4D\u7F6E\uFF0C\u505A\u51FA\u4E00\u51FB\u5FC5\u6BBA\u7684\u62E6\u622A\u51B3\u7B56\uFF0C\u4E0D\u80FD\u5C11\u6355\u6216\u6EA2\u6F0F\u5207\u7247\u4EA7\u751FIndexError\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5728\u7D27\u5F20\u7684\u72D9\u51FB\u80CC\u666F\u91CC\uFF0C\u5C06Python\u5207\u7247\u7684\u8D1F\u6B65\u957F\u7FFB\u8F6C\u53CA\u8D8A\u754C\u5BB9\u9519\u7387\u4F5C\u4E3A\u6740\u624B\u950F\uFF0C\u5B8C\u6210\u5207\u7247\u8BED\u6CD5\u7684\u6700\u9AD8\u638C\u63E1\u3002"
        },
        {
          chapterIndex: "10",
          title: "\u5B57\u5178\u5951\u7EA6\u4E0E\u9AD8\u9891\u68C0\u7D22\u5BC6\u5319",
          coveredChapters: "Topic 5.1",
          summary: "\u54C8\u5E0C\u5FEB\u901F\u68C0\u7D22, Key\u552F\u4E00\u6027\u89C4\u5219, \u96C6\u5408\u53BB\u6742\u8D28\u673A\u5236",
          gameType: "coding-puzzle",
          gameTitle: "\u8FDC\u53E4\u54C8\u5E0C\u77F3\u7891\uFF1A\u62FC\u8865\u6563\u5931\u7684\u6570\u636E\u8FDE\u63A5\u94FE",
          gameRules: "\u53E4\u795E\u9057\u7559\u7684\u5951\u7EA6\u7891\u6587\u6B8B\u635F\uFF0C\u5FEB\u901F\u7D22\u5F15\u4FE1\u7269\u65F6\u56E0Key\u51B2\u7A81\u7206\u53D1\u5185\u5B58\u91CD\u6C61\u67D3\uFF0C\u6D77\u91CF\u6742\u8D28\u5143\u7D20\u5728\u963B\u585E\u68C0\u7D22\u7BA1\u9053\u3002\u4E3A\u4E86\u9632\u6B62\u4E0A\u4E07\u6761\u5BC6\u8BED\u53D1\u751F\u67E5\u8BE2O(N)\u9000\u5316\uFF0C\u4F60\u5FC5\u987B\u5728\u9650\u65F6\u5185\u91CD\u7F16\u54C8\u5E0C\u7D22\u5F15\u7B97\u6CD5\u7247\u6BB5\uFF0C\u5229\u7528\u5BF9\u96C6\u5408\uFF08Set\uFF09\u7684\u5FEB\u901F\u6E05\u6D17\u8FC7\u6EE4\uFF0C\u4F7F\u7891\u6587\u5B57\u5178\u7ED3\u6784\u5B8C\u7F8E\u91CD\u7EC4\u8FD0\u884C\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5728\u7B97\u6CD5\u65F6\u95F4\u590D\u6742\u5EA6\u9000\u5316\u7684\u903C\u8FEB\u4E0B\uFF0C\u8BA9\u5B66\u8005\u6DF1\u5EA6\u4F53\u4F1A\u5E76\u7406\u89E3\u54C8\u5E0C\u5B57\u5178O(1)\u7684\u7EDD\u5BF9\u6280\u672F\u4F18\u52BF\u548C\u552F\u4E00\u952E\u7684\u6838\u5FC3\u673A\u5236\u3002"
        },
        {
          chapterIndex: "11",
          title: "\u54C8\u5E0C\u51B2\u7A81\u6B7B\u5FAA\u73AF\u5927\u89E3\u7ED3",
          coveredChapters: "Topic 5.2",
          summary: "Dict\u51B2\u7A81\u6297\u54C8\u5E0C\u5316, \u53EF\u54C8\u5E0C\u5BF9\u8C61\uFF08Hashable\uFF09\u8FB9\u754C, __hash__\u5E95\u5C42\u590D\u5199",
          gameType: "cross-match",
          gameTitle: "\u591A\u6781\u5951\u7EA6\u5BC6\u94A5\u5D29\u584C\uFF1A\u5254\u9664\u4E0D\u53EF\u54C8\u5E0C\u5F02\u5E38\u5361\u6B7B",
          gameRules: "\u5951\u7EA6\u7CFB\u7EDF\u7A81\u7136\u53D1\u51FA\u72C2\u66B4KeyError\uFF1A\u5217\u8868\u65E0\u6CD5\u5F53\u6210\u5B57\u5178\u7684Key\uFF08TypeError: unhashable type: 'list'\uFF09\u3002\u73A9\u5BB6\u5FC5\u987B\u5C06\u5404\u79CD\u53D8\u91CF\u7C7B\u578B\uFF08\u5143\u7EC4\u3001\u5217\u8868\u3001\u5B57\u7B26\u4E32\u3001\u5B57\u5178\uFF09\u4E0E\u5176\u662F\u5426\u5177\u6709\u7269\u7406\u54C8\u5E0C\u7A33\u6001\u7279\u5F81\u8FDB\u884C\u5BF9\u9F50\u8FDE\u7EBF\uFF0C\u6392\u9664\u90A3\u4E9B\u4E0D\u5B88\u5951\u7EA6\u7684\u4E0D\u53EF\u54C8\u5E0C\u53D8\u91CF\u5F02\u8D28\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u901A\u8FC7\u5339\u914D\uFF0C\u4F7F\u5B66\u751F\u8BA4\u8BC6\u5230\u53EA\u6709Immutable\u5BF9\u8C61\u624D\u53EF\u54C8\u5E0C\u4F5C\u4E3A\u5B57\u5178Key\u7684\u7269\u7406\u672C\u8D28\uFF0C\u6E05\u9664\u7F16\u7801\u65F6\u7684\u6697\u5751\u3002"
        },
        {
          chapterIndex: "12",
          title: "\u9632\u706B\u5899Try-Except\u5192\u6CE1\u5F02\u5E38\u63A7\u5236",
          coveredChapters: "Topic 5.3",
          summary: "\u5F02\u5E38\u5192\u6CE1\u56DE\u6EAF, \u591A\u91CDExcept\u62E6\u622A, \u5F02\u5E38\u6808\u5B9A\u4F4D",
          gameType: "quiz",
          gameTitle: "\u96F7\u66B4\u7194\u6BC1\u6838\u5E94\u6025\u63A7\u5236\uFF1A\u963B\u65AD\u5931\u63A7\u7684\u9664\u96F6\u5F02\u5E38\u94FE",
          gameRules: "\u7531\u4E8E\u4F20\u611F\u5668\u77AC\u65F6\u6389\u7EBF\uFF0C\u6570\u636E\u6D41\u4E2D\u8D6B\u7136\u6DF7\u5165\u4E86\u81F4\u547D\u76840\u963B\u6297\u56E0\u5B50\u3002\u9664\u4EE50\u7684ZeroDivisionError\u5DE8\u6F9C\u6B63\u4EE5\u6781\u5176\u5F3A\u70C8\u7684\u52BF\u5934\u5411\u5916\u58F3\u7CFB\u7EDF\u5192\u6CE1\u6EA2\u51FA\uFF0C\u6240\u5230\u4E4B\u5904\u5404\u5C42\u6A21\u5757\u5168\u6570\u6B7B\u673A\uFF01\u4F60\u9700\u8981\u5728\u590D\u6742\u5D4C\u5957\u51FD\u6570\u6808\u5E27\u4E2D\uFF0C\u51C6\u786E\u8BCA\u65AD\u6700\u4F18\u96C5\u7684Try-Except\u963B\u65AD\u4F4D\u7F6E\uFF0C\u5E76\u5728Finally\u5757\u4E2D\u786E\u4FDD\u5B89\u5168\u9600\u4E0D\u6C89\u6CA1\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u5B9E\u666F\u6F14\u793A\u672A\u6355\u83B7\u5F02\u5E38\u5BFC\u81F4\u8F6F\u4EF6\u94FE\u6761\u96EA\u5D29\u7684\u60E8\u72B6\uFF0C\u8BA9\u5B66\u751F\u6811\u7ACB\u8D77\u5B89\u5168\u7F16\u7A0B\u4E0E\u5F02\u5E38\u5206\u7EA7\u56DE\u6536\u673A\u5236\u7684\u53CD\u5411\u672C\u80FD\u3002"
        },
        {
          chapterIndex: "13",
          title: "LEGB\u53D8\u91CF\u4F5C\u7528\u57DF\u7A7A\u95F4\u6495\u88C2",
          coveredChapters: "Topic 6.1",
          summary: "\u5C40\u90E8\u4E0E\u5168\u5C40\u547D\u540D\u7A7A\u95F4, Built-in\u4E0EEnclosing\u91CD\u5408, global/nonlocal\u5951\u7EA6",
          gameType: "coding-puzzle",
          gameTitle: "\u9B54\u6CD5\u6C99\u6CB3\u7981\u5FCC\u8FB9\u754C\uFF1A\u4FEE\u590D\u5C40\u90E8\u53D8\u91CF\u540D\u5B57\u6253\u67B6\u9519\u8BEF",
          gameRules: "\u7531\u4E8E\u540C\u540D\u51B2\u7A81\uFF0C\u51FD\u6570\u5185\u90E8\u7684\u4EE3\u7801\u6B63\u4F01\u56FE\u66F4\u6539\u51FD\u6570\u5916\u7684\u6838\u5FC3\u62A4\u76FE\u503C`shield_hp`\uFF0C\u5F15\u53D1\u4E86UnboundLocalError\u4E25\u91CD\u8B66\u544A\uFF0C\u62A4\u76FE\u5728\u8B66\u62A5\u91CC\u745F\u745F\u53D1\u6296\u3002\u4F60\u5FC5\u987B\u5728\u4EE3\u7801\u6BB5\u5408\u9002\u4F4D\u7F6E\u914D\u7F6E\u540D\u5B57\u9501\u5B9A\u6307\u4EE4\uFF0C\u901A\u8FC7`global`\u6216`nonlocal`\u91CD\u65B0\u7F16\u6392\u4F5C\u7528\u57DF\u906E\u853D\u6821\u9A8C\uFF0C\u4FDD\u62A4\u62A4\u76FE\u514D\u4E8E\u903B\u8F91\u584C\u9677\u3002",
          duration: "10\u5206\u949F",
          designRationale: "\u901A\u8FC7\u89E3\u51B3\u540D\u79F0\u89E3\u6790\u6697\u6597\uFF0C\u4F7F\u5B66\u5458\u7406\u89E3\u547D\u540D\u7A7A\u95F4\u5728\u7269\u7406\u5C42\u9762\u5BF9\u5806\u6808\u53D8\u91CF\u4F5C\u7528\u57DF\u7684\u4FDD\u62A4\u548C\u9694\u79BB\u4EF7\u503C\u3002"
        },
        {
          chapterIndex: "14",
          title: "\u6781\u9650\u9012\u5F52\u4E0E\u6808\u6DF1\u5EA6\u6EA2\u51FA\u963B\u5C3C",
          coveredChapters: "Topic 6.2",
          summary: "\u9012\u5F52\u57FA\u7EBF\u6761\u4EF6\uFF08Base Case\uFF09, \u7CFB\u7EDF\u6808\u632F\u8361, sys.setrecursionlimit\u4E34\u754C",
          gameType: "math-quest",
          gameTitle: "\u65E0\u5C3D\u9012\u56DE\u65CB\u6DA1\uFF1A\u7B97\u51C6\u751F\u547D\u7EBF\u907F\u514D\u6B7B\u9501\u9012\u5F52",
          gameRules: "\u63A2\u9669\u961F\u5760\u8FDB\u4E86\u4E00\u4E2A\u9012\u56E0\u80FD\u91CF\u53CD\u5E94\u73AF\u4E2D\uFF0C\u6DF1\u5EA6\u6BCF\u589E\u4E00\u7EA7\uFF0C\u7CFB\u7EDF\u6808\u5C31\u5806\u6512\u4E00\u5C42\u4E34\u65F6\u5BC4\u5B58\u5668\u3002\u56E0\u7F3A\u5C11\u6B63\u786E\u7684\u57FA\u51C6\u51FA\u53E3\uFF08Base Case\uFF09\uFF0C\u7CFB\u7EDF\u6808\u6B63\u65E0\u60C5\u54111000\u9650\u5236\u7EBF\u903C\u8FD1\uFF01\u4F60\u5FC5\u987B\u7ACB\u5373\u7B97\u51FA\u57FA\u51C6\u6761\u4EF6\u7684\u6781\u9650\u8FD4\u822A\u6307\u9488\u6570\uFF0C\u7528\u8BA1\u7B97\u963B\u65AD\u65E0\u9650\u5236\u66B4\u8DCC\u5D29\u6E83\u3002",
          duration: "11\u5206\u949F",
          designRationale: "\u5C06\u9012\u5F52\u57FA\u7684\u5224\u5B9A\u8F6C\u5316\u4E3A\u62EF\u6551\u5760\u843D\u8005\u7684\u751F\u6B7B\u6551\u751F\u7D22\u53D1\u5C04\u89D2\uFF0C\u6DF1\u523B\u638C\u63E1\u9012\u5F52\u82E5\u65E0\u51FA\u53E3\u5C06\u541E\u566C\u7269\u7406\u5185\u5B58\u76F4\u81F3\u6808\u5D29\u7684\u94C1\u5F8B\u3002"
        },
        {
          chapterIndex: "15",
          title: "\u6A21\u5757\u4EA4\u53C9\u52A0\u8F7D\u4EA4\u53C9\u4F9D\u8D56\u89E3\u73AF",
          coveredChapters: "Topic 6.3",
          summary: "\u6A21\u5757\u52A0\u8F7D\u7269\u7406\u673A\u5236, Circular Import\u5FAA\u73AF\u6CE8\u5165, \u52A8\u6001\u5185\u90E8\u5BFC\u5165\uFF08Dynamic Import\uFF09",
          gameType: "interactive-story",
          gameTitle: "\u53CC\u5934\u9EC4\u91D1\u9F99\u6A21\u5757\u5927\u7194\u65AD\uFF1A\u6253\u7834\u5F7C\u6B64\u4EA4\u53C9\u6307\u5F15\u6B7B\u7ED3",
          gameRules: "\u9EC4\u91D1\u9F99\u7684\u4E24\u9897\u6CD5\u672F\u6838\uFF08\u6A21\u5757A\u4E0E\u6A21\u5757B\uFF09\u5F7C\u6B64\u547C\u5524\uFF0C\u5728\u542F\u52A8\u77AC\u95F4\u56E0\u4E3A\u53CC\u5411\u4EA4\u53C9`import`\u9677\u5165\u65E0\u59CB\u65E0\u7EC8\u7684\u521D\u59CB\u5316\u5361\u6B7B\u6B7B\u5708\uFF01\u5168\u57CE\u9B54\u6CD5\u6D41\u505C\u6446\u3002\u4F5C\u4E3A\u7687\u5BB6\u9996\u5E2D\u5927\u6CD5\u672F\u7A0B\u5E8F\u5B98\uFF0C\u4F60\u9700\u8981\u51B3\u7B56\u662F\u5426\u5C06\u5BFC\u5165\u5207\u6539\u81F3\u5185\u90E8\u8C03\u7528\uFF0C\u8FD8\u662F\u5F7B\u5E95\u62BD\u79BB\u51FA\u516C\u5171\u63A5\u53E3\u534F\u8BAE\uFF0C\u505A\u51FA\u91CD\u5927\u4EE3\u7801\u7269\u7406\u7ED3\u6784\u89E3\u8026\u9009\u62E9\u3002",
          duration: "11\u5206\u949F",
          designRationale: "\u5C06\u6A21\u5757\u52A0\u8F7D\u548C\u4EA4\u53C9\u5BFC\u5165\u547D\u540D\u5361\u6B7B\u7684\u590D\u6742\u539F\u7406\u8F6C\u4E3A\u6253\u7834\u9EC4\u91D1\u6B7B\u7ED3\u7684\u91CD\u5927\u6218\u7565\u6289\u62E9\uFF0C\u5185\u5316\u5E95\u5C42\u5DE5\u7A0B\u67B6\u6784\u89C4\u8303\u903B\u8F91\u3002"
        }
      ]
    };
  }
  return {
    title: title || "\u300A\u9AD8\u9636\u7EFC\u5408\u79D1\u5B66\u6559\u6750\u7EB2\u8981\u300B",
    modules: [
      {
        chapterIndex: "01",
        title: "\u5FAE\u89C2\u8D28\u5B50\u5E73\u8861\u914D\u6BD4",
        coveredChapters: "Topic 1.1",
        summary: "\u539F\u5B50\u4E2D\u5FC3\u7ED3\u6784, \u8D28\u5B50\u4E2D\u5B50\u7535\u8377, \u5F3A\u76F8\u4E92\u4F5C\u7528\u963B\u6297",
        gameType: "math-quest",
        gameTitle: "\u6838\u71C3\u6599\u5931\u8861\u6F0F\u7F51\u6355\u83B7\uFF1A\u5F3A\u6838\u7535\u78C1\u9600\u8BA1\u7B97\u7A81\u56F4",
        gameRules: "\u6838\u53CD\u5E94\u5806\u538B\u529B\u9600\u4E25\u91CD\u8FC7\u70ED\u3002\u9AD8\u80FD\u53CD\u5C04\u7F69\u6CC4\u9732\u5F3A\u8F90\u5C04\u5C18\u57C3\u3002\u5355\u4EBA\u73A9\u5BB6\u4F5C\u4E3A\u5E73\u8861\u603B\u6307\u6325\uFF0C\u9700\u8981\u901A\u8FC7\u914D\u5236\u539F\u5B50\u4E2D\u5FC3\u5FAE\u89C2\u8D28\u5B50\u3001\u4E2D\u5B50\u7684\u6781\u9650\u80FD\u7EA7\u914D\u6BD4\uFF0C\u8BA1\u7B97\u4E2D\u5B50\u622A\u9762\uFF0C\u4EE5\u9632\u91CD\u7C92\u5B50\u8FC7\u5EA6\u81EA\u53D1\u88C2\u53D8\u5F15\u53D1\u6BC1\u706D\u5927\u6D2A\u70C8\u3002\u8BA1\u7B97\u53C2\u6570\u5FC5\u987B\u57283\u7EB3\u79D2\u5185\u6536\u655B\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u4E0D\u518D\u586B\u9E2D\u5F0F\u704C\u8F93\u539F\u5B50\u7ED3\u6784\uFF0C\u800C\u662F\u5C06\u5E73\u8861\u5FAE\u89C2\u539F\u5B50\u91CD\u529B\u4E0E\u7EF4\u6301\u53CD\u5E94\u5806\u7535\u7AD9\u5B89\u5168\u76F4\u63A5\u8054\u7CFB\u8D77\u6765\uFF0C\u901A\u8FC7\u80FD\u91CF\u6C42\u53D6\u516C\u5F0F\u5EFA\u7ACB\u76F4\u89C2\u8BA4\u77E5\u5B66\u3002"
      },
      {
        chapterIndex: "02",
        title: "\u4E2D\u5B50\u7A33\u5B9A\u8870\u53D8\u8F90\u5C04\u62E6\u622A",
        coveredChapters: "Topic 1.2",
        summary: "\u5F31\u76F8\u4E92\u4F5C\u7528, \u8D1D\u5854\u7C92\u5B50\u8870\u53D8\u6BD4, \u540C\u4F4D\u7D20\u5B89\u5168\u8870\u53D8\u7A97\u53E3",
        gameType: "cross-match",
        gameTitle: "\u5E9F\u65E7\u540C\u4F4D\u7D20\u5B89\u5168\u5904\u7F6E\uFF1A\u80FD\u80FD\u8C31\u4EEA\u591A\u901A\u9053\u53CD\u5C04\u914D\u5BF9",
        gameRules: "\u8870\u53D8\u5806\u5185\u7684\u653E\u5C04\u6027\u4E2D\u5B50\u6B63\u4EE5\u9AD8\u4E0D\u786E\u5B9A\u6027\u629B\u6D12\u3002\u5B66\u751F\u626E\u6F14\u653E\u5C04\u9632\u62A4\u5E08\uFF0C\u9700\u8981\u7CBE\u51C6\u8BCA\u65AD\u5404\u4E2A\u4E0D\u540C\u8870\u53D8\u9636\u6BB5\u7684\u7269\u7406\u7279\u5F81\uFF0C\u5C06\u7C92\u5B50\u8870\u53D8\u7387\u3001\u6B63\u8D1F\u6781\u504F\u89D2\u7279\u6027\u4EE5\u53CA\u80FD\u8C31\u53CD\u5C04\u7387\u8FDB\u884C\u8FDE\u7EBF\u914D\u5BF9\uFF0C\u5C01\u9501\u81F4\u547D\u5C04\u7EBF\u6CC4\u9732\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u5229\u7528\u5E9F\u65E7\u653E\u5C04\u539F\u963B\u6321\u573A\u666F\uFF0C\u628A\u865A\u65E0\u7F25\u7F08\u7684\u8D1D\u5854\u7C92\u5B50\u3001\u80FD\u8C31\u5206\u5E03\u5305\u88C5\u6210\u51E0\u4F55\u5BF9\u9F50\u53CD\u5C04\uFF0C\u5E2E\u52A9\u5B66\u751F\u5728\u64CD\u4F5C\u4E2D\u7406\u89E3\u5FAE\u89C2\u6781\u6027\u7279\u5F81\u3002"
      },
      {
        chapterIndex: "03",
        title: "\u7535\u5B50\u4EF7\u952E\u6781\u6027\u8FDE\u63A5\u5668",
        coveredChapters: "Topic 2.1",
        summary: "\u5171\u4EF7\u952E\u4EF7\u7535\u5B50\u5171\u4EAB, \u516B\u9685\u4F53\u7A33\u5B9A\u6CD5\u5219, \u5076\u6781\u6781\u6027\u5438\u7EB3",
        gameType: "coding-puzzle",
        gameTitle: "\u5371\u7206\u4EF7\u952E\u65AD\u88C2\u9632\u5FA1\uFF1A\u4FEE\u590D\u4E0D\u9971\u548C\u78B3\u94FE\u9AD8\u80FD\u7A33\u5B9A\u4EE3\u7801",
        gameRules: "\u6750\u6599\u56E0\u9AD8\u6E29\u5206\u5B50\u9AA8\u67B6\u7834\u788E\uFF0C\u5355\u4EF7\u952E\u81EA\u7531\u57FA\u65E0\u5E8F\u7206\u53D1\u3002\u4F60\u5FC5\u987B\u91CD\u6392\u5E8F\u4EF7\u7535\u5B50\u5438\u6536\u62FC\u8865\u903B\u8F91\u4E0E\u805A\u5408\u5224\u65AD\uFF0C\u901A\u8FC7\u6781\u5C11\u7684\u5916\u5C42\u7535\u5B50\u62FC\u586B\uFF0C\u4F7F\u5468\u56F4\u7684\u5316\u5B66\u539F\u4EF6\u91CD\u65B0\u7ED3\u6676\u51FA\u7A33\u5065\u7684\u60F0\u6027\u8868\u9762\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u4F7F\u4F4E\u8BA4\u77E5\u5316\u5B66\u753B\u7EBF\u8F6C\u4E3A\u7CFB\u7EDF\u5316\u3001\u903B\u8F91\u94FE\u4FEE\u590D\uFF0C\u7406\u89E3\u5206\u5B50\u5185\u90E8\u4EF7\u7535\u5B50\u5171\u4EAB\u5BF9\u7CFB\u7EDF\u7A33\u5065\u7684\u652F\u67F1\u8D21\u732E\u3002"
      },
      {
        chapterIndex: "04",
        title: "\u5E93\u4ED1\u529B\u79BB\u5B50\u6676\u683C\u5B9A\u4F4D",
        coveredChapters: "Topic 2.2",
        summary: "\u79BB\u5B50\u9759\u7535\u5F15\u529B, \u5E93\u4ED1\u52BF\u80FD\u516C\u5F0F, \u6676\u683C\u7194\u6CB8\u70B9\u70ED\u529B\u5B66",
        gameType: "quiz",
        gameTitle: "\u9AD8\u538B\u7535\u89E3\u69FD\u5931\u63A7\u7194\u878D\uFF1A\u6676\u683C\u5F3A\u5EA6\u4E34\u754C\u6781\u901F\u8BCA\u65AD",
        gameRules: "\u9AD8\u7089\u5185\u7531\u4E8E\u7535\u6781\u5206\u5E03\u4E0D\u5747\uFF0C\u9AD8\u538B\u9759\u7535\u529B\u5E73\u8861\u5D29\u6E83\uFF0C\u6C2F\u5316\u94A0\u76D0\u56FA\u6001\u6676\u683C\u5373\u5C06\u53D1\u751F\u5931\u63A7\u7684\u65E0\u5E8F\u8F6F\u5316\u6CC4\u9732\uFF01\u4F60\u5FC5\u987B\u8BBA\u8BC1\u5E76\u5FEB\u901F\u6838\u7B97\u5404\u79CD\u6781\u6027\u6742\u8D28\u7684\u5E93\u4ED1\u5438\u80FD\u7EA7\uFF0C\u5224\u5B9A\u4F55\u79CD\u63BA\u6742\u7269\u5BF9\u62C9\u62AC\u7194\u70B9\u80FD\u8D77\u5230\u6838\u5FC3\u951A\u5B9A\u4F5C\u7528\uFF0C\u7D27\u6025\u5BF9\u7089\u6E29\u8FDB\u884C\u4E2D\u548C\u51CF\u9707\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u5229\u7528\u9AD8\u7089\u7194\u878D\u5371\u673A\uFF0C\u5F3A\u8FEB\u5B66\u751F\u8BA1\u7B97\u5E76\u638C\u63E1\u9759\u7535\u76F8\u4E92\u4F5C\u7528\u4E0E\u79BB\u5B50\u534A\u5F84\u3001\u7535\u8377\u6570\u7684\u53CD\u6BD4\u4F8B\u5E73\u65B9\u7269\u7406\u5185\u56E0\u3002"
      },
      {
        chapterIndex: "05",
        title: "\u6781\u6027\u6EB6\u5242\u76F8\u4F3C\u76F8\u6EB6\u6D17\u6DA4",
        coveredChapters: "Topic 2.3",
        summary: "\u76F8\u4F3C\u76F8\u6EB6\u673A\u7406, \u6EB6\u8D28\u5206\u5B50\u5076\u6781\u77E9, \u8868\u9762\u6D3B\u6027\u5C42\u4E0D\u5E73\u8861",
        gameType: "interactive-story",
        gameTitle: "\u5267\u6BD2\u6709\u673A\u6EA2\u6D41\u62E6\u622A\uFF1A\u6781\u6027\u53BB\u6C61\u7684\u6750\u6599\u914D\u7ED9\u6289\u62E9",
        gameRules: "\u65E0\u8272\u6709\u673A\u5267\u6BD2\u7269\u5DF2\u6E17\u900F\u5230\u6C34\u8FC7\u6EE4\u4ED3\u53E3\uFF01\u666E\u901A\u7684\u51B2\u5237\u5F92\u52B3\u65E0\u529F\uFF0C\u4F60\u9700\u8981\u77AC\u95F4\u5224\u65AD\u5176\u5206\u5B50\u7684\u5076\u6781\u6027\u5206\u5E03\u3002\u5E76\u5728\u4E00\u7CFB\u5217\u6781\u6027\u6D17\u6DB2\u3001\u975E\u6781\u6027\u6EB6\u5242\u4E2D\u505A\u51FA\u7D27\u6025\u4E24\u6743\u6295\u7968\uFF1A\u662F\u987A\u5E94\u5176\u758F\u6C34\u4EB2\u6CB9\u672C\u80FD\uFF0C\u8FD8\u662F\u914D\u4EE5\u5F3A\u6781\u6027\u5076\u6781\u4ECB\u8D28\uFF0C\u4EE5\u9632\u5168\u6E2F\u996E\u7528\u6C34\u6E90\u62A5\u9500\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u7528\u7D27\u8FEB\u53BB\u6C61\u505A\u80CC\u666F\uFF0C\u5728\u9009\u62E9\u91CC\u63ED\u793A\u76F8\u4F3C\u76F8\u6EB6\u4E0D\u662F\u4E00\u53E5\u6B7B\u987A\u53E3\u6E9C\uFF0C\u800C\u662F\u5206\u5B50\u95F4\u529B\u78C1\u6781\u5438\u5F15\u5951\u5408\u5EA6\u7684\u7269\u7406\u6289\u62E9\u3002"
      },
      {
        chapterIndex: "06",
        title: "\u9178\u78B1\u4E2D\u548C\u9006\u63A8\u5E73\u8861\u7CBE\u51C6\u6EF4\u5B9A",
        coveredChapters: "Topic 3.1",
        summary: "\u4E2D\u548C\u53CD\u5E94\u7269\u7406\u8DC3\u5347, \u9178\u78B1\u6307\u793A\u6307\u6570\u68C0\u6D4B, \u77AC\u65F6\u6C22\u6C27\u5BF9\u51B2",
        gameType: "math-quest",
        gameTitle: "\u6781\u901F\u9178\u6DB2\u6EB6\u89E3\u69FD\uFF1A\u9632\u6B62\u5916\u58F3\u8150\u8680\u7684\u7269\u7406\u6781\u9650\u5242\u91CF\u6C42\u53D6",
        gameRules: "\u5F3A\u9178\u6EB6\u89E3\u6C60\u53D1\u751F\u7269\u6599\u8D85\u8F7D\uFF0C\u4E0D\u9508\u94A2\u5408\u91D1\u6321\u677F\u5F00\u59CB\u5636\u5636\u5192\u70DF\u3002\u4F60\u5FC5\u987B\u572810\u79D2\u5185\u7B97\u51C6\u5F53\u524D\u4F53\u79EF\u548C\u5E38\u6570\u4E0B\uFF0C\u5E94\u8BE5\u6295\u5165\u7684\u5BF9\u5E94\u6D53\u5EA6\u7684\u5F31\u78B1\u7C89\u672B\u5242\u91CF\uFF0C\u591A\u4E00\u6BEB\u514B\u5F15\u53D1\u5267\u70C8\u55B7\u6CB8\u3001\u5C11\u4E00\u6BEB\u514B\u5BFC\u81F4\u5916\u4FDD\u62A4\u58F3\u7A7F\u5B54\uFF0C\u8FD9\u662F\u5206\u6BEB\u4E0D\u5DEE\u7684\u914D\u51C6\u535A\u5F08\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u5C06\u6570\u5B66\u4E2D\u548C\u91CF\u5316\u4E3A\u633D\u6551\u5927\u575D\u7684\u5242\u91CF\u6781\u9650\uFF0C\u6781\u529B\u6311\u6218\u81EA\u5B66\u8005\u5173\u4E8E\u9178\u78B1\u6BD4\u4F8B\u7684\u77AC\u65F6\u8111\u7B97\u4E0E\u7CBE\u786E\u63A8\u7406\u7D20\u8D28\u3002"
      },
      {
        chapterIndex: "07",
        title: "\u5171\u8F6D\u7F13\u51B2\u6EB6\u6DB2\u62D0\u70B9\u5E73\u6ED1",
        coveredChapters: "Topic 3.2",
        summary: "\u5F31\u9178\u6216\u5F31\u78B1\u7F13\u51B2\u57FA, pH\u5BF9\u6570\u5E73\u8861\u7A81\u8DC3, \u5171\u8F6D\u9178\u78B1\u5BF9\u4E92\u8865\u6027",
        gameType: "quiz",
        gameTitle: "\u751F\u5316\u8231pH\u72C2\u6CE2\u52A8\u5371\u673A\uFF1A\u6355\u83B7\u5BF9\u6570\u6EF4\u5B9A\u66F2\u7EBF\u5B89\u5168\u533A",
        gameRules: "\u6B63\u5728\u5B75\u5316\u7684\u6297\u4F53\u5BF9\u9178\u78B1\u6297\u6027\u6781\u5EA6\u5A07\u6C14\uFF0C\u5916\u754C\u5F3A\u9178\u6E17\u6D41\u4FC3\u4F7FpH\u5BF9\u6570\u6781\u5EA6\u903C\u8FD1\u6B7B\u4EA1\u7EA2\u754C\uFF01\u5E38\u89C4\u7684\u5F3A\u78B1\u4E2D\u548C\u5728\u6570\u5B66\u7A81\u8DC3\u533A\u53D1\u751F\u6781\u5927\u6CE2\u52A8\u3001\u65E0\u6CD5\u63A7\u5236\u3002\u4F60\u5FC5\u987B\u901A\u8FC7\u8BBA\u8BC1\u5F15\u5165\u5F31\u5171\u8F6D\u7684\u918B\u8D28\u9178\u76D0\u7F13\u51B2\u80FD\u7EA7\uFF0C\u501F\u52A9\u7CFB\u7EDF\u5BF9\u5BF9\u6570\u6446\u5E45\u7684\u7F13\u9707\u529B\u5316\u9669\u4E3A\u5937\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u5F15\u5BFC\u5B66\u751F\u6DF1\u523B\u611F\u609F\u5171\u8F6D\u9178\u78B1\u5BF9\u662F\u5982\u4F55\u901A\u8FC7\u52A8\u6001\u79BB\u89E3\u6765\u541E\u566C\u5916\u6765\u9178\u78B1\u51B2\u51FB\u7684\uFF0C\u5F7B\u5E95\u5185\u5316\u8457\u540D\u7684Henderson\u516C\u5F0F\u7684\u7269\u7406\u5999\u7528\u3002"
      },
      {
        chapterIndex: "08",
        title: "\u591A\u7EA7\u6D78\u6DB2\u9971\u548C\u7194\u878D\u7ED3\u6676",
        coveredChapters: "Topic 3.3",
        summary: "\u6EB6\u89E3\u5EA6\u5E73\u8861\u5E38\u6570Ksp, \u6790\u51FA\u7ED3\u6676\u901F\u7387, \u79BB\u5B50\u6548\u5E94\u70ED\u529B\u5B66",
        gameType: "cross-match",
        gameTitle: "\u5371\u5316\u91CD\u91D1\u5C5E\u622A\u6D41\uFF1A\u6676\u4F53\u6C89\u6DC0\u6790\u51FA\u6761\u4EF6\u7684\u7CBE\u7B97\u5339\u914D",
        gameRules: "\u5DE5\u4E1A\u7BA1\u9053\u91CD\u91D1\u5C5E\u79BB\u5B50\u7684\u6E17\u6F0F\u5373\u5C06\u6BD2\u5316\u4E0B\u6C34\u9053\u3002\u666E\u901A\u7684\u6C89\u6DC0\u5242\u6295\u5165\u91CF\u5DF2\u8FBE\u74F6\u9888\uFF0C\u7BA1\u9053\u6C14\u538B\u66B4\u8D70\u3002\u4F60\u5FC5\u987B\u5206\u6790Ksp\u52A8\u6001\u53D8\u5316\uFF0C\u7CBE\u786E\u914D\u5BF9\u5E38\u6E29\u6D53\u5EA6\u5DEE\u3001\u540C\u79BB\u5B50\u538B\u8FEB\u7CFB\u6570\u3001\u9971\u548C\u6790\u51FA\u901F\u5EA6\uFF0C\u7528\u5B8C\u7F8E\u8FDE\u7EBF\u5F15\u7206\u91CD\u91D1\u5C5E\u6700\u5FEB\u7ED3\u6676\u6C89\u6DC0\u964D\u89E3\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u4F7F\u6EB6\u89E3\u5EA6\u5E38\u6570\u516C\u5F0F\u5728\u622A\u6C61\u6218\u4E2D\u5316\u4F5C\u53EF\u89C6\u5BF9\u9F50\u52A8\u4F5C\uFF0C\u5F15\u5BFC\u81EA\u5B66\u8005\u5728\u5927\u8111\u5185\u5C06\u6D53\u5EA6\u6BD4\u5BF9\u4E0E\u6C89\u6DC0\u5173\u7CFB\u7269\u7406\u7ED1\u5B9A\u3002"
      },
      {
        chapterIndex: "09",
        title: "\u78B3\u94FE\u540C\u5206\u5F02\u6784\u7A7A\u95F4\u5927\u6392\u67E5",
        coveredChapters: "Topic 4.1",
        summary: "\u7A7A\u95F4\u5BF9\u79F0\u7ED3\u6784, \u8303\u5FB7\u534E\u5F15\u529B\u5806\u53E0, \u5206\u652F\u4F4D\u963B\u5BF9\u7194\u70B9\u5F71\u54CD",
        gameType: "coding-puzzle",
        gameTitle: "\u7279\u79CD\u6750\u6599\u7194\u6CB8\u70B9\u5D29\u6E83\uFF1A\u4FEE\u6B63\u540C\u5206\u5F02\u6784\u78B3\u94FE\u5806\u79EF\u6392\u5217",
        gameRules: "\u9AD8\u7CBE\u5408\u91D1\u4FDD\u62A4\u677F\u8981\u5728\u6781\u5BD2\u4E0B\u7EF4\u6301\u7ED3\u6784\u575A\u786C\uFF0C\u7136\u800C\u5F53\u4E0B\u5176\u9AD8\u805A\u5F02\u6784\u78B3\u94FE\u56E0\u6392\u5217\u6742\u4E71\u3001\u8303\u5FB7\u534E\u529B\u7684\u91CD\u53E0\u8DDD\u79BB\u8FC7\u5927\uFF0C\u521A\u6027\u63A5\u8FD1\u6563\u788E\u3002\u4F60\u5FC5\u987B\u5145\u5F53\u7EB3\u7C73\u88C5\u914D\u5B98\uFF0C\u91CD\u6392\u5176\u540C\u5206\u5F02\u6784\u78B3\u9AA8\u67B6\u7684\u652F\u94FE\u5BF9\u79F0\u5EA6\u7B97\u6CD5\uFF0C\u786E\u4FDD\u5BC6\u5B9E\u62FC\u88C5\u4EE5\u62C9\u62AC\u5206\u5B50\u95F4\u5F15\u529B\u6297\u6027\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u5C06\u67AF\u71E5\u4E0D\u7231\u8BB0\u7684\u540C\u5206\u5F02\u6784\u78B3\u94FE\u7A7A\u95F4\u7ED3\u6784\u8F6C\u4E3A\u9AD8\u53EF\u7528\u6750\u6599\u7684\u88C5\u914D\u5BC6\u7801\u62FC\u8865\uFF0C\u4F7F\u8303\u5FB7\u534E\u5806\u79EF\u4E0E\u7A7A\u95F4\u5BF9\u79F0\u5EA6\u7684\u56E0\u679C\u4E00\u89C8\u65E0\u9057\u3002"
      },
      {
        chapterIndex: "10",
        title: "\u9971\u548C\u4E0E\u4E0D\u9971\u548C\u53CC\u952E\u805A\u5408",
        coveredChapters: "Topic 4.2",
        summary: "\u78B3\u53CC\u952E\u4E0D\u9971\u548C\u52A0\u6210, \u81EA\u7531\u57FA\u94FE\u5F0F\u5F15\u71C3, \u70ED\u529B\u5B66\u786C\u5E95",
        gameType: "interactive-story",
        gameTitle: "\u9AD8\u538B\u53CD\u5E94\u91DC\u88C2\u7206\u8B66\u62A5\uFF1A\u63A7\u5236\u53CC\u952E\u52A0\u6210\u91CA\u653E\u7684\u6307\u6570\u70ED\u80FD",
        gameRules: "\u5355\u4F53\u6DF7\u5408\u7269\u4E2D\u7684\u9971\u548C\u5EA6\u8FC7\u4F4E\uFF0C\u4E0D\u9971\u548C\u5361\u6263\u5728\u6C27\u6C14\u6E17\u5165\u540E\u53D1\u751F\u4E86\u72C2\u70ED\u7684\u81EA\u53D1\u94FE\u5F0F\u4EA4\u8054\u52A0\u6210\uFF0C\u70ED\u91CF\u5806\u7206\u53D110\u500D\u7EA7\u5C16\u5CF0\u7EA2\u5149\uFF01\u4F5C\u4E3A\u9632\u66B4\u603B\u76D1\uFF0C\u4F60\u6709\u6570\u79D2\u51B3\u7B56\u65F6\u95F4\uFF1A\u662F\u5012\u5165\u6DB2\u963B\u6D88\u9000\u5361\u6263\u81EA\u7531\u57FA\uFF0C\u8FD8\u662F\u727A\u7272\u9AD8\u805A\u7269\u5F3A\u5EA6\u76F4\u63A5\u52A0\u538B\u5BC6\u5C01\u3002\u751F\u6B7B\u5B58\u4EA1\u5728\u6B64\u4E00\u4E3E\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u70ED\u653E\u70ED\u94FE\u6761\u662F\u805A\u5408\u5DE5\u4E1A\u7684\u68A6\u9B47\uFF0C\u901A\u8FC7\u6781\u9650\u51B3\u7B56\uFF0C\u5B66\u5458\u5C06\u5BF9\u78B3\u53CC\u952E\u5728\u4E0D\u9971\u548C\u72B6\u6001\u4E0B\u7684\u5DE8\u5927\u5316\u5B66\u4F4D\u80FD\u7559\u4E0B\u76F4\u51FB\u7075\u9B42\u7684\u5370\u8C61\u3002"
      },
      {
        chapterIndex: "11",
        title: "\u5171\u6CB8\u538B\u5F3A\u7CBE\u7CBE\u5BC6\u84B8\u998F",
        coveredChapters: "Topic 5.1",
        summary: "\u4E24\u76F8\u4E24\u7EC4\u5206\u6C7D\u6DB2\u5E73\u8861, \u62C9\u4E4C\u5C14\u5B9A\u5F8B\u7406\u60F3\u5EA6, \u6CB8\u70B9\u4E0E\u5916\u538B\u53CD\u6BD4",
        gameType: "math-quest",
        gameTitle: "\u6709\u673A\u9632\u6BD2\u8840\u6E05\u70ED\u4EA4\u6362\uFF1A\u84B8\u998F\u5854\u6781\u9650\u6E29\u5EA6\u538B\u5F3A\u5BF9\u51C6",
        gameRules: "\u6BD2\u5242\u548C\u4FDD\u62A4\u8840\u6E05\u5728110\u5EA6\u5171\u6CB8\u84B8\u998F\u3002\u4E00\u65E6\u53D7\u6E29\u8D85\u8D8A\u70ED\u70B9\uFF0C\u8840\u6E05\u5C06\u6C38\u4E45\u5931\u6D3B\u3002\u4F60\u73B0\u5728\u5FC5\u987B\u8BA1\u7B97\u964D\u4F4E\u84B8\u998F\u5854\u6C14\u538B\u7684\u7CBE\u786E\u5411\u91CF\uFF0C\u5728\u6C14\u6DB2\u76F8\u5E73\u8861\u56FE\u4E0A\u5229\u7528\u62C9\u4E4C\u5C14\u5B9A\u7406\u6C42\u5F97\u5176\u5E38\u6570\u4EA4\u6C47\u70B9\uFF0C\u6821\u51C6\u6700\u4F4E\u70ED\u4EA4\u6362\u6E29\u538B\u5BF9\u9F50\uFF0C\u5728\u8840\u6E05\u88AB\u84B8\u6BC1\u524D\u63D0\u53D6\u6551\u547D\u836F\u6DB2\u3002",
        duration: "12\u5206\u949F",
        designRationale: "\u628A\u590D\u6742\u7684\u6C7D\u6DB2\u76F8\u5E73\u8861\u66F2\u7EBF\u5316\u4E3A\u51CF\u538B\u84B8\u998F\u964D\u6E29\u81EA\u6551\u7684\u5B9E\u673A\u5DE5\u7A0B\u8BA1\u7B97\uFF0C\u5F7B\u5E95\u9886\u609F\u538B\u5F3A\u63A7\u5236\u76F8\u5E73\u8861\u7684\u9AD8\u7B49\u771F\u6838\u3002"
      },
      {
        chapterIndex: "12",
        title: "\u6D3B\u5316\u80FD\u4F4D\u969C\u7A81\u8DC3\u50AC\u5316",
        coveredChapters: "Topic 5.2",
        summary: "\u963F\u4F26\u5C3C\u4E4C\u65AF\u516C\u5F0F, \u50AC\u5316\u5242\u964D\u4F4E\u4F4D\u969C, \u53CD\u5E94\u70ED\u529B\u5B66\u5E73\u8861\u4E0D\u53D8\u6027",
        gameType: "quiz",
        gameTitle: "\u51B7\u6838\u805A\u7194\u52A0\u901F\uFF1A\u963F\u4F26\u5C3C\u4E4C\u65AF\u6D3B\u5316\u80FD\u58C1\u969C\u6253\u7834",
        gameRules: "\u80FD\u6E90\u6838\u5FC3\u53CD\u5E94\u6781\u5176\u8870\u5F31\uFF0C\u56E0\u4E3A\u53CD\u5E94\u7269\u5206\u5B50\u5728200\u5EA6\u6E29\u5EA6\u4E0B\u7684\u5E73\u5747\u81EA\u7531\u78B0\u649E\u52A8\u80FD\u6839\u672C\u591F\u4E0D\u7740\u9AD8\u8038\u7684\u6D3B\u5316\u80FD\u58C1\u969C\uFF01\u4F60\u9700\u8981\u8BBA\u8BC1\u901A\u8FC7\u5F15\u5165\u91CD\u91D1\u5C5E\u50AC\u5316\u5242\u4EE5\u5F3A\u529B\u91CD\u6784\u8FC7\u6E21\u6001\uFF0C\u8BA9\u6D3B\u5316\u80FD\u5C4F\u969C\u65AD\u5D16\u5F0F\u6ED1\u5761\uFF0C\u5E76\u5728\u8BBA\u8BC1\u50AC\u5316\u5242\u4E0D\u4F1A\u6539\u53D8\u53CD\u5E94\u5E73\u8861\u603B\u4EA7\u51FA\u5B9A\u7406\u4E0B\u505A\u51FA\u5B89\u5168\u6289\u62E9\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u5C06\u62BD\u8C61\u7684\u80FD\u7EA7\u8FC7\u6E21\u6001\u4E0E\u964D\u4F4E\u6D3B\u5316\u4F4D\u969C\u7684\u73B0\u5B9E\u5DE5\u7A0B\u96BE\u9898\u8026\u5408\uFF0C\u8BA9\u5B66\u5458\u611F\u53D7\u50AC\u5316\u5242\u4F5C\u4E3A\u2018\u5B8F\u89C2\u7269\u7406\u52A0\u901F\u5F00\u5173\u2019\u7684\u6280\u672F\u795E\u6548\u3002"
      },
      {
        chapterIndex: "13",
        title: "\u751F\u547D\u9176\u53D8\u6027\u8D1F\u53CD\u9988\u62E6\u622A",
        coveredChapters: "Topic 5.3",
        summary: "\u9176\u4FC3\u53CD\u5E94\u901F\u7387, \u53D8\u6027\u5931\u6D3B\u4E34\u754C\u70B9, \u6C34\u5229\u8D1F\u53CD\u9988\u8C03\u8282",
        gameType: "interactive-story",
        gameTitle: "\u7279\u79CD\u6BD2\u7D20\u4F53\u6E29\u9AD8\u70ED\u62E6\u622A\uFF1A\u7EF4\u6301\u9176\u4FC3\u5FAA\u73AF\u5E73\u7A33\u7684\u751F\u6B7B\u8F83\u91CF",
        gameRules: "\u673A\u4F53\u6E29\u5EA6\u6B63\u541142\u5EA6\u4E0D\u53EF\u633D\u56DE\u7684\u9AD8\u70ED\u903C\u8FD1\uFF0C\u7EF4\u6301\u4F53\u7EC6\u80DE\u6C27\u6D41\u7684\u6838\u5FC3\u9176\u5728\u8D8A\u8FC741\u5EA6\u7EA2\u7EBF\u540E\uFF0C\u5176\u9AD8\u5EA6\u7CBE\u5BC6\u7684\u4E09\u7EF4\u7A7A\u95F4\u6784\u8C61\u6B63\u56E0\u4E3A\u6C22\u952E\u548C\u4E8C\u786B\u952E\u65AD\u5F00\u53D1\u751F\u96EA\u5D29\u53D8\u6027\uFF01\u4F60\u9700\u8981\u5728\u51B7\u7F29\u9488\u6CE8\u5C04\u6216\u6BD2\u6027\u514D\u75AB\u5BF9\u51B2\u95F4\u53D1\u8D77\u591A\u65B9\u5411\u6323\u624E\u6295\u8D44\u548C\u6295\u7968\uFF0C\u7EF4\u62A4\u50AC\u5316\u6D3B\u6027\u4E0D\u81F4\u77AC\u95F4\u53D8\u6C34\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u8BA9\u5B66\u751F\u7ECF\u5386\u9176\u7684\u9AD8\u654F\u53D8\u6027\u5931\u6D3B\u66F2\u7EBF\uFF0C\u660E\u767D\u9176\u6D3B\u6027\u5BF9\u6781\u7AEF\u5916\u754C\u6761\u4EF6\uFF08\u6E29\u5EA6\u3001\u9178\u5EA6\uFF09\u7684\u6050\u6016\u654F\u611F\u6027\uFF0C\u592F\u5B9E\u751F\u7269\u50AC\u5316\u57FA\u7840\u77E5\u8BC6\u3002"
      },
      {
        chapterIndex: "14",
        title: "\u52D2\u590F\u7279\u5217\u9632\u7EBF\u81EA\u9002\u5E94\u8865\u507F",
        coveredChapters: "Topic 6.1",
        summary: "\u52D2\u590F\u7279\u5217\u539F\u7406, \u6D53\u5EA6\u538B\u5F3A\u5E94\u529B\u5E73\u8861\u81EA\u9002\u5E94, \u6B63\u9006\u901F\u7387\u53CD\u9988",
        gameType: "coding-puzzle",
        gameTitle: "\u5316\u5B66\u84C4\u6C34\u6C60\u8FC7\u538B\u8B66\u62A5\uFF1A\u5E73\u8861\u6F02\u79FB\u9632\u5FA1\u4EE3\u7801\u62FC\u88C5",
        gameRules: "\u5408\u6210\u6C28\u9AD8\u538B\u53CD\u5E94\u5806\u7A81\u906D\u6C14\u538B\u6CF5\u8D85\u8F7D\u6324\u538B\uFF0C\u6C14\u6E29\u6FC0\u5267\u98D9\u5347\uFF01\u7CFB\u7EDF\u5185\u7F6E\u7684\u5E73\u8861\u72B6\u6001\u673A\u9677\u5165\u504F\u632F\u6253\u67B6\uFF0C\u65E0\u6CD5\u5BF9\u5E73\u8861\u79FB\u4F4D\u505A\u51FA\u65B9\u5411\u9884\u6D4B\u3002\u4F60\u5FC5\u987B\u5728\u9650\u65F6\u5185\u62FC\u88C5\u5E73\u8861\u5224\u5B9AIf-Else\u7B97\u6CD5\u4EE3\u7801\uFF0C\u6A21\u62DF\u52D2\u590F\u7279\u5217\u7269\u7406\u5BF9\u51B2\u903B\u8F91\uFF0C\u8FEB\u4F7F\u7CFB\u7EDF\u671D\u5206\u5B50\u6570\u51CF\u5C0F\u7684\u65B9\u5411\u81EA\u52A8\u504F\u8F6C\uFF0C\u5316\u89E3\u7206\u70B8\u5384\u8FD0\u3002",
        duration: "10\u5206\u949F",
        designRationale: "\u901A\u8FC7\u7F16\u5199\u5E73\u8861\u8F6C\u6362\u4EE3\u7801\uFF0C\u8BA9\u5B66\u751F\u9886\u4F1A\u5316\u5B66\u5E73\u8861\u4E0D\u4EC5\u662F\u4E00\u6761\u51B7\u51B0\u51B0\u7684\u539F\u5219\uFF0C\u66F4\u662F\u5305\u542B\u5927\u81EA\u7136\u81EA\u6211\u8D1F\u53CD\u9988\u6F14\u66FF\u673A\u5236\u7684\u6700\u5177\u52A8\u6001\u4EE3\u6570\u5BF9\u79F0\u6027\u7684\u5B8C\u7F8E\u6CD5\u5219\u3002"
      },
      {
        chapterIndex: "15",
        title: "\u6269\u6563\u71B5\u589E\u9AD8\u70ED\u575D\u6781\u963B",
        coveredChapters: "Topic 6.2",
        summary: "\u70ED\u529B\u5B66\u7B2C\u4E8C\u5B9A\u5F8B, \u6269\u6563\u9AD8\u71B5\u72B6\u6001, \u5C40\u90E8\u51CF\u71B5\u91CD\u7EC4\u727A\u7272",
        gameType: "interactive-story",
        gameTitle: "\u70ED\u6269\u6563\u9AD8\u71B5\u5931\u63A7\u5927\u7206\u7834\uFF1A\u6700\u540E\u4E00\u79D2\u7684\u51CF\u71B5\u9009\u62E9",
        gameRules: "\u6838\u7269\u8D28\u963B\u9694\u8231\u5F7B\u5E95\u7834\u88C2\uFF0C\u5927\u91CF\u7684\u5206\u5B50\u9AD8\u71B5\u80FD\u91CF\u6B63\u5728\u4EE5\u51E0\u4F55\u500D\u7387\u671D\u5168\u65B9\u5411\u65E0\u5E8F\u8513\u5EF6\uFF08\u9AD8\u70ED\u6269\u6563\uFF09\uFF0C\u5982\u679C\u4E0D\u52A0\u63A7\u5236\uFF0C\u80FD\u91CF\u6563\u9038\u5C06\u5F7B\u5E95\u8BA9\u6574\u8258\u6551\u751F\u8239\u5760\u5165\u65E0\u6CD5\u633D\u56DE\u7684\u6C38\u4E45\u9AD8\u71B5\u70ED\u5BC2\u51B0\u51B7\u6B7B\u5708\u3002\u4F60\u9700\u8981\u5728\u6700\u540E\u51B3\u7B56\uFF1A\u662F\u5C01\u95ED\u5C40\u90E8\u8231\u6BB5\u6CE8\u5165\u51B0\u6001\u51B7\u6E90\u5B9E\u73B0\u9AD8\u80FD\u5C40\u90E8\u6392\u70ED\uFF08\u91CD\u7EC4\u81EA\u51CF\u71B5\uFF09\uFF0C\u8FD8\u662F\u727A\u7272\u8F85\u80FD\u53D1\u7535\u673A\u7ED9\u4E3B\u63A7\u91CD\u6784\u71B5\u963B\uFF1F\u6BCF\u4E00\u4E2A\u4E0D\u5F52\u8DEF\u6289\u62E9\u90FD\u4F1A\u5F7B\u5E95\u9006\u53D8\u9003\u751F\u80DC\u7B97\u3002",
        duration: "11\u5206\u949F",
        designRationale: "\u6DF1\u5EA6\u7406\u89E3\u70ED\u529B\u5B66\u7B2C\u4E8C\u5B9A\u5F8B\u4E0D\u53EF\u9006\u71B5\u589E\u7684\u51B7\u9177\u7279\u6027\uFF0C\u5C06\u5C40\u9650\u7CFB\u7EDF\u5185\u5C40\u90E8\u8017\u6563\u51CF\u71B5\u548C\u8017\u80FD\u4EE3\u507F\u673A\u5236\u620F\u5267\u5316\u5448\u73B0\uFF0C\u63D0\u5347\u7269\u7406\u54F2\u5B66\u773C\u5149\u3002"
      }
    ]
  };
}
async function startServer() {
  app.get("/api/prompt-templates", async (req, res) => {
    try {
      const aiEntry = req.query.aiEntry;
      const templates = await getAllPromptTemplates(aiEntry);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/prompt-templates/:id", async (req, res) => {
    try {
      const template = await getPromptTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: "Prompt template not found" });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/prompt-templates", async (req, res) => {
    try {
      const template = await createPromptTemplate(req.body);
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.put("/api/prompt-templates/:id", async (req, res) => {
    try {
      const template = await updatePromptTemplate(req.params.id, req.body);
      if (!template) return res.status(404).json({ error: "Prompt template not found" });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/prompt-templates/:id", async (req, res) => {
    try {
      await deletePromptTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/prompt-templates/:templateId/versions", async (req, res) => {
    try {
      const versions = await getPromptVersions(req.params.templateId);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/prompt-templates/:templateId/versions", async (req, res) => {
    try {
      const existingVersions = await getPromptVersions(req.params.templateId);
      const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map((v) => v.version)) + 1 : 1;
      const version = await createPromptVersion({
        ...req.body,
        promptTemplateId: req.params.templateId,
        version: nextVersion
      });
      res.json(version);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.put("/api/prompt-versions/:id", async (req, res) => {
    try {
      const version = await updatePromptVersion(req.params.id, req.body);
      if (!version) return res.status(404).json({ error: "Prompt version not found" });
      res.json(version);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/prompt-versions/:id", async (req, res) => {
    try {
      await deletePromptVersion(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/prompt-templates/seed", async (req, res) => {
    try {
      const { aiEntry, name, systemPrompt, userPromptTemplate } = req.body;
      if (!aiEntry || !name) {
        return res.status(400).json({ error: "aiEntry and name are required" });
      }
      const existing = await getAllPromptTemplates(aiEntry);
      if (existing.length > 0) {
        return res.json({ success: true, seeded: false, existing });
      }
      const template = await createPromptTemplate({
        aiEntry,
        name,
        systemPrompt: systemPrompt || null,
        userPromptTemplate: userPromptTemplate || null,
        isActive: true
      });
      res.json({ success: true, seeded: true, template });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/version-notes", async (req, res) => {
    try {
      const notes = await getAllVersionNotes();
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.put("/api/version-notes/:version", async (req, res) => {
    try {
      const { version } = req.params;
      const { note } = req.body;
      if (typeof note !== "string") {
        return res.status(400).json({ error: "note (string) is required" });
      }
      const saved = await setVersionNote(version, note);
      res.json(saved);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/git-info", (req, res) => {
    try {
      const projectRoot = process.cwd();
      const opts = { cwd: projectRoot, encoding: "utf-8", timeout: 3e3 };
      const headHash = (0, import_child_process.execSync)("git rev-parse --short HEAD", opts).trim();
      let dirty = false;
      try {
        const status = (0, import_child_process.execSync)("git status --porcelain", opts).trim();
        dirty = status.length > 0;
      } catch {
      }
      const branch = (0, import_child_process.execSync)("git rev-parse --abbrev-ref HEAD", opts).trim();
      res.json({ headHash, dirty, branch });
    } catch (error) {
      res.json({ headHash: "", dirty: false, branch: "", error: error.message });
    }
  });
  app.get("/api/model-configs", async (req, res) => {
    try {
      const configs = await getAllModelConfigs();
      res.json(configs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/model-configs/:id", async (req, res) => {
    try {
      const config = await getModelConfig(req.params.id);
      if (!config) return res.status(404).json({ error: "Model config not found" });
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/model-configs", async (req, res) => {
    try {
      const config = await createModelConfig(req.body);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.put("/api/model-configs/:id", async (req, res) => {
    try {
      const config = await updateModelConfig(req.params.id, req.body);
      if (!config) return res.status(404).json({ error: "Model config not found" });
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/model-configs/:id", async (req, res) => {
    try {
      await deleteModelConfig(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.put("/api/projects/:id/execution-mode", async (req, res) => {
    try {
      const { executionMode } = req.body;
      if (executionMode !== "auto" && executionMode !== "manual") {
        return res.status(400).json({ error: "executionMode \u5FC5\u987B\u4E3A auto \u6216 manual" });
      }
      await updateProject(req.params.id, { executionMode });
      res.json({ success: true, executionMode });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/automation/start", async (req, res) => {
    try {
      const { projectId, concurrency, model } = req.body;
      if (!projectId) return res.status(400).json({ error: "\u7F3A\u5C11 projectId" });
      const job = await startAutomationJob(projectId, { concurrency, model });
      res.json({ job });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/automation/:jobId/status", async (req, res) => {
    try {
      const snapshot = await getJobSnapshot(req.params.jobId);
      if (!snapshot.job) return res.status(404).json({ error: "Job \u4E0D\u5B58\u5728" });
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/automation/:jobId/stream", async (req, res) => {
    const { jobId } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(": connected\n\n");
    registerSseClient(jobId, res);
    try {
      const snapshot = await getJobSnapshot(jobId);
      if (snapshot.job) {
        res.write(`event: snapshot
data: ${JSON.stringify(snapshot)}

`);
      }
    } catch {
    }
    const heartbeat = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
      }
    }, 15e3);
    req.on("close", () => {
      clearInterval(heartbeat);
      unregisterSseClient(jobId, res);
    });
  });
  app.post("/api/automation/:jobId/pause", async (req, res) => {
    try {
      await pauseJob(req.params.jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/automation/:jobId/resume", async (req, res) => {
    try {
      await resumeJob(req.params.jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/automation/:jobId/cancel", async (req, res) => {
    try {
      await cancelJob(req.params.jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/automation/task/:taskId/retry", async (req, res) => {
    try {
      await retryTask(req.params.taskId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/automation/:jobId/retry-all", async (req, res) => {
    try {
      await retryAllFailed(req.params.jobId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/projects/:id/app-codes", async (req, res) => {
    try {
      const project = await getProject(req.params.id);
      if (!project) return res.status(404).json({ error: "\u9879\u76EE\u4E0D\u5B58\u5728" });
      let modules = [];
      try {
        const parsed = JSON.parse(project.modules);
        modules = Array.isArray(parsed) ? parsed : parsed.slices || parsed.modules || [];
      } catch {
      }
      const results = [];
      for (const mod of modules) {
        const code = await getGeneratedAppCode(req.params.id, mod.id);
        if (code) {
          results.push({
            moduleId: mod.id,
            title: mod.title || mod.sliceId || mod.id,
            coveredChapters: mod.coveredChapters,
            code
          });
        }
      }
      res.json({ items: results, total: results.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("\u26A1 Vite middleware initialized in Development mode.");
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
    console.log("\u{1F4E6} Production assets statically mounted.");
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} Full-stack Book-to-Game server running on http://0.0.0.0:${PORT} [${SERVER_VERSION}]`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
