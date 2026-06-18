#!/usr/bin/env python3
"""检查 CBRE3103 教材的二级标题识别问题"""
import sqlite3, base64
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = PdfDocument.from_bytes(pdf_bytes)

# 检查前几页的原始输出
for page_idx in range(5):
    print(f"\n=== Page {page_idx + 1} ===")
    md = doc.to_markdown(page_idx, detect_headings=True)
    lines = md.split('\n')
    for i, line in enumerate(lines[:15]):
        if '1.1' in line or 'SOFTWARE' in line.upper() or 'REQUIREMENTS' in line.upper():
            print(f"  {i}: {repr(line)}")
