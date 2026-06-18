#!/usr/bin/env python3
"""查找 HBEC2603 真正的正文页（包含 BACKGROUND OF TEACHING YOUNG LEARNERS）"""
import sqlite3, base64
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = fitz.open(stream=pdf_bytes, filetype="pdf")

# 检查 Page 10-30
for page_idx in range(9, 30):
    page = doc[page_idx]
    text = page.get_text()
    if 'BACKGROUND OF TEACHING' in text.upper() or ('1.1' in text and 'ATTITUDES' in text.upper()):
        print(f"\n=== Page {page_idx + 1} 包含目标内容 ===")
        lines = text.split('\n')
        for i, line in enumerate(lines[:15]):
            if 'BACKGROUND' in line.upper() or '1.1' in line or 'ATTITUDES' in line.upper() or 'LEARNERS' in line.upper():
                print(f"  Line {i}: {line[:100]}")

doc.close()
