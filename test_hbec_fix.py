#!/usr/bin/env python3
"""测试 HBEC2603 Page 21 的修复效果"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import fix_headings_and_paragraphs
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = PdfDocument.from_bytes(pdf_bytes)

md = doc.to_markdown(20, detect_headings=True)  # index 20 = Page 21
fixed = fix_headings_and_paragraphs(md)
fixed_lines = fixed.split('\n')

# 验证
print("=== 验证 ===")
for line in fixed_lines:
    if 'BACKGROUND' in line.upper() and '1.1' in line:
        print(f"二级标题: {line}")
        # 清理多余空格后比较
        cleaned = ' '.join(line.split())
        expected = '## 1.1 BACKGROUND OF TEACHING YOUNG LEARNERS: ATTITUDES AND APPROACHES IN TEACHING ENGLISH TO CHILDREN'
        if cleaned.upper() == expected.upper():
            print("  ✓ 修复成功")
        else:
            print(f"  ✗ 修复失败")
            print(f"  期望: {expected}")
            print(f"  实际: {cleaned}")
