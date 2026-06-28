#!/usr/bin/env python3
"""查看 HBEC2603 Page 4 的原始输出"""
import sqlite3, base64
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = PdfDocument.from_bytes(pdf_bytes)

print("=== Page 4 原始输出 ===")
md = doc.to_markdown(3, detect_headings=True)
lines = md.split('\n')
for i, line in enumerate(lines[:20]):
    print(f"  {i}: {repr(line)}")
