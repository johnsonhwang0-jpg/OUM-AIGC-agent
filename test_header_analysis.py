#!/usr/bin/env python3
import sqlite3, base64, fitz, re
from collections import Counter

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

pdf_bytes = base64.b64decode(row[0])
doc = fitz.open(stream=pdf_bytes, filetype="pdf")
print(f"Total pages: {doc.page_count}")

# Analyze header/footer patterns
total_pages = min(doc.page_count, 20)
top_texts = []
bottom_texts = []

for page_num in range(total_pages):
    page = doc[page_num]
    rect = page.rect
    page_height = rect.height
    
    header_zone = fitz.Rect(0, 0, rect.width, page_height * 0.12)
    footer_zone = fitz.Rect(0, page_height * 0.88, rect.width, page_height)
    
    for block in page.get_text("dict", clip=header_zone).get("blocks", []):
        if "lines" in block:
            for line in block["lines"]:
                text = "".join(span["text"] for span in line["spans"]).strip()
                if text and len(text) < 100:
                    y_pos = line["spans"][0]["origin"][1]
                    top_texts.append((text, y_pos, page_num))
    
    for block in page.get_text("dict", clip=footer_zone).get("blocks", []):
        if "lines" in block:
            for line in block["lines"]:
                text = "".join(span["text"] for span in line["spans"]).strip()
                if text and len(text) < 100:
                    y_pos = line["spans"][0]["origin"][1]
                    bottom_texts.append((text, y_pos, page_num))

top_counter = Counter(t[0].strip().lower() for t in top_texts)
bottom_counter = Counter(t[0].strip().lower() for t in bottom_texts)

threshold = max(2, total_pages * 0.3)
print(f"\nThreshold: {threshold}")
print(f"\n=== TOP TEXTS (appearing >= {threshold} pages) ===")
for t, count in top_counter.most_common(30):
    marker = " <-- HEADER" if count >= threshold else ""
    print(f"  [{count}x] {t}{marker}")

print(f"\n=== BOTTOM TEXTS (appearing >= {threshold} pages) ===")
for t, count in bottom_counter.most_common(30):
    marker = " <-- FOOTER" if count >= threshold else ""
    print(f"  [{count}x] {t}{marker}")

# Also check pages 10-20 for what the actual header text looks like
print(f"\n=== Sample header texts from pages 10-20 ===")
for page_num in range(10, min(21, doc.page_count)):
    page = doc[page_num]
    rect = page.rect
    page_height = rect.height
    header_zone = fitz.Rect(0, 0, rect.width, page_height * 0.12)
    
    texts_in_zone = []
    for block in page.get_text("dict", clip=header_zone).get("blocks", []):
        if "lines" in block:
            for line in block["lines"]:
                text = "".join(span["text"] for span in line["spans"]).strip()
                y_pos = line["spans"][0]["origin"][1]
                if text:
                    texts_in_zone.append(f"    y={y_pos:.1f}: '{text}'")
    
    if texts_in_zone:
        print(f"  Page {page_num + 1}:")
        for t in texts_in_zone:
            print(t)

doc.close()
