#!/usr/bin/env python3
"""测试当前 fix_headings_and_paragraphs 对 CBRE3103 的处理"""
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

md = doc.to_markdown(3, detect_headings=True)

print("=== 原始输出 (Page 4 前20行) ===")
lines = md.split('\n')
for i, line in enumerate(lines[:20]):
    print(f"  {i}: {repr(line)}")

print("\n=== 处理后输出 ===")
fixed = fix_headings_and_paragraphs(md)
fixed_lines = fixed.split('\n')
for i, line in enumerate(fixed_lines[:20]):
    print(f"  {i}: {repr(line)}")
