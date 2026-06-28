#!/usr/bin/env python3
"""查看处理后的完整输出"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import fix_headings_and_paragraphs
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()

if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = PdfDocument.from_bytes(pdf_bytes)
    
    print("=== CBRE3103 Page 20 处理后输出 ===")
    md = doc.to_markdown(19, detect_headings=True)
    fixed = fix_headings_and_paragraphs(md)
    
    # 逐行显示
    lines = fixed.split('\n')
    for i, line in enumerate(lines):
        if not line.strip():
            print(f"  {i}: [空行]")
        else:
            print(f"  {i}: {repr(line[:150])}")

conn.close()
