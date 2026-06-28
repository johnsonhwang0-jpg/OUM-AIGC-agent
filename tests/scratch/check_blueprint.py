import sqlite3
import json

conn = sqlite3.connect('/Users/johnsonhwang/Desktop/OUM-AIGC-V2-immersive-simulation/booktogame-ai-agent/booktogame.db')
cursor = conn.cursor()

cursor.execute("SELECT id, name, rawBlueprintData, bookContentText FROM projects WHERE name LIKE '%HBEC2603%'")
row = cursor.fetchone()
if row:
    project_id = row[0]
    project_name = row[1]
    raw_blueprint = row[2]
    book_content = row[3]
    
    print(f"Project ID: {project_id}")
    print(f"Project Name: {project_name}")
    print(f"rawBlueprintData length: {len(raw_blueprint) if raw_blueprint else 0}")
    print(f"bookContentText length: {len(book_content) if book_content else 0}")
    
    if raw_blueprint:
        try:
            blueprint = json.loads(raw_blueprint)
            print(f"\nrawBlueprintData keys: {blueprint.keys() if isinstance(blueprint, dict) else type(blueprint)}")
            if isinstance(blueprint, dict) and 'slices' in blueprint:
                slices = blueprint['slices']
                print(f"Number of slices: {len(slices)}")
                for i, s in enumerate(slices[:3]):
                    sid = s.get('id', 'N/A')
                    title = s.get('title', 'N/A')[:50]
                    content_len = len(s.get('content', ''))
                    print(f"  Slice {i}: ID={sid}, Title={title}..., Content length={content_len}")
                    
                    # Check for TOPIC 2
                    content = s.get('content', '')
                    if 'TOPIC 2' in content:
                        print(f"    -> Found 'TOPIC 2'!")
                        import re
                        for match in re.finditer(r'.{0,80}TOPIC 2.{0,80}', content):
                            print(f"    Match: {repr(match.group())}")
        except json.JSONDecodeError as e:
            print(f"Failed to parse rawBlueprintData: {e}")
            print(f"First 500 chars: {raw_blueprint[:500]}")
else:
    print("HBEC2603 project not found")

conn.close()
