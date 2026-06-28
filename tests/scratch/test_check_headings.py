#!/usr/bin/env python3
"""查看所有教材的三级标题识别情况"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import extract_with_oxide
from pdf_oxide import PdfDocument
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT name, pdfData FROM projects")
rows = cursor.fetchall()
conn.close()

for name, pdf_data in rows:
    print(f"\n{'='*60}")
    print(f"教材: {name}")
    print(f"{'='*60}")
    
    try:
        pdf_bytes = base64.b64decode(pdf_data)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        doc.close()
        
        result = extract_with_oxide(pdf_bytes, 0, total_pages - 1, 3)
        
        # 统计各级标题
        h2_count = 0
        h3_count = 0
        h4_count = 0
        
        for page in result.get('pages', []):
            content = page['content']
            for line in content.split('\n'):
                if line.startswith('## ') and not line.startswith('### '):
                    h2_count += 1
                elif line.startswith('### '):
                    h3_count += 1
                elif line.startswith('#### '):
                    h4_count += 1
        
        print(f"二级标题(##): {h2_count}")
        print(f"三级标题(###): {h3_count}")
        print(f"四级标题(####): {h4_count}")
        
        # 显示部分三级标题示例
        print("\n三级标题示例:")
        h3_lines = []
        for page in result.get('pages', [])[:5]:
            content = page['content']
            for line in content.split('\n'):
                if line.startswith('### '):
                    h3_lines.append(line)
        
        for line in h3_lines[:5]:
            print(f"  {line}")
        if len(h3_lines) > 5:
            print(f"  ... 还有 {len(h3_lines) - 5} 个三级标题")
        if len(h3_lines) == 0:
            print("  (无三级标题)")
        
    except Exception as e:
        import traceback
        print(f"  错误: {e}")
        traceback.print_exc()
