#!/usr/bin/env python3
"""查看所有教材的三级标题识别情况（修复后）"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import fix_headings_and_paragraphs
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()

# 查看所有教材
cursor.execute("SELECT DISTINCT name FROM projects")
names = [row[0] for row in cursor.fetchall()]

for name in names:
    cursor.execute("SELECT pdfData FROM projects WHERE name = ? LIMIT 1", (name,))
    row = cursor.fetchone()
    if not row:
        continue
    
    print(f"\n{'='*60}")
    print(f"教材: {name}")
    print(f"{'='*60}")
    
    try:
        pdf_bytes = base64.b64decode(row[0])
        doc = PdfDocument.from_bytes(pdf_bytes)
        
        h3_count = 0
        h3_lines = []
        
        for page_idx in range(len(doc)):
            md = doc.to_markdown(page_idx, detect_headings=True)
            fixed = fix_headings_and_paragraphs(md)
            
            for line in fixed.split('\n'):
                if line.startswith('### ') and not line.startswith('#### '):
                    h3_count += 1
                    if len(h3_lines) < 10:
                        h3_lines.append(line)
        
        print(f"三级标题(###) 数量: {h3_count}")
        print("三级标题示例:")
        for line in h3_lines[:10]:
            print(f"  {line[:80]}")
        if h3_count > 10:
            print(f"  ... 还有 {h3_count - 10} 个")
        if h3_count == 0:
            print("  (无三级标题)")
        
    except Exception as e:
        print(f"  错误: {e}")

conn.close()
