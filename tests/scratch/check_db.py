import sqlite3

conn = sqlite3.connect('/Users/johnsonhwang/Desktop/OUM-AIGC-V2-immersive-simulation/booktogame-ai-agent/booktogame.db')
cursor = conn.cursor()

# Find the project with HBEC2603
cursor.execute("SELECT id, name, pdf_path FROM projects WHERE name LIKE '%HBEC2603%' OR pdf_path LIKE '%HBEC2603%'")
projects = cursor.fetchall()
print("Projects with HBEC2603:")
for p in projects:
    print(f"  ID: {p[0]}, Name: {p[1]}, PDF Path: {p[2]}")

# Also check all projects
cursor.execute("SELECT id, name, pdf_path FROM projects ORDER BY id DESC LIMIT 5")
all_projects = cursor.fetchall()
print("\nRecent projects:")
for p in all_projects:
    print(f"  ID: {p[0]}, Name: {p[1]}, PDF Path: {p[2]}")

conn.close()
