import sqlite3
import json

conn = sqlite3.connect('/Users/johnsonhwang/Desktop/OUM-AIGC-V2-immersive-simulation/booktogame-ai-agent/booktogame.db')
cursor = conn.cursor()

# Get the HBEC2603 project
cursor.execute("SELECT id, name, modules FROM projects WHERE name LIKE '%HBEC2603%'")
row = cursor.fetchone()
if row:
    project_id = row[0]
    project_name = row[1]
    modules_json = row[2]
    
    print(f"Project ID: {project_id}")
    print(f"Project Name: {project_name}")
    print(f"Modules JSON length: {len(modules_json) if modules_json else 0}")
    
    if modules_json:
        modules = json.loads(modules_json)
        print(f"Number of modules: {len(modules)}")
        
        for i, module in enumerate(modules):
            module_id = module.get('id', 'N/A')
            title = module.get('title', 'N/A')
            content_len = len(module.get('content', ''))
            print(f"  Module {i}: ID={module_id}, Title={title[:50]}..., Content length={content_len}")
            
            # Check for TOPIC 2 in content
            content = module.get('content', '')
            if 'TOPIC 2' in content:
                print(f"    -> Found 'TOPIC 2' in this module!")
                # Show context around TOPIC 2
                import re
                for match in re.finditer(r'.{0,80}TOPIC 2.{0,80}', content):
                    print(f"    Match: {repr(match.group())}")
else:
    print("HBEC2603 project not found")
    # List all projects
    cursor.execute("SELECT id, name FROM projects ORDER BY id DESC")
    all_projects = cursor.fetchall()
    print("\nAll projects:")
    for p in all_projects:
        print(f"  ID: {p[0]}, Name: {p[1]}")

conn.close()
