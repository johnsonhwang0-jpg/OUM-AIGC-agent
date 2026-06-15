#!/usr/bin/env python3
"""
PDF 结构化提取服务 - 三阶段处理

第一阶段：PyMuPDF 页面裁切
- 去掉顶部 10% 和底部 8%（物理裁切页面内容）

第二阶段：pdf_oxide 结构化提取
- to_markdown(page, detect_headings=True, include_images=True)
- 获得 Markdown 格式文本（含标题层级 # ## ### ####）

第三阶段：后处理过滤
- 分析 PDF 的 TOC/Bookmarks，获取所有章节标题
- 过滤掉 pdf_oxide 从 TOC 注入的页眉行（如 "TOPIC 1 REQUIREMENTS ENGINEERING"）
- 过滤掉纯页码行、版权信息等

输入 (stdin JSON):
{
  "pdfData": "base64 string",
  "startPage": 1,
  "endPage": 10,
  "imageOutputDir": "/path/to/images"  // 可选
}

输出 (stdout JSON):
{
  "pages": [
    {"pageNum": 1, "content": "...", "images": [...]},
    {"pageNum": 2, "content": "...", "images": [...]}
  ],
  "totalPages": 100
}
"""

import sys
import json
import base64
import os
import re
import fitz  # PyMuPDF
from pdf_oxide import PdfDocument


def get_toc_titles(doc: fitz.Document) -> set:
    """从 PDF 的 TOC/Bookmarks 中提取所有章节标题（用于后续过滤）"""
    titles = set()
    toc = doc.get_toc()
    for item in toc:
        title = item[1].strip()
        if title:
            # 添加原始标题
            titles.add(title)
            # 添加归一化版本（去掉多余空格）
            normalized = re.sub(r'\s+', ' ', title).strip()
            titles.add(normalized)
            # 添加小写版本（用于不区分大小写匹配）
            titles.add(normalized.lower())
            titles.add(title.lower())
    return titles


def crop_pdf(pdf_bytes: bytes) -> bytes:
    """使用 PyMuPDF 裁切 PDF：去掉顶部 10% 和底部 8%"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    for page in doc:
        rect = page.rect
        page_height = rect.height
        crop_rect = fitz.Rect(
            rect.x0,
            rect.y0 + page_height * 0.10,
            rect.x1,
            rect.y1 - page_height * 0.08
        )
        page.set_cropbox(crop_rect)
    
    cleaned_bytes = doc.tobytes()
    doc.close()
    return cleaned_bytes


# 页眉页脚过滤正则模式
HEADER_FOOTER_PATTERNS = [
    # 纯页码（阿拉伯数字）
    r'^[•\-\–\—]?\s*\d{1,4}\s*[•\-\–\—]?$',
    # 罗马数字页码
    r'^[ivxlcdmIVXLCDM]{2,}$',
    # 页码 + 页
    r'^(?:第\s*\d+\s*页|page\s*\d+|\d+\s*[-—]\s*页)(?:\/共\s*\d+\s*页)?$',
    # 版权信息
    r'(?:出版社|Publishing|Copyright|All\s+rights\s+reserved|版权所有|©)',
    # 网址
    r'(?:www\.|http:\/\/|https:\/\/)[\w\.\-\/]+',
    # ISBN/ISSN
    r'(?:ISBN|ISSN)\s*[\d\-]+',
    # 单独的课程代码
    r'^[A-Z]{2,4}\d{3,4}$',
    # 页码 + TOPIC/Chapter/Unit/Section 标题（如 "2 TOPIC 1 ESTABLISHING COMMON GROUND"）
    r'^\d{1,3}\s+(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\'\'\u2019\-]+$',
    # TOPIC/Chapter/Unit/Section 标题 + 页码（如 "TOPIC 1 ESTABLISHING COMMON GROUND 2"）
    r'^(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\'\'\u2019\-]+\s+\d{1,3}$',
    # TOPIC/Chapter/Unit/Section 标题 + 特殊符号 + 页码（如 "TOPIC 2 ...  19"）
    r'^(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\'\'\u2019\-]+\s+[^\w\s]+\s*\d{1,3}$',
    # 特殊符号 + TOPIC/Chapter/Unit/Section 标题 + 页码（如 " TOPIC 2 ... 18"）
    r'^[^\w\s]+\s*(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\'\'\u2019\-]+\s+\d{1,3}$',
    # 特殊符号 + TOPIC/Chapter/Unit/Section 标题 + 特殊符号 + 页码（如 " TOPIC 2 ...  19"）
    r'^[^\w\s]+\s*(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\'\'\u2019\-]+\s+[^\w\s]+\s*\d{1,3}$',
]


def is_header_footer_line(text: str, toc_titles: set) -> bool:
    """检查一行是否是页眉/页脚，应该被过滤掉"""
    trimmed = text.strip()
    if not trimmed:
        return False
    
    # 移除 Markdown 标题前缀（# ## ### 等）以便匹配
    clean_text = re.sub(r'^#+\s*', '', trimmed).strip()
    
    # 1. 检查正则模式（页码、版权、网址等）
    for pattern in HEADER_FOOTER_PATTERNS:
        if re.search(pattern, trimmed, re.IGNORECASE):
            return True
        # 也检查清理后的文本（处理 Markdown 标题格式的页眉）
        if clean_text != trimmed and re.search(pattern, clean_text, re.IGNORECASE):
            return True
    
    # 2. 检查 "页码 + TOC标题" 格式（如 "4 TOPIC 1 REQUIREMENTS ENGINEERING"）
    # 只过滤带页码的，不过滤纯标题
    normalized = re.sub(r'\s+', ' ', clean_text).strip()
    normalized_lower = normalized.lower()
    for title in toc_titles:
        title_lower = title.lower() if not title.endswith('_lower') else title
        if len(title_lower) > 10:
            # 匹配 "数字 + 标题" 或 "标题 + 数字"
            if re.search(rf'^\d+\s+{re.escape(title_lower)}$', normalized_lower):
                return True
            if re.search(rf'^{re.escape(title_lower)}\s+\d+$', normalized_lower):
                return True
    
    return False


def is_page_number_line(text: str) -> bool:
    """检查是否是单独的页码行（如 **2**、** 3**、**4** 等）"""
    stripped = text.strip()
    if not stripped:
        return False
    # 匹配 Markdown 加粗的单独数字：**2**、** 3**、**4**、** 5 **
    if re.match(r'^\*{1,2}\s*\d{1,4}\s*\*{1,2}$', stripped):
        return True
    # 匹配纯数字（很短的）
    if re.match(r'^\d{1,4}$', stripped) and len(stripped) <= 4:
        return True
    return False


def is_bold_heading_pattern(text: str) -> tuple:
    """检查是否是加粗的标题模式（如 **1.1.2** **Development of Morality**）
    返回 (level, heading_text) 或 None
    """
    stripped = text.strip()
    # 匹配 **数字** **标题文本** 或 **数字.数字** **标题文本**
    m = re.match(r'^\*{1,2}\s*(\d+(?:\.\d+)*)\s*\*{1,2}\s+\*{1,2}\s*(.+?)\s*\*{1,2}$', stripped)
    if m:
        num_part = m.group(1)
        title_part = m.group(2)
        # 辅助标题（ACTIVITY/SELF-TEST 等）固定使用 H4
        if is_auxiliary_heading(title_part):
            return (4, f"{num_part} {title_part}")
        # 根据数字层级判断标题级别
        dots = num_part.count('.')
        level = min(dots + 1, 4)  # 1.1.1 -> 3级, 1.1 -> 2级, 1 -> 1级
        return (level, f"{num_part} {title_part}")
    return None


def is_heading_fragment(text: str) -> bool:
    """检查是否是标题的片段（没有标点结尾，且包含标题关键词）"""
    stripped = text.strip()
    if not stripped:
        return False
    # 以数字开头（如 1.1 Background...）
    if re.match(r'^\d+\.\d+', stripped):
        # 如果是完整的标题（包含冒号或长度较长），不是片段
        if ':' in stripped or len(stripped) > 40:
            return False
        # 如果结尾没有句号、问号、感叹号，可能是片段
        if not re.search(r'[.!?]$', stripped):
            return True
    return False


def split_multiple_headings(text: str) -> list:
    """将同一行中的多个标题分割成独立的标题行
    例如: "Text  1.1.1 Title  1.1.2 Title" -> ["1.1.1 Title", "1.1.2 Title"]
    """
    # 匹配 "数字.数字.数字" 后跟标题文本的模式
    pattern = r'(\d+\.\d+(?:\.\d+)*)\s+([A-Z][^\d]*(?=\s+\d+\.\d+|$))'
    matches = list(re.finditer(pattern, text))
    
    if len(matches) < 2:
        return None  # 不是多个标题
    
    results = []
    for match in matches:
        num_part = match.group(1)
        title_part = match.group(2).strip()
        # 辅助标题固定使用 H4
        if is_auxiliary_heading(title_part):
            level = 4
        else:
            dots = num_part.count('.')
            level = min(dots + 1, 4)
        prefix = '#' * level
        results.append(f"{prefix} {num_part} {title_part}")
    
    return results


def is_title_text_without_number(text: str) -> bool:
    """检查是否是标题文本但没有数字前缀
    例如: "Software Requirements and Requirements Engineering"
    特征：大写字母开头，没有句号结尾，不包含数字编号
    排除：包含 "Topic" 的行（通常是 TOC 标题）
    """
    stripped = text.strip()
    if not stripped:
        return False
    # 不以数字开头
    if re.match(r'^\d', stripped):
        return False
    # 不以 # 开头（不是 Markdown 标题）
    if stripped.startswith('#'):
        return False
    # 不以标点结尾
    if re.search(r'[.!?;:]$', stripped):
        return False
    # 排除包含 "Topic" 的行（通常是 TOC 标题，不是章节标题）
    if 'topic' in stripped.lower():
        return False
    # 包含多个大写字母开头的单词（标题特征）
    words = stripped.split()
    if len(words) >= 2:
        capitalized_count = sum(1 for w in words if w[0].isupper())
        if capitalized_count >= 2:
            return True
    return False


def extract_number_from_line(text: str) -> str:
    """从行中提取第一个数字编号（如 "1.1"）
    例如: "**1** 1.1  1.1.1 Software Requirements" -> "1.1"
    """
    # 匹配 "数字.数字" 模式
    match = re.search(r'\b(\d+\.\d+)\b', text)
    if match:
        return match.group(1)
    return None


# 辅助标题关键词（活动、自测、术语、总结、参考等）
AUXILIARY_HEADING_KEYWORDS = {'ACTIVITY', 'ACTIVITIES', 'SELF-TEST', 'SELF TEST', 'KEY TERMS', 'SUMMARY', 'REFERENCES', 'REFLECTION', 'FEEDBACK', 'EXERCISE', 'EXERCISES', 'QUIZ', 'PRACTICE', 'DISCUSSION', 'CHECKLIST'}


def is_auxiliary_heading(title: str) -> bool:
    """检查是否是辅助标题（活动、自测、术语等）"""
    upper = title.upper()
    return any(kw in upper for kw in AUXILIARY_HEADING_KEYWORDS)


def is_bold_number_heading(text: str) -> tuple:
    """检查是否是加粗的数字编号标题
    例如: "**1.1 REQUIREMENTS ENGINEERING**"
    返回 (level, heading_text) 或 None
    """
    stripped = text.strip()
    # 匹配 **数字.数字 文本** 模式
    m = re.match(r'^\*{1,2}\s*(\d+\.\d+(?:\.\d+)*)\s+(.+?)\s*\*{1,2}$', stripped)
    if m:
        num_part = m.group(1)
        title_part = m.group(2)
        # 辅助标题（ACTIVITY/SELF-TEST 等）固定使用 H4
        if is_auxiliary_heading(title_part):
            return (4, f"{num_part} {title_part}")
        dots = num_part.count('.')
        level = min(dots + 1, 4)
        return (level, f"{num_part} {title_part}")
    return None


def is_bold_number_only(text: str) -> str:
    """检查是否是纯加粗数字编号（如 **1.1**）
    返回数字编号或 None
    """
    stripped = text.strip()
    m = re.match(r'^\*{1,2}\s*(\d+\.\d+(?:\.\d+)*)\s*\*{1,2}$', stripped)
    if m:
        return m.group(1)
    return None


def split_merged_paragraphs(text: str) -> str:
    """分割被错误合并的段落（PDF 提取时多个段落被合并成一行，用3个或更多空格分隔）"""
    # 匹配模式：句号/问号/感叹号 + 3个或更多空格 + 大写字母开头的新句子
    # 例如: "...methods.   Teaching English..." -> "...methods.\n\nTeaching English..."
    # 注意：2个空格是正常句子分隔，不分割
    text = re.sub(r'([.!?])\s{3,}([A-Z])', r'\1\n\n\2', text)
    return text


def is_table_line(text: str) -> bool:
    """检查是否是 Markdown 表格行"""
    stripped = text.strip()
    # 表格内容行：| cell1 | cell2 |
    if stripped.startswith('|') and stripped.endswith('|'):
        # 排除分隔符行 |---|---|
        if not re.match(r'^\|[\s\-:|]+\|$', stripped):
            return True
    return False


def is_table_separator(text: str) -> bool:
    """检查是否是 Markdown 表格分隔符行"""
    stripped = text.strip()
    return bool(re.match(r'^\|[\s\-:|]+\|$', stripped))


def rebuild_table_with_pymupdf(pdf_bytes: bytes, page_idx: int) -> str:
    """使用 PyMuPDF 重建表格格式"""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_idx >= len(doc):
            doc.close()
            return ""
        
        page = doc[page_idx]
        blocks = page.get_text("dict")["blocks"]
        
        # 查找表格相关的文本块（基于 y 坐标排序）
        table_rows = []
        for block in blocks:
            if "lines" in block:
                for line in block["lines"]:
                    text = "".join(span["text"] for span in line["spans"]).strip()
                    if text:
                        y = line.get("bbox", (0,0,0,0))[1]
                        x = line.get("bbox", (0,0,0,0))[0]
                        table_rows.append((y, x, text))
        
        doc.close()
        
        # 按 y 坐标排序
        table_rows.sort(key=lambda r: (r[0], r[1]))
        
        # 简单的表格重建：假设每行是一个单元格
        # 这里需要根据实际表格结构调整
        return "\n".join([r[2] for r in table_rows])
    except Exception:
        return ""


def fix_table_empty_lines(md_content: str) -> str:
    """修复表格内的空行：表格分隔符和数据行之间不能有空行"""
    lines = md_content.split('\n')
    result = []
    in_table = False
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # 检测表格开始
        if is_table_line(stripped) or is_table_separator(stripped):
            in_table = True
            result.append(line)
            continue
        
        # 在表格中时，跳过空行
        if in_table:
            if not stripped:
                continue  # 跳过表格内的空行
            elif is_table_line(stripped):
                result.append(line)
            else:
                # 非表格行，表格结束
                in_table = False
                result.append(line)
        else:
            result.append(line)
    
    return '\n'.join(result)


def fix_fragmented_tables(md_content: str) -> str:
    """修复被碎片化的表格：
    1. 合并相邻的表格片段
    2. 清理空单元格
    3. 确保表格格式正确
    """
    lines = md_content.split('\n')
    result = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # 检查是否是表格行
        if is_table_line(stripped) or is_table_separator(stripped):
            # 收集所有连续的表格行
            table_lines = []
            while i < len(lines):
                s = lines[i].strip()
                if is_table_line(s) or is_table_separator(s):
                    table_lines.append(s)
                    i += 1
                elif not s:  # 跳过空行
                    i += 1
                    continue
                else:
                    break
            
            # 解析表格
            if table_lines:
                # 找到分隔符行的位置
                sep_idx = -1
                for idx, tl in enumerate(table_lines):
                    if is_table_separator(tl):
                        sep_idx = idx
                        break
                
                if sep_idx > 0:
                    # 有完整的表格结构
                    # 计算列数
                    header = table_lines[0]
                    num_cols = len([c for c in header.split('|') if c.strip()])
                    
                    # 清理表格：移除空行，合并多行单元格
                    cleaned_rows = []
                    for tl in table_lines:
                        if is_table_separator(tl):
                            # 生成分隔符行
                            cleaned_rows.append('|' + '|'.join(['---'] * num_cols) + '|')
                        else:
                            # 清理单元格
                            cells = [c.strip() for c in tl.split('|')[1:-1]]
                            # 如果单元格数量不匹配，补齐
                            while len(cells) < num_cols:
                                cells.append('')
                            cleaned_rows.append('|' + '|'.join(cells) + '|')
                    
                    # 添加清理后的表格（前面一个空行，后面一个空行，但表格内部不能有）
                    result.append('')
                    result.extend(cleaned_rows)
                    result.append('')
                else:
                    # 没有分隔符，直接输出
                    result.extend(table_lines)
            continue
        
        result.append(line)
        i += 1
    
    return '\n'.join(result)


def fix_headings_and_paragraphs(md_content: str, toc_titles: set = None) -> str:
    """修复标题和段落格式：
    1. 将 **1.1.2** **Title** 转换为 ### 1.1.2 Title
    2. 合并断裂的标题行
    3. 分割同一行中的多个标题
    4. 修复段落合并问题
    5. 合并标题文本和数字编号（如 "Software Requirements..." + "1.1" -> "## 1.1 Software Requirements..."）
    6. 合并 Markdown 标题和加粗编号（如 "## SOFTWARE REQUIREMENTS AND" + "**1.1 REQUIREMENTS ENGINEERING**" -> "## 1.1 SOFTWARE REQUIREMENTS AND REQUIREMENTS ENGINEERING"）
    7. 合并多段 Markdown 标题 + 中间加粗数字（如 "## BACKGROUND OF TEACHING YOUNG" + "**1.1**" + "## LEARNERS:..." + "## CHILDREN"）
    8. 分割被错误合并的段落（3个或更多空格分隔的多个段落）
    9. 修复被碎片化的表格
    10. 处理列表项（如 (a), (b), (c) 或 1., 2., 3.）
    """
    if toc_titles is None:
        toc_titles = set()
    lines = md_content.split('\n')
    result = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # 跳过空行
        if not stripped:
            result.append('')
            i += 1
            continue
        
        # 过滤页眉页脚（在转换为 Markdown 标题之前）
        if is_header_footer_line(stripped, toc_titles):
            i += 1
            continue
        
        # 0. 先处理同一行中的多个标题（如 "Text  1.1.1 Title  1.1.2 Title"）
        split_result = split_multiple_headings(stripped)
        if split_result and not stripped.startswith('#'):
            # 检查是否有前缀文本（如 "Approaches in Teaching English to Children"）
            first_match = re.search(r'(\d+\.\d+(?:\.\d+)*)', stripped)
            if first_match:
                prefix_text = stripped[:first_match.start()].strip()
                if prefix_text:
                    # 前缀文本需要与前一行合并
                    if result and result[-1] and not result[-1].startswith('#'):
                        result[-1] = result[-1] + ' ' + prefix_text
                    else:
                        result.append(prefix_text)
            # 添加分割后的标题
            result.extend(split_result)
            i += 1
            continue
        
        # 0.5 处理列表项：检测 (a), (b), (c) 或 1., 2., 3. 等列表标记
        # 匹配模式：行首的 (a) 文本 或 a) 文本 或 1. 文本（只匹配小写字母）
        list_match = re.match(r'^\(?([a-z0-9]+)\)?\s+(.+)$', stripped)
        if list_match and not stripped.startswith('#'):
            marker = list_match.group(1)
            text = list_match.group(2)
            # 检查是否是列表标记（单个小写字母或1-2位数字）
            if re.match(r'^[a-z]$', marker) or re.match(r'^\d{1,2}$', marker):
                # 这是列表项，格式化为 - 标记 文本
                result.append(f'- ({marker}) {text}')
                i += 1
                continue
        
        # 0.6 处理行内的列表项：如 "text:   (a) **Set of Natural Numbers**"
        # 匹配模式：冒号 + 多个空格 + (a) 文本（只匹配小写字母）
        inline_list_match = re.search(r':\s{2,}\(?([a-z0-9]+)\)?\s+(.+)$', stripped)
        if inline_list_match and not stripped.startswith('#'):
            marker = inline_list_match.group(1)
            text = inline_list_match.group(2)
            prefix_text = stripped[:inline_list_match.start()].rstrip()
            # 检查是否是列表标记（单个小写字母或1-2位数字）
            if re.match(r'^[a-z]$', marker) or re.match(r'^\d{1,2}$', marker):
                # 前缀文本作为段落
                if prefix_text.endswith(':'):
                    result.append(prefix_text)
                    result.append('')
                else:
                    result.append(prefix_text)
                    result.append('')
                # 列表项
                result.append(f'- ({marker}) {text}')
                i += 1
                continue
        
        # 1. 检查是否是加粗标题模式 **1.1.2** **Title**
        heading_match = is_bold_heading_pattern(stripped)
        if heading_match:
            level, heading_text = heading_match
            prefix = '#' * level
            result.append(f"{prefix} {heading_text}")
            i += 1
            continue
        
        # 1.5 检查是否是加粗数字编号标题（如 **1.1.1 Emotional Development: Action, Communication**）
        # 并检查后续是否有 Markdown 标题片段需要合并
        bold_heading_match = is_bold_number_heading(stripped)
        if bold_heading_match:
            level, heading_text = bold_heading_match
            prefix = '#' * level
            
            # 跳过空行，找下一行非空内容
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            
            if j < len(lines):
                next_line = lines[j].strip()
                # 检查下一行是否是同级别的 Markdown 标题片段
                if next_line.startswith(prefix + ' '):
                    # 提取片段文本
                    fragment_match = re.match(r'^(#+)\s*(.+)$', next_line)
                    if fragment_match:
                        fragment_text = fragment_match.group(2).strip()
                        # 合并
                        merged_text = heading_text + ' ' + fragment_text
                        result.append(f"{prefix} {merged_text}")
                        result.append('')  # 保留标题后的空行
                        i = j + 1
                        continue
            
            # 没有后续片段，直接输出
            result.append(f"{prefix} {heading_text}")
            i += 1
            continue
        
        # 2. 检查是否是 Markdown 标题 + 加粗编号的组合
        # 模式 A: "## SOFTWARE REQUIREMENTS AND" + "**1.1 REQUIREMENTS ENGINEERING**"
        # 模式 B: "## BACKGROUND OF TEACHING YOUNG" + "**1.1**" + "## LEARNERS:..." + "## CHILDREN"
        if stripped.startswith('#'):
            # 提取标题级别和文本
            heading_match = re.match(r'^(#+)\s*(.+)$', stripped)
            if heading_match:
                level_prefix = heading_match.group(1)
                title_text = heading_match.group(2).strip()
                
                # 跳过空行，找下一行非空内容
                j = i + 1
                while j < len(lines) and not lines[j].strip():
                    j += 1
                
                if j < len(lines):
                    next_line = lines[j].strip()
                    
                    # 模式 A: 下一行是加粗的数字编号标题（如 **1.1 REQUIREMENTS ENGINEERING**）
                    bold_match = is_bold_number_heading(next_line)
                    if bold_match:
                        bold_level, bold_text = bold_match
                        # bold_text 格式: "1.1 REQUIREMENTS ENGINEERING"
                        # 提取数字编号和标题文本
                        bold_parts = bold_text.split(' ', 1)
                        if len(bold_parts) == 2:
                            bold_number = bold_parts[0]  # "1.1"
                            bold_title = bold_parts[1]   # "REQUIREMENTS ENGINEERING"
                            # 辅助标题固定使用 H4，否则根据数字编号的点数计算标题级别
                            if is_auxiliary_heading(bold_title):
                                correct_level = 4
                            else:
                                dots = bold_number.count('.')
                                correct_level = min(dots + 1, 4)
                            correct_prefix = '#' * correct_level
                            # 合并：数字编号 + 标题文本 + 加粗标题文本
                            merged_text = f"{bold_number} {title_text} {bold_title}"
                            result.append(f"{correct_prefix} {merged_text}")
                            result.append('')  # 保留标题后的空行
                            i = j + 1
                            continue
                    
                    # 模式 B: 下一行是纯加粗数字编号（如 **1.1**）
                    bold_number_only = is_bold_number_only(next_line)
                    if bold_number_only:
                        # 收集后续的 Markdown 标题片段
                        heading_parts = [title_text]
                        k = j + 1
                        while k < len(lines):
                            next_line2 = lines[k].strip()
                            # 如果是空行，跳过继续查找
                            if not next_line2:
                                k += 1
                                continue
                            # 检查是否是 Markdown 标题
                            if next_line2.startswith('#'):
                                heading_match2 = re.match(r'^(#+)\s*(.+)$', next_line2)
                                if heading_match2:
                                    heading_parts.append(heading_match2.group(2).strip())
                                    k += 1
                                    continue
                            # 不是标题，停止收集
                            break
                        
                        # 检查合并后的标题是否是辅助标题
                        merged_title = ' '.join(heading_parts)
                        if is_auxiliary_heading(merged_title):
                            correct_level = 4
                        else:
                            dots = bold_number_only.count('.')
                            correct_level = min(dots + 1, 4)
                        correct_prefix = '#' * correct_level
                        # 合并所有标题片段
                        merged_text = f"{bold_number_only} {' '.join(heading_parts)}"
                        result.append(f"{correct_prefix} {merged_text}")
                        result.append('')  # 保留标题后的空行
                        i = k
                        continue
        
        # 3. 检查是否是标题文本但没有数字前缀（需要与下一行合并）
        if is_title_text_without_number(stripped):
            # 跳过空行，找下一行非空内容
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                next_line = lines[j].strip()
                # 检查下一行是否包含数字编号
                number = extract_number_from_line(next_line)
                if number:
                    # 检查是否是辅助标题
                    if is_auxiliary_heading(stripped):
                        level = 4
                    else:
                        dots = number.count('.')
                        level = min(dots + 1, 4)
                    prefix = '#' * level
                    result.append(f"{prefix} {number} {stripped}")
                    result.append('')  # 保留标题后的空行
                    i = j + 1
                    continue
        
        # 4. 检查是否是断裂的标题行（需要合并）
        if is_heading_fragment(stripped):
            # 跳过空行，找下一行非空内容
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                next_line = lines[j].strip()
                # 如果下一行不是标题、不是新段落开头
                if next_line and not next_line.startswith('#') and not re.match(r'^\d+\.\d+', next_line):
                    # 合并当前行和下一行
                    merged = stripped + ' ' + next_line
                    # 检查合并后是否包含多个标题
                    split_result = split_multiple_headings(merged)
                    if split_result:
                        result.extend(split_result)
                        i = j + 1
                        continue
                    # 检查合并后是否还是片段
                    if not re.search(r'[.!?]$', merged):
                        # 继续查找后续片段
                        k = j + 1
                        while k < len(lines) and not lines[k].strip():
                            k += 1
                        if k < len(lines):
                            next_next = lines[k].strip()
                            if next_next and not next_next.startswith('#') and not re.match(r'^\d+\.\d+', next_next):
                                merged = merged + ' ' + next_next
                                # 再次检查是否包含多个标题
                                split_result = split_multiple_headings(merged)
                                if split_result:
                                    result.extend(split_result)
                                    i = k + 1
                                    continue
                                result.append(merged)
                                i = k + 1
                                continue
                        result.append(merged)
                        i = j + 1
                        continue
                    else:
                        result.append(merged)
                        i = j + 1
                        continue
        
        # 5. 处理普通行：修复段落合并
        # 如果当前行以连字符结尾（表示单词被断开），与下一行连接
        if stripped.endswith('-') and i + 1 < len(lines):
            next_stripped = lines[i + 1].strip()
            if next_stripped and not next_stripped.startswith('#'):
                # 去掉连字符，直接连接
                result.append(stripped[:-1] + next_stripped)
                i += 2
                continue
        
        # 6. 如果当前行不以标点结尾，且下一行是小写开头，可能是同一段落
        if (not re.search(r'[.!?;:]$', stripped) and 
            not stripped.endswith('-') and
            i + 1 < len(lines)):
            next_stripped = lines[i + 1].strip()
            if (next_stripped and 
                not next_stripped.startswith('#') and
                not re.match(r'^\d+\.\d+', next_stripped) and
                re.match(r'^[a-z]', next_stripped)):
                # 合并为同一段落
                result.append(stripped + ' ' + next_stripped)
                i += 2
                continue
        
        result.append(line)
        i += 1
    
    output = '\n'.join(result)
    # 最后两步：修复表格，然后分割被错误合并的段落
    output = fix_fragmented_tables(output)
    output = split_merged_paragraphs(output)
    return output


def filter_markdown_content(md_content: str, toc_titles: set) -> str:
    """过滤 Markdown 内容中的页眉页脚行"""
    lines = md_content.split('\n')
    filtered = []
    
    for line in lines:
        stripped = line.strip()
        
        # 空行保留
        if not stripped:
            filtered.append('')
            continue
        
        # 过滤单独的页码行（**2**、** 3** 等）
        if is_page_number_line(stripped):
            continue
        
        # 过滤加粗标题模式（会在后续 fix_headings_and_paragraphs 中处理）
        if is_bold_heading_pattern(stripped):
            filtered.append(line)
            continue
        
        # Markdown 标题行（# ## ### 等）全部保留，不过滤
        # 因为 TOC 中包含所有章节标题，如果过滤会导致合法标题被误删
        if stripped.startswith('#'):
            filtered.append(line)
            continue
        
        # 其他行：检查是否是页眉页脚
        if is_header_footer_line(stripped, toc_titles):
            continue  # 跳过页眉页脚
        
        filtered.append(line)
    
    return '\n'.join(filtered).strip()


def clean_pymupdf_table(table) -> str:
    """清理 PyMuPDF 提取的表格，去除重复列，生成 HTML 表格（支持合并单元格）"""
    data = table.extract()
    if not data:
        return ""
    
    num_cols = len(data[0]) if data else 0
    if num_cols == 0:
        return ""
    
    # 找出内容列：在数据行（跳过 header）中有实际内容的列
    content_cols = []
    for col_idx in range(num_cols):
        has_data = False
        for row_idx in range(1, len(data)):
            cell = data[row_idx][col_idx] if col_idx < len(data[row_idx]) else None
            if cell and cell.strip():
                has_data = True
                break
        if has_data:
            content_cols.append(col_idx)
    
    if not content_cols:
        return ""
    
    # 处理 header 行
    header_cells = []
    for col_idx in content_cols:
        cell = data[0][col_idx] if col_idx < len(data[0]) else None
        header_cells.append(cell.strip() if cell else "")
    
    # 如果 header 为空，尝试从相邻列获取标题
    if not any(h for h in header_cells):
        for col_idx in content_cols:
            for offset in [-1, 1, -2, 2]:
                adj_col = col_idx + offset
                if 0 <= adj_col < num_cols:
                    cell = data[0][adj_col] if adj_col < len(data[0]) else None
                    if cell and cell.strip():
                        header_cells[content_cols.index(col_idx)] = cell.strip()
                        break
    
    # 处理数据行：提取并清理单元格
    rows_data = []
    prev_values = [""] * len(content_cols)
    for row_idx in range(1, len(data)):
        row = data[row_idx]
        cells = []
        for i, col_idx in enumerate(content_cols):
            cell = row[col_idx] if col_idx < len(row) else None
            if cell is None or not cell.strip():
                cells.append(prev_values[i])
            else:
                cleaned = cell.strip().replace('\n', ' ')
                cells.append(cleaned)
                prev_values[i] = cleaned
        
        if all(not c for c in cells):
            continue
        rows_data.append(cells)
    
    if not rows_data:
        return ""
    
    # 计算每列的 rowspan：检测连续相同的值
    num_rows = len(rows_data)
    num_content_cols = len(content_cols)
    
    # rowspan[col][row] = 该单元格应该跨越的行数（0 表示被合并，不渲染）
    rowspan = [[1] * num_rows for _ in range(num_content_cols)]
    
    for col_idx in range(num_content_cols):
        row = 0
        while row < num_rows:
            if not rows_data[row][col_idx]:
                row += 1
                continue
            
            # 查找连续相同的值
            span = 1
            while row + span < num_rows and rows_data[row + span][col_idx] == rows_data[row][col_idx]:
                rowspan[col_idx][row + span] = 0  # 标记为被合并
                span += 1
            
            rowspan[col_idx][row] = span
            row += span
    
    # 生成 HTML 表格
    html_lines = []
    html_lines.append('<table class="w-full border-collapse my-4 text-xs">')
    
    # Header
    html_lines.append('<thead class="bg-cyan-500/10">')
    html_lines.append('<tr>')
    for h in header_cells:
        html_lines.append(f'<th class="text-left px-3 py-2 text-cyan-300 font-semibold border-r border-white/5 last:border-r-0">{h}</th>')
    html_lines.append('</tr>')
    html_lines.append('</thead>')
    
    # Body
    html_lines.append('<tbody>')
    for row_idx in range(num_rows):
        html_lines.append('<tr class="border-b border-white/10 hover:bg-white/5 transition">')
        for col_idx in range(num_content_cols):
            if rowspan[col_idx][row_idx] == 0:
                continue  # 被合并的单元格，跳过
            
            rs = rowspan[col_idx][row_idx]
            rs_attr = f' rowspan="{rs}"' if rs > 1 else ''
            cell_content = rows_data[row_idx][col_idx]
            html_lines.append(f'<td class="px-3 py-2 text-slate-300 border-r border-white/5 last:border-r-0 align-top"{rs_attr}>{cell_content}</td>')
        html_lines.append('</tr>')
    html_lines.append('</tbody>')
    
    html_lines.append('</table>')
    
    return '\n'.join(html_lines)


def remove_fragmented_tables(md_content: str) -> str:
    """移除 pdf_oxide 产生的碎片化表格内容"""
    lines = md_content.split('\n')
    result = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # 检测并跳过碎片化表格行
        if is_table_line(stripped) or is_table_separator(stripped):
            # 跳过所有连续的表格行和空行
            while i < len(lines):
                s = lines[i].strip()
                if is_table_line(s) or is_table_separator(s) or not s:
                    i += 1
                else:
                    break
            continue
        
        result.append(line)
        i += 1
    
    return '\n'.join(result)


def clean_table_fragments(md_content: str) -> str:
    """清理表格碎片文本（在 remove_fragmented_tables 之后调用）"""
    lines = md_content.split('\n')
    cleaned = []
    
    # 表格关键词（用于识别表格碎片）
    table_header_keywords = {"Stage", "Emotional Development", "Action"}
    
    # 表格单元格常见模式
    cell_patterns = [
        r"^They have", r"^They are", r"^They start", r"^They begin",
        r"^They show", r"^They display", r"^They love", r"^They learn",
        r"^makes them", r"^likely to", r"^of sadness", r"^association between",
        r"^outbursts and", r"^consequences\.$", r"^humour\.$",
        r"^regulate their", r"^control their", r"^proper and",
        r"^differences between", r"^impulse control", r"^unable to comprehend",
        r"^start to develop", r"^start showing", r"^start to express",
        r"^without difficulty", r"^patience\. They", r"^ask for permission",
        r"^belong to them", r"^throwing a tantrum", r"^getting physical",
        r"^snatch a toy", r"^hit, bite or push", r"^laugh if they find",
        r"^something funny", r"^sense of humour", r"^develop empathy",
        r"^recognise the feeling", r"^comprehend the", r"^emotional outbursts",
        r"^negative consequences", r"^fewer tantrums", r"^making people laugh",
        r"^silly and making", r"^sadness in others",
        r"^Three years", r"^Four years", r"^Five years", r"^old$",
        r"^In trying to", r"^They display patience",
    ]
    
    for line in lines:
        stripped = line.strip()
        
        # 跳过表格 header 碎片
        if stripped in table_header_keywords:
            continue
        
        # 跳过表格单元格碎片
        is_fragment = False
        for pattern in cell_patterns:
            if re.search(pattern, stripped, re.IGNORECASE):
                is_fragment = True
                break
        if is_fragment:
            continue
        
        cleaned.append(line)
    
    # 清理多余空行（最多保留 2 个连续空行）
    result = []
    empty_count = 0
    for line in cleaned:
        if not line.strip():
            empty_count += 1
            if empty_count <= 2:
                result.append(line)
        else:
            empty_count = 0
            result.append(line)
    
    return '\n'.join(result)


def convert_raw_text_to_markdown(raw_text: str) -> str:
    """将 extract_text_auto 的原始文本转换为 Markdown 格式。
    保留公式符号，应用标题检测和段落格式化。
    """
    # 替换 Unicode 私有区域字符为正确的数学符号
    char_map = {
        '\uf03d': '=',   # 等号
        '\uf02d': '-',   # 减号/负号
        '\uf075': '',    # 图标（移除）
        '\uf0ec': '{',   # 左花括号
        '\uf0fc': '',    # 空
        '\uf0ce': '∈',   # 属于
        '\uf0b9': ':',   # 冒号
        '\uf0ed': '',    # 空
        '\uf0fd': '}',   # 右花括号
        '\uf0ee': '',    # 空
        '\uf0fe': '',    # 空
    }
    for old_char, new_char in char_map.items():
        raw_text = raw_text.replace(old_char, new_char)
    
    lines = raw_text.split('\n')
    result = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            result.append('')
            continue
        
        # 分离 "NUMBER SYSTEM 1.1" 模式
        heading_match = re.match(r'^([A-Z][A-Z\s]+?)\s+(\d+\.\d+(?:\.\d+)*)\s*$', stripped)
        if heading_match:
            title = heading_match.group(1).strip()
            num = heading_match.group(2)
            # 辅助标题固定使用 H4
            if is_auxiliary_heading(title):
                level = 4
            else:
                dots = num.count('.')
                level = min(dots + 1, 4)
            hashes = '#' * level
            result.append(f'{hashes} {num} {title}')
            result.append('')
            continue
        
        # 检测标题模式
        bold_heading = re.match(r'^(\d+\.\d+(?:\.\d+)*)\s+(.+)$', stripped)
        if bold_heading and not stripped.endswith('.'):
            num = bold_heading.group(1)
            title = bold_heading.group(2)
            # 辅助标题固定使用 H4
            if is_auxiliary_heading(title):
                hashes = '####'
            else:
                dots = num.count('.')
                level = min(dots + 1, 4)
                hashes = '#' * level
            result.append(f'{hashes} {num} {title}')
            continue
        
        # 纯大写标题（Topic/Chapter 级别，固定为 H2）
        if stripped.isupper() and len(stripped) > 3 and len(stripped) < 60:
            if not re.match(r'^(TOPIC|PAGE|CHAPTER)\s+\d', stripped):
                result.append(f'## {stripped}')
                continue
        
        # 处理行内的列表项：分割 "(a) text (b) text" 为多行
        # 使用更精确的模式：只匹配 (a-z) 或 (1-2位数字)，排除大写字母
        list_pattern = r'\(([a-z0-9]+)\)\s+'
        matches = list(re.finditer(list_pattern, stripped))
        
        if len(matches) >= 1:
            # 有列表标记，分割处理
            parts = []
            last_end = 0
            
            for match in matches:
                marker = match.group(1)
                # 检查是否是有效的列表标记（单个字母或1-2位数字）
                if re.match(r'^[a-z]$', marker, re.IGNORECASE) or re.match(r'^\d{1,2}$', marker):
                    # 添加标记前的文本
                    if match.start() > last_end:
                        prefix = stripped[last_end:match.start()].strip()
                        if prefix:
                            parts.append(prefix)
                    # 提取列表项内容（从标记后到下一个标记前）
                    start = match.end()
                    # 找到下一个标记的位置
                    next_match = None
                    for m in matches:
                        if m.start() > match.start():
                            next_match = m
                            break
                    
                    if next_match:
                        content = stripped[start:next_match.start()].strip()
                    else:
                        content = stripped[start:].strip()
                    
                    if content:
                        parts.append(f'- ({marker}) {content}')
                    last_end = next_match.start() if next_match else len(stripped)
            
            # 添加剩余文本
            if last_end < len(stripped):
                remaining = stripped[last_end:].strip()
                if remaining:
                    parts.append(remaining)
            
            if parts:
                result.extend(parts)
            else:
                result.append(stripped)
        else:
            # 普通文本
            result.append(stripped)
    
    return '\n'.join(result)


def extract_with_oxide(pdf_bytes: bytes, start_page: int, end_page: int, 
                       toc_titles: set, image_output_dir: str = None) -> dict:
    """使用 pdf_oxide 进行结构化提取 + 后处理过滤"""
    doc = PdfDocument.from_bytes(pdf_bytes)
    total_pages = doc.page_count()
    
    # 同时用 PyMuPDF 打开，用于表格提取
    fitz_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    result_pages = []
    
    for page_num in range(start_page - 1, min(end_page, total_pages)):
        # 使用 extract_text_auto 获取原始文本（保留公式符号）
        raw_text = doc.extract_text_auto(page_num)
        
        # 将原始文本转换为 Markdown 格式
        md_content = convert_raw_text_to_markdown(raw_text)
        
        # 尝试用 PyMuPDF 提取表格并替换碎片化的表格
        try:
            fitz_page = fitz_doc[page_num]
            tabs = fitz_page.find_tables()
            if tabs.tables:
                # 先移除碎片化的表格内容
                md_content = remove_fragmented_tables(md_content)
                # 再清理表格碎片文本
                md_content = clean_table_fragments(md_content)
                # 用 PyMuPDF 提取的表格替换 pdf_oxide 的碎片化表格
                for table in tabs.tables:
                    # 清理表格并生成正确的 Markdown 格式
                    table_md = clean_pymupdf_table(table)
                    if table_md:
                        # 将表格添加到内容末尾
                        md_content = md_content + "\n\n" + table_md
        except Exception as e:
            print(f"Warning: Table extraction failed for page {page_num + 1}: {e}", file=sys.stderr)
        
        # 后处理：先修复标题和段落格式（合并断裂标题、分割多标题行），同时过滤页眉
        fixed_content = fix_headings_and_paragraphs(md_content, toc_titles)
        
        # 后处理：修复表格内的空行（分隔符和数据行之间不能有空行）
        fixed_content = fix_table_empty_lines(fixed_content)
        
        # 后处理：再过滤页眉页脚（此时标题已正确分割）
        filtered_content = filter_markdown_content(fixed_content, toc_titles)
        
        page_info = {
            'pageNum': page_num + 1,
            'content': filtered_content,
            'images': []
        }
        
        # 收集图片信息 - 使用 PyMuPDF 提取图片
        if image_output_dir:
            os.makedirs(image_output_dir, exist_ok=True)
            try:
                fitz_page = fitz_doc[page_num]
                image_list = fitz_page.get_images(full=True)
                for idx, img_info in enumerate(image_list):
                    xref = img_info[0]
                    try:
                        base_image = fitz_doc.extract_image(xref)
                        if base_image:
                            img_data = base_image["image"]
                            img_ext = base_image["ext"]
                            img_width = base_image.get("width", 0)
                            img_height = base_image.get("height", 0)
                            
                            # 检查图片区域是否有文字（通过图片的边界框）
                            # 如果图片区域有文字覆盖，说明是装饰性背景图，跳过
                            # 如果图片区域没有文字，说明图片本身承载信息，保留
                            is_decorative = False
                            try:
                                # 获取图片在页面上的位置信息
                                img_rects = fitz_page.get_image_rects(xref)
                                if img_rects:
                                    # 取第一个矩形作为图片区域
                                    rect = img_rects[0]
                                    # 检查该区域内是否有文字
                                    text_dict = fitz_page.get_text("dict", clip=rect)
                                    for block in text_dict.get("blocks", []):
                                        if block.get("type") == 0:  # 文字块
                                            for line in block.get("lines", []):
                                                for span in line.get("spans", []):
                                                    if span.get("text", "").strip():
                                                        is_decorative = True
                                                        break
                                                if is_decorative:
                                                    break
                                        if is_decorative:
                                            break
                            except Exception:
                                # 如果无法获取图片位置，默认保留图片
                                is_decorative = False
                            
                            # 只保留非装饰性图片（图片区域内无文字）
                            if not is_decorative:
                                img_filename = f"page{page_num + 1}_img{idx + 1}.{img_ext}"
                                img_path = os.path.join(image_output_dir, img_filename)
                                with open(img_path, 'wb') as f:
                                    f.write(img_data)
                                page_info['images'].append({
                                    'filename': img_filename,
                                    'path': img_path,
                                    'width': img_width,
                                    'height': img_height
                                })
                    except Exception as img_err:
                        print(f"Warning: Failed to extract image {idx + 1} from page {page_num + 1}: {img_err}", file=sys.stderr)
            except Exception as e:
                print(f"Warning: Image extraction failed for page {page_num + 1}: {e}", file=sys.stderr)
        
        if page_info['content']:
            result_pages.append(page_info)
    
    fitz_doc.close()
    
    return {
        'pages': result_pages,
        'totalPages': total_pages
    }


def main():
    try:
        input_data = json.loads(sys.stdin.read())
        pdf_data_b64 = input_data['pdfData']
        start_page = input_data.get('startPage', 1)
        end_page = input_data.get('endPage', 9999)
        image_output_dir = input_data.get('imageOutputDir')
        
        # 解码 PDF 数据
        pdf_bytes = base64.b64decode(pdf_data_b64)
        
        # 第一阶段：从 PDF TOC 提取标题（用于后续过滤）
        print("Extracting TOC titles...", file=sys.stderr)
        temp_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        toc_titles = get_toc_titles(temp_doc)
        print(f"Found {len(toc_titles)} TOC titles", file=sys.stderr)
        temp_doc.close()
        
        # 第二阶段：PyMuPDF 页面裁切
        print("Cropping PDF pages...", file=sys.stderr)
        cropped_bytes = crop_pdf(pdf_bytes)
        
        # 第三阶段：pdf_oxide 结构化提取 + 后处理过滤
        print("Extracting with pdf_oxide...", file=sys.stderr)
        result = extract_with_oxide(cropped_bytes, start_page, end_page, toc_titles, image_output_dir)
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
