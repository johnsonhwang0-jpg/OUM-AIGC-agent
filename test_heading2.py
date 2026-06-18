#!/usr/bin/env python3
"""检查二级标题断裂问题"""
import sqlite3, base64, json, subprocess

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
conn.close()

input_data = {
    "pdfData": row[0],
    "startPage": 1,
    "endPage": 10,
}

result = subprocess.run(
    ["python3", "pdf_extractor_oxide.py"],
    input=json.dumps(input_data),
    capture_output=True,
    text=True
)

output = json.loads(result.stdout)
for page in output.get('pages', []):
    content = page['content']
    lines = content.split('\n')
    # 找包含 1.1 或 BACKGROUND 的行
    for i, line in enumerate(lines):
        if '1.1' in line or 'BACKGROUND' in line.upper() or 'TEACHING YOUNG' in line.upper():
            print(f"\n=== Page {page['pageNum']}, Line {i} ===")
            for j in range(max(0, i-3), min(len(lines), i+8)):
                prefix = ">>> " if j == i else "    "
                print(f"{prefix}{j}: {lines[j]}")
