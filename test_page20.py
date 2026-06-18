#!/usr/bin/env python3
"""查看 CBRE3103 Page 20 的 pdf_oxide 原始输出"""
import sqlite3, base64
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = PdfDocument.from_bytes(pdf_bytes)

print("=== Page 20 原始输出 ===")
md = doc.to_markdown(19, detect_headings=True)  # index 19 = Page 20
lines = md.split('\n')
for i, line in enumerate(lines[:15]):
    print(f"  {i}: {repr(line)}")
