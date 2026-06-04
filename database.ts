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

export async function closeDatabase(): Promise<void> {
  if (db) {
    saveDatabase(db);
    db.close();
    db = null;
  }
}
