#!/usr/bin/env python3
"""测试 pdf_oxide 不同选项的效果"""
import sqlite3, base64
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = PdfDocument.from_bytes(pdf_bytes)

print("=== 检查 page 4 的 1.1 标题 ===")
md4 = doc.to_markdown(3, detect_headings=True)
lines = md4.split('\n')
for i, line in enumerate(lines[:15]):
    print(f"  {i}: {repr(line)}")

print("\n=== 检查 page 25 (1.1.2 Morality) ===")
md25 = doc.to_markdown(24, detect_headings=True)
lines = md25.split('\n')
for i, line in enumerate(lines[:20]):
    print(f"  {i}: {repr(line)}")
