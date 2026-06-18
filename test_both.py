#!/usr/bin/env python3
"""验证 HBEC2603 教材的修复效果"""
import sqlite3, base64, json, subprocess

conn = sqlite3.connect('booktogame.db')
cursor = conn.cursor()
cursor.execute("SELECT pdfData FROM projects WHERE name LIKE '%HBEC%' LIMIT 1")
row = cursor.fetchone()
conn.close()

input_data = {
    "pdfData": row[0],
    "startPage": 1,
    "endPage": 30,
}

result = subprocess.run(
    ["python3", "pdf_extractor_oxide.py"],
    input=json.dumps(input_data),
    capture_output=True,
    text=True
)

output = json.loads(result.stdout)

print("=" * 60)
print("HBEC2603 验证")
print("=" * 60)

# 问题1：三级标题
print("\n问题1：三级标题识别 (1.1.2 Development of Morality)")
found_tertiary = False
for page in output.get('pages', []):
    content = page['content']
    lines = content.split('\n')
    for line in lines:
        if '1.1.2' in line and 'Morality' in line:
            print(f"✓ Page {page['pageNum']}: {line}")
            found_tertiary = True
if not found_tertiary:
    print("✗ 未找到三级标题")

# 问题2：二级标题
print("\n问题2：二级标题断裂 (1.1 Background...)")
found_secondary = False
for page in output.get('pages', []):
    content = page['content']
    lines = content.split('\n')
    for line in lines:
        if '1.1' in line and 'Background' in line:
            print(f"✓ Page {page['pageNum']}: {line}")
            if 'Approaches' in line:
                print(f"  → 标题完整")
            else:
                print(f"  → 标题断裂")
            found_secondary = True
if not found_secondary:
    print("✗ 未找到二级标题")

# 问题3：CBRE3103 验证
print("\n" + "=" * 60)
print("CBRE3103 验证")
print("=" * 60)

conn2 = sqlite3.connect('booktogame.db')
cursor2 = conn2.cursor()
cursor2.execute("SELECT pdfData FROM projects WHERE name LIKE '%CBRE%' LIMIT 1")
row2 = cursor2.fetchone()
conn2.close()

input_data2 = {
    "pdfData": row2[0],
    "startPage": 1,
    "endPage": 10,
}

result2 = subprocess.run(
    ["python3", "pdf_extractor_oxide.py"],
    input=json.dumps(input_data2),
    capture_output=True,
    text=True
)

output2 = json.loads(result2.stdout)

print("\n问题：二级标题识别 (1.1 SOFTWARE REQUIREMENTS...)")
found_cbre = False
for page in output2.get('pages', []):
    content = page['content']
    lines = content.split('\n')
    for line in lines:
        if '1.1' in line and 'SOFTWARE' in line.upper() and 'REQUIREMENTS' in line.upper():
            print(f"✓ Page {page['pageNum']}: {line}")
            found_cbre = True
if not found_cbre:
    print("✗ 未找到二级标题")
