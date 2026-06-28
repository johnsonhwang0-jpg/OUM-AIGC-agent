import sqlite3
import re

conn = sqlite3.connect('/Users/johnsonhwang/Desktop/OUM-AIGC-V2-immersive-simulation/booktogame-ai-agent/booktogame.db')
cursor = conn.cursor()

cursor.execute("SELECT bookContentText FROM projects WHERE name LIKE '%HBEC2603%'")
row = cursor.fetchone()
if row and row[0]:
    content = row[0]
    print(f"bookContentText length: {len(content)}")
    
    # Search for TOPIC 2 patterns
    print("\nSearching for 'TOPIC 2' patterns:")
    for match in re.finditer(r'.{0,100}TOPIC 2.{0,100}', content):
        text = match.group()
        # Clean up newlines for display
        clean = text.replace('\n', ' ')
        print(f"  Match: {clean}")
        print()
else:
    print("No bookContentText found")

conn.close()
