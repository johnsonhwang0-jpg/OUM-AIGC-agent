#!/usr/bin/env python3
"""查看后端返回的完整内容格式"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import extract_with_oxide
from pdf_oxide import PdfDocument
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()

if row:
    pdf_bytes = base64.b64decode(row[0])
    
    # 获取 TOC
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    toc_titles = set()
    for item in doc.get_toc():
        toc_titles.add(item[1])
    doc.close()
    
    # 提取 Page 20-21
    result = extract_with_oxide(pdf_bytes, 20, 21, toc_titles)
    
    print("=== 后端返回的完整内容 ===")
    for page in result.get('pages', []):
        print(f"\n--- Page {page['pageNum']} ---")
        content = page['content']
        # 显示每一行（包括空行）
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if not line.strip():
                print(f"  {i}: [空行]")
            else:
                print(f"  {i}: {line[:100]}")
    
    # 查看原始字符串（显示转义字符）
    print("\n=== 原始字符串（前500字符） ===")
    if result.get('pages'):
        content = result['pages'][0]['content']
        print(repr(content[:500]))

conn.close()
