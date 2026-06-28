#!/usr/bin/env python3
"""查看 HBEC2603 的段落情况"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import extract_with_oxide
from pdf_oxide import PdfDocument
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()

if row:
    pdf_bytes = base64.b64decode(row[0])
    
    # 获取 TOC
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    toc_titles = set()
    for item in doc.get_toc():
        toc_titles.add(item[1])
    doc.close()
    
    # 提取 Page 22
    result = extract_with_oxide(pdf_bytes, 22, 22, toc_titles)
    
    print("=== HBEC2603 Page 22 处理后输出 ===")
    for page in result.get('pages', []):
        content = page['content']
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if not line.strip():
                print(f"  {i}: [空行]")
            else:
                print(f"  {i}: {repr(line[:120])}")

conn.close()
