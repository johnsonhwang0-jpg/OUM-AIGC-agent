#!/usr/bin/env python3
"""测试三级标题的修复效果"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import fix_headings_and_paragraphs
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()

# 测试 HBEC2603 Page 22
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = PdfDocument.from_bytes(pdf_bytes)
    
    print("=== HBEC2603 Page 22 ===")
    md = doc.to_markdown(21, detect_headings=True)
    fixed = fix_headings_and_paragraphs(md)
    
    print("处理后包含 '1.1.1' 或 '###' 的行:")
    for line in fixed.split('\n'):
        if '1.1.1' in line or '1.1.2' in line or line.startswith('###'):
            print(f"  {line[:100]}")

# 测试 CBRE3103 Page 21
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = PdfDocument.from_bytes(pdf_bytes)
    
    print("\n=== CBRE3103 Page 21 ===")
    md = doc.to_markdown(20, detect_headings=True)
    fixed = fix_headings_and_paragraphs(md)
    
    print("处理后包含 '1.1.1' 或 '###' 的行:")
    for line in fixed.split('\n'):
        if '1.1.1' in line or '1.1.2' in line or line.startswith('###'):
            print(f"  {line[:100]}")

conn.close()
