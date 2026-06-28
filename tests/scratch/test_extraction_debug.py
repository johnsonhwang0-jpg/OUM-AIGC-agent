#!/usr/bin/env python3
"""检查 pdf_oxide 输出的 "TOPIC 1 REQUIREMENTS ENGINEERING" 来自哪里"""
import sqlite3, base64, json, sys, os, tempfile

# 获取 CBRE3103 的 PDF
conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])

# 先用 PyMuPDF 清理
import fitz
from collections import Counter
import re

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

print(f"Header texts: {header_texts}")
print(f"Header zones: {header_zones}")

# 检查 page 19 的完整文本结构
page = doc[18]  # page 19 (0-indexed)
rect = page.rect
page_height = rect.height

print(f"\n=== Page 19 all text blocks ===")
for block in page.get_text("dict").get("blocks", []):
    if "lines" in block:
        for line in block["lines"]:
            text = "".join(span["text"] for span in line["spans"]).strip()
            y_pos = line["spans"][0]["origin"][1]
            bbox = line.get("bbox", [])
            if text:
                in_header_zone = len(header_zones) > 0 and header_zones[0][0] <= y_pos <= header_zones[0][1]
                print(f"  y={y_pos:.1f} bbox={bbox} in_header={in_header_zone}: '{text}'")

# 现在测试：先用 PyMuPDF 清理，再用 pdf_oxide 提取
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
    # 正则匹配红action
    HEADER_FOOTER_PATTERNS = [
        r'^[•\-\–\—]?\s*\d{1,4}\s*[•\-\–\—]?$',
        r'^[ivxlcdmIVXLCDM]+$',
        r'^(?:Topic|Chapter|Unit|Section|Module)\s+\d+\s+.+\s+\d{1,3}$',
        r'^\d{1,3}\s+(?:Topic|Chapter|Unit|Section|Module)\s+\d+',
        r'^[A-Z]{2,4}\d{3,4}$',
        r'^(?:COURSE\s+GUIDE|TABLE\s+OF\s+CONTENTS|REFERENCES)$',
    ]
    for block in page.get_text("dict").get("blocks", []):
        if "lines" in block:
            for line in block["lines"]:
                text = "".join(span["text"] for span in line["spans"]).strip()
                normalized = normalize_spaces(text)
                for pattern in HEADER_FOOTER_PATTERNS:
                    if re.search(pattern, normalized, re.IGNORECASE):
                        line_bbox = line.get("bbox")
                        if line_bbox:
                            redact_rect = fitz.Rect(line_bbox)
                            redact_rect.x0 -= 2
                            redact_rect.x1 += 2
                            redact_rect.y0 -= 2
                            redact_rect.y1 += 2
                            page.add_redact_annot(redact_rect)
                        break

for page in doc:
    page.apply_redactions()

cleaned_bytes = doc.tobytes()
doc.close()

# 用 pdf_oxide 提取 page 19
from pdf_oxide import PdfDocument
oxide_doc = PdfDocument.from_bytes(cleaned_bytes)
md = oxide_doc.to_markdown(18, detect_headings=True)
print(f"\n=== pdf_oxide output for page 19 (first 1000 chars) ===")
print(md[:1000])
oxide_doc.close()
