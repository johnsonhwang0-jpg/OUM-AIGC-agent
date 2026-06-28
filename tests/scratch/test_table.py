#!/usr/bin/env python3
"""测试 HBEC2603 Page 23 的表格提取"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import extract_with_oxide

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()

if row:
    pdf_bytes = base64.b64decode(row[0])
    
    import fitz
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    toc_titles = set()
    for item in doc.get_toc():
        toc_titles.add(item[1])
    doc.close()
    
    result = extract_with_oxide(pdf_bytes, 23, 23, toc_titles)
    
    print("=== 提取结果 ===")
    for page in result.get('pages', []):
        print(f"\n--- Page {page['pageNum']} ---")
        print(page['content'])

conn.close()
