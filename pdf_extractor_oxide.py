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
]


def is_header_footer_line(text: str, toc_titles: set) -> bool:
    """检查一行是否是页眉/页脚，应该被过滤掉"""
    trimmed = text.strip()
    if not trimmed:
        return False
    
    # 1. 检查是否匹配 TOC 标题（pdf_oxide 从 TOC 注入的页眉）
    normalized = re.sub(r'\s+', ' ', trimmed).strip()
    normalized_lower = normalized.lower()
    for title in toc_titles:
        title_lower = title.lower() if not title.endswith('_lower') else title
        if normalized_lower == title_lower:
            return True
        # 也检查是否包含 TOC 标题（处理 "4 TOPIC 1 REQUIREMENTS ENGINEERING" 这种格式）
        if title_lower in normalized_lower and len(title_lower) > 10:
            return True
    
    # 2. 检查正则模式
    for pattern in HEADER_FOOTER_PATTERNS:
        if re.search(pattern, trimmed, re.IGNORECASE):
            return True
    
    # 3. 检查 "页码 + TOC标题" 格式（如 "4 TOPIC 1 REQUIREMENTS ENGINEERING"）
    for title in toc_titles:
        title_lower = title.lower()
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
        dots = num_part.count('.')
        level = min(dots + 1, 4)
        prefix = '#' * level
        results.append(f"{prefix} {num_part} {title_part}")
    
    return results


def fix_headings_and_paragraphs(md_content: str) -> str:
    """修复标题和段落格式：
    1. 将 **1.1.2** **Title** 转换为 ### 1.1.2 Title
    2. 合并断裂的标题行
    3. 分割同一行中的多个标题
    4. 修复段落合并问题
    """
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
        
        # 1. 检查是否是加粗标题模式 **1.1.2** **Title**
        heading_match = is_bold_heading_pattern(stripped)
        if heading_match:
            level, heading_text = heading_match
            prefix = '#' * level
            result.append(f"{prefix} {heading_text}")
            i += 1
            continue
        
        # 2. 检查是否是断裂的标题行（需要合并）
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
        
        # 3. 处理普通行：修复段落合并
        # 如果当前行以连字符结尾（表示单词被断开），与下一行连接
        if stripped.endswith('-') and i + 1 < len(lines):
            next_stripped = lines[i + 1].strip()
            if next_stripped and not next_stripped.startswith('#'):
                # 去掉连字符，直接连接
                result.append(stripped[:-1] + next_stripped)
                i += 2
                continue
        
        # 4. 如果当前行不以标点结尾，且下一行是小写开头，可能是同一段落
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
    
    return '\n'.join(result)


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


def extract_with_oxide(pdf_bytes: bytes, start_page: int, end_page: int, 
                       toc_titles: set, image_output_dir: str = None) -> dict:
    """使用 pdf_oxide 进行结构化提取 + 后处理过滤"""
    doc = PdfDocument.from_bytes(pdf_bytes)
    total_pages = doc.page_count()
    
    result_pages = []
    
    for page_num in range(start_page - 1, min(end_page, total_pages)):
        # 结构化提取
        md_content = doc.to_markdown(
            page_num,
            detect_headings=True,
            include_images=True,
            image_output_dir=image_output_dir
        )
        
        # 后处理：先修复标题和段落格式（合并断裂标题、分割多标题行）
        fixed_content = fix_headings_and_paragraphs(md_content)
        
        # 后处理：再过滤页眉页脚（此时标题已正确分割）
        filtered_content = filter_markdown_content(fixed_content, toc_titles)
        
        page_info = {
            'pageNum': page_num + 1,
            'content': filtered_content,
            'images': []
        }
        
        # 收集图片信息
        if image_output_dir:
            os.makedirs(image_output_dir, exist_ok=True)
            try:
                page_images = doc.extract_images(page_num)
                for idx, img in enumerate(page_images):
                    img_data = img.get('data')
                    if img_data:
                        img_filename = f"page{page_num + 1}_img{idx + 1}.{img.get('format', 'png').lower()}"
                        img_path = os.path.join(image_output_dir, img_filename)
                        with open(img_path, 'wb') as f:
                            f.write(img_data)
                        page_info['images'].append({
                            'filename': img_filename,
                            'path': img_path,
                            'width': img.get('width'),
                            'height': img.get('height')
                        })
            except Exception as e:
                print(f"Warning: Image extraction failed for page {page_num + 1}: {e}", file=sys.stderr)
        
        if page_info['content']:
            result_pages.append(page_info)
    
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
