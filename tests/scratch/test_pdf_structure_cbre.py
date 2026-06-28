#!/usr/bin/env python3
"""分析 CBRE3103 Page 4 的 PDF 结构，查看标题的坐标位置"""
import sqlite3, base64
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = fitz.open(stream=pdf_bytes, filetype="pdf")

page = doc[3]  # Page 4 (index 3)
print("=== Page 4 文本块分析（按 Y 坐标排序）===")
blocks = page.get_text("blocks")
# 按 Y 坐标排序
blocks_sorted = sorted(blocks, key=lambda b: b[1])

for i, block in enumerate(blocks_sorted[:20]):
    x0, y0, x1, y1, text, block_no, block_type = block
    print(f"Block {i}: Y={y0:.1f}-{y1:.1f}, X={x0:.1f}-{x1:.1f}")
    print(f"  Text: {repr(text[:120])}")
    print()

doc.close()
