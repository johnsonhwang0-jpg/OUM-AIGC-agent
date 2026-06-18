#!/usr/bin/env python3
"""检查 PDF 原始结构"""
import sqlite3, base64
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = fitz.open(stream=pdf_bytes, filetype="pdf")

# 检查 page 4 (index 3) 的文本块
print("=== Page 4 text blocks ===")
page = doc[3]
blocks = page.get_text("blocks")
for i, block in enumerate(blocks[:15]):
    x0, y0, x1, y1, text, block_no, block_type = block
    print(f"  Block {i}: y={y0:.1f}-{y1:.1f} '{text[:80]}'")

print("\n=== Page 25 text blocks (1.1.2 Morality) ===")
page25 = doc[24]
blocks25 = page25.get_text("blocks")
for i, block in enumerate(blocks25[:15]):
    x0, y0, x1, y1, text, block_no, block_type = block
    print(f"  Block {i}: y={y0:.1f}-{y1:.1f} '{text[:80]}'")

doc.close()
