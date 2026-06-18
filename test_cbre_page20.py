#!/usr/bin/env python3
"""测试 CBRE3103 Page 20 的修复效果"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import fix_headings_and_paragraphs
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = PdfDocument.from_bytes(pdf_bytes)

md = doc.to_markdown(19, detect_headings=True)  # index 19 = Page 20

print("=== 原始输出 (Page 20 前10行) ===")
lines = md.split('\n')
for i, line in enumerate(lines[:10]):
    print(f"  {i}: {repr(line)}")

print("\n=== 处理后输出 ===")
fixed = fix_headings_and_paragraphs(md)
fixed_lines = fixed.split('\n')
for i, line in enumerate(fixed_lines[:10]):
    print(f"  {i}: {repr(line)}")

# 验证
print("\n=== 验证 ===")
for line in fixed_lines:
    if 'SOFTWARE' in line.upper() and '1.1' in line:
        print(f"二级标题: {line}")
        if 'SOFTWARE REQUIREMENTS AND REQUIREMENTS ENGINEERING' in line.upper():
            print("  ✓ 修复成功")
        else:
            print("   修复失败")
