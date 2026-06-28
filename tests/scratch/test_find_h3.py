#!/usr/bin/env python3
"""查找包含三级标题的页面"""
import sqlite3, base64
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()

# 查看 HBEC2603
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    print("=== HBEC2603 查找包含 1.1.1 的页面 ===")
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        text = page.get_text()
        if '1.1.1' in text or '1.1.2' in text:
            print(f"\nPage {page_idx + 1} 包含三级标题")
            lines = text.split('\n')
            for i, line in enumerate(lines[:20]):
                if '1.1.1' in line or '1.1.2' in line or 'Emotional' in line or 'Morality' in line:
                    print(f"  Line {i}: {line[:100]}")

# 查看 CBRE3103
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    print("\n=== CBRE3103 查找包含 1.1.1 的页面 ===")
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        text = page.get_text()
        if '1.1.1' in text or '1.1.2' in text:
            print(f"\nPage {page_idx + 1} 包含三级标题")
            lines = text.split('\n')
            for i, line in enumerate(lines[:20]):
                if '1.1.1' in line or '1.1.2' in line or 'Software Requirements' in line:
                    print(f"  Line {i}: {line[:100]}")

conn.close()
