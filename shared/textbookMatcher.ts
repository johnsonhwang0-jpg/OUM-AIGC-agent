/**
 * 教材匹配与内容提取的共享纯函数层
 *
 * 设计目的：
 *  - 让后端 orchestrator 与前端浏览器复用同一份提取逻辑，
 *    避免出现"两套实现"导致自动模式与手动模式行为不一致。
 *  - 本文件不得依赖浏览器 API（window、document 等）。
 *
 * 历史背景：原本全部位于 src/utils/textbookMatcher.ts，
 * 其中 getExtractedTextForModuleAsync 依赖 PDF.js（window 全局），
 * 只能在浏览器运行，后端无法直接调用，因此 orchestrator 重新实现了一份
 * 精简版逻辑，导致自动模式缺失 offset、filterAndFormatLines、trim 等步骤。
 * 本文件将纯函数抽离，作为前后端共享的唯一实现来源。
 */
import { BookModule, DirectoryItem, ExtractedImage } from "../src/types";

export type { BookModule, DirectoryItem, ExtractedImage };

/**
 * 目录条目的最小结构：仅需 title 和 page 字段。
 * 前端 DirectoryItem（含 id/type/level）和后端 SimpleDirItem（含 level）
 * 都满足此接口，因此 calculatePageRange 等函数可同时被前后端调用。
 */
export interface PageRef {
  title: string;
  page?: string;
}

/**
 * 从 Base64 PDF 按需提取指定页的文本+格式信息（前端专用，依赖 PDF.js）
 * 注意：本函数留在 src/utils/textbookMatcher.ts，不在此共享文件中。
 */

/** 带格式的 PDF 页面项（仅前端 PDF.js 提取使用，后端不会触及） */
export interface PdfPageItem {
  text: string;
  fontSize: number;
  fontWeight: number;
  hasBold: boolean;
  y: number;
}

/**
 * 根据目录结构和章节切分信息计算页码范围
 * 输入：1) 目录（章节 → 页码映射） 2) coveredChapters（如 "1.1-1.3"）
 * 逻辑：起始页码 = 起始章节在目录中的页码
 *       结束页码 = 结束章节下一个非子章节节点的页码
 */
export function calculatePageRange(
  covered: string,
  directoryItems: PageRef[]
): { startPage: string; endPage: string; found: boolean } {
  const parseSectionNumbers = (str: string): number[] | null => {
    const match = str.trim().match(/(\d+(?:\.\d+)*)/);
    if (!match) return null;
    return match[1].split('.').map(x => parseInt(x, 10));
  };

  const isDescendant = (target: number[], item: number[]): boolean => {
    if (item.length < target.length) return false;
    for (let i = 0; i < target.length; i++) {
      if (item[i] !== target[i]) return false;
    }
    return true;
  };

  const findIndex = (nums: number[]): number => {
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

  let startNums: number[] | null;
  let endNums: number[] | null;

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

/**
 * 构建匹配 Markdown 标题的正则表达式
 * 例如 "1.1" → 匹配 "## 1.1 ..." 或 "### 1.1 ..."
 */
export function buildHeadingPattern(chapterNum: string): RegExp {
  const escaped = chapterNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^#{1,6}\\s+${escaped}(?:\\s|$)`, 'i');
}

/**
 * 在目录中找到指定章节的下一个同级别节点，返回章节号（如 "2.4"）
 * 例如 1.3 的下一个同级是 1.4；如果 1.4 不存在，则是 2.1（下一个 Topic 的第一节）
 */
export function findNextSibling(
  chapterNum: string,
  directoryItems: PageRef[]
): string | null {
  const parseSection = (str: string): number[] | null => {
    const match = str.trim().match(/^(\d+(?:\.\d+)*)/);
    if (!match) return null;
    return match[1].split('.').map(x => parseInt(x, 10));
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
      const isNext = nums.slice(0, -1).every((n, j) => n === targetNums[j]) &&
                     nums[nums.length - 1] === targetNums[targetNums.length - 1] + 1;
      if (isNext) {
        return nums.join('.');
      }
    }

    if (nums.length === level && nums[0] > targetNums[0]) {
      // continue
    }
  }

  const nextTopicNum = targetNums[0] + 1;
  for (let i = 0; i < directoryItems.length; i++) {
    const nums = parseSection(directoryItems[i].title);
    if (!nums) continue;
    if (nums.length === level && nums[0] === nextTopicNum) {
      return nums.join('.');
    }
  }

  return null;
}

/**
 * 根据 coveredChapters 裁剪提取内容，去除范围外的冗余内容
 * 例如 coveredChapters = "1.1-1.3"，则：
 * - 找到 ## 1.1 ... 标题，删除之前的内容
 * - 找到 1.3 的下一个同级别节点（如 1.4 或 2.1），删除该标题及之后的内容
 */
export function trimExtractedContent(
  mdContent: string,
  coveredChapters: string,
  directoryItems: PageRef[]
): string {
  const covered = coveredChapters.trim();
  if (!covered) return mdContent;

  const rangeMatch = covered.match(/(\d+(?:\.\d+)*)\s*[-~—至]\s*(\d+(?:\.\d+)*)/);
  let startChapter: string;
  let endChapter: string;

  if (rangeMatch) {
    startChapter = rangeMatch[1];
    endChapter = rangeMatch[2];
  } else {
    startChapter = covered;
    endChapter = covered;
  }

  const lines = mdContent.split('\n');

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
  return trimmedLines.join('\n').trim();
}

/**
 * 对后端提取的纯文本进行页眉页脚过滤和格式化处理
 * 支持两种模式：
 * 1. pdf_oxide 模式：输入已包含 Markdown 格式（# ## ### 标题），只过滤页眉页脚
 * 2. 旧版 PyMuPDF 模式：输入为纯文本，需要智能格式化
 */
export function filterAndFormatLines(lines: string[], directoryItems?: PageRef[]): string {
  const hasMarkdownHeadings = lines.some(line => /^#{1,6}\s/.test(line.trim()));

  if (hasMarkdownHeadings) {
    const filteredLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        filteredLines.push('');
        continue;
      }
      if (/^#{1,6}\s/.test(trimmed)) {
        filteredLines.push(line);
        continue;
      }
      if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
        filteredLines.push(line);
        continue;
      }
      if (/^\|/.test(trimmed)) {
        filteredLines.push(line);
        continue;
      }
      if (/^[•\-]?\s*\d+\s*[•\-]?$/.test(trimmed)) continue;
      if (/^(?:第\s*\d+\s*页|page\s*\d+|\b\d+\s*[-—]\s*页\b)/i.test(trimmed)) continue;
      if (/(?:出版社|Publishing|Copyright|All\s+rights\s+reserved|版权所有|©)/i.test(trimmed) && trimmed.length < 80) continue;
      if (/(?:www\.|http:\/\/|https:\/\/)/i.test(trimmed) && trimmed.length < 80) continue;
      if (/(?:ISBN|ISSN)\s*[\d\-]+/i.test(trimmed) && trimmed.length < 80) continue;
      if (/^(?:Topic|Chapter|Unit|Section)\s+\d+\s+[A-Z\s]+\d{1,3}$/i.test(trimmed)) continue;
      if (/^\d{1,3}$/.test(trimmed) && trimmed.length <= 3) continue;

      filteredLines.push(line);
    }

    return filteredLines.join('\n').trim() || "*(经过智能降噪过滤，未包含非考点核心文本)*";
  }

  // 旧版 PyMuPDF 纯文本模式
  const topicNames: string[] = [];
  if (Array.isArray(directoryItems)) {
    for (const item of directoryItems) {
      const title = item.title || "";
      const topicMatch = title.match(/^(Topic\s+\d+.*)$/i);
      if (topicMatch) {
        topicNames.push(topicMatch[1].toUpperCase());
      }
    }
  }

  const headerPatterns: RegExp[] = [];
  if (topicNames.length > 0) {
    for (const topicName of topicNames) {
      const escapedName = topicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      headerPatterns.push(new RegExp(`^\\d{1,3}\\s+${escapedName}$`));
      headerPatterns.push(new RegExp(`^${escapedName}\\s+\\d{1,3}$`));
    }
  }
  headerPatterns.push(/^(?:Topic|Chapter|Unit|Section)\s+\d+\s+[A-Z\s]+\d{1,3}$/i);

  const footerPatterns = [
    /(?:出版社|Publishing|Copyright|All\s+rights\s+reserved|版权所有|©)/i,
    /(?:www\.|http:\/\/|https:\/\/)/i,
    /(?:ISBN|ISSN)\s*[\d\-]+/i,
  ];

  const isHeaderOrFooter = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    if (/^[•\-]?\s*\d+\s*[•\-]?$/.test(trimmed)) return true;
    if (/^(?:第\s*\d+\s*页|page\s*\d+)/i.test(trimmed)) return true;

    if (footerPatterns.some(pat => pat.test(trimmed)) && trimmed.length < 80) return true;

    const cleaned = trimmed.replace(/[^A-Za-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    if (/^[A-Za-z0-9\s]+$/.test(cleaned)) {
      if (headerPatterns.some(pat => pat.test(cleaned))) return true;
    }

    return false;
  };

  const filteredLines: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      filteredLines.push('');
      continue;
    }
    if (isHeaderOrFooter(line)) continue;
    filteredLines.push(line);
  }

  return filteredLines.join('\n').trim() || "*(经过智能降噪过滤，未包含非考点核心文本)*";
}

/**
 * 根据目录条目与 PDF 实际页文本，自动计算印刷页 → 物理页的偏移量。
 * 印刷页码（目录上写的 P.15）和物理页码（PDF 第 20 页）通常因为封面、
 * 版权页、目录等前置页存在差异，offset 用于对齐两者。
 */
export function calculateAutoPageOffset(
  directoryItems: PageRef[],
  pdfPagesText: string[]
): number {
  if (!directoryItems || directoryItems.length === 0 || !pdfPagesText || pdfPagesText.length === 0) {
    return 0;
  }

  const offsets: number[] = [];

  const testItems = directoryItems
    .filter(item => {
      const p = parseInt(item.page || "", 10);
      return !isNaN(p) && p > 0;
    })
    .slice(0, 10);

  testItems.forEach(item => {
    const printedPage = parseInt(item.page, 10);
    const cleanTitle = item.title.replace(/[\s\.\-\:：、，。§§]+/g, "").trim().toLowerCase();
    if (cleanTitle.length < 3) return;

    const searchStart = 5;
    const searchLimit = Math.min(40, pdfPagesText.length);
    for (let pIdx = searchStart; pIdx < searchLimit; pIdx++) {
      const pageTextClean = pdfPagesText[pIdx].replace(/[\s\.\-\:：、，。§§]+/g, "").trim().toLowerCase();
      if (pageTextClean.includes(cleanTitle)) {
        const physicalPage = pIdx + 1;
        offsets.push(physicalPage - printedPage);
        break;
      }
    }
  });

  if (offsets.length === 0) {
    return 0;
  }

  const counts: Record<number, number> = {};
  let bestOffset = 0;
  let maxCount = 0;

  offsets.forEach(off => {
    counts[off] = (counts[off] || 0) + 1;
    if (counts[off] > maxCount) {
      maxCount = counts[off];
      bestOffset = off;
    }
  });

  return bestOffset;
}
