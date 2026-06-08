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
        
        # Markdown 标题行（# ## ### 等）需要特殊处理
        if stripped.startswith('#'):
            # 提取标题文本（去掉 # 和空格）
            title_text = re.sub(r'^#+\s*', '', stripped).strip()
            # 检查标题文本本身是否是页眉
            if is_header_footer_line(title_text, toc_titles):
                continue  # 跳过这个页眉标题
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
        
        # 后处理：过滤页眉页脚
        filtered_content = filter_markdown_content(md_content, toc_titles)
        
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
