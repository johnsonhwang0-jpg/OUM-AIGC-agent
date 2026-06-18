#!/usr/bin/env python3
"""检查页码格式"""
import sqlite3, base64, json, subprocess

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row = cursor.fetchone()
conn.close()

input_data = {
    "pdfData": row[0],
    "startPage": 19,
    "endPage": 28,
}

result = subprocess.run(
    ["python3", "pdf_extractor_oxide.py"],
    input=json.dumps(input_data),
    capture_output=True,
    text=True
)

output = json.loads(result.stdout)
for page in output.get('pages', [])[:6]:
    content = page['content']
    # 找页码行（通常是单独的数字或 **数字** 格式）
    lines = content.split('\n')
    print(f"\n--- Page {page['pageNum']} first 5 lines ---")
    for i, line in enumerate(lines[:5]):
        print(f"  Line {i}: '{line}'")
