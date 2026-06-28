#!/usr/bin/env python3
"""测试新的 pdf_extractor_oxide.py"""
import sqlite3, base64, json, sys

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

if not row or not row[0]:
    print("No CBRE PDF found")
    sys.exit(1)

input_data = {
    "pdfData": row[0],
    "startPage": 19,
    "endPage": 25,
    "imageOutputDir": "/tmp/test_pdf_images"
}

import subprocess
result = subprocess.run(
    ["python3", "pdf_extractor_oxide.py"],
    input=json.dumps(input_data),
    capture_output=True,
    text=True
)

print("=== STDERR (日志) ===")
print(result.stderr)

print("\n=== STDOUT (结果) ===")
try:
    output = json.loads(result.stdout)
    for page in output.get('pages', [])[:4]:
        print(f"\n--- Page {page['pageNum']} (first 600 chars) ---")
        print(page['content'][:600])
except json.JSONDecodeError:
    print(result.stdout[:2000])
