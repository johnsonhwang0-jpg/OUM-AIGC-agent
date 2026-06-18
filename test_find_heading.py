#!/usr/bin/env python3
"""查找包含 'BACKGROUND OF TEACHING YOUNG' 的PDF页面"""
import sqlite3, base64
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT name, pdfData FROM projects")
rows = cursor.fetchall()
conn.close()

for name, pdf_data in rows:
    if 'CBRE' in name.upper():
        continue
    try:
        pdf_bytes = base64.b64decode(pdf_data)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for page_idx in range(min(30, len(doc))):
            page = doc[page_idx]
            text = page.get_text()
            if 'BACKGROUND OF TEACHING' in text.upper() or 'ATTITUDES AND APPROACHES' in text.upper():
                print(f"\n=== {name} - Page {page_idx + 1} ===")
                lines = text.split('\n')
                for i, line in enumerate(lines[:15]):
                    if 'BACKGROUND' in line.upper() or '1.1' in line or 'ATTITUDES' in line.upper() or 'LEARNERS' in line.upper():
                        print(f"  Line {i}: {line[:100]}")
        
        doc.close()
    except Exception as e:
        pass
