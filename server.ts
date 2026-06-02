import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  createProject,
  updateProject,
  updateProjectPdf,
  getProject,
  getAllProjects,
  deleteProject,
  saveModuleScript,
  getModuleScripts,
  Project
} from "./database.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

// Body parsing configurations
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// AI Provider configuration
const AI_PROVIDER = process.env.AI_PROVIDER || "deepseek"; // "deepseek", "dashscope", "gemini", "ollama", or "huggingface"

// DeepSeek API client
async function callDeepSeek(prompt: string, systemPrompt: string = "", model: string = ""): Promise<string> {
  try {
    const deepseekModel = model || process.env.DEEPSEEK_MODEL || "deepseek-chat";
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY || "";
    
    if (!deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }
    
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekApiKey}`
      },
      body: JSON.stringify({
        model: deepseekModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("DeepSeek call failed:", error);
    throw error;
  }
}

// DashScope (阿里云通义千问) API client
async function callDashScope(prompt: string, systemPrompt: string = "", model: string = ""): Promise<string> {
  try {
    const dashscopeModel = model || process.env.DASHSCOPE_MODEL || "qwen-plus";
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY || "";
    
    if (!dashscopeApiKey) {
      throw new Error("DASHSCOPE_API_KEY is not configured");
    }
    
    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dashscopeApiKey}`
      },
      body: JSON.stringify({
        model: dashscopeModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DashScope API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("DashScope call failed:", error);
    throw error;
  }
}

// Lazy initializer for Google GenAI client
let aiInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("⚠️ Warning: GEMINI_API_KEY environment variable is not set!");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Ollama API client
async function callOllama(prompt: string, systemPrompt: string = "", model: string = ""): Promise<string> {
  try {
    const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
    const ollamaModel = model || process.env.OLLAMA_MODEL || "llama3.1:8b";
    
    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: prompt,
        system: systemPrompt,
        format: "json",
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

// Hugging Face Inference API client (免费云端模型)
async function callHuggingFace(prompt: string, systemPrompt: string = "", model: string = ""): Promise<string> {
  try {
    const hfModel = model || process.env.HUGGINGFACE_MODEL || "Qwen/Qwen2-7B-Instruct";
    const hfToken = process.env.HUGGINGFACE_TOKEN || "";
    
    const fullPrompt = systemPrompt ? `<|system|>${systemPrompt}</s><|user|>${prompt}</s><|assistant|>` : prompt;
    
    const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(hfToken && { "Authorization": `Bearer ${hfToken}` })
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 2048,
          temperature: 0.7,
          top_p: 0.95,
          repetition_penalty: 1.0,
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

// Ensure server is up and responsive
/**
 * Utility to standardize and clean chapter range values to follow a clean uniform "a-b" or "a" format. Removes "Topic", "&", "and", etc.
 */
function cleanCoveredChapters(covered: string, fallbackIndex: string): string {
  if (!covered) return fallbackIndex || "1.1";
  
  // Clean basic prefixes and noise
  let str = covered
    .replace(/[Cc]hapter|[Ss]ection|[Tt]opic|第|章|节|课/gi, "")
    .replace(/[\s\uFEFF\xA0]+/g, "") // remove all whitespaces
    .trim();

  // Standardize delimiters (replace &, and, \, +, 顿号、 or comma with -)
  str = str.replace(/[&以及+和与、,，]/g, "-");

  // Filter out non-numeric noise except decimals and hyphens
  // Let's find all decimals or numbers representing sections/subsections
  const matches = str.match(/\d+(?:\.\d+)?/g);
  if (matches && matches.length >= 2) {
    // If we have a list of numbers like ['6.1', '6.2'], represent it as first-last range, e.g., '6.1-6.2'
    const first = matches[0];
    let last = matches[matches.length - 1];

    if (first.includes('.') && !last.includes('.')) {
      const major = first.split('.')[0];
      last = `${major}.${last}`;
    }

    if (first === last) {
      return first;
    }
    return `${first}-${last}`;
  } else if (matches && matches.length === 1) {
    return matches[0];
  }

  // Fallback to whatever digits we can salvage, or return clean string
  return str || fallbackIndex || "1.1";
}

// Convert old mock blueprint format to new slice format
function convertOldMockToNewFormat(oldMock: any) {
  const slices = (oldMock.modules || []).map((mod: any, idx: number) => ({
    sliceId: `S${idx + 1}`,
    title: mod.title || `切片${idx + 1}`,
    coveredChapters: mod.coveredChapters || `${idx + 1}.1`,
    summary: {
      learnedPoints: [
        `能理解${mod.title || "本节"}的核心概念`,
        `能描述${mod.summary || "相关知识点"}的关键特征`,
        `能运用${mod.title || "本节"}知识解决实际问题`
      ],
      practicalProblems: [
        `当遇到${mod.title || "本节"}相关场景时，你能运用核心知识进行分析`,
        `当需要应用${mod.title || "本节"}概念时，你能做出正确决策`
      ]
    },
    infoDensity: {
      conceptCount: mod.infoDensity ? 3 : 4,
      factCount: mod.infoDensity ? 2 : 3,
      abstractLevel: "中",
      nestingLevel: "两层",
      suggestedMinutes: "10-15",
      rationale: mod.infoDensity || "该切片信息量适中，可在10-15分钟内完成学习，不会造成认知过载。"
    },
    cohesionDetail: {
      cohesionType: "时序递进",
      mechanism: mod.cohesionDetail || "该切片内的知识点围绕同一教学主题组织，逻辑递进关联，形成完整学习单元。",
      coreQuestion: `如何掌握${mod.title || "本节"}的核心知识并应用于实践？`
    },
    designRationale: mod.designRationale || `学生通过本切片学习${mod.title || "核心概念"}，理解知识点之间的关联，并能运用这些知识分析和解决实际问题。`
  }));
  
  return {
    bookTitle: oldMock.title || "未知教材",
    totalSlices: slices.length,
    slices
  };
}

function parseJsonResponse(text: string) {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1];
  }
  return JSON.parse(cleaned);
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Project Management APIs
app.get("/api/projects", async (req, res) => {
  try {
    const projects = await getAllProjects();
    console.log("📋 GET /api/projects returning:", projects.length, "projects");
    res.json(projects);
  } catch (error) {
    console.error("❌ Failed to get projects:", error);
    res.status(500).json({ error: "Failed to get projects" });
  }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    console.log("📥 GET /api/projects/:id called:", req.params.id);
    const project = await getProject(req.params.id);
    console.log("📋 Project found:", project ? "yes" : "no", project);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error("❌ Failed to get project:", error);
    res.status(500).json({ error: "Failed to get project" });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const { name, pdfFileName, pdfData, bookTitle, bookContentText, directoryItems, modules } = req.body;
    console.log("📥 POST /api/projects called with:", { name, pdfFileName: pdfFileName ? "yes" : "no", pdfData: pdfData ? "yes" : "no" });
    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }
    const project = await createProject(name, pdfFileName, pdfData, bookTitle, bookContentText, directoryItems, modules);
    console.log("✅ Project created in DB:", project.id);
    res.json(project);
  } catch (error) {
    console.error("❌ Failed to create project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  try {
    const { name, bookTitle, bookContentText, directoryItems, modules, pdfFileName, pdfData } = req.body;
    await updateProject(req.params.id, { name, bookTitle, bookContentText, directoryItems, modules, pdfFileName, pdfData });
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

/**
 * 1) Parsing TOC & Module Blueprinting API
 */
app.post("/api/parse-book", async (req, res) => {
  try {
    const { title, fullText, directoryStructure } = req.body;

    // Log the dynamic data being received from frontend
    console.log("\n📚 ========== PARSE BOOK API CALL ==========");
    console.log("📕 Book Title (dynamic from frontend):", title);
    console.log("📂 Directory Structure length:", directoryStructure?.length || 0);
    if (directoryStructure && directoryStructure.length > 0) {
      console.log("📋 First 5 directory items:", JSON.stringify(directoryStructure.slice(0, 5), null, 2));
    }
    console.log("📏 fullText length:", fullText?.length || 0);
    console.log("🤖 AI Provider:", process.env.AI_PROVIDER || "deepseek");
    console.log("🧠 Model:", process.env.DEEPSEEK_MODEL || "deepseek-chat");
    console.log("==========================================\n");

    if (!title) {
      return res.status(400).json({ error: "Missing book title." });
    }

    let directoryText = "";
    if (directoryStructure && directoryStructure.length > 0) {
      directoryText = "目录 & 课本章节提要：\n";
      directoryStructure.forEach((item: any) => {
        const pageStr = item.page ? ` (P.${item.page})` : '';
        if (item.type === 'chapter') {
          directoryText += `${item.title}${pageStr}\n`;
        } else {
          directoryText += `  - ${item.title}${pageStr}\n`;
        }
      });
    } else {
      directoryText = fullText?.substring(0, 15000) || "";
    }

    const fullTextSnippet = fullText && fullText.length > 0
      ? `\n\n以下是该课本的原始文本内容摘要（供参考）：\n${fullText.substring(0, 8000)}`
      : "";

    const systemInstruction = `你是一名为教师/课程设计者提供服务的教学切片专家。我将给你一本书的目录，请你帮我将其切分成多个教学切片，每个切片用于后续设计互动内容。
 
一、核心切片原则
信息负荷控制：每个切片包含 3-7 个核心概念（或 5-10 条具体策略/事实），对应 8-18 分钟的学习时长
知识内聚性：每个切片内的知识点必须能共同回答一个完整的子问题或完成一个闭环的子任务
章节覆盖格式：使用 a-b 格式表示连续章节（如 2.1-2.3），单个章节写成 a（如 5.2）
二、输出格式要求
请输出纯 JSON 格式，结构如下：
{
  "bookTitle": "从目录中提取的书名",
  "totalSlices": 22,
  "slices": [
    {
      "sliceId": "S1",
      "title": "切片主题名称（一句话，让学生知道这个切片在讲什么）",
      "coveredChapters": "1.1-1.2",
      "summary": {
        "learnedPoints": [
          "能说出/理解/区分XXX（具体可陈述的知识点）",
          "能描述XXX的X个阶段/类型",
          "能解释XXX与XXX的关系"
        ],
        "practicalProblems": [
          "当...时，你能...（具体场景化描述）",
          "当...时，你能..."
        ]
      },
      "infoDensity": {
        "conceptCount": 4,
        "factCount": 2,
        "abstractLevel": "低/中/高",
        "nestingLevel": "无/两层/三层",
        "suggestedMinutes": "8-12",
        "rationale": "用2-3句话说明：为什么这个负荷是合理的？如果超限，建议如何拆分？"
      },
      "cohesionDetail": {
        "cohesionType": "因果链/时序递进/对比争鸣/问题-解决链/分类并列/工具性内聚/解释性递进",
        "mechanism": "用3-4句话说明知识点之间的具体连接方式（如：A导致B，B决定C；前3个概念共同支撑第4个；两个考点并列但共同服务于一个目的）",
        "coreQuestion": "用一句话概括：这个切片最终要回答的核心问题是什么？"
      },
      "designRationale": "用1-2句话说明为什么把这些章节/概念切在一起，以及它与前后切片的逻辑关系"
    }
  ]
}
三、字段详细填写规范
字段 	 填写要求
sliceId 	 S1, S2, S3… 按顺序编号
title 	 一句话主题，建议用"动词+名词"或"核心问题"形式
coveredChapters 	 使用 a-b 格式，如 2.1-2.3；单节写 3.5
summary.learnedPoints 	 3-5条，每条以"能…"开头，可验证
summary.practicalProblems 	 2-3条，格式为"当【具体场景】时，你能【具体行动】"
infoDensity.conceptCount 	 纯理论概念的数量（如"关键期假说""ZPD"）
infoDensity.factCount 	 具体事实/策略/步骤的数量（如"9类ESL活动"）
infoDensity.abstractLevel 	 低=可立即操作；中=需简单推理；高=需理论理解
infoDensity.nestingLevel 	 无=并列；两层=概念下有子概念；三层=需多步推理
infoDensity.suggestedMinutes 	 基于conceptCount×2~3分钟 + factCount×0.5~1分钟估算
infoDensity.rationale 	 必须包含判断结论+依据，如超限则给出拆分建议
cohesionDetail.cohesionType 	 从括号中选择最匹配的一项
cohesionDetail.mechanism 	 明确写出"X连接Y""A支撑B""C和D共同指向E"
cohesionDetail.coreQuestion 	 一个完整的问句，如"如何判断一个孩子处于哪个阅读阶段？"
designRationale 	 说明切片边界划分的逻辑，以及与前后切片的关系
四、重要提醒
如果某一章/节的信息负荷过高（conceptCount > 7 或 abstractLevel=高 且 conceptCount > 5），请在 infoDensity.rationale 中明确建议"拆分为2个切片"
如果某一章/节的信息负荷过低（conceptCount < 2 且 factCount < 3），请合并到相邻切片
每个切片必须能让一个普通教师/学生在 20 分钟内完成理解（不含练习）
输出必须是有效的纯 JSON，不要包含注释或额外文字`;

    const promptMessage = `这是你需要处理的书籍目录，书籍名称是"${title}"，书籍目录信息如下：\n${directoryText}${fullTextSnippet}\n\n请严格按照上述目录结构进行切片，不要使用你训练数据中的其他课本内容。`;

    // DEBUG: Print the actual prompt message being sent to AI
    console.log("\n📝 ========== PROMPT MESSAGE SENT TO AI ==========");
    console.log("Title used:", title);
    console.log("Directory text length:", directoryText.length);
    console.log("Directory text first 500 chars:", directoryText.substring(0, 500));
    console.log("Directory text last 300 chars:", directoryText.substring(directoryText.length - 300));
    console.log("Full prompt message first 1500 chars:", promptMessage.substring(0, 1500));
    console.log("==========================================\n");

    let outputText: string;

    // Force use DeepSeek V4 Flash for this specific endpoint (textbook slicing)
    const sliceModel = "deepseek-v4-flash";
    console.log(`🔄 [parse-book] Forcing DeepSeek model: ${sliceModel}`);
    outputText = await callDeepSeek(promptMessage, systemInstruction, sliceModel);

    try {
      const resultObj = parseJsonResponse(outputText);
      // Clean up coveredChapters layout string to be strictly standard across all slices
      if (resultObj && Array.isArray(resultObj.slices)) {
        resultObj.slices = resultObj.slices.map((slice: any, index: number) => {
          const fallbackIdx = `${index + 1}.1`;
          return {
            ...slice,
            coveredChapters: cleanCoveredChapters(slice.coveredChapters, fallbackIdx),
            infoDensity: slice.infoDensity || {
              conceptCount: 3,
              factCount: 2,
              abstractLevel: "中",
              nestingLevel: "两层",
              suggestedMinutes: "10-15",
              rationale: "该切片涵盖3-4个紧密相关的核心概念，信息量适中，可在10-15分钟内完成学习，不会造成认知过载。"
            },
            cohesionDetail: slice.cohesionDetail || {
              cohesionType: "时序递进",
              mechanism: "该切片内的知识点在逻辑上递进关联，围绕同一教学主题组织，形成完整的学习单元。",
              coreQuestion: "本切片要回答的核心问题是什么？"
            },
            designRationale: slice.designRationale || "学生通过本切片学习核心概念，理解知识点之间的关联，并能运用这些知识分析和解决实际问题。",
            summary: slice.summary || {
              learnedPoints: ["本切片涵盖的核心知识点"],
              practicalProblems: ["当...时，你能..."]
            }
          };
        });
      }
      res.json(resultObj);
    } catch (parseErr) {
      console.error("JSON parsing failed, raw response was:", outputText);
      const blueprint = getHeuristicOrMockBlueprint(title, fullText, directoryStructure);
      res.json(blueprint);
    }

  } catch (error: any) {
    console.error("Error splitting chapters via AI:", error);
    try {
      console.warn("⚠️ AI API call failed. Falling back to dynamic directory-based slicing...");
      const blueprint = getHeuristicOrMockBlueprint(
        req.body.title || "标准教材中的核心课题",
        req.body.fullText || "",
        req.body.directoryStructure || []
      );
      res.json(blueprint);
    } catch (innerErr: any) {
      res.status(500).json({ error: error.message || "External endpoint processing error" });
    }
  }
});

/**
 * Robust local heuristic and template-based syllabus builder.
 * Guarantees that even if Gemini is completely offline, blocked, or rate-limited,
 * the user receives an elegant, tailored, and customizable syllabus in Step 2.
 * Ensure whole sections are continuously covered from first to last with no truncation or skips.
 */
function getHeuristicOrMockBlueprint(title: string, fullText: string, directoryStructure: any[] = []) {
  const normTitle = (title || "").toLowerCase();

  if (directoryStructure && directoryStructure.length >= 3) {
    const chapters = directoryStructure.filter((item: any) => item.type === 'chapter');
    const sections = directoryStructure.filter((item: any) => item.type === 'section');

    const itemsToSlice = chapters.length >= 2 ? chapters : directoryStructure;

    let chunkSize = 1;
    if (itemsToSlice.length > 18) {
      chunkSize = Math.ceil(itemsToSlice.length / 16);
    }

    const matchedSlices: { chapterIndex: string; title: string; coveredChapters: string; summary: string }[] = [];
    let seqIdx = 1;

    for (let i = 0; i < itemsToSlice.length; i += chunkSize) {
      const chunk = itemsToSlice.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const firstItem = chunk[0];
      const lastItem = chunk[chunk.length - 1];

      const firstNumMatch = firstItem.title.match(/(\d+(?:\.\d+)?)/);
      const lastNumMatch = lastItem.title.match(/(\d+(?:\.\d+)?)/);
      const firstNum = firstNumMatch ? firstNumMatch[1] : `${seqIdx}.1`;
      const lastNum = lastNumMatch ? lastNumMatch[1] : firstNum;

      let rawCovered = firstNum === lastNum ? firstNum : `${firstNum}-${lastNum}`;

      const titleParts = chunk.map((c: any) => {
        const cleanTitle = c.title.replace(/^\d+(?:\.\d+)?\s*[-–—.:：、\s]+/, '').trim();
        return cleanTitle || c.title;
      });
      const combinedTitle = titleParts.join(" 与 ");
      const cleanTitle = combinedTitle.length > 50 ? combinedTitle.substring(0, 47) + "..." : combinedTitle;
      const combinedSummary = titleParts.join("，") + "核心考点及原理运用论证";

      matchedSlices.push({
        chapterIndex: String(seqIdx).padStart(2, '0'),
        title: cleanTitle,
        coveredChapters: cleanCoveredChapters(rawCovered, firstNum),
        summary: combinedSummary
      });
      seqIdx++;
    }

    const enrichedSlices = matchedSlices.map((slice) => {
      const normLine = slice.title.toLowerCase();
      let gameType = "quiz";
      let gameTitle = `${slice.title}核心概念通关`;

      if (normLine.includes("计算") || normLine.includes("公式") || normLine.includes("物理") || normLine.includes("数学") || normLine.includes("方程") || normLine.includes("量")) {
        gameType = "math-quest";
        gameTitle = `${slice.title}：定量计算与数据推演诊断`;
      } else if (normLine.includes("代码") || normLine.includes("编程") || normLine.includes("逻辑") || normLine.includes("算法") || normLine.includes("函数")) {
        gameType = "coding-puzzle";
        gameTitle = `${slice.title}：逻辑排障与程序除错挑战`;
      } else if (normLine.includes("概念") || normLine.includes("分类") || normLine.includes("匹配") || normLine.includes("对应") || normLine.includes("关联")) {
        gameType = "cross-match";
        gameTitle = `${slice.title}：核心概念知识匹配连线`;
      } else if (normLine.includes("故事") || normLine.includes("决策") || normLine.includes("抉择") || normLine.includes("剧情") || normLine.includes("历史")) {
        gameType = "interactive-story";
        gameTitle = `${slice.title}：情境剧情与因果抉择分支`;
      } else {
        gameType = "quiz";
        gameTitle = `${slice.title}：综合推演与深度应用通关`;
      }

      const gameRules = `尊敬的学员，请进入关于 "${slice.title}" 的交互论证训练舱。挑战规则：在模拟的危机环境或核心场景下，通过一系列深度学科判断和情境决策，巩固您在 [${slice.title}] 中所学的核心逻辑。`;

      return {
        chapterIndex: slice.chapterIndex,
        title: slice.title,
        coveredChapters: slice.coveredChapters,
        summary: {
          learnedPoints: [`能理解${slice.title}的核心概念`, `能描述${slice.title}的关键特征`, `能运用${slice.title}知识解决实际问题`],
          practicalProblems: [`当遇到${slice.title}相关场景时，你能运用核心知识进行分析`, `当需要应用${slice.title}概念时，你能做出正确决策`]
        },
        gameType,
        gameTitle,
        gameRules,
        duration: "10分钟",
        designRationale: `通过场景式交互，将 [${slice.title}] 抽象规律转化为紧迫的系统级决策，强化深层应用认知。`,
        infoDensity: {
          conceptCount: 3,
          factCount: 2,
          abstractLevel: "中",
          nestingLevel: "两层",
          suggestedMinutes: "10-15",
          rationale: "该切片信息量适中，可在10-15分钟内完成学习，不会造成认知过载。"
        },
        cohesionDetail: {
          cohesionType: "时序递进",
          mechanism: `该切片内的知识点围绕"${slice.title}"这一教学主题组织，逻辑递进关联，形成完整学习单元。`,
          coreQuestion: `如何掌握${slice.title}的核心知识并应用于实践？`
        }
      };
    });

    return {
      bookTitle: (title || "Custom Textbook").endsWith("》") ? (title || "Custom Textbook") : `《${title || "Custom Textbook"}》`,
      totalSlices: enrichedSlices.length,
      slices: enrichedSlices
    };
  }

  const lines = (fullText || "").split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 3 && l.length < 120);

  // Match section headers inside lines list
  const sectionLines: { sectionNum: string; text: string }[] = [];
  
  // Regex pattern matching decimals: matches 6.1, 6.2, 1.1.2, or words like Section 6.1, Topic 6.1 etc.
  const sectionRegex = /^(?:[Ss]ection|[Tt]opic|[Cc]hapter|第)?\s*(\d+(?:\.\d+)?)(?:章|节|课)?\s*[:：.\-、\s]+\s*(.*)$/;
  const chineseChapterRegex = /^第\s*([一二三四五六七八九十百0-9]+)\s*[章节部分讲]\s*[:：.\-、\s]*(.*)$/;

  for (const line of lines) {
    if (line.length < 4 || line.length > 120) continue;
    
    let match = line.match(sectionRegex);
    if (match) {
      const num = match[1];
      const rest = match[2].trim();
      if (rest.length > 2 && rest.length < 90) {
        if (!sectionLines.some(sl => sl.sectionNum === num || sl.text === rest)) {
          sectionLines.push({ sectionNum: num, text: rest });
        }
      }
    } else {
      match = line.match(chineseChapterRegex);
      if (match) {
        const num = match[1];
        const rest = match[2].trim();
        if (rest.length > 2 && rest.length < 90) {
          if (!sectionLines.some(sl => sl.sectionNum === num || sl.text === rest)) {
            sectionLines.push({ sectionNum: num, text: rest });
          }
        }
      }
    }
  }

  if (sectionLines.length < 3 && lines.length > 5) {
    const chunkSize = Math.max(1, Math.floor(lines.length / 5));
    for (let i = 0; i < 5 && i * chunkSize < lines.length; i++) {
      const snippet = lines[i * chunkSize];
      sectionLines.push({ sectionNum: `1.${i+1}`, text: snippet.length > 40 ? snippet.substring(0, 37) + '...' : snippet });
    }
  }

  // If we couldn't parse enough slices from raw text, fallback to standard mock template structures
  if (sectionLines.length < 3) {
    const rawMock = getMockBlueprint(title);
    return convertOldMockToNewFormat(rawMock);
  }

  // Partition sections dynamically to guarantee comprehensive coverage from 1st to last section with no truncation!
  const baseBlueprint = getMockBlueprint(title);
  const baseModules = baseBlueprint.modules;

  let chunkSize = 1;
  if (sectionLines.length > 18) {
    chunkSize = Math.ceil(sectionLines.length / 16);
  }

  const matchedSlices: { chapterIndex: string; title: string; coveredChapters: string; summary: string }[] = [];
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
    
    // Combine titles: e.g. "Section A 与 Section B"
    const combinedTitle = chunk.map(c => c.text).join(" 与 ");
    const cleanTitle = combinedTitle.length > 50 ? combinedTitle.substring(0, 47) + "..." : combinedTitle;
    
    // Combine summaries into conceptual bullets
    const combinedSummary = chunk.map(c => c.text).join("，") + "核心考点及原理运用论证";
    
    matchedSlices.push({
      chapterIndex: String(seqIdx).padStart(2, '0'),
      title: cleanTitle,
      coveredChapters: cleanCoveredChapters(rawCovered, firstSec.sectionNum),
      summary: combinedSummary
    });
    seqIdx++;
  }

  // If we successfully parsed structures, let's pair them with domain-specific template properties
  const enrichedSlices = matchedSlices.map((slice, i) => {
    const templateMod = baseModules[i % baseModules.length];

    // Select suitable GameType heuristically
    const normLine = slice.title.toLowerCase();
    let gameType = "quiz";
    let gameTitle = `${slice.title}核心概念通关`;
    
    if (normLine.includes("计算") || normLine.includes("公式") || normLine.includes("数") || normLine.includes("物理") || normLine.includes("数学") || normLine.includes("方程") || normLine.includes("量")) {
      gameType = "math-quest";
      gameTitle = `${slice.title}：定量计算与数据推演诊断`;
    } else if (normLine.includes("代码") || normLine.includes("编程") || normLine.includes("逻辑") || normLine.includes("算法") || normLine.includes("函数") || normLine.includes("脚本") || normLine.includes("源") || normLine.includes("程序")) {
      gameType = "coding-puzzle";
      gameTitle = `${slice.title}：逻辑排障与程序除错挑战`;
    } else if (normLine.includes("概念") || normLine.includes("分类") || normLine.includes("匹配") || normLine.includes("对应") || normLine.includes("关联")) {
      gameType = "cross-match";
      gameTitle = `${slice.title}：核心概念知识匹配连线`;
    } else if (normLine.includes("故事") || normLine.includes("决策") || normLine.includes("选择") || normLine.includes("抉择") || normLine.includes("剧情") || normLine.includes("历史")) {
      gameType = "interactive-story";
      gameTitle = `${slice.title}：情境剧情与因果抉择分支`;
    } else {
      gameType = "quiz";
      gameTitle = `${slice.title}：综合推演与深度应用通关`;
    }

    // Dynamic clean rules
    const gameRules = `尊敬的学员，请进入关于 “${slice.title}” 的交互论证训练舱。挑战规则：在模拟的危机环境或核心场景下，通过一系列深度学科判断和情境决策，巩固您在 [${slice.title}] 中所学的核心逻辑。`;

    return {
      chapterIndex: slice.chapterIndex,
      title: slice.title,
      coveredChapters: slice.coveredChapters,
      summary: `${slice.title}相关的核心概念网络与实践考点`,
      gameType,
      gameTitle,
      gameRules,
      duration: "10分钟",
      designRationale: `通过场景式交互，将 [${slice.title}] 抽象规律转化为紧迫的系统级决策，强化深层应用认知。`,
      infoDensity: "经过信息密度裁切，本单元核心学习负荷已被精简控制为 3 个关键级差，确保不产生认知过度疲劳。",
      cohesionDetail: `本切片的关键知识因子在结构上具有极强的物理因果 or 逻辑链条依赖。设计统一挑战能极大凸显这一内聚结构。`
    };
  });

  return {
    bookTitle: (title || "Custom Textbook").endsWith("》") ? (title || "Custom Textbook") : `《${title || "Custom Textbook"}》`,
    totalSlices: enrichedSlices.length,
    slices: enrichedSlices
  };
}




/**
 * 2) Generate Interactive Playable Script API for individual chapters
 */
app.post("/api/generate-script", async (req, res) => {
  try {
    let { 
      bookTitle, 
      chapterTitle, 
      chapterIndex, 
      summary, 
      gameType, 
      gameTitle, 
      gameRules, 
      extractedContent 
    } = req.body;

    if (!chapterTitle) {
      return res.status(400).json({ error: "Missing required chapter metadata (chapterTitle)." });
    }

    const activeGameType = gameType || "quiz";
    const activeGameTitle = gameTitle || `${chapterTitle}核心知识闯关`;
    const activeGameRules = gameRules || "通过问答和交互挑战，在游戏场景中论证并巩固该章节的核心理论与概念考点。";

    const systemInstruction = `You are a creative educational writer and game scripting system.
You will write a step-by-step interactive gaming script (specifically 3 challenges) designed to teach and quiz students about a school book chapter.
Based on the chapter details, formulate:
1. An introduction story/scenario context: Establish a quest, virtual lab, workspace portal, or team mission.
2. Exactly 3 comprehensive, progressive questions/challenges ('challenges') of matching type:
   - For 'quiz' / 'interactive-story': Make type 'choice' or 'question', providing four standard visual 'options', and set 'correctAnswer' to the correct option index or exact choice.
   - For 'cross-match': Set type 'match', where prompt contains the matching item, options contain a few distinct definitions, and correctAnswer is the correct definition string.
   - For 'fill-blank': Set type 'blank', prompt should be a sentence with a missing word, and correctAnswer is the single correct keyword.
   - For 'coding-puzzle': Set type 'puzzle', prompt should contain code snippets with errors, and correctAnswer is the correct snippet format.
   - For 'math-quest': Set type 'question' or 'choice', focusing on academic numeric step solving.
3. A nice wrap-up educational conclusion explaining the principles of the gameplay.

Provide extremely high-quality feedback logs explaining the scientific or historical reasoning why an answer is correct or not.

Output ONLY valid JSON format:
{
  "introduction": "场景介绍",
  "challenges": [
    {
      "type": "choice|question|blank|match|puzzle",
      "title": "关卡标题",
      "prompt": "问题描述",
      "options": ["选项1", "选项2", "选项3", "选项4"],
      "correctAnswer": "正确答案",
      "feedbackCorrect": "正确反馈",
      "feedbackIncorrect": "错误反馈"
    }
  ],
  "conclusion": "结束语"
}
Reply in Chinese only.`;

    const promptText = `Generate a fully functional step-by-step game script for Chapter ${chapterIndex}: "${chapterTitle}" in "${bookTitle || 'Textbook'}".
Chapter Objectives: ${summary}
Proposed Game: ${activeGameTitle} (${activeGameRules})
Target Game Class Mode: ${activeGameType}
Reference Textbook Text Snippet:\n\n${(extractedContent || "General academic curriculum rules relative to " + chapterTitle).substring(0, 8000)}\n\n
Make the challenges direct, logical, scientific and fully complete. Ensure all options are list array strings. Set correctAnswers to match options exactly.`;

    let outputText: string;
    
    if (AI_PROVIDER === "deepseek") {
      console.log("🔄 Using DeepSeek for script generation...");
      outputText = await callDeepSeek(promptText, systemInstruction);
    } else if (AI_PROVIDER === "dashscope") {
      console.log("🔄 Using DashScope (通义千问) for script generation...");
      outputText = await callDashScope(promptText, systemInstruction);
    } else if (AI_PROVIDER === "ollama") {
      console.log("🔄 Using Ollama for script generation...");
      outputText = await callOllama(promptText, systemInstruction);
    } else if (AI_PROVIDER === "huggingface") {
      console.log("🔄 Using Hugging Face for script generation...");
      outputText = await callHuggingFace(promptText, systemInstruction);
    } else {
      const key = process.env.GEMINI_API_KEY;
      if (!key || key.trim() === "" || key.trim() === "your-actual-gemini-api-key-here") {
        return res.status(401).json({ 
          error: "GEMINI_API_KEY 未配置",
          message: "请在 .env 文件中设置有效的 Google Gemini API Key，或者设置 AI_PROVIDER=dashscope 使用阿里云通义千问。",
          detail: "当前无法调用 AI 模型生成游戏脚本，请先配置 API Key 或切换到 DashScope。"
        });
      }
      
      const ai = getGenAI();
      console.log("🔄 Using Gemini for script generation...");
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              introduction: { type: Type.STRING },
              challenges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "Must be 'choice', 'question', 'blank', 'match', or 'puzzle'" },
                    title: { type: Type.STRING, description: "Creative step level name" },
                    prompt: { type: Type.STRING, description: "Question prompt, riddle, code puzzle block, or math challenge" },
                    options: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING },
                      description: "Array of potential answers"
                    },
                    correctAnswer: { type: Type.STRING, description: "The exact matching answer" },
                    feedbackCorrect: { type: Type.STRING, description: "Deep educational recap" },
                    feedbackIncorrect: { type: Type.STRING, description: "Insightful hint" }
                  },
                  required: ["type", "title", "prompt", "correctAnswer", "feedbackCorrect", "feedbackIncorrect"]
                }
              },
              conclusion: { type: Type.STRING }
            },
            required: ["introduction", "challenges", "conclusion"]
          }
        }
      });
      
      outputText = response.text;
      if (!outputText) {
        throw new Error("No output generated from Gemini model.");
      }
    }

    try {
      const parsedScript = parseJsonResponse(outputText);
      res.json(parsedScript);
    } catch (parseErr) {
      console.error("JSON parsing of script failed, raw chunk was:", outputText);
      res.status(500).json({ error: "Failed to parse script as JSON.", raw: outputText });
    }

  } catch (error: any) {
    console.error("Error generating interactive script:", error);
    res.status(500).json({ error: error.message || "External endpoint processing error" });
  }
});

/**
 * 2b) Recommend high-cognition scenario play title and rules based on concepts
 */
app.post("/api/recommend-scenario", async (req, res) => {
  try {
    const { chapterTitle, summary, gameType, designRationale } = req.body;
    if (!chapterTitle || !gameType) {
      return res.status(400).json({ error: "Missing required chapter meta (chapterTitle, gameType)." });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      // Local highly intelligent recommended scenarios
      let gameTitle = "微缩宇宙：未知平衡态调控";
      let gameRules = "当前物理系统处于紧急泄露临界状态。你将扮演特遣危机处置专员，必须依靠对本单元知识点的系统内化，实时诊断各类偏差变量，平衡不稳定性，做出明智的关键性决策以拯救设施。";

      if (gameType === "interactive-story") {
        gameTitle = `《${chapterTitle}：危机决策风暴》`;
        gameRules = `你被紧急投送到一处面临解体危机的科学基站！当前的核心挑战是：如何利用 [${summary}] 的相互作用链条制止灾难。你必须在数个涉及生死权衡和逻辑链冲突的选项中做出核心选择，每一步都会诱发物理系统的连锁崩溃或救赎。`;
      } else if (gameType === "quiz") {
        gameTitle = `《${chapterTitle}：多维诊断大密室》`;
        gameRules = `你被锁在了一台暴走的人造反应舱中！系统主控脑抛出了一系列关于 [${summary}] 的深度反直觉现象诊断。你必须担任逻辑排障专家，在限时内诊断并论证正确的成因以解锁气闸安全协议。`;
      } else if (gameType === "coding-puzzle") {
        gameTitle = `《${chapterTitle}：逻辑重构与数据阻断行动》`;
        gameRules = `受阻于 [${summary}] 物理数据流的异常溢出，控制中枢代码大面积瘫痪。作为逻辑架构师，你需要诊断溢出漏洞，重置物理守恒定律的数据结构，修补失衡的代码控制律，在溢出红线前重建数据网。`;
      } else if (gameType === "math-quest") {
        gameTitle = `《${chapterTitle}：精密计算突围协议》`;
        gameRules = `灾难已经进入物理突击期！要强行抑制参数暴涨，你必须化身安全计算总指挥，在极小的时间窗口里对 [${summary}] 进行参数极值平衡、反应公式对齐、以及流量计算，精准将指针回调到安全区间。`;
      }

      return res.json({ gameTitle, gameRules });
    }

    const ai = getGenAI();

    const systemInstruction = `You are a creative educational writer and interactive gamification designer (中文环境).
Your sole task is to recommend a highly polished, high-tension educational game title and a concise, high-cognition gameplay conflict description based on the provided core concepts and preferred game mechanics.

Instructions for generation:
1. "gameTitle" must be a punchy, dramatic sci-fi, fantasy, historic, or high-concept narrative title (e.g., "金斯限界引力失衡漏气警报", "泰坦霸权终结与秩序过渡", "数据魔咒重构阻断协议"). It should capture attention instantly.
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
- Pedagogical Objective: "${designRationale || 'None'}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gameTitle: { type: Type.STRING, description: "A beautifully crafted, high-traction game title." },
            gameRules: { type: Type.STRING, description: "Detailed 1-paragraph game objective/rules in Chinese explaining the crisis, role, and key choices." }
          },
          required: ["gameTitle", "gameRules"]
        }
      }
    });

    const parsed = parseJsonResponse(response.text);
    res.json(parsed);

  } catch (error: any) {
    console.error("Error recommending scenario:", error);
    res.status(500).json({ error: error.message || "External recommender error" });
  }
});

/**
 * 3) Contextual Conversation / QA API with the Educational Agent
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, currentBookTitle } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      const lastMsg = messages[messages.length - 1]?.text?.toLowerCase() || "";
      let reply = "你好！我是你的 AI 学习游戏策划专家。有什么关于当前课本、章节拆分或互动游戏玩法设计的，尽管问我！";
      if (lastMsg.includes("建议") || lastMsg.includes("推荐") || lastMsg.includes("玩法")) {
        reply = "我可以为你配置多种游戏：知识大比拼 (Quiz)、连线搭配 (Match)、文本填空 (Blank Fill)、探险抉择文本冒险 (Story Quest)、代码纠错魔咒 (Coding Puzzle) 或者是 算术速算闯关 (Math Quest)！";
      } else if (lastMsg.includes("章节") || lastMsg.includes("目录")) {
        reply = "课件最好划分为 3-6 个独立模块。你可以在 Step 2 页面对每个章节标题和具体的游戏规则进行完全定制的汉化与修改！";
      }
      return res.json({ reply });
    }

    const ai = getGenAI();
    
    // Convert to Gemini parts structure
    const contentsPayload = messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
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
  } catch (error: any) {
    console.error("Error in conversational API:", error);
    res.status(500).json({ error: error.message || "Failed to engage Gemini chat." });
  }
});

function getMockBlueprint(title: string) {
  const normTitle = (title || "").toLowerCase();
  
  if (normTitle.includes("宇宙") || normTitle.includes("astro") || normTitle.includes("stellar") || normTitle.includes("恒星")) {
    return {
      title: "《宇宙起源与恒星物理》",
      modules: [
        {
          chapterIndex: "01",
          title: "超引力恒星胚胎控制",
          coveredChapters: "Topic 1.1",
          summary: "金斯不稳定性, 引力势能, 气体塌缩临界点",
          gameType: "math-quest",
          gameTitle: "星云失衡状态对准：避免黑洞过早坍缩",
          gameRules: "星云引力失衡漏气警报响起！玩家必须通过权衡气体温度、引力自转动能，诊断塌缩阻力参数，并在金斯极限临界点前执行向心气旋对冲策略，迫使学员平衡多个热力学变量维持星核处于胚胎期平衡状态。",
          duration: "10分钟",
          designRationale: "避免让自学者去死记硬背金斯臨界条件，而是在高度紧张的星云泄露灾难中扮演空间科学家，通过调节质量及向心压力理解引力热平衡对星体成型的影响。"
        },
        {
          chapterIndex: "02",
          title: "低温原星盘湍流对准",
          coveredChapters: "Topic 1.2",
          summary: "吸积盘结构, 湍流粘滞, 磁流体力学平衡",
          gameType: "cross-match",
          gameTitle: "恒星最初星骨拼装：克服原星盘紊乱风暴",
          gameRules: "原星盘物质流动速率处于失衡崩溃边缘。玩家扮演轨道重力修正官，需要诊断磁场阻尼、重力不稳定性分布，并调配冷凝尘粒的摩擦阻力和向心降速度，确保流体粘滞系数平滑度，避免盘体自发碎裂。",
          duration: "10分钟",
          designRationale: "通过控制粘滞变量诊断原星盘演化，使学生深度认知气体摩擦生热并释放引力机械能的过程，而非孤立学习摩擦常数。"
        },
        {
          chapterIndex: "03",
          title: "星风抛洒与角动量溢流",
          coveredChapters: "Topic 1.3",
          summary: "双极外流, 角动量流失, 强磁重联",
          gameType: "interactive-story",
          gameTitle: "角动量大泄洪：挽救自转解体的一线选择",
          gameRules: "胚胎恒星转速由于物质极化吸收攀升至瓦解红线！你需要立刻做出决断：是通过开辟强双极气流外泄动能，还是依赖磁塞重联引发大耀斑放电。每一次决策都在引力收敛与物质彻底飞散的生死平衡点上徘徊。",
          duration: "10分钟",
          designRationale: "将恒星角动量守恒物理屏障包装成决策，迫使学生推演‘自转阻力必须流失、恒星方可凝聚’的物理因果。"
        },
        {
          chapterIndex: "04",
          title: "质子-质子链瞬间点准",
          coveredChapters: "Topic 2.1",
          summary: "pp链一阶反应, 正电子湮灭, 强相互作用势垒",
          gameType: "quiz",
          gameTitle: "核区点火协议：克服强库仑排斥力的核聚变反应",
          gameRules: "原恒星中心温度已攀升至1000万开尔文，但弱相互作用导致质子融合成双质子（氦-2）在极限衰变。你必须精确调度量子隧道效应发生概率。论证在极小势垒下，如何调度微观粒子的平均动能克服点火熔断。",
          duration: "10分钟",
          designRationale: "不再死记硬背核聚变温度，而是将势垒克服及核力主导包装成微观高负荷突围博弈。"
        },
        {
          chapterIndex: "05",
          title: "碳氮氧循环高温点火",
          coveredChapters: "Topic 2.2",
          summary: "CNO循环催化, 高温温标指数, 核心密度跃升",
          gameType: "math-quest",
          gameTitle: "超质量红巨星内核反应：紧急平抑CNO核能输出暴涨",
          gameRules: "高质量核心温度飙升至2000万度，CNO温标准数呈17次方指极级暴涨！玩家必须化身重力热核总控官，紧急计算并注入微量氦-4流体以降低核心静压，控制因碳催化剂引发的自毁链条。",
          duration: "12分钟",
          designRationale: "极高阶的非线性指数公式在事故压力下展示，迫使学生深度掌握大质量恒星内部温控极度脆弱的核心机制。"
        },
        {
          chapterIndex: "06",
          title: "辐射层光子万载迷宫穿越",
          coveredChapters: "Topic 3.1",
          summary: "辐射阻尼, 光子平均自由程, 康普顿不透明度",
          gameType: "coding-puzzle",
          gameTitle: "逃逸光子散射轨迹：修正不透明传导代码",
          gameRules: "核反应产生的光子在穿越20万公里致密辐射层时被物质无尽散射，代码寻路系统处于溢出故障。你必须重构光子游走步数计算代码与散射概率分配表，诊断辐射不透明度的动态阻力并疏通光能向外传递物理大动脉。",
          duration: "10分钟",
          designRationale: "使学生认知虽然光速极快，但由于极高不透明度形成的‘漫步’，是保持恒星外壳不会瞬间坍塌的幕后稳定保障。"
        },
        {
          chapterIndex: "07",
          title: "对流泡湍流沸腾阻尼",
          coveredChapters: "Topic 3.2",
          summary: "阿基米德浮力, 绝热温度梯度, 混合长理论",
          gameType: "cross-match",
          gameTitle: "恒星最外层巨浪对流：流体力学不稳定性对抗",
          gameRules: "随着恒星外层温度骤降、不透明度暴增，辐射层已无法宣泄能量。庞大的高热对流泡正以几马赫速度翻滚怒吼。玩家作为浮力参数控制员，必须精确配对绝热膨胀率与实际温度梯度的偏差等级，平息失控的能量喷涌。",
          duration: "10分钟",
          designRationale: "匹配不稳定性流体变量，揭示物理对流启动的临界条件（史瓦西判据）。"
        },
        {
          chapterIndex: "08",
          title: "太阳黑子强磁扭结诊断",
          coveredChapters: "Topic 3.3",
          summary: "发电机效应, 磁重联爆发, 电浆阻尼",
          gameType: "quiz",
          gameTitle: "耀斑大爆发警告：黑子极性磁绳折断干预",
          gameRules: "差动自转导致赤道发电机产生的磁力线发生百万次极限扭绕。你必须紧急对准两个带有高能反差极性的磁流，诊断其磁张力积聚量并下达泄放电磁阀指令。如果论证诊断失败，耀斑爆发将瞬间烧穿近轨探测卫星。",
          duration: "10分钟",
          designRationale: "将黑子机制、发电机原理及磁重联突变在事故背景中呈现，使黑子不单是不发光的洞，而是高磁能高应力点。"
        },
        {
          chapterIndex: "09",
          title: "核心氢燃尽红巨星大崩裂",
          coveredChapters: "Topic 4.1",
          summary: "壳层氢聚变, 核心收缩升温, 外部热膨胀不平衡",
          gameType: "interactive-story",
          gameTitle: "恒星壳层点火临界点：巨星膨胀灾难下的卫星重轨",
          gameRules: "恒星核心氢耗尽开始塌缩，而外层却由于强烈的壳层引燃发生了指数式狂退膨胀。你作为轨道基站领航长，正遭遇母星外大气气阻急速吞噬。你必须在立刻拉升轨道牺牲燃料，还是深入外气层借力大气刹车中做出极高风险的权衡投票选择。",
          duration: "10分钟",
          designRationale: "理解恒星核心收缩伴随外壳膨胀的‘镜像演化律’，将热质动力学化为空间自救的物理决策背景。"
        },
        {
          chapterIndex: "10",
          title: "氦闪0.1秒生死危机自救",
          coveredChapters: "Topic 4.2",
          summary: "电子简并压力, 热失控机制, 三阿尔法反应阻尼",
          gameType: "math-quest",
          gameTitle: "简并核心碳爆发控制：制止氦热失控崩塌",
          gameRules: "简并核心内部由于温度升高却无法膨胀散热，三阿尔法核聚变速率以40次方极限级暴涨！警报拉响！玩家必须在一张复杂的核反应截面上，计算出量子简并态向正常抗压气态转变的瞬间热值常数差并施加引力挤压干扰干预。",
          duration: "11分钟",
          designRationale: "利用爆破的死机风险传达电子简并压力与温度解耦、从而缺乏安全负反馈调节这一白矮星至要物理机制。"
        },
        {
          chapterIndex: "11",
          title: "s-过程重元素捕获",
          coveredChapters: "Topic 4.3",
          summary: "缓慢中子捕获, 贝塔衰变期限, 铁核以上元素合成",
          gameType: "coding-puzzle",
          gameTitle: "炼金术核心：捕获星际缓慢流动中子",
          gameRules: "红巨星边缘脉冲震荡，自由中子流以极慢速撞击重核。由于贝塔衰变半衰期处于动态波段，你必须诊断其捕获窗口。重排中子吸收及能级衰变排序，修复元素周期表铁核以上合金演替顺序，避免生成短命非稳同位素。",
          duration: "10分钟",
          designRationale: "通过拼补衰变链，让自学者深度消化半衰期与中子流密度的匹配规律（s-过程与r-过程本质对立）。"
        },
        {
          chapterIndex: "12",
          title: "白矮星吸积盘潮汐溢流",
          coveredChapters: "Topic 5.1",
          summary: "罗氏极限溢流, 吸积盘动量守恒, 边界溢流切断",
          gameType: "cross-match",
          gameTitle: "伴星倾注大劫掠：保护极简核心质量边界",
          gameRules: "伴星物质已经越过重力平衡点（拉格朗日L1点），向白矮星表面疯狂溅落，外壳核能正失控升温！玩家需要对齐并匹配溢流速率、角动量散失及壳层核热暴走阈值，精准决策何时切断重力纠缠带。",
          duration: "10分钟",
          designRationale: "将双星系统的引力拉扯和质量溢流设计为多参数平衡对齐挑战，让罗氏极限的解析富有极强的主动应用情境。"
        },
        {
          chapterIndex: "13",
          title: "Ia超新星零点热核起爆",
          coveredChapters: "Topic 5.2",
          summary: "碳闪失控爆炸, 钱德拉塞卡极限突破, 狭义相对论压强",
          gameType: "quiz",
          gameTitle: "1.44倍质量大防线：拦截碳燃熔断链条",
          gameRules: "白矮星积聚质量在1.4398倍太阳质量极限跳动！系统引力已经压垮了相对论性电子简并压，极速塌缩正在触发吞噬一切的碳核点火。为了阻止Ia型自爆冲击波撕碎周边的行星港，你必须迅速诊断能量堆的温度并决策是否泄压泄质。",
          duration: "10分钟",
          designRationale: "通过生死防线突出1.44M☉作为电子边界神圣不可侵犯的物理性质，强化学生在零界点做出极限推理的技能。"
        },
        {
          chapterIndex: "14",
          title: "中子星中子简并压抗衡",
          coveredChapters: "Topic 5.3",
          summary: "超流质中子态, 奥本海默极限, 极端量子简并",
          gameType: "interactive-story",
          gameTitle: "引力暴风眼底：维持中子星最后气阻防线",
          gameRules: "强引力已将质子与电子压碎融合成中子流，外部质量正继续堆积！中子简并压防线开始局部松动。你作为超大引力屏障总建造师，面临不容有失的决策投票：是主动发射粒子流抛洒多余包层质量，还是用强惯性角动量偏转极强磁气。每一步抉择都会引发不归路演化。",
          duration: "10分钟",
          designRationale: "使学生理解中子星生存法则。它的极限就是奥本海默限制，若在惊心动魄的选择里失败，就不可阻拦地滑落进恒星演化的终局深渊。"
        },
        {
          chapterIndex: "15",
          title: "史瓦西黑洞时空重力抗衡",
          coveredChapters: "Topic 6.1",
          summary: "史瓦西半径, 事件视界外侧红移, 潮汐引力剪切",
          gameType: "math-quest",
          gameTitle: "视界危机突围：光速边缘的时空归因诊断",
          gameRules: "飞船尾端外壳已因黑洞极不均匀的潮汐剪切力发生剧烈热变形。信号由于引力红移几近断绝。你必须诊断前后两端引力差常数，逆推当下的史瓦西半径临界并设定逃逸发动机的变轨切角。你需要在撕裂或流失中建立时空突围轨迹航线数。",
          duration: "10分钟",
          designRationale: "通过黑洞极限逃生案例，使难以理解的引力红移及潮汐切应力公式化为逃生偏角计算的紧迫因果推演，达成大师层级的直觉物理内化。"
        }
      ]
    };
  }

  if (normTitle.includes("神话") || normTitle.includes("greek") || normTitle.includes("myth") || normTitle.includes("历史") || normTitle.includes("文学")) {
    return {
      title: "《古希腊罗马神话探求》",
      modules: [
        {
          chapterIndex: "01",
          title: "混沌深渊法则重建",
          coveredChapters: "Topic 1.1",
          summary: "宇宙起源神谱, 泰坦神权对抗, 秩序构建原理",
          gameType: "interactive-story",
          gameTitle: "泰坦霸权终结与神代过渡大战略",
          gameRules: "克洛诺斯正残酷吞噬他的子嗣，盖亚的泪水与宙斯的叛乱物在暗处涌动。你作为奥林匹斯首席命运神官，需要调和先知普罗米修斯的力量，在暗黑泰坦的绝对雷霆攻势下权衡战术，发布命运盟约。每个法令都在凡人安全与神不朽权威间进行艰难策略权衡投票。",
          duration: "10分钟",
          designRationale: "从神学秩序建立演化，帮助学生理解神权过渡不只是单纯杀戮，而是社会契约、理性法则对野蛮天然力量的取代过程。"
        },
        {
          chapterIndex: "02",
          title: "泰坦之战的象征和更迭",
          coveredChapters: "Topic 1.2",
          summary: "自然崇拜与人神同形, 世代夺权宿命, 理性意志升华",
          gameType: "cross-match",
          gameTitle: "天命巨变沙盘：击穿克洛诺斯的宿命闭环",
          gameRules: "克洛诺斯不信任任何新生的力量，其腹中诸神渴望觉醒解脱。你需要扮演天界谋臣，分析旧泰坦巨灵神能缺陷，匹配宙斯联军中的多股势力（百手巨人、独眼巨人等）并设定精准的偷袭、防守时机，通过高难度时序调校突围。",
          duration: "10分钟",
          designRationale: "通过谋略分配，引导学生领会‘泰坦代表狂暴自然，奥林匹斯象征律法规范’这一核心宗教学演替实质。"
        },
        {
          chapterIndex: "03",
          title: "波塞冬海陆神权划定",
          coveredChapters: "Topic 2.1",
          summary: "海洋自然属性, 地震崩裂图腾, 神权力图谱",
          gameType: "quiz",
          gameTitle: "三叉戟狂澜干预：平息爱琴海怒吼海港",
          gameRules: "暴风雨海啸正要把希腊庞大的返乡船队拍碎在致命暗礁上！你作为他的神庙大祭司，面临水手极度恐慌的哗变暴乱。你必须分析波塞冬海洋、地震多相图腾神力的触发归因，向国王和水手提供在神明狂怒背后的深层理性平息论证指南，做出安抚与祭祀博弈选择。",
          duration: "10分钟",
          designRationale: "不只是简单填鸭式记熟谁是海神，而是通过对自然灾变和神性关联的剖析，掌握古人对海洋无限敬畏下的信仰机制。"
        },
        {
          chapterIndex: "04",
          title: "雅典娜卫城城防决策",
          coveredChapters: "Topic 2.2",
          summary: "城邦守护契约, 智慧策略对抗, 橄榄树的社会隐喻",
          gameType: "math-quest",
          gameTitle: "雅典守护命名大战：橄榄生命力对抗狂暴潮汐",
          gameRules: "雅典面临波塞冬的三叉戟海泉侵蚀，生存危机迫在眉睫。而雅典娜的橄榄枝则象征着农耕与和平的基石。单人学生扮演首席内阁官，需要通过复杂的社会资源平衡计算模型，评估两尊神明各自赐福在百年跨度里对雅典城邦粮食产量、航海优势的最终剪切效能，完成决定城邦国运的圣选决策。",
          duration: "11分钟",
          designRationale: "将神话竞争转化为极其现实的城邦国家规划，使橄榄与马的设计彻底变为社会生产力视角的博弈反推。"
        },
        {
          chapterIndex: "05",
          title: "冥府幽冥魂境裁判",
          coveredChapters: "Topic 2.3",
          summary: "冥河审判逻辑, 善恶魂灵分流, 命运秩序神印",
          gameType: "coding-puzzle",
          gameTitle: "阿格隆河渡口：修正亡魂分流审判判定",
          gameRules: "冥河暴涨，数以千万计的死者灵魂在审判法庭前发生踩踏、无望呼号！法官米诺斯判断秩序算法链遭遇诅咒篡改。玩家必须作为法门监护使者，根据古希腊‘未入土者、大恶之人、英雄亡魂’多级律法，紧急排查并重新编排逻辑层代码，防止无序亡灵倾覆死神大殿。",
          duration: "10分钟",
          designRationale: "将死后世界的阶层分流与判定逻辑结合，反映古希腊对生前德行、葬礼尊重和世道公正的法律心理底色。"
        },
        {
          chapterIndex: "06",
          title: "普罗米修斯火种授人契约",
          coveredChapters: "Topic 2.4",
          summary: "偷盗天火本质, 宙斯反向惩戒, 预知能力博弈",
          gameType: "interactive-story",
          gameTitle: "高加索巨岩峭壁：面临飞鹰啄肝的终极对峙",
          gameRules: "太阳战车天火被下凡盗取，宙斯狂怒，要把普罗米修斯死锁悬崖。你需要在选择向神权低头撤回知识，还是彻底承担万年折磨让火种在文明地毯式播种中做出终极拷问抉择，并向潘多拉盒子的释放提出深层逻辑权衡。",
          duration: "10分钟",
          designRationale: "引导学员在大义与个人极端痛苦的煎熬中自决辩护，深刻理解神话中‘天火盗取象征着独立理性和不屈服神威的觉醒历程’。"
        },
        {
          chapterIndex: "07",
          title: "德尔斐宿命大殿的反讽",
          coveredChapters: "Topic 3.1",
          summary: "德尔斐神谕, 宿命悲剧反讽, 性格局限归因",
          gameType: "quiz",
          gameTitle: "认识你自己：破解神谕对反抗英雄的双重绞杀",
          gameRules: "大地上最骄傲的王子试图绕过‘必弑其父’的梦魇预言。你作为阿波罗之眼大祭司，需要连环论证面对宿命预言时，英雄每一步充满理性骄傲（Hubris）的逃避决定是如何恰恰在逻辑链条中亲手织就了宿命网兜（如俄狄浦斯王）。",
          duration: "10分钟",
          designRationale: "彻底根除神话是简单巧合的浅薄观念，引导学生理解古希腊学者对人意志抗衡天命、却又受性格局限限制的宏亮悲剧宿命闭环诠释。"
        },
        {
          chapterIndex: "08",
          title: "Perseus美杜莎魔镜猎杀",
          coveredChapters: "Topic 3.2",
          summary: "视线石化机制, 雅典娜盾牌反光, 英雄策略武装",
          gameType: "cross-match",
          gameTitle: "戈尔贡魔女巢穴：镜面物理光学反射极限挑战",
          gameRules: "美杜莎怒睁双目，凡与其对视者瞬间碳化。作为带路祭司的你，正协助珀尔修斯。你必须在沙盘上将雅典娜之盾的完美偏角反射机制，与赫尔墨斯飞鞋的速度阻尼进行精确对齐，算准折射路线制导英雄在完全不平视盲区斩下首级。",
          duration: "10分钟",
          designRationale: "用几何对齐挑战使自学者认识到英雄奇迹并非仅靠神仙开挂，更是在绝对致命局限下用精细工具和计算达到的神谋奇绝。"
        },
        {
          chapterIndex: "09",
          title: "奥革阿斯牛圈泄洪流控",
          coveredChapters: "Topic 4.1",
          summary: "赫拉克勒斯十二伟业, 河流动力物理学, 屈辱试炼转化",
          gameType: "math-quest",
          gameTitle: "大河改道绝技：在日落前疏通万头牛圈淤结",
          gameRules: "三十年未清的几万头牛的牛粪淤泥堆积如山，傲慢国王限你一天全扫。你现在必须计算阿尔斐俄斯河的截流截面，求得最大瞬时水动量冲击能量，精准平衡大河冲击力不至于轰碎城防地表或清扫失败的双重物理极限。",
          duration: "12分钟",
          designRationale: "将伟业包孕在精确水利工程下，使赫拉克勒斯用智谋战胜无谓死力的大师风范一跃而上。"
        },
        {
          chapterIndex: "10",
          title: "冥河渡轮阿隆契约平衡",
          coveredChapters: "Topic 4.2",
          summary: "不朽之躯与凡俗极性, 冥河契约誓言, 物理伤害传递",
          gameType: "interactive-story",
          gameTitle: "斯提克斯真火洗礼：阿喀琉斯的绝死死角暴露",
          gameRules: "海中仙女忒提斯正用冥河之水浸泡婴儿，祈求全身金刚不坏。然而由于提握其脚踝，其脚踵成为唯一能被撕开的生门。你作为命运守护官，需要投票决定在这场神圣抗性与脆弱物理死脉并存的历史变局下，如何部署兵力确保阿喀琉斯一生的战略制胜概率。",
          duration: "10分钟",
          designRationale: "理解神不坏与凡俗死结同在的宿命隐喻，使学生体味出古典英雄不灭与不可挽回的毁灭死生缠结哲学。"
        },
        {
          chapterIndex: "11",
          title: "金苹果阿特拉斯重负欺骗",
          coveredChapters: "Topic 4.3",
          summary: "双向博弈对抗, 重力常数置换, 巧智代替暴力",
          gameType: "coding-puzzle",
          gameTitle: "苍穹重力交换算法：从巨人肩膀上取回金苹果",
          gameRules: "阿特拉斯诱骗你替他举起倾覆的蓝天苍穹，并狞笑要扬长远去，重压正要把你的全身骨骼粉碎成渣！你必须以高精度逻辑拼接‘寻找替代重力点、巨人回归条件校验、临时垫肩博弈欺瞒’的代码链，在神级绝对力量抗衡红线爆震之前让两两物理重荷互换复位。",
          duration: "10分钟",
          designRationale: "突显智性博弈对单纯暴力上限的碾压，把这一寓言彻底内化到软件攻防博弈及心理角力的算法建构里。"
        },
        {
          chapterIndex: "12",
          title: "特洛伊流言崩解輿論战",
          coveredChapters: "Topic 5.1",
          summary: "拉奥孔警灯, 特洛伊木马谶纬, 舆论情报反攻",
          gameType: "quiz",
          gameTitle: "拉奥孔之怒：击溃祭司对木马的真伪质疑",
          gameRules: "老祭司拉奥孔正对市民高呼‘警惕希腊人哪怕带着礼物！’，并掷出投矛击穿木马发出空洞回响，特洛伊高层面临彻底拒绝计划的极限死局，你的内应身份危悬一线。你必须诊断木马祭祀神明天罚的宗教恐惧心理，论证释放反向舆论流言击碎祭司怀疑大网。",
          duration: "10分钟",
          designRationale: "将军事奇谋包装为高度复杂的心理信息对抗与危机控制，让古神罚在人智谋划下彰显其惊人的历史归因逻辑。"
        },
        {
          chapterIndex: "13",
          title: "阿喀琉斯神怒狂澜",
          coveredChapters: "Topic 5.2",
          summary: "战神特质狂热, 帕特罗克洛斯复仇, 战局倾斜拐点",
          gameType: "interactive-story",
          gameTitle: "挚友之死红线突越：愤怒之神的杀戮与理智平衡",
          gameRules: "帕特罗克洛斯被赫克托耳枭首，狂风中悲曲回旋，阿喀琉斯的绝死战狂（Furor）突破心理警戒。你需要投票和决策是否下发全新赫法伊斯托斯神铁战衣，在平乱、复仇追逃与对特洛伊神圣河神极度冒犯导致的狂澜巨口之间制导宿命退敌轨道。",
          duration: "10分钟",
          designRationale: "深层体悟悲剧英雄为了复仇不惜将全世界化为废土的极端精神状态，深刻透射英雄荣誉机制背后的极端毁灭破坏哲学。"
        },
        {
          chapterIndex: "14",
          title: "木马空成计秒数潜入",
          coveredChapters: "Topic 5.3",
          summary: "空间潜入时间流, 内部连锁开启, 战局信息完全性",
          gameType: "coding-puzzle",
          gameTitle: "特洛伊城防内膛：编排寂静开合突击路径",
          gameRules: "特洛伊城已喝醉沉睡，木马中希腊伏兵要在神明祭月落到天幕三分之二点瞬时开启出口。由于木马舱口传动机械卡顿。你需要重排突击队员静音索降、清除暗哨、大开城门三个核心算子的运行排序，通过完美的时间流控制代码校准降温突入防线。",
          duration: "10分钟",
          designRationale: "在危机四伏的时间精度极限里，迫使学员体味空间潜入在无声静音约束下的极度高压工程编排。"
        },
        {
          chapterIndex: "15",
          title: "塞壬主桅杆博弈契约",
          coveredChapters: "Topic 6.1",
          summary: "奥德赛契约, 行为经济自律机制, 信息接收自决",
          gameType: "interactive-story",
          gameTitle: "地狱之音女妖尖啸：捆绑桅杆下的无言指令总决选",
          gameRules: "女妖致命塞壬之歌直达心髓，要把你引向吞噬死亡的礁石，奥德修斯被捆绑的桅杆已在剧烈摇晃并勒出血迹，理智崩毁。如若松开，飞船将在滔天海浪中撞礁而逝。你必须在痛苦剧毒折磨中，通过指头打出无声闪屏指令在不能开口的绝裂意志撕扯中，指挥耳塞封存的水手保持风暴切偏角航道逃出生天。",
          duration: "10分钟",
          designRationale: "作为行为经济学和博弈论圣典中的‘预先承诺契约’（Commitment Device）之源，让学者依靠交互在内心确立‘预先限制任性、方能挣脱人道死角’的思维跃迁。"
        }
      ]
    };
  }

  if (normTitle.includes("python") || normTitle.includes("code") || normTitle.includes("编程") || normTitle.includes("wizard")) {
    return {
      title: "《Python魔法卡牌学院》",
      modules: [
        {
          chapterIndex: "01",
          title: "内存宝箱魔力封装",
          coveredChapters: "Topic 1.1",
          summary: "变量内存寻址, 数据类型转换, 逻辑布尔能",
          gameType: "coding-puzzle",
          gameTitle: "魔法溢流危机：熔炼不稳定数据符文",
          gameRules: "圣殿魔力水晶因内存泄漏发生狂暴震荡！作为实习结印师，你需要快速在一行行报错指针中，找出混合类型由于隐式强转（把str与int直接相加）导致的法术崩塌，拼补并封装类型检测保护层。",
          duration: "10分钟",
          designRationale: "让初学者不再觉得数据类型是干瘪的语法条目，而是在模拟‘致命内存膨胀’的实战诊断中理解其物理存储开销与限制。"
        },
        {
          chapterIndex: "02",
          title: "变量纠缠与地址浅复制",
          coveredChapters: "Topic 1.2",
          summary: "可变对象与不可变对象, 内存引用基址, id()指针校验",
          gameType: "cross-match",
          gameTitle: "血脉孪生血刃：解除克隆护腕的变量纠缠危机",
          gameRules: "你炼制的‘力量卡牌A’（List列表对象）在被直接复制给‘魔法卡牌B’（B = A）后，对B追加增益居然导致A的内存属性也离奇膨胀并过载报销！你必须诊断出引用拷贝共享冲突，在多条深度克隆（copy.deepcopy）、原样引用连线匹配中切断同源血脉共享。",
          duration: "10分钟",
          designRationale: "在变量纠缠污染的重压下，让学者深度体会并理解可变对象（Mutable）赋值背后的物理指针概念，彻底克服内存幽灵。"
        },
        {
          chapterIndex: "03",
          title: "强类型与加号雷鸣阻击",
          coveredChapters: "Topic 1.3",
          summary: "强类型拦截机制, TypeCheck静态规则, 隐式异常处理",
          gameType: "quiz",
          gameTitle: "拼接熔炉爆沸：拦截Python解释器Type报错狂潮",
          gameRules: "高炉内正冶炼‘合金魔液’。学徒因拼错公式：'Flux' + 99，促使系统发出雷鸣红色TypeError。高炉温度陡高。你必须作为总控制师紧急论证此报错归因，推演JavaScript隐式转换在这段代码中的差异，并执行显式数据拦截强转协议。",
          duration: "10分钟",
          designRationale: "对比强弱类型，让初学者在大脑内建立起坚挺的类型防线，不因隐式错误废止了工程应用。"
        },
        {
          chapterIndex: "04",
          title: "If-Else 圣光抉择折返",
          coveredChapters: "Topic 2.1",
          summary: "逻辑门判断, 嵌套条件边界, 特权安全拦截",
          gameType: "quiz",
          gameTitle: "圣门抉择铁卫：守护核心魔力边界",
          gameRules: "多名被暗黑魔法寄生的诡异人偶试图强闯安全检测圣门。玩家扮演边防审计圣骑士。你需要连续分析三重嵌套If条件分支在极冷、极热极限状态下的计算流，诊断复杂布尔逻辑与布尔短路求值逻辑，做出百分之百精准的放行或格杀决策。",
          duration: "10分钟",
          designRationale: "用紧张的关防抉择，迫使学员彻底攻克嵌套边界、条件优先级及短路计算等容易混淆的高认知痛点。"
        },
        {
          chapterIndex: "05",
          title: "哨兵变量极端触发屏蔽",
          coveredChapters: "Topic 2.2",
          summary: "边界值判定, Sentinel哨兵协议, True/False变量跃迁",
          gameType: "interactive-story",
          gameTitle: "魔法护盾崩开点：寻找决定生死的那个逻辑哨兵",
          gameRules: "寒霜护盾在外围由于热能攻击呈现复杂的压力摆幅。哨兵布尔变量`is_breached`由于多重防线判断延迟发生失效。你需要连续做出战术指令，决定在何种安全余量重置此核心逻辑哨兵，确保护盾不会因极小值溢出而悄然崩裂。",
          duration: "10分钟",
          designRationale: "通过战术决策透视状态机（StateMachine）在逻辑开发中的至高可靠性，培养学生哨兵防御理念。"
        },
        {
          chapterIndex: "06",
          title: "For/While 千重无限炼界",
          coveredChapters: "Topic 3.1",
          summary: "循环步长约束, 死循环边界中断, Break跳转",
          gameType: "math-quest",
          gameTitle: "无限深渊逃逸：计算并斩断死锁法阵",
          gameRules: "你被反叛者扔进了一个在无限迭代中急速升温的While法阵。温度每循环一次增加一个因子。学员必须算准变值的极速跃迁范围，诊断出由于控制变量未自增导致的步长锁，用精确计算求得Break法术施展的临界帧数以斩断无限死炼。",
          duration: "10分钟",
          designRationale: "将空洞的Loop语法与死循环带来的热能升温等量齐观，使学生自然而然生成对循环终止因子的条件警戒心。"
        },
        {
          chapterIndex: "07",
          title: "惰性求值极限算力解围",
          coveredChapters: "Topic 3.2",
          summary: "range()生成器精细内存开销, Iterator迭代原理, Yield延迟计算",
          gameType: "coding-puzzle",
          gameTitle: "远古超大型列表大堵车：用惰性发生指针解决溢出故障",
          gameRules: "数据库被千万行超大魔法原体数据包阻塞。旧循环代码因试图全加载至列表（List）中引发悲剧的内存OOM大死机。你需要诊断迭代流并快速重编，将庞大的静态范围计算改写成惰性发生指针，彻底疏通内存堵死大动脉。",
          duration: "10分钟",
          designRationale: "将惰性求值与物理内存开销挂钩，让自学者深度惊叹于迭代发生器对维持高并发、轻量容器的核心算力意义。"
        },
        {
          chapterIndex: "08",
          title: "列表百宝胶囊大重排",
          coveredChapters: "Topic 4.1",
          summary: "多维列表切片, 内存引用地址, 元素安全剔除",
          gameType: "cross-match",
          gameTitle: "圣物武器库收纳：多级列表百宝格精准对齐",
          gameRules: "强大的远古武器在极高温震荡中发生了乱序污染，乱套的列表索引将法伤和物伤属性完全重合颠倒。单人学者需要将由于变值导致的引用共享浅拷贝冲突一一诊断，将列表深拷贝、区间逆序切片规则与武器库修复逻辑进行完美连线匹配。",
          duration: "10分钟",
          designRationale: "对齐内存深浅拷贝及索引越界概念，以图形武器重排序为载体，让学员深刻了解内存地址变值的陷阱。"
        },
        {
          chapterIndex: "09",
          title: "多维切片越界防线拦截",
          coveredChapters: "Topic 4.2",
          summary: "Slice三因子索引边界, 步长方向自适应, IndexError防御",
          gameType: "quiz",
          gameTitle: "巨蛇魔虫身体撕裂案：三维能量核精密切片捕捉",
          gameRules: "魔虫正因极差自转发生断节，其力量属性储在[start:stop:step]的多维向量中。你作为能量阻碍官，必须推演当step为-1时的空间极性翻转逻辑，诊断出切片在空索引下的边界自适应位置，做出一击必殺的拦截决策，不能少捕或溢漏切片产生IndexError。",
          duration: "10分钟",
          designRationale: "在紧张的狙击背景里，将Python切片的负步长翻转及越界容错率作为杀手锏，完成切片语法的最高掌握。"
        },
        {
          chapterIndex: "10",
          title: "字典契约与高频检索密匙",
          coveredChapters: "Topic 5.1",
          summary: "哈希快速检索, Key唯一性规则, 集合去杂质机制",
          gameType: "coding-puzzle",
          gameTitle: "远古哈希石碑：拼补散失的数据连接链",
          gameRules: "古神遗留的契约碑文残损，快速索引信物时因Key冲突爆发内存重污染，海量杂质元素在阻塞检索管道。为了防止上万条密语发生查询O(N)退化，你必须在限时内重编哈希索引算法片段，利用对集合（Set）的快速清洗过滤，使碑文字典结构完美重组运行。",
          duration: "10分钟",
          designRationale: "在算法时间复杂度退化的逼迫下，让学者深度体会并理解哈希字典O(1)的绝对技术优势和唯一键的核心机制。"
        },
        {
          chapterIndex: "11",
          title: "哈希冲突死循环大解结",
          coveredChapters: "Topic 5.2",
          summary: "Dict冲突抗哈希化, 可哈希对象（Hashable）边界, __hash__底层复写",
          gameType: "cross-match",
          gameTitle: "多极契约密钥崩塌：剔除不可哈希异常卡死",
          gameRules: "契约系统突然发出狂暴KeyError：列表无法当成字典的Key（TypeError: unhashable type: 'list'）。玩家必须将各种变量类型（元组、列表、字符串、字典）与其是否具有物理哈希稳态特征进行对齐连线，排除那些不守契约的不可哈希变量异质。",
          duration: "10分钟",
          designRationale: "通过匹配，使学生认识到只有Immutable对象才可哈希作为字典Key的物理本质，清除编码时的暗坑。"
        },
        {
          chapterIndex: "12",
          title: "防火墙Try-Except冒泡异常控制",
          coveredChapters: "Topic 5.3",
          summary: "异常冒泡回溯, 多重Except拦截, 异常栈定位",
          gameType: "quiz",
          gameTitle: "雷暴熔毁核应急控制：阻断失控的除零异常链",
          gameRules: "由于传感器瞬时掉线，数据流中赫然混入了致命的0阻抗因子。除以0的ZeroDivisionError巨澜正以极其强烈的势头向外壳系统冒泡溢出，所到之处各层模块全数死机！你需要在复杂嵌套函数栈帧中，准确诊断最优雅的Try-Except阻断位置，并在Finally块中确保安全阀不沉没。",
          duration: "10分钟",
          designRationale: "实景演示未捕获异常导致软件链条雪崩的惨状，让学生树立起安全编程与异常分级回收机制的反向本能。"
        },
        {
          chapterIndex: "13",
          title: "LEGB变量作用域空间撕裂",
          coveredChapters: "Topic 6.1",
          summary: "局部与全局命名空间, Built-in与Enclosing重合, global/nonlocal契约",
          gameType: "coding-puzzle",
          gameTitle: "魔法沙河禁忌边界：修复局部变量名字打架错误",
          gameRules: "由于同名冲突，函数内部的代码正企图更改函数外的核心护盾值`shield_hp`，引发了UnboundLocalError严重警告，护盾在警报里瑟瑟发抖。你必须在代码段合适位置配置名字锁定指令，通过`global`或`nonlocal`重新编排作用域遮蔽校验，保护护盾免于逻辑塌陷。",
          duration: "10分钟",
          designRationale: "通过解决名称解析暗斗，使学员理解命名空间在物理层面对堆栈变量作用域的保护和隔离价值。"
        },
        {
          chapterIndex: "14",
          title: "极限递归与栈深度溢出阻尼",
          coveredChapters: "Topic 6.2",
          summary: "递归基线条件（Base Case）, 系统栈振荡, sys.setrecursionlimit临界",
          gameType: "math-quest",
          gameTitle: "无尽递回旋涡：算准生命线避免死锁递归",
          gameRules: "探险队坠进了一个递因能量反应环中，深度每增一级，系统栈就堆攒一层临时寄存器。因缺少正确的基准出口（Base Case），系统栈正无情向1000限制线逼近！你必须立即算出基准条件的极限返航指针数，用计算阻断无限制暴跌崩溃。",
          duration: "11分钟",
          designRationale: "将递归基的判定转化为拯救坠落者的生死救生索发射角，深刻掌握递归若无出口将吞噬物理内存直至栈崩的铁律。"
        },
        {
          chapterIndex: "15",
          title: "模块交叉加载交叉依赖解环",
          coveredChapters: "Topic 6.3",
          summary: "模块加载物理机制, Circular Import循环注入, 动态内部导入（Dynamic Import）",
          gameType: "interactive-story",
          gameTitle: "双头黄金龙模块大熔断：打破彼此交叉指引死结",
          gameRules: "黄金龙的两颗法术核（模块A与模块B）彼此呼唤，在启动瞬间因为双向交叉`import`陷入无始无终的初始化卡死死圈！全城魔法流停摆。作为皇家首席大法术程序官，你需要决策是否将导入切改至内部调用，还是彻底抽离出公共接口协议，做出重大代码物理结构解耦选择。",
          duration: "11分钟",
          designRationale: "将模块加载和交叉导入命名卡死的复杂原理转为打破黄金死结的重大战略抉择，内化底层工程架构规范逻辑。"
        }
      ]
    };
  }

  // Universal Fallback (e.g. Science/Chemistry default)
  return {
    title: title || "《高阶综合科学教材纲要》",
    modules: [
      {
        chapterIndex: "01",
        title: "微观质子平衡配比",
        coveredChapters: "Topic 1.1",
        summary: "原子中心结构, 质子中子电荷, 强相互作用阻抗",
        gameType: "math-quest",
        gameTitle: "核燃料失衡漏网捕获：强核电磁阀计算突围",
        gameRules: "核反应堆压力阀严重过热。高能反射罩泄露强辐射尘埃。单人玩家作为平衡总指挥，需要通过配制原子中心微观质子、中子的极限能级配比，计算中子截面，以防重粒子过度自发裂变引发毁灭大洪烈。计算参数必须在3纳秒内收敛。",
        duration: "10分钟",
        designRationale: "不再填鸭式灌输原子结构，而是将平衡微观原子重力与维持反应堆电站安全直接联系起来，通过能量求取公式建立直观认知学。"
      },
      {
        chapterIndex: "02",
        title: "中子稳定衰变辐射拦截",
        coveredChapters: "Topic 1.2",
        summary: "弱相互作用, 贝塔粒子衰变比, 同位素安全衰变窗口",
        gameType: "cross-match",
        gameTitle: "废旧同位素安全处置：能能谱仪多通道反射配对",
        gameRules: "衰变堆内的放射性中子正以高不确定性抛洒。学生扮演放射防护师，需要精准诊断各个不同衰变阶段的物理特征，将粒子衰变率、正负极偏角特性以及能谱反射率进行连线配对，封锁致命射线泄露。",
        duration: "10分钟",
        designRationale: "利用废旧放射原阻挡场景，把虚无缥缈的贝塔粒子、能谱分布包装成几何对齐反射，帮助学生在操作中理解微观极性特征。"
      },
      {
        chapterIndex: "03",
        title: "电子价键极性连接器",
        coveredChapters: "Topic 2.1",
        summary: "共价键价电子共享, 八隅体稳定法则, 偶极极性吸纳",
        gameType: "coding-puzzle",
        gameTitle: "危爆价键断裂防御：修复不饱和碳链高能稳定代码",
        gameRules: "材料因高温分子骨架破碎，单价键自由基无序爆发。你必须重排序价电子吸收拼补逻辑与聚合判断，通过极少的外层电子拼填，使周围的化学原件重新结晶出稳健的惰性表面。",
        duration: "10分钟",
        designRationale: "使低认知化学画线转为系统化、逻辑链修复，理解分子内部价电子共享对系统稳健的支柱贡献。"
      },
      {
        chapterIndex: "04",
        title: "库仑力离子晶格定位",
        coveredChapters: "Topic 2.2",
        summary: "离子静电引力, 库仑势能公式, 晶格熔沸点热力学",
        gameType: "quiz",
        gameTitle: "高压电解槽失控熔融：晶格强度临界极速诊断",
        gameRules: "高炉内由于电极分布不均，高压静电力平衡崩溃，氯化钠盐固态晶格即将发生失控的无序软化泄露！你必须论证并快速核算各种极性杂质的库仑吸能级，判定何种掺杂物对拉抬熔点能起到核心锚定作用，紧急对炉温进行中和减震。",
        duration: "10分钟",
        designRationale: "利用高炉熔融危机，强迫学生计算并掌握静电相互作用与离子半径、电荷数的反比例平方物理内因。"
      },
      {
        chapterIndex: "05",
        title: "极性溶剂相似相溶洗涤",
        coveredChapters: "Topic 2.3",
        summary: "相似相溶机理, 溶质分子偶极矩, 表面活性层不平衡",
        gameType: "interactive-story",
        gameTitle: "剧毒有机溢流拦截：极性去污的材料配给抉择",
        gameRules: "无色有机剧毒物已渗透到水过滤仓口！普通的冲刷徒劳无功，你需要瞬间判断其分子的偶极性分布。并在一系列极性洗液、非极性溶剂中做出紧急两权投票：是顺应其疏水亲油本能，还是配以强极性偶极介质，以防全港饮用水源报销。",
        duration: "10分钟",
        designRationale: "用紧迫去污做背景，在选择里揭示相似相溶不是一句死顺口溜，而是分子间力磁极吸引契合度的物理抉择。"
      },
      {
        chapterIndex: "06",
        title: "酸碱中和逆推平衡精准滴定",
        coveredChapters: "Topic 3.1",
        summary: "中和反应物理跃升, 酸碱指示指数检测, 瞬时氢氧对冲",
        gameType: "math-quest",
        gameTitle: "极速酸液溶解槽：防止外壳腐蚀的物理极限剂量求取",
        gameRules: "强酸溶解池发生物料超载，不锈钢合金挡板开始嘶嘶冒烟。你必须在10秒内算准当前体积和常数下，应该投入的对应浓度的弱碱粉末剂量，多一毫克引发剧烈喷沸、少一毫克导致外保护壳穿孔，这是分毫不差的配准博弈。",
        duration: "10分钟",
        designRationale: "将数学中和量化为挽救大坝的剂量极限，极力挑战自学者关于酸碱比例的瞬时脑算与精确推理素质。"
      },
      {
        chapterIndex: "07",
        title: "共轭缓冲溶液拐点平滑",
        coveredChapters: "Topic 3.2",
        summary: "弱酸或弱碱缓冲基, pH对数平衡突跃, 共轭酸碱对互补性",
        gameType: "quiz",
        gameTitle: "生化舱pH狂波动危机：捕获对数滴定曲线安全区",
        gameRules: "正在孵化的抗体对酸碱抗性极度娇气，外界强酸渗流促使pH对数极度逼近死亡红界！常规的强碱中和在数学突跃区发生极大波动、无法控制。你必须通过论证引入弱共轭的醋质酸盐缓冲能级，借助系统对对数摆幅的缓震力化险为夷。",
        duration: "10分钟",
        designRationale: "引导学生深刻感悟共轭酸碱对是如何通过动态离解来吞噬外来酸碱冲击的，彻底内化著名的Henderson公式的物理妙用。"
      },
      {
        chapterIndex: "08",
        title: "多级浸液饱和熔融结晶",
        coveredChapters: "Topic 3.3",
        summary: "溶解度平衡常数Ksp, 析出结晶速率, 离子效应热力学",
        gameType: "cross-match",
        gameTitle: "危化重金属截流：晶体沉淀析出条件的精算匹配",
        gameRules: "工业管道重金属离子的渗漏即将毒化下水道。普通的沉淀剂投入量已达瓶颈，管道气压暴走。你必须分析Ksp动态变化，精确配对常温浓度差、同离子压迫系数、饱和析出速度，用完美连线引爆重金属最快结晶沉淀降解。",
        duration: "10分钟",
        designRationale: "使溶解度常数公式在截污战中化作可视对齐动作，引导自学者在大脑内将浓度比对与沉淀关系物理绑定。"
      },
      {
        chapterIndex: "09",
        title: "碳链同分异构空间大排查",
        coveredChapters: "Topic 4.1",
        summary: "空间对称结构, 范德华引力堆叠, 分支位阻对熔点影响",
        gameType: "coding-puzzle",
        gameTitle: "特种材料熔沸点崩溃：修正同分异构碳链堆积排列",
        gameRules: "高精合金保护板要在极寒下维持结构坚硬，然而当下其高聚异构碳链因排列杂乱、范德华力的重叠距离过大，刚性接近散碎。你必须充当纳米装配官，重排其同分异构碳骨架的支链对称度算法，确保密实拼装以拉抬分子间引力抗性。",
        duration: "10分钟",
        designRationale: "将枯燥不爱记的同分异构碳链空间结构转为高可用材料的装配密码拼补，使范德华堆积与空间对称度的因果一览无遗。"
      },
      {
        chapterIndex: "10",
        title: "饱和与不饱和双键聚合",
        coveredChapters: "Topic 4.2",
        summary: "碳双键不饱和加成, 自由基链式引燃, 热力学硬底",
        gameType: "interactive-story",
        gameTitle: "高压反应釜裂爆警报：控制双键加成释放的指数热能",
        gameRules: "单体混合物中的饱和度过低，不饱和卡扣在氧气渗入后发生了狂热的自发链式交联加成，热量堆爆发10倍级尖峰红光！作为防暴总监，你有数秒决策时间：是倒入液阻消退卡扣自由基，还是牺牲高聚物强度直接加压密封。生死存亡在此一举。",
        duration: "10分钟",
        designRationale: "热放热链条是聚合工业的梦魇，通过极限决策，学员将对碳双键在不饱和状态下的巨大化学位能留下直击灵魂的印象。"
      },
      {
        chapterIndex: "11",
        title: "共沸压强精精密蒸馏",
        coveredChapters: "Topic 5.1",
        summary: "两相两组分汽液平衡, 拉乌尔定律理想度, 沸点与外压反比",
        gameType: "math-quest",
        gameTitle: "有机防毒血清热交换：蒸馏塔极限温度压强对准",
        gameRules: "毒剂和保护血清在110度共沸蒸馏。一旦受温超越热点，血清将永久失活。你现在必须计算降低蒸馏塔气压的精确向量，在气液相平衡图上利用拉乌尔定理求得其常数交汇点，校准最低热交换温压对齐，在血清被蒸毁前提取救命药液。",
        duration: "12分钟",
        designRationale: "把复杂的汽液相平衡曲线化为减压蒸馏降温自救的实机工程计算，彻底领悟压强控制相平衡的高等真核。"
      },
      {
        chapterIndex: "12",
        title: "活化能位障突跃催化",
        coveredChapters: "Topic 5.2",
        summary: "阿伦尼乌斯公式, 催化剂降低位障, 反应热力学平衡不变性",
        gameType: "quiz",
        gameTitle: "冷核聚熔加速：阿伦尼乌斯活化能壁障打破",
        gameRules: "能源核心反应极其衰弱，因为反应物分子在200度温度下的平均自由碰撞动能根本够不着高耸的活化能壁障！你需要论证通过引入重金属催化剂以强力重构过渡态，让活化能屏障断崖式滑坡，并在论证催化剂不会改变反应平衡总产出定理下做出安全抉择。",
        duration: "10分钟",
        designRationale: "将抽象的能级过渡态与降低活化位障的现实工程难题耦合，让学员感受催化剂作为‘宏观物理加速开关’的技术神效。"
      },
      {
        chapterIndex: "13",
        title: "生命酶变性负反馈拦截",
        coveredChapters: "Topic 5.3",
        summary: "酶促反应速率, 变性失活临界点, 水利负反馈调节",
        gameType: "interactive-story",
        gameTitle: "特种毒素体温高热拦截：维持酶促循环平稳的生死较量",
        gameRules: "机体温度正向42度不可挽回的高热逼近，维持体细胞氧流的核心酶在越过41度红线后，其高度精密的三维空间构象正因为氢键和二硫键断开发生雪崩变性！你需要在冷缩针注射或毒性免疫对冲间发起多方向挣扎投资和投票，维护催化活性不致瞬间变水。",
        duration: "10分钟",
        designRationale: "让学生经历酶的高敏变性失活曲线，明白酶活性对极端外界条件（温度、酸度）的恐怖敏感性，夯实生物催化基础知识。"
      },
      {
        chapterIndex: "14",
        title: "勒夏特列防线自适应补偿",
        coveredChapters: "Topic 6.1",
        summary: "勒夏特列原理, 浓度压强应力平衡自适应, 正逆速率反馈",
        gameType: "coding-puzzle",
        gameTitle: "化学蓄水池过压警报：平衡漂移防御代码拼装",
        gameRules: "合成氨高压反应堆突遭气压泵超载挤压，气温激剧飙升！系统内置的平衡状态机陷入偏振打架，无法对平衡移位做出方向预测。你必须在限时内拼装平衡判定If-Else算法代码，模拟勒夏特列物理对冲逻辑，迫使系统朝分子数减小的方向自动偏转，化解爆炸厄运。",
        duration: "10分钟",
        designRationale: "通过编写平衡转换代码，让学生领会化学平衡不仅是一条冷冰冰的原则，更是包含大自然自我负反馈演替机制的最具动态代数对称性的完美法则。"
      },
      {
        chapterIndex: "15",
        title: "扩散熵增高热坝极阻",
        coveredChapters: "Topic 6.2",
        summary: "热力学第二定律, 扩散高熵状态, 局部减熵重组牺牲",
        gameType: "interactive-story",
        gameTitle: "热扩散高熵失控大爆破：最后一秒的减熵选择",
        gameRules: "核物质阻隔舱彻底破裂，大量的分子高熵能量正在以几何倍率朝全方向无序蔓延（高热扩散），如果不加控制，能量散逸将彻底让整艘救生船坠入无法挽回的永久高熵热寂冰冷死圈。你需要在最后决策：是封闭局部舱段注入冰态冷源实现高能局部排热（重组自减熵），还是牺牲辅能发电机给主控重构熵阻？每一个不归路抉择都会彻底逆变逃生胜算。",
        duration: "11分钟",
        designRationale: "深度理解热力学第二定律不可逆熵增的冷酷特性，将局限系统内局部耗散减熵和耗能代偿机制戏剧化呈现，提升物理哲学眼光。"
      }
    ]
  };
}
/* 力封装",
          coveredChapters: "Topic 1.1 - 1.4",
          summary: "变量内存寻址, 数据类型转换, 逻辑布尔能",
          gameType: "coding-puzzle",
          gameTitle: "魔法溢流危机：熔炼不稳定数据符文",
          gameRules: "圣殿魔力水晶因内存泄漏发生狂暴震荡！作为实习结印师，你需要快速在一行行报错指针中，找出混合类型由于隐式强转（把str与int直接相加）导致的法术崩塌，拼补并封装类型检测保护层。",
          duration: "100分",
          designRationale: "让初学者不再觉得数据类型是干瘪的语法条目，而是在模拟‘致命内存膨胀’的实战诊断中理解其物理存储开销与限制。"
        },
        {
          chapterIndex: "02",
          title: "If-Else 圣光抉择折返",
          coveredChapters: "Topic 2.1 - 2.4",
          summary: "逻辑门判断, 嵌套条件边界, 特权安全拦截",
          gameType: "quiz",
          gameTitle: "圣门抉择铁卫：守护核心魔力边界",
          gameRules: "多名被暗黑魔法寄生的诡异人偶试图强闯安全检测圣门。玩家扮演边防审计圣骑士。你需要连续分析三重嵌套If条件分支在极冷、极热极限状态下的计算流，诊断复杂布尔逻辑与布尔短路求值逻辑，做出百分之百精准的放行或格杀决策。",
          duration: "10分钟",
          designRationale: "用紧张的关防抉择，迫使学员彻底攻克嵌套边界、条件优先级及短路计算等容易混淆的高认知痛点。"
        },
        {
          chapterIndex: "03",
          title: "For/While 千重无限炼界",
          coveredChapters: "Topic 3.1 - 3.4",
          summary: "循环步长约束, 死循环边界中断, Break跳转",
          gameType: "math-quest",
          gameTitle: "无限深渊逃逸：计算并斩断死锁法阵",
          gameRules: "你被反叛者扔进了一个在无限迭代中急速升温的While法阵。温度每循环一次增加一个因子。学员必须算准变值的极速跃迁范围，诊断出由于控制变量未自增导致的步长锁，用精确计算求得Break法术施展的临界帧数以斩断无限死炼。",
          duration: "10分钟",
          designRationale: "将空洞的Loop语法与死循环带来的热能升温等量齐观，使学生自然而然生成对循环终止因子的条件警戒心。"
        },
        {
          chapterIndex: "04",
          title: "列表百宝胶囊大重排",
          coveredChapters: "Topic 4.1 - 4.4",
          summary: "多维列表切片, 内存引用地址, 元素安全剔除",
          gameType: "cross-match",
          gameTitle: "圣物武器库收纳：多级列表百宝格精准对齐",
          gameRules: "强大的远古武器在极高温震荡中发生了乱序污染，乱套的列表索引将法伤和物伤属性完全重合颠倒。单人学者需要将由于变值导致的引用共享浅拷贝冲突一一诊断，将列表深拷贝、区间逆序切片规则与武器库修复逻辑进行完美连线匹配。",
          duration: "10分钟",
          designRationale: "对齐内存深浅拷贝及索引越界概念，以图形武器重排序为载体，让学员深刻了解内存地址变值的陷阱。"
        },
        {
          chapterIndex: "05",
          title: "字典契约与高频检索密匙",
          coveredChapters: "Topic 5.1 - 5.4",
          summary: "哈希快速检索, Key唯一性规则, 集合去杂质机制",
          gameType: "coding-puzzle",
          gameTitle: "远古哈希石碑：拼补散失的数据连接链",
          gameRules: "古神遗留的契约碑文残损，快速索引信物时因Key冲突爆发内存重污染，海量杂质元素在阻塞检索管道。为了防止上万条密语发生查询O(N)退化，你必须在限时内重编哈希索引算法片段，利用对集合（Set）的快速清洗过滤，使碑文字典结构完美重组运行。",
          duration: "10分钟",
          designRationale: "在算法时间复杂度退化的逼迫下，让学者深度体会并理解哈希字典O(1)的绝对技术优势和唯一键的核心机制。"
        },
        {
          chapterIndex: "06",
          title: "Def 结印咒文与沙盒屏障",
          coveredChapters: "Topic 6.1 - 6.4",
          summary: "重用封装思想, 报错异常溯源, 局部与全局变量作用域",
          gameType: "interactive-story",
          gameTitle: "禁忌沙盒爆破：安全Try-Except决策阻断",
          gameRules: "主城外发生魔法污染泄露，任何除以0或者空指针报错都会瞬间引燃整个魔法网，彻底瘫痪供电。学员作为法网总指挥，面临多方向未知类型的异能侵蚀。你需要在多变路线抉择中，决策在哪里部署全局作用域隔离、在哪配置Try-Except拦截，以及如何传参保证代码库的高可靠容灾重用性。",
          duration: "10分钟",
          designRationale: "将高级作用域隔离和高可用报错阻断融入到城市防火墙抵御入侵的互动决策里，完成高级软件架构思维跃迁。"
        }
      ]
    };
  }

  // Universal Fallback (e.g. Science/Chemistry default)
  return {
    title: title || "《高阶综合科学教材纲要》",
    modules: [
      {
        chapterIndex: "01",
        title: "微观质子平衡配比",
        coveredChapters: "Topic 1.1 - 1.4",
        summary: "原子中心结构, 质子中子电荷, 元素丰度调和",
        gameType: "math-quest",
        gameTitle: "核燃料失衡漏网捕获：强核电磁阀计算突围",
        gameRules: "核反应堆压力阀严重过热。高能反射罩泄露强辐射尘埃。单人玩家作为平衡总指挥，需要通过配制原子中心微观质子、中子的极限能级配比，计算中子截面，以防重粒子过度自发裂变引发毁灭大洪烈。计算参数必须在3纳秒内收敛。",
        duration: "10分钟",
        designRationale: "不再填鸭式灌输原子结构，而是将平衡微观原子重力与维持反应堆电站安全直接联系起来，通过能量求取公式建立直观认知学。"
      },
      {
        chapterIndex: "02",
        title: "分子价键应密连接器",
        coveredChapters: "Topic 2.1 - 2.4",
        summary: "共价键共享极性, 离子静电库仑力, 八隅体极限",
        gameType: "cross-match",
        gameTitle: "酸性废液高能黏合：极性分子的磁合连线匹配",
        gameRules: "泄漏的高分子硫酸废料吞噬了防御盾合金底座，正向生活区侵蚀。你需要诊断各种污染元素的电子富集丰度，精确拉线匹配价电子缺位，将共价极性力学与静电库仑引力阻碍点完美配对，完成坚固的无机盐惰性物结晶硬化。",
        duration: "101分",
        designRationale: "利用废液侵入的紧张感，强迫学生分析多原子共享外层电子轨道的静电力吸引变化，实现化学键动力学的深入领会。"
      },
      {
        chapterIndex: "03",
        title: "强酸溶解与常数平衡控制",
        coveredChapters: "Topic 3.1 - 3.4",
        summary: "强酸滴定浓度, pH对数平衡比, 中和逆推常数",
        gameType: "quiz",
        gameTitle: "危爆生化池紧急缓冲：化学滴定强度的博弈论证",
        gameRules: "一个高压生化实验池pH值正因为杂质催化急速跌落，极度偏酸腐蚀外壳，报警红灯闪烁！常规碱性喷淋发生机械阻塞。玩家必须深度论证其对数滴定曲线在平缓区与突跃区的状态跃迁，论证在有限氨缓冲剂下做出何种剂量注入以稳定常数，避免过热爆炸。",
        duration: "10分钟",
        designRationale: "在面临大坝溶解的极危局势下，迫使学员应用pH负对数曲线的非线性跳跃规律，避免盲目超量添加缓冲剂导致的失效。"
      },
      {
        chapterIndex: "04",
        title: "碳链异构催化爆破",
        coveredChapters: "Topic 4.1 - 4.4",
        summary: "碳链同分异构, 双键不饱和物, 聚合能量释放",
        gameType: "interactive-story",
        gameTitle: "末日气态生命合成：异构聚合的多通路决策树",
        gameRules: "异星气态致命原体突破玻璃封锁！你需要在紧迫资源配给中，连续投票决定将哪种异构碳骨架注入其吞噬体。由于同分异构体的沸点与空间位阻有天壤之别，你的每一次抉择将彻底决定合成聚合链是迅速变重并凝固沉降，还是发热加剧引爆整个呼吸仓系统。",
        duration: "10分钟",
        designRationale: "通过极具电影感的致命气体扩散环境，将同分异构体的细微物理与化学性质差异包装成生死抉择的权衡指标。"
      },
      {
        chapterIndex: "05",
        title: "有机溶剂极性蒸馏安全拦截",
        coveredChapters: "Topic 5.1 - 5.4",
        summary: "有机相似相溶, 极性分布平衡, 沸点压强关系",
        gameType: "coding-puzzle",
        gameTitle: "化学毒剂智能过滤算法：蒸馏塔温压配比校正",
        gameRules: "防生化毒剂蒸馏冷却塔的主轴指令代码遭遇杂质乱序干扰，温度梯度控制循环彻底失效。学员需要诊断过滤流程，重新拉线或编排If-Else过压释放温度检测循环，准确地切断相同沸点下的多组杂质，保证救命血清在高度非线性受热状态下完成结晶。",
        duration: "10分钟",
        designRationale: "将蒸馏方程转化为控制代码中的逻辑跳转因子，让学生从工程层面对有机物理特性（沸点随压强急跌）进行调优。"
      },
      {
        chapterIndex: "06",
        title: "生命酶催化热失控挽救",
        coveredChapters: "Topic 6.1 - 6.4",
        summary: "活化能屏障降低, 酶变性负反馈, 米氏常数动态反应",
        gameType: "interactive-story",
        gameTitle: "致命体液升温：拦截酶催化连锁高烧突触",
        gameRules: "一种由基因武器诱发的发热链条正在患者体内激活，体能核心酶正因为超越常数界限发生大面积变性。你作为急诊ICU微型机器人最高AI算法操纵人，必须诊断病原体活化能屏障并做出治疗战略决策。多重决策路线都在高活化率和体液崩溃的边界跳舞，每一次行动都将产生深层的级联因果变化。",
        duration: "10分钟",
        designRationale: "将复杂的米氏曲线动力学和酶变性规律转化为拯救生命的高考量决策拉锯。每一次退烧或固化活性的操作都让学生深入掌握催化反馈物理机理。"
      }
    ]
  };
}
*/

function getMockScript(chapterTitle: string, gameType: string) {
  const norm = (chapterTitle || "").toLowerCase();

  // 1. ASTROPHYSICS & SOLAR PHYSICS
  if (norm.includes("恒星") || norm.includes("星云") || norm.includes("引力") || norm.includes("聚变") || norm.includes("光子") || norm.includes("巨星") || norm.includes("坍塌") || norm.includes("坍缩") || norm.includes("简并") || norm.includes("黑洞") || norm.includes("红移")) {
    return {
      introduction: `=== 模拟舱启动："${chapterTitle}" ===\n您好，飞船AI系统已就绪。船身表壳热力传感器数值剧烈跳动，前方是极端致密的宇宙极性引力阻隔区。你必须运用恒星物理学法则，排除连锁状态故障！`,
      challenges: [
        {
          type: "choice",
          title: "挑战 1：引力塌缩临界诊断",
          prompt: "在星际介质大范围降速塌缩过程中，要维持恒星胚胎不发生无限暴跌而形成超级黑洞，其气压向外产生的热压力必须与向里的什么能量处于完美的静力学力阻平衡？",
          options: ["引力自相吸引势能 (Gravitational Potential)", "暗物质能级波强", "霍金热表面辐射压", "强磁极旋转扭矩矩"],
          correctAnswer: "引力自相吸引势能 (Gravitational Potential)",
          feedbackCorrect: "完全正确！在太阳乃至所有主序恒星的生命周期中，流体力学静力平衡（Hydrostatic Equilibrium）要求内部核聚变产生的热辐射压完美抵消恒星自身巨大的引力塌缩收缩势能。",
          feedbackIncorrect: "不正确。请记住：引力向内拉，辐射压力向外推！这是恒星生存近百亿年在力学上的终极博弈因果机制。"
        },
        {
          type: "choice",
          title: "挑战 2：热核聚变阻断分析",
          prompt: "当一颗恒星质量小于1.5倍太阳质量时，其内部进行氢核聚变并源源不断向太阳辐射层供给热能的最核心能量流动形式是：",
          options: ["质子-质子链反应 (p-p chain)", "碳氮氧循环 (CNO cycle)", "三阿尔法氦骤燃反应", "电子简并压力排变"],
          correctAnswer: "质子-质子链反应 (p-p chain)",
          feedbackCorrect: "太棒了！小质量恒星（例如我们的太阳）以质子-质子链反应（p-p chain）为主，而大于1.5倍太阳质量的巨星，因中心温度极高，其热核聚变则由CNO循环主导。",
          feedbackIncorrect: "错误。CNO（碳氮氧循环）是高质量巨型星在更高温度临界下才会活化的催化链。中低质量恒星是以主体的p-p质子链提供引力抗衡的！"
        },
        {
          type: "choice",
          title: "挑战 3：钱德拉塞卡坍缩临界线",
          prompt: "白矮星能够依靠‘电子简并压’抵抗引力坍塌，但当其积聚伴星溢出物质，使得质量超过了著名的钱德拉塞卡极限时，它将无法制动并发生Ia超新星自爆。这一生死极限质量值是太阳质量的：",
          options: ["1.44倍", "3.0倍", "0.08倍", "8.0倍"],
          correctAnswer: "1.44倍",
          feedbackCorrect: "完美斩断危机！钱德拉塞卡极限正是 1.44 M☉。一旦超越该值，电子简并压在狭义相对论效应下败下阵来，星体无情缩塌为中子星或 Ia 超新星烈爆！",
          feedbackIncorrect: "不对。1.44倍是电子简并压的绝对宇宙边界；而 3.0倍 则是中子简并压的边界（奥本海默-沃尔科夫极限）；0.08倍是主序聚变点火底线。"
        }
      ],
      conclusion: "物理防御拦截大获成功！星体外层磁压和轨道压力数据彻底稳定，恒星演化物理学的数据结晶完美导入你的中央数据库。您的决策兼具科学理智与危机大局观！"
    };
  }

  // 2. ANCIENT GREEK & ROMAN MYTHS
  if (norm.includes("神话") || norm.includes("希腊") || norm.includes("混沌") || norm.includes("主神") || norm.includes("十二") || norm.includes("英雄") || norm.includes("试炼") || norm.includes("特洛伊") || norm.includes("塞壬") || norm.includes("命运") || norm.includes("神谱")) {
    return {
      introduction: `=== 凡人试炼场启动："${chapterTitle}" ===\n宏大的神殿铜钟在凡尘之上重重敲响。你发现自己身处诸神权能交织、充满神圣矛盾的地盘。为了从主神的宿命赌局和流血危机中突围，你必须运用古希腊悲剧法则做出策略权衡！`,
      challenges: [
        {
          type: "choice",
          title: "挑战 1：秩序确立与泰坦之战的象征",
          prompt: "在奥林匹斯起源神战中，宙斯联合独眼巨人等力量，推翻其父克洛诺斯的泰坦残暴霸权。从神话的历史演化角度看，这一权力更迭的本质象征着：",
          options: ["理性契约与神圣秩序将野蛮狂暴的混沌和天灾取代", "神祇自私无序血统的自我污染", "人类文明在火种点燃前的神族放任自流", "物理世界引力法则对虚无状态的单向吞噬"],
          correctAnswer: "理性契约与神圣秩序将野蛮狂暴的混沌和天灾取代",
          feedbackCorrect: "一语中的！泰坦诸神多象征着暴风、大地震和虚无狂野的自然灾变，而以宙斯（律法）、雅典娜（智慧与策略）为首的奥林匹斯新神主宰世界，深刻寓意着古希腊文明由野蛮自然崇拜向社会理性秩序、神法契约的政治过渡哲学。",
          feedbackIncorrect: "不对。在神话深度分析中，宙斯重置的法则代表契约与理性的光明神谱，对应着人建立联邦与政治法律的伟大跃迁，不仅是家族复仇！"
        },
        {
          type: "choice",
          title: "挑战 2：神话宿命与性格悲剧抉择",
          prompt: "德尔斐神庙的石墙上刻着‘认识你自己’，希腊悲剧常在英雄试图逃避神谕的反抗中爆发（如俄狄浦斯王）。在希腊悲剧深层设计中，英雄悲剧的终极导因通常是：",
          options: ["英雄在反抗宿命时由于必然天性执念而形成的‘傲慢/过失’ (Hubris)", "诸神因赌气单向对其身体施展的死灵诅咒", "凡人骨骼强度和热能供给的生理限制", "外在恶魔势力的强行夺舍操弄"],
          correctAnswer: "英雄在反抗宿命时由于必然天性执念而形成的‘傲慢/过失’ (Hubris)",
          feedbackCorrect: "论证精彩！希腊悲剧的核心魅力在于：悲剧并不是偶然的厄运，而是由于英雄面对神谕展现出超出常人的骄傲、坚执（ Hubris 与 Hamartia），在理性反抗的自决道路上恰恰亲手织就了宿命！",
          feedbackIncorrect: "不正确。单纯由外邪害死算不上是高级悲剧，真正的希腊宿命宿愿必须是通过凡人在自决努力下的性格过错诱发的宏伟反讽。"
        },
        {
          type: "choice",
          title: "挑战 3：奥德修斯塞壬策略的博弈论应用",
          prompt: "在奥德赛漂流史诗中，船长奥德修斯明知塞壬女妖那吞噬生命的歌声无可抗拒，却不愿像水手那样用蜡封住双耳，而是命令手下将自己死死绑在船主栀杆上，若求饶便绑得更紧。在博弈论和心理学中，这一做法被称为：",
          options: ["预先约束协议/奥德修斯契约 (Commitment Device)", "双向博弈盲区退让", "弱者主观意志投机", "信息完全阻塞反射"],
          correctAnswer: "预先约束协议/奥德修斯契约 (Commitment Device)",
          feedbackCorrect: "完美解析！‘奥德修斯契约’（Odyssey Contract / Commitment Device）是行为经济学名流词。用来表达在决策者处于高度清醒和理智时，采取强制性客观机制约束未来可能会丧失理智的自己，以冲破人性致命弱点！",
          feedbackIncorrect: "不对。他并非装模作样地投机！他通过捆绑桅杆既渴望亲历至美真相、又用外在机制完美避开死亡暗礁，是理性行为模式的始祖经典。"
        }
      ],
      conclusion: "奥林匹斯的命运天平彻底倾斜向您！由于您深刻洞察了悲剧之网下的理智救赎与人性契约，诸神以雷霆起誓，护送您的智慧和意志荣登英灵神座！"
    };
  }

  // 3. PYTHON CODE SPELLBOOK
  if (norm.includes("python") || norm.includes("code") || norm.includes("编程") || norm.includes("代码") || norm.includes("变量") || norm.includes("循环") || norm.includes("字典") || norm.includes("函谱")) {
    return {
      introduction: `=== 魔法沙盒安全区启动："${chapterTitle}" ===\n警告！多段溢流异常在圣法阵的编译流（Compiler Sandbox）中肆虐。由于隐式漏洞及类型冲突，系统已降级熔断。代码法阵急需诊断与规则修复！`,
      challenges: [
        {
          type: "choice",
          title: "挑战 1：变量引力与数据强转熔断",
          prompt: "在一项魔力熔炉计算中，某学徒在Python圣典中写下代码：val = 'SpellPower: ' + 99。在Jupyter沙盒中运行，该行会触发什么报错？你应如何以最轻开销诊断和修复它？",
          options: ["TypeError。使用 str(99) 显式将整型包裹强转再进行拼接", "SyntaxError。必须将单引号换成三引号", "ValueError。只能通过 float(val) 反向剥离文字", "魔法反噬。Python解释器会安静崩塌，无任何日志返回"],
          correctAnswer: "TypeError。使用 str(99) 显式将整型包裹强转再进行拼接",
          feedbackCorrect: "修复成功！Python 是一门强类型（Strongly Typed）语言，它严厉拒绝整型（int）与字符串（str）的隐式自动转换拼接。必须显式强转。而在弱类型语言中如JS则可能会产生隐式胁迫拼接，这常埋下深层漏洞隐患。",
          feedbackIncorrect: "不对。在强类型机制下，str和int是不可能直接依靠加号融合的，会雷鸣报错TypeError！唯一的出路是用最利索的显式转化函数将其数据化包围。"
        },
        {
          type: "choice",
          title: "挑战 2：For 循环步长与逻辑死结",
          prompt: "学徒需要打印10以内的所有正奇数，并写出了代码：for i in range(1, 10, 2): print(i)。这段循环代码中，代表步长变化与终止条件边界调控的第三个核心参数是哪个？它是如何规避死循环膨胀灾难的？",
          options: ["参数 2是步长 (2)，它表明每次循环增加2，保证在10这个终止界限（不包)内自然停机", "参数 1代表起始指针（1），它是循环能停机的根本归因", "参数 10代表无限循环溢出的冷却阻值", " range() 魔法在Python 3中是一张静态超长列表，会自动耗尽物理内存中断"],
          correctAnswer: "参数 2是步长 (2)，它表明每次循环增加2，保证在10这个终止界限（不包)内自然停机",
          feedbackCorrect: "完美修正！range(start, stop, step) 依靠 step=2 使得变量 i 每次递增 2，直抵边界 10 (由 stop=10 阻断，不包含10)。由于它是根据迭代协议（Iterator）惰性求值产生的，因此对物理内存的占用是 O(1) 级的，永远不会导致物理存储爆炸！",
          feedbackIncorrect: "不对。 range() 第三个因子是控制每次循环跨越距离的‘步长’！如果方向设置相反或者不设置控制指针，而试图用While循环盲目处理，极其容易坠入CPU 100%死锁陷阱。"
        },
        {
          type: "choice",
          title: "挑战 3：列表浅拷贝引用毒性诊断",
          prompt: "在一段武器管理代码中，学徒执行如下咒语：\nlistA = [5, 10]\nlistB = listA\nlistB.append(15)\nprint(listA)\n最终输出居然是 [5, 10, 15]！这种变量‘血脉纠缠’是因为犯了什么内存引用共享的致命错误？",
          options: ["直接等号赋值仅复制了堆地址的指针（浅绑定），应该用 copy.deepcopies() 或 listA.copy() 规避强纠缠", "Python中列表是不可变的（Immutable），系统一定是打印了缓存机制残留", " val[15] 没有在 val[-1] 中被妥善宣告", "没有运行垃圾收集器 gc.collect() 强制刷新"],
          correctAnswer: "直接等号赋值仅复制了堆地址的指针（浅绑定），应该用 copy.deepcopies() 或 listA.copy() 规避强纠缠",
          feedbackCorrect: "大师级诊断！Python中列表是可变对象（Mutable）。直接用 '=' 赋值只是将新变量指向了相同的堆内存引用地址。要避免数据互相污染，必须使用深拷贝（Deep Copy）或者至少是 `.copy()` 独立克隆以分割数据地带。",
          feedbackIncorrect: "不正确。等号是不复制列表内含的具体实体的，它只是把名字也系在了同一个物理内存包裹线头上，一损俱损！一定要用克隆拷贝函数斩断这一关联引用共享机制。"
        }
      ],
      conclusion: "代码法阵安全度 100%。魔法报错全部排除，沙盒防御重新升起！自上而下的重用结印、作用域隔离、异常多点拦截规则完美收敛。你已彻底领会了高级开发者的工程逻辑之美！"
    };
  }

  // 4. Default General Fallback (Chemistry / General Science)
  return {
    introduction: `欢迎进入《${chapterTitle}》智能模拟训练舱！\n舱内危险物理环境已生成：警报红光闪烁，参数极度不平衡。为了避免发生毁灭性生化灾难或者动力引擎过载自毁，你必须作为总控专家，在极高认知负荷的困境中迅速论证和决策！`,
    challenges: [
      {
        type: "choice",
        title: "第一阶段：基本原理诊断",
        prompt: "面对突如其来的压力和气泡聚变异常，化学键在剧烈升温下濒临彻底崩溃。你必须立即判定，什么作用力是维持微观核心粒子能够抵抗同性电荷间巨大排斥力而凝聚不灭的根本动力？",
        options: ["依靠介子传递的‘强相互作用力’ (Strong Force)", "静电库仑吸引力", "分子间范德华弱引力", "引力波潮汐常数"],
        correctAnswer: "依靠介子传递的‘强相互作用力’ (Strong Force)",
        feedbackCorrect: "完全正确！强核力克服了质子之间巨大的静电排斥力，在微观极其局限的跨度上（~10^-15m）将粒子牢牢锁在原子内部，是构成万物重核稳定的根本。",
        feedbackIncorrect: "不正确。质子带正电，静电力在微观实际上在反向推开质子，唯有‘强相互作用力’提供压倒性的吸引捆绑阻碍！"
      },
      {
        type: "choice",
        title: "第二阶段：极限决策权衡",
        prompt: "生化池温度已经攀升至98度，pH对数值正发生剧烈非线性突跃。常规中和手段已来不及喷洒。在极度资源配给赤字下，下面哪项是防止酸度穿孔最合理的缓冲化学决策路径？",
        options: ["运用少量高系数共轭弱酸碱缓冲溶液稳定pH对数拐点", "盲目超载投入纯氢氧化钠烈性颗粒以求瞬时中和", "彻底抽干冷却管道注入大量高纯度甲醇废液", "注入高放射性裂变铀以对冲热势堆"],
        correctAnswer: "运用少量高系数共轭弱酸碱缓冲溶液稳定pH对数拐点",
        feedbackCorrect: "决策非凡！由于pH对数公式的突跃平缓区规律，强突碱灌注极易引发温度指数式失控爆炸。利用共轭（Conjugate）酸碱对能依靠热力学解离常数自我调节动态抵御外来扰动，才是最高效冷静的安全博弈选择！",
        feedbackIncorrect: "错误抉择。盲目倒入大量强碱不仅会引发核放热的瞬间爆发大爆炸，还无法利用任何自我对冲平衡机理，这是最危险的死磕。"
      },
      {
        type: "choice",
        title: "第三阶段：深层归因与思维跃迁",
        prompt: "模拟实验结束，为何在刚才高热状态下，有些同分异构碳链材料抗熔化指数远胜于普通同结构脂肪烃？其背后的关键空间几何分子机制归因是：",
        options: ["枝杈较少、排布极规整的直链或对称异构体能产生更紧密的结晶和更高范德华堆积力", "双键在发生无规则常数突变自发变频", "高分子中游离中子的热能衰变延迟", "由于极性基团发生了空间逆反塌缩"],
        correctAnswer: "枝杈较少、排布极规整的直链或对称异构体能产生更紧密的结晶和更高范德华堆积力",
        feedbackCorrect: "归因极其深刻！同分异构体中，支链越少或分子空间几何对称度越高的结构（如新戊烷 vs 异戊烷），其堆积致密性极佳，促使大量的分子外缘电荷云在微观上发生更大面积的瞬时极化，从而凝聚出更大的范德华引力防线，拉高熔沸点极限！",
        feedbackIncorrect: "不对。在化学晶格中，空间几何的拼装规整度决定了距离！距离越近物理摩擦键能和范德华极化阻力也就翻倍高攀！"
      }
    ],
    conclusion: "危机警报圆满解除。全堆芯温度和流速指标回到健康平稳的绿色安全刻度，恭喜你成功通关高级科学挑战，从被动复述知识完全内化升华为复杂系统调度专家！"
  };
}


// Handle Vite dev server vs production static asset serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite Dev Server middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use(vite.middlewares);
    console.log("⚡ Vite middleware initialized in Development mode.");
  } else {
    // Production serving of static compiled assets
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("📦 Production assets statically mounted.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Full-stack Book-to-Game server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
