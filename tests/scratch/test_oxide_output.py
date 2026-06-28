import sys
import json
import base64
import fitz
from pdf_oxide import PdfDocument

# Open the PDF
pdf_path = "/Users/johnsonhwang/Desktop/OUM-AIGC-V2-immersive-simulation/booktogame-ai-agent/uploads/HBEC2603 Teaching English to Young Learners.pdf"
doc = fitz.open(pdf_path)

# Check page 19 (S2 slice, page 19)
page_num = 18  # 0-indexed
page = doc[page_num]

# Extract text using pdf_oxide
oxide_doc = PdfDocument(pdf_path)
md_content = oxide_doc.to_markdown(page_num, detect_headings=True, include_images=True)

print(f"=== Page {page_num + 1} raw markdown from pdf_oxide ===")
print(repr(md_content))
print()
print("=== Formatted ===")
print(md_content)

doc.close()
