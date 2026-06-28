#!/usr/bin/env python3
"""查看段落分段情况（完整内容）"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import fix_headings_and_paragraphs
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()

if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = PdfDocument.from_bytes(pdf_bytes)
    
    # 查看 Page 20 的段落情况
    print("=== CBRE3103 Page 20 完整内容 ===")
    md = doc.to_markdown(19, detect_headings=True)
    fixed = fix_headings_and_paragraphs(md)
    
    print(fixed[:2000])

conn.close()
