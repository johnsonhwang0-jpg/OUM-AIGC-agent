#!/usr/bin/env python3
"""查找包含 'A successful early English programme' 的页面"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import fix_headings_and_paragraphs
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()

if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = PdfDocument.from_bytes(pdf_bytes)
    
    for page_idx in range(len(doc)):
        md = doc.to_markdown(page_idx, detect_headings=True)
        if "A successful early English programme" in md or "broader educational goals" in md:
            print(f"=== 找到 Page {page_idx + 1} ===")
            fixed = fix_headings_and_paragraphs(md)
            print(fixed)
            break

conn.close()
