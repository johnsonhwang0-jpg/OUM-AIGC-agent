#!/usr/bin/env python3
"""
PDF 结构化提取服务 - 使用 PyMuPDF (fitz)
接收 Base64 PDF 数据和页码范围，返回带 Markdown 格式的文本

输入 (stdin JSON):
{
  "pdfData": "base64 string",
  "startPage": 1,
  "endPage": 10
}

输出 (stdout JSON):
{
  "pages": [
    {"pageNum": 1, "content": "..."},
    {"pageNum": 2, "content": "..."}
  ],
  "totalPages": 100
}
"""

import sys
import json
import base64
import re
import fitz  # PyMuPDF

def detect_heading_level(text: str, font_size: float, font_name: str, is_bold: bool) -> int:
    """根据文本特征判断标题层级"""
    text = text.strip()
    
    # 排除列表项模式 (a), (b), (c) 等 - 这些不是标题
    if re.match(r'^\([a-zA-Z]\)\s*$', text):
        return 0
    if re.match(r'^\([a-zA-Z]\)\s+.+', text):
        return 0  # (a) Some Text 也是列表项，不是标题
    
    # 排除纯数字或短文本（可能是页码）
    if re.match(r'^\d+\s*$', text) and len(text) <= 4:
        return 0
    
    # 排除单独的章节号（如 "1.1" 单独出现，通常是页脚）
    if re.match(r'^\d+\.\d+\s*$', text) and len(text) < 10:
        return 0
    
    # 排除包含数学符号的短文本（如 "N = {1, 2, 3}"）
    if re.search(r'[∈≠]', text) and len(text) < 50:
        return 0
    
    # 排除页眉/页脚模式（如 "TOPIC 1 NUMBERS" 后跟页码）
    if re.match(r'^(TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z\s]+$', text, re.IGNORECASE):
        return 0
    
    # 模式匹配优先
    if re.match(r'^\d+\.\d+\.\d+\s', text):
        return 3  # 三级标题
    if re.match(r'^\d+\.\d+\s', text) and not re.match(r'^\d+\.\d+\.\d+', text):
        return 2  # 二级标题
    if re.match(r'^(Topic|Chapter|Unit|Section)\s+\d+', text, re.IGNORECASE):
        return 1  # 一级标题
    
    # 字号判断（提高阈值，避免误判）
    if font_size >= 20 or (is_bold and font_size >= 18):
        return 1
    if font_size >= 16 or (is_bold and font_size >= 14):
        return 2
    if is_bold and font_size >= 13:
        return 3
    
    return 0  # 正文

def detect_list_item(text: str) -> tuple:
    """检测是否为列表项，返回 (是否为列表, 列表类型, 清理后的文本)"""
    # 有序列表: 1. xxx, 2) xxx, (1) xxx
    ordered_match = re.match(r'^(\d+)[\.\)]\s+(.*)', text)
    if ordered_match:
        return (True, 'ol', ordered_match.group(2))
    
    # 字母列表: (a) xxx, a) xxx, A) xxx
    alpha_match = re.match(r'^\(([a-zA-Z])\)\s+(.*)', text)
    if alpha_match:
        return (True, 'ol', alpha_match.group(2))
    
    # 单独的 (a), (b), (c) 也是列表项
    if re.match(r'^\([a-zA-Z]\)\s*$', text):
        return (True, 'ol', '')
    
    alpha_match2 = re.match(r'^([a-zA-Z])[\.\)]\s+(.*)', text)
    if alpha_match2:
        return (True, 'ol', alpha_match2.group(2))
    
    # 无序列表: • xxx, - xxx, * xxx, ‣ xxx
    unordered_match = re.match(r'^[•\-\*‣●○■□]\s+(.*)', text)
    if unordered_match:
        return (True, 'ul', unordered_match.group(1))
    
    return (False, '', text)

def extract_pages(pdf_data_b64: str, start_page: int, end_page: int):
    """提取指定页范围的 PDF 内容，保留段落、列表、标题结构"""
    pdf_bytes = base64.b64decode(pdf_data_b64)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    
    result_pages = []
    
    for page_num in range(start_page - 1, min(end_page, total_pages)):
        page = doc[page_num]
        
        # 使用 "dict" 模式提取，保留文本块结构
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        
        # 收集所有文本行，带位置信息
        text_items = []
        
        for block in blocks:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                y = round(line["bbox"][1])  # Y 坐标
                x = round(line["bbox"][0])  # X 坐标
                
                # 合并同一 span 的文本
                line_text = ""
                font_sizes = []
                font_names = []
                is_bold = False
                
                for span in line["spans"]:
                    text = span["text"]
                    if text.strip():
                        line_text += text
                        font_sizes.append(span["size"])
                        font_names.append(span["font"])
                        if span["flags"] & 2**4:  # bold flag
                            is_bold = True
                
                line_text = line_text.strip()
                if not line_text:
                    continue
                
                avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 12
                font_name = font_names[0] if font_names else ""
                
                text_items.append({
                    'text': line_text,
                    'y': y,
                    'x': x,
                    'font_size': avg_font_size,
                    'font_name': font_name,
                    'is_bold': is_bold
                })
        
        # 按 Y 坐标排序（从上到下）
        text_items.sort(key=lambda item: item['y'])
        
        # 合并同一行的文本（Y 坐标差 <= 5px 且 X 坐标差 <= 25px，避免合并列表项标记和正文）
        merged_lines = []
        current_line = None
        
        for item in text_items:
            if current_line and abs(item['y'] - current_line['y']) <= 5 and abs(item['x'] - current_line['x']) <= 25:
                # 同行，合并
                current_line['text'] += ' ' + item['text']
                current_line['font_size'] = max(current_line['font_size'], item['font_size'])
                if item['is_bold']:
                    current_line['is_bold'] = True
            else:
                if current_line:
                    merged_lines.append(current_line)
                current_line = item.copy()
        
        if current_line:
            merged_lines.append(current_line)
        
        # 合并连续的标题行（例如 "1.1" + "NUMBER SYSTEM" → "1.1 NUMBER SYSTEM"）
        # 只有当标题在合理距离内（Y差 <= 30px 且 X差 <= 50px）才合并
        heading_lines = []
        final_lines = []
        
        for item in merged_lines:
            heading_level = detect_heading_level(item['text'], item['font_size'], item['font_name'], item['is_bold'])
            if heading_level > 0:
                if heading_lines:
                    # 检查 Y 和 X 距离
                    y_diff = abs(item['y'] - heading_lines[-1]['y'])
                    x_diff = abs(item['x'] - heading_lines[-1]['x'])
                    if y_diff > 30 or x_diff > 50:
                        # 距离太远，不合并，先输出之前的标题
                        heading_lines.sort(key=lambda h: h['x'])
                        merged_text = ' '.join(h['text'] for h in heading_lines)
                        max_size = max(h['font_size'] for h in heading_lines)
                        any_bold = any(h['is_bold'] for h in heading_lines)
                        final_lines.append({
                            'text': merged_text,
                            'y': heading_lines[0]['y'],
                            'x': heading_lines[0]['x'],
                            'font_size': max_size,
                            'font_name': heading_lines[0]['font_name'],
                            'is_bold': any_bold
                        })
                        heading_lines = [item]
                    else:
                        heading_lines.append(item)
                else:
                    heading_lines.append(item)
            else:
                if heading_lines:
                    # 合并所有连续的标题行为一行，按 X 坐标排序确保正确顺序
                    heading_lines.sort(key=lambda h: h['x'])
                    merged_text = ' '.join(h['text'] for h in heading_lines)
                    max_size = max(h['font_size'] for h in heading_lines)
                    any_bold = any(h['is_bold'] for h in heading_lines)
                    final_lines.append({
                        'text': merged_text,
                        'y': heading_lines[0]['y'],
                        'x': heading_lines[0]['x'],
                        'font_size': max_size,
                        'font_name': heading_lines[0]['font_name'],
                        'is_bold': any_bold
                    })
                    heading_lines = []
                final_lines.append(item)
        
        if heading_lines:
            heading_lines.sort(key=lambda h: h['x'])
            merged_text = ' '.join(h['text'] for h in heading_lines)
            max_size = max(h['font_size'] for h in heading_lines)
            any_bold = any(h['is_bold'] for h in heading_lines)
            final_lines.append({
                'text': merged_text,
                'y': heading_lines[0]['y'],
                'x': heading_lines[0]['x'],
                'font_size': max_size,
                'font_name': heading_lines[0]['font_name'],
                'is_bold': any_bold
            })
        
        merged_lines = final_lines
        
        # 生成 Markdown
        md_lines = []
        in_list = False
        list_type = ''
        list_items = []
        pending_list_marker = None  # 待处理的列表标记（如 "(a)"）
        list_counter = 0  # 列表计数器
        
        def render_list_item(text):
            nonlocal list_counter
            if list_type == 'ul':
                md_lines.append(f'- {text}')
            elif list_type == 'ol':
                list_counter += 1
                md_lines.append(f'{list_counter}. {text}')
        
        def flush_list():
            nonlocal in_list, list_type, list_items, list_counter
            if list_items:
                for li in list_items:
                    render_list_item(li)
                md_lines.append('')  # 列表后空一行
            in_list = False
            list_type = ''
            list_items = []
            list_counter = 0
        
        # 计算段落分隔阈值
        y_coords = [item['y'] for item in merged_lines]
        y_diffs = [abs(y_coords[i+1] - y_coords[i]) for i in range(len(y_coords)-1)]
        avg_y_diff = sum(y_diffs) / len(y_diffs) if y_diffs else 15
        paragraph_threshold = avg_y_diff * 1.8
        
        current_paragraph = []
        last_y = None
        
        def flush_paragraph():
            nonlocal current_paragraph
            if current_paragraph:
                md_lines.append(' '.join(current_paragraph))
                md_lines.append('')  # 段落后空一行
                current_paragraph = []
        
        for item in merged_lines:
            text = item['text']
            font_size = item['font_size']
            font_name = item['font_name']
            is_bold = item['is_bold']
            y = item['y']
            
            # 检测标题
            heading_level = detect_heading_level(text, font_size, font_name, is_bold)
            
            if heading_level > 0:
                # 标题：先结束当前段落和列表
                flush_paragraph()
                flush_list()
                pending_list_marker = None
                md_lines.append(f'{"#" * heading_level} {text}')
                md_lines.append('')
                last_y = y
                continue
            
            # 如果有待处理的列表标记，将当前文本追加到列表项
            if pending_list_marker:
                is_list, ltype, list_text = detect_list_item(text)
                if not is_list:
                    # 当前行不是列表标记，说明它是上一个列表标记的内容
                    if not in_list or list_type != 'ol':
                        flush_list()
                        in_list = True
                        list_type = 'ol'
                        list_counter = 0
                    render_list_item(text)
                    pending_list_marker = None
                    last_y = y
                    continue
            
            # 检测列表项
            is_list, ltype, list_text = detect_list_item(text)
            
            if is_list:
                # 列表：先结束当前段落
                flush_paragraph()
                if not in_list or list_type != ltype:
                    flush_list()
                    in_list = True
                    list_type = ltype
                    list_counter = 0
                
                # 如果列表文本为空，说明是单独的标记（如 "(a)"），等待下一行内容
                if not list_text:
                    pending_list_marker = item
                else:
                    render_list_item(list_text)
                last_y = y
                continue
            else:
                # 不是列表，但不结束当前列表（允许列表项之间有描述段落）
                pending_list_marker = None
            
            # 正文：检查是否是新段落
            if last_y is not None and abs(y - last_y) > paragraph_threshold:
                flush_paragraph()
            
            # 冒号结尾的文本强制换行（如 "The following are the main types of numbers:"）
            if text.rstrip().endswith(':'):
                current_paragraph.append(text)
                flush_paragraph()
                last_y = y
                continue
            
            # 单独的短粗文本（如页脚 "1.1"、页码 "2"）不加粗
            if is_bold and len(text) < 10 and re.match(r'^[\d\.\s]+$', text):
                formatted_text = text
            else:
                formatted_text = f'**{text}**' if is_bold else text
            current_paragraph.append(formatted_text)
            last_y = y
        
        # 刷新剩余内容
        flush_paragraph()
        flush_list()
        
        content = '\n'.join(md_lines).strip()
        if content:
            result_pages.append({
                'pageNum': page_num + 1,
                'content': content
            })
    
    doc.close()
    
    return {
        'pages': result_pages,
        'totalPages': total_pages
    }

def main():
    try:
        input_data = json.loads(sys.stdin.read())
        pdf_data = input_data['pdfData']
        start_page = input_data.get('startPage', 1)
        end_page = input_data.get('endPage', 9999)
        
        result = extract_pages(pdf_data, start_page, end_page)
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
