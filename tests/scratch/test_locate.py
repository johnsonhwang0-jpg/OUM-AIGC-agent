#!/usr/bin/env python3
"""定位 CBRE3103 二级标题问题"""
import sqlite3, base64, json, subprocess

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
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

print("=== 查找包含 'SOFTWARE' 或 '1.1' 的行 ===")
for page in output.get('pages', []):
    content = page['content']
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'SOFTWARE' in line.upper() or ('1.1' in line and 'REQUIREMENTS' in line.upper()):
            print(f"\nPage {page['pageNum']}, Line {i}:")
            print(f"  {repr(line)}")
            # 显示上下文
            for j in range(max(0, i-2), min(len(lines), i+3)):
                if j != i:
                    print(f"  {j}: {repr(lines[j][:80])}")
