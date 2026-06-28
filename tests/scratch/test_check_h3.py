#!/usr/bin/env python3
"""查看包含三级标题的页面的 pdf_oxide 原始输出"""
import sqlite3, base64
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()

# 查看 HBEC2603 Page 22 (包含 1.1.1)
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = PdfDocument.from_bytes(pdf_bytes)
    
    print("=== HBEC2603 Page 22 (包含 1.1.1) ===")
    md = doc.to_markdown(21, detect_headings=True)  # index 21 = Page 22
    lines = md.split('\n')
    for i, line in enumerate(lines[:25]):
        print(f"  {i}: {repr(line[:120])}")
    
    print("\n=== HBEC2603 Page 25 (包含 1.1.2) ===")
    md = doc.to_markdown(24, detect_headings=True)  # index 24 = Page 25
    lines = md.split('\n')
    for i, line in enumerate(lines[:25]):
        print(f"  {i}: {repr(line[:120])}")

# 查看 CBRE3103 Page 21 (包含 1.1.1)
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = PdfDocument.from_bytes(pdf_bytes)
    
    print("\n=== CBRE3103 Page 21 (包含 1.1.1) ===")
    md = doc.to_markdown(20, detect_headings=True)  # index 20 = Page 21
    lines = md.split('\n')
    for i, line in enumerate(lines[:25]):
        print(f"  {i}: {repr(line[:120])}")
    
    print("\n=== CBRE3103 Page 22 (包含 1.1.2) ===")
    md = doc.to_markdown(21, detect_headings=True)  # index 21 = Page 22
    lines = md.split('\n')
    for i, line in enumerate(lines[:25]):
        print(f"  {i}: {repr(line[:120])}")

conn.close()
