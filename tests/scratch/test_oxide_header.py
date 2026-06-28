#!/usr/bin/env python3
"""检查 pdf_oxide 的页眉来源"""
import sqlite3, base64, fitz

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])

# 检查 page 19 的完整内容，包括所有文本
doc = fitz.open(stream=pdf_bytes, filetype="pdf")
page = doc[18]  # page 19

print("=== Page 19 full text (get_text) ===")
full_text = page.get_text()
# 找 TOPIC 1 出现的位置
for i, line in enumerate(full_text.split('\n')):
    if 'TOPIC' in line or 'REQUIREMENTS' in line:
        print(f"  Line {i}: '{line}'")

print("\n=== Page 19 text blocks with positions ===")
for block in page.get_text("dict").get("blocks", []):
    if "lines" in block:
        for line in block["lines"]:
            text = "".join(span["text"] for span in line["spans"]).strip()
            if 'TOPIC' in text.upper() or 'REQUIREMENTS' in text.upper():
                y_pos = line["spans"][0]["origin"][1]
                bbox = line.get("bbox", [])
                print(f"  y={y_pos:.1f} bbox={bbox}: '{text}'")

# 检查 PDF 元数据
print("\n=== PDF Metadata ===")
metadata = doc.metadata
print(metadata)

# 检查 page 19 的 annotations
print("\n=== Page 19 Annotations ===")
for annot in page.annots() or []:
    print(f"  Type: {annot.type}, Rect: {annot.rect}, Contents: {annot.info.get('content', '')}")

doc.close()

# 现在测试：不用 PyMuPDF 裁切，直接用 pdf_oxide 提取原始 PDF
print("\n=== pdf_oxide on ORIGINAL page 19 ===")
from pdf_oxide import PdfDocument
oxide_doc = PdfDocument.from_bytes(pdf_bytes)
md = oxide_doc.to_markdown(18, detect_headings=True)
print(md[:500])
