#!/usr/bin/env python3
import sqlite3, base64, fitz, os, json

# Get PDF data from database
conn = sqlite3.connect('booktogame.db')
c = conn.cursor()
c.execute('SELECT pdfData FROM projects WHERE id="proj-1780988392538-8itousn"')
row = c.fetchone()
conn.close()

if row and row[0]:
    pdf_bytes = base64.b64decode(row[0])
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    # Check all pages to find NUMBER SYSTEM
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_text = page.get_text()
        if "NUMBER SYSTEM" in page_text:
            print(f"\n=== Page {page_idx+1} (found NUMBER SYSTEM) ===")
            blocks = page.get_text('dict', flags=fitz.TEXT_PRESERVE_WHITESPACE)['blocks']
            for block in blocks:
                if 'lines' not in block:
                    continue
                for line in block['lines']:
                    y = round(line['bbox'][1])
                    x = round(line['bbox'][0])
                    text = ''
                    font_sizes = []
                    is_bold = False
                    for span in line['spans']:
                        text += span['text']
                        font_sizes.append(span['size'])
                        if span['flags'] & 2**4:
                            is_bold = True
                    text = text.strip()
                    if text:
                        avg_size = sum(font_sizes)/len(font_sizes) if font_sizes else 0
                        print(f'y={y:4d} x={x:4d} size={avg_size:5.1f} bold={is_bold} | {text[:120]}')
    
    doc.close()
else:
    print("No PDF data found")
