#!/usr/bin/env python3
"""验证红action是否真的删除了页眉文本"""
import sqlite3, base64, fitz, re
from collections import Counter

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])

def normalize_spaces(text):
    return re.sub(r'\s+', ' ', text).strip()

# 分析页眉
doc = fitz.open(stream=pdf_bytes, filetype="pdf")
total_pages = min(doc.page_count, 30)
top_texts = []
for page_num in range(total_pages):
    page = doc[page_num]
    rect = page.rect
    page_height = rect.height
    header_zone = fitz.Rect(0, 0, rect.width, page_height * 0.15)
    for block in page.get_text("dict", clip=header_zone).get("blocks", []):
        if "lines" in block:
            for line in block["lines"]:
                text = "".join(span["text"] for span in line["spans"]).strip()
                if text and len(text) < 120:
                    y_pos = line["spans"][0]["origin"][1]
                    normalized = normalize_spaces(text).lower()
                    top_texts.append((normalized, text, y_pos, page_num))

top_counter = Counter(t[0] for t in top_texts)
threshold = max(2, int(total_pages * 0.2))
header_texts = {t for t, count in top_counter.items() if count >= threshold}
header_ys = [t[2] for t in top_texts if t[0] in header_texts]
header_zones = [(min(header_ys) - 5, max(header_ys) + 15)] if header_ys else []

print(f"Header zones: {header_zones}")

# 应用红action
for page in doc:
    rect = page.rect
    page_height = rect.height
    # 裁切
    crop_rect = fitz.Rect(rect.x0, rect.y0 + page_height * 0.10, rect.x1, rect.y1 - page_height * 0.08)
    page.set_cropbox(crop_rect)
    # 区域红action
    for (y0, y1) in header_zones:
        redact_rect = fitz.Rect(rect.x0, y0, rect.x1, y1)
        if page.rect.intersects(redact_rect):
            page.add_redact_annot(redact_rect)

# 应用红action
for page in doc:
    page.apply_redactions()

# 保存并重新打开
cleaned_bytes = doc.tobytes()
doc.close()

# 用 PyMuPDF 重新打开清理后的 PDF，检查页眉是否还在
cleaned_doc = fitz.open(stream=cleaned_bytes, filetype="pdf")
page19 = cleaned_doc[18]
print(f"\n=== Page 19 after redaction (PyMuPDF) ===")
full_text = page19.get_text()
for i, line in enumerate(full_text.split('\n')):
    if 'TOPIC' in line.upper() or 'REQUIREMENTS' in line.upper():
        print(f"  Line {i}: '{line}'")

# 用 pdf_oxide 提取
from pdf_oxide import PdfDocument
oxide_doc = PdfDocument.from_bytes(cleaned_bytes)
md = oxide_doc.to_markdown(18, detect_headings=True)
print(f"\n=== Page 19 after redaction (pdf_oxide) ===")
print(md[:300])
