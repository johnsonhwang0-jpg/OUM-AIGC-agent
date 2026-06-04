import { DirectoryItem } from "../types";

/**
 * Extracts numeric parts of a chapter/topic string.
 * Example: "Topic 10" -> 10, "Chapter 3" -> 3, "第十二章" -> 12.
 */
function getChapterNumber(text: string): number | null {
  // Topic 12 -> 12
  let match = text.match(/Topic\s+(\d+)/i);
  if (match) return parseInt(match[1], 10);

  // Chapter 12 -> 12
  match = text.match(/Chapter\s+(\d+)/i);
  if (match) return parseInt(match[1], 10);

  // Unit 12 -> 12
  match = text.match(/Unit\s+(\d+)/i);
  if (match) return parseInt(match[1], 10);

  // 第12章 -> 12
  match = text.match(/第\s*(\d+)\s*(?:章|单元)/);
  if (match) return parseInt(match[1], 10);

  // 第十二章 -> 12
  match = text.match(/第\s*([一二三四五六七八九十百]+)\s*(?:章|单元)/);
  if (match) {
    return chineseToNumber(match[1]);
  }

  return null;
}

/**
 * Converted Chinese numerals representation to basic integer.
 */
function chineseToNumber(chinese: string): number {
  const chars: { [key: string]: number } = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  };
  if (chinese.length === 1) {
    return chars[chinese] || 1;
  }
  if (chinese.length === 2) {
    if (chinese[0] === '十') {
      return 10 + (chars[chinese[1]] || 0);
    }
    if (chinese[1] === '十') {
      return (chars[chinese[0]] || 1) * 10;
    }
  }
  if (chinese.length === 3) {
    if (chinese[1] === '十') {
      return (chars[chinese[0]] || 1) * 10 + (chars[chinese[2]] || 0);
    }
  }
  return 1;
}

/**
 * Parses raw text from standard textbook content or uploaded PDF text into a clean structured Directory format.
 * Focuses on extracting chapters, sub-chapters/sections, and corresponding page numbers.
 * Perfectly ignores post-TOC text stream duplicates by tracking sequence indices and page number regressions.
 */
export function parseTextToDirectory(text: string): DirectoryItem[] {
  if (!text) return [];

  // 1. Spacing normalizations
  let normalized = text
    .replace(/[\r\n]+/g, ' \n ') 
    .replace(/Ê/g, "'") // Character correction
    .replace(/â/g, "'")
    .replace(/\s+/g, ' ');

  // Drop common header and footer patterns that contaminate the tokens
  const trashPatterns = [
    /Copyright\s+©\s+Open\s+University\s+Malaysia\s*\(OUM\)/gi,
    /Table\s+of\s+Contents\s+[ivx\d]+\s*/gi,
    /TABLE\s+OF\s+CONTENTS\s+[ivx\d]+\s*/gi,
    /Table\s+of\s+Contents/gi,
    /TABLE\s+OF\s+CONTENTS/gi,
  ];

  trashPatterns.forEach(pat => {
    normalized = normalized.replace(pat, ' ');
  });

  normalized = normalized.trim();

  // 2. Identify all potential Heading Landmarks inside the text stream
  interface Landmark {
    index: number;
    text: string;
    type: 'chapter' | 'section';
    headingKey: string;
  }

  const landmarks: Landmark[] = [];

  // Identifies landmarks: Topic 1, Chapter 2, 1.1, 1.1.1, Summary, Key Terms, etc.
  const headingRegex = /\b(Topic\s+\d+|Chapter\s+\d+|Unit\s+\d+|Section\s+\d+|Summary|Key\s+Terms|Self-Test\s*\d*|References|Further\s+Reading)\b|\b\d+(?:\.\d+){1,2}\b|第\s*[\d一二三四五六七八九十百]+\s*(?:章|节|单元|讲)/gi;

  let match;
  while ((match = headingRegex.exec(normalized)) !== null) {
    const matchedText = match[0];
    const index = match.index;

    // Categorize into chapter level or sub-section level
    let type: 'chapter' | 'section' = 'section';
    if (/^(Topic|Chapter|Unit|第\s*[\d一二三四五六七八九十百]+\s*(?:章|单元))/i.test(matchedText)) {
      type = 'chapter';
    }

    landmarks.push({
      index,
      text: matchedText,
      type,
      headingKey: matchedText.trim()
    });
  }

  // Fallback if no landmarks found
  if (landmarks.length === 0) {
    return parseTextToDirectoryFallback(text);
  }

  // 3. Process landmarks chronologically, building a list of items.
  // We use strict truncation rules to detect when we have moved from the TOC indices into actual book content pages.
  const items: DirectoryItem[] = [];
  
  const seenChapterNumbers = new Set<number>();
  let maxChapterNumSeen = 0;
  let maxPageNumSeen = 0;

  for (let i = 0; i < landmarks.length; i++) {
    const current = landmarks[i];
    const next = landmarks[i + 1];

    const segmentStart = current.index + current.text.length;
    const segmentEnd = next ? next.index : normalized.length;
    const rawSegment = normalized.substring(segmentStart, segmentEnd).trim();

    // Heuristics 1: If there is an extremely long raw segment of prose text (e.g. > 2000 characters)
    // between two matched markers, it is a telltale sign that we have left the compact TOC list and entered the real prose content.
    if (rawSegment.length > 2000) {
      break; 
    }

    // Heuristics 2: Check for Chapter/Topic resets.
    // In a compact index, Chapter/Topic values will rise monotonically (1, 2, 3.. 10).
    // If they wrap back to 1, or go backwards, the directory table portion is ended.
    if (current.type === 'chapter') {
      const chNum = getChapterNumber(current.headingKey);
      if (chNum !== null) {
        if (seenChapterNumbers.has(chNum) || (maxChapterNumSeen > 2 && chNum < maxChapterNumSeen)) {
          // Detected TOC repetition / wrap-around! Stop parsing right here.
          break;
        }
        seenChapterNumbers.add(chNum);
        maxChapterNumSeen = Math.max(maxChapterNumSeen, chNum);
      }
    }

    let title = rawSegment;
    let page: string | undefined = undefined;

    // Tokens split
    const tokens = title.split(/\s+/).filter(Boolean);

    // Filter integer candidates for page numbering (usually the last digits)
    const integerIndices: number[] = [];
    tokens.forEach((t, idx) => {
      if (/^\d+$/.test(t)) {
        integerIndices.push(idx);
      }
    });

    if (integerIndices.length > 0) {
      const pageIndex = integerIndices[integerIndices.length - 1];
      const candidatePage = tokens[pageIndex];
      const pageNum = parseInt(candidatePage, 10);

      // 页码合理性检查：教材页码不应超过 1201
      if (!isNaN(pageNum) && pageNum > 0 && pageNum < 1201) {
        page = candidatePage;
      }

      // Remove the page number and wrap-around page indicators from the segment title
      const titleTokens = tokens.filter((t, idx) => {
        if (idx === pageIndex) return false;
        if (/^\d+$/.test(t) && t === candidatePage) return false;
        return true;
      });
      title = titleTokens.join(' ');
    }

    // Heuristics 3: Page Number regression check.
    // If page numbers have progressed up to e.g. 136, but suddenly go back to 1 or 2,
    // we have entered the body pages of Topic 1!
    if (page) {
      const pageNum = parseInt(page, 10);
      if (!isNaN(pageNum)) {
        // 页码回退检查：只有当页码回退非常显著（回到个位数或回退超过50页）时才中断
        // 放宽条件以兼容目录页码非严格递增的教材
        if (maxPageNumSeen > 50 && pageNum < maxPageNumSeen && (pageNum < 5 || pageNum < maxPageNumSeen - 50)) {
          break; // Page resets indicates we are inside the book body! Break.
        }
        maxPageNumSeen = Math.max(maxPageNumSeen, pageNum);
      }
    }

    // Clean padding
    title = title
      .replace(/^[\s.、:：\-–—_]+/g, '')
      .replace(/[\s.、:：\-–—_]+$/g, '')
      .trim();

    const finalTitle = current.headingKey + (title ? ` - ${title}` : '');

    items.push({
      id: `${current.type}-${i}-${Date.now()}`,
      type: current.type,
      title: finalTitle,
      page: page || "",
      level: current.type === 'chapter' ? 1 : 2
    });
  }

  // 4. Fill in missing page values sequentially
  let currentChapterPageNum = 1;
  let currentSectionOffset = 0;

  items.forEach(item => {
    if (item.page) {
      const parsed = parseInt(item.page, 10);
      if (!isNaN(parsed)) {
        if (item.type === 'chapter') {
          currentChapterPageNum = parsed;
          currentSectionOffset = 0;
        } else {
          currentChapterPageNum = parsed;
        }
      }
    } else {
      if (item.type === 'chapter') {
        currentChapterPageNum += 10;
        item.page = String(currentChapterPageNum);
      } else {
        currentSectionOffset += 2;
        item.page = String(currentChapterPageNum + currentSectionOffset);
      }
    }
  });

  return items;
}

/**
 * Robust line-by-line fallback parser for arbitrary text dumps lacking standard heading layouts.
 */
function parseTextToDirectoryFallback(text: string): DirectoryItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items: DirectoryItem[] = [];
  let chCount = 1;
  let secCount = 1;

  lines.forEach((line, idx) => {
    const trimmed = line.replace(/Ê/g, "'").trim();
    if (trimmed.length < 60) {
      if (trimmed.includes("章") || trimmed.includes("Chapter") || trimmed.includes("Topic") || idx === 0) {
        items.push({
          id: `ch-fallback-${idx}`,
          type: 'chapter',
          title: trimmed,
          page: String(chCount * 18 - 12),
          level: 1
        });
        chCount++;
        secCount = 1;
      } else {
        items.push({
          id: `sec-fallback-${idx}`,
          type: 'section',
          title: trimmed,
          page: String((chCount - 1) * 18 - 12 + secCount * 3),
          level: 2
        });
        secCount++;
      }
    } else {
      const short = trimmed.substring(0, 45) + "...";
      items.push({
        id: `sec-fallback-long-${idx}`,
        type: 'section',
        title: short,
        page: String((chCount - 1) * 18 - 12 + secCount * 3),
        level: 2
      });
      secCount++;
    }
  });

  return items;
}

/**
 * Regenerates the bookContentText plain text from a list of structured DirectoryItems
 */
export function serializeDirectoryToText(items: DirectoryItem[]): string {
  let text = "目录 & 课本章节提要：\n";
  items.forEach(item => {
    const pageStr = item.page ? ` (P.${item.page})` : '';
    if (item.type === 'chapter') {
      text += `${item.title}${pageStr}\n`;
    } else {
      text += `  - ${item.title}${pageStr}\n`;
    }
  });
  return text;
}
