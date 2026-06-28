#!/usr/bin/env python3
"""查看 pdf_oxide 原始输出的段落情况"""
import sqlite3, base64
from pdf_oxide import PdfDocument

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()

if row:
    pdf_bytes = base64.b64decode(row[0])
    doc = PdfDocument.from_bytes(pdf_bytes)
    
    print("=== CBRE3103 Page 20 原始输出 ===")
    md = doc.to_markdown(19, detect_headings=True)
    
    # 显示原始输出的每一行
    lines = md.split('\n')
    for i, line in enumerate(lines[:20]):
        if not line.strip():
            print(f"  {i}: [空行]")
        else:
            print(f"  {i}: {line[:120]}")
            # 显示行尾的特殊字符
            if '  ' in line:
                print(f"      (包含双空格)")

conn.close()
