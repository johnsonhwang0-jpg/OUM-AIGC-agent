#!/usr/bin/env python3
"""
PDF 结构化提取服务 - 两阶段处理（PyMuPDF + pdf_oxide）

第一阶段：PyMuPDF 去除页眉页脚
- 获取页面尺寸
- 定义页眉区域（顶部Y坐标范围）
- 定义页脚区域（底部Y坐标范围）
- 裁剪页面区域（精确裁剪）

第二阶段：pdf_oxide 结构化提取
- 配置 ConversionOptions
  - detect_headings: true
  - include_images: true
  - reading_order_mode: ColumnAware
  - extract_tables: true
- 调用 to_markdown() 方法
- 获得 Markdown 格式文本（含标题层级 # ## ###）

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
import tempfile
import fitz  # PyMuPDF - 仅用于裁剪
from pdf_oxide import PdfDocument

def crop_pdf_bytes(pdf_bytes: bytes, header_ratio: float = 0.08, footer_ratio: float = 0.05) -> bytes:
    """
    第一阶段：使用 PyMuPDF 裁剪页眉页脚区域
    header_ratio: 页眉占页面高度的比例（默认 8%）
    footer_ratio: 页脚占页面高度的比例（默认 5%）
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    for page in doc:
        rect = page.rect
        page_height = rect.height
        
        # 计算裁剪区域：去掉顶部页眉和底部页脚
        new_rect = fitz.Rect(
            rect.x0,
            rect.y0 + page_height * header_ratio,  # 顶部裁剪
            rect.x1,
            rect.y1 - page_height * footer_ratio   # 底部裁剪
        )
        
        # 应用裁剪
        page.set_cropbox(new_rect)
    
    # 保存裁剪后的 PDF 到内存
    cropped_bytes = doc.tobytes()
    doc.close()
    return cropped_bytes


def extract_with_oxide(pdf_bytes: bytes, start_page: int, end_page: int, image_output_dir: str = None) -> dict:
    """
    第二阶段：使用 pdf_oxide 进行结构化提取
    """
    doc = PdfDocument.from_bytes(pdf_bytes)
    total_pages = doc.page_count()
    
    result_pages = []
    
    for page_num in range(start_page - 1, min(end_page, total_pages)):
        # 使用 to_markdown 方法，自动检测标题层级、表格等
        md_content = doc.to_markdown(
            page_num,
            detect_headings=True,
            reading_order="column_aware",
            extract_tables=True
        )
        
        page_info = {
            'pageNum': page_num + 1,
            'content': md_content.strip(),
            'images': []
        }
        
        # 提取图片（如果指定了输出目录）
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
    
    doc.close()
    
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
        
        # 第一阶段：PyMuPDF 裁剪页眉页脚
        cropped_bytes = crop_pdf_bytes(pdf_bytes)
        
        # 第二阶段：pdf_oxide 结构化提取
        result = extract_with_oxide(cropped_bytes, start_page, end_page, image_output_dir)
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
