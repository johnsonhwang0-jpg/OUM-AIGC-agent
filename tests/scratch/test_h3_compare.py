#!/usr/bin/env python3
"""对比 HBEC2603 TOC 中的三级标题和实际识别的三级标题"""
import sqlite3, base64
import sys
sys.path.insert(0, '.')
from pdf_extractor_oxide import fix_headings_and_paragraphs
from pdf_oxide import PdfDocument
import fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()

if row:
    pdf_bytes = base64.b64decode(row[0])
    
    # 查看 TOC 中的三级标题
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    toc = doc.get_toc()
    print("=== TOC 中的三级标题 ===")
    toc_h3 = []
    for item in toc:
        level, title, page = item
        if level == 3:
            toc_h3.append(title)
            print(f"  {title} (Page {page})")
    doc.close()
    
    # 查看实际识别的三级标题
    doc2 = PdfDocument.from_bytes(pdf_bytes)
    print("\n=== 实际识别的三级标题 ===")
    recognized_h3 = []
    for page_idx in range(len(doc2)):
        md = doc2.to_markdown(page_idx, detect_headings=True)
        fixed = fix_headings_and_paragraphs(md)
        for line in fixed.split('\n'):
            if line.startswith('### ') and not line.startswith('#### '):
                # 提取标题文本（去掉 ### 前缀）
                title = line.replace('### ', '').strip()
                recognized_h3.append(title)
    
    for title in recognized_h3:
        print(f"  {title[:80]}")
    
    # 对比
    print(f"\n=== 对比 ===")
    print(f"TOC 三级标题数量: {len(toc_h3)}")
    print(f"识别三级标题数量: {len(recognized_h3)}")
    
    # 找 TOC 中有但没识别到的
    missing = []
    for toc_title in toc_h3:
        found = False
        for rec_title in recognized_h3:
            # 模糊匹配
            if toc_title.lower() in rec_title.lower() or rec_title.lower() in toc_title.lower():
                found = True
                break
        if not found:
            missing.append(toc_title)
    
    if missing:
        print(f"\nTOC 中有但未识别的三级标题 ({len(missing)} 个):")
        for title in missing:
            print(f"  {title}")
    else:
        print("\n所有 TOC 三级标题都已识别！")

conn.close()
