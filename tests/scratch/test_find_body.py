#!/usr/bin/env python3
"""查找 CBRE3103 真正的正文页（包含 1.1 SOFTWARE REQUIREMENTS AND）"""
import sqlite3, base64
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = fitz.open(stream=pdf_bytes, filetype="pdf")

# 检查 Page 11-20
for page_idx in range(10, 20):
    page = doc[page_idx]
    text = page.get_text()
    if 'SOFTWARE REQUIREMENTS' in text.upper() and '1.1' in text:
        print(f"\n=== Page {page_idx + 1} 包含目标内容 ===")
        lines = text.split('\n')
        for i, line in enumerate(lines[:20]):
            if 'SOFTWARE' in line.upper() or '1.1' in line or 'REQUIREMENTS' in line.upper():
                print(f"  Line {i}: {line[:100]}")

doc.close()
