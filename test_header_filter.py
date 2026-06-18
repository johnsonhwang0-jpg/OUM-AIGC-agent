import sys
sys.path.insert(0, '/Users/johnsonhwang/Desktop/OUM-AIGC-V2-immersive-simulation/booktogame-ai-agent')

from pdf_extractor_oxide import is_header_footer_line, HEADER_FOOTER_PATTERNS
import re

# Test with actual formats from database
test_cases = [
    "   TOPIC 2   UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING 18",
    "TOPIC 2   UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING      19",
    "   TOPIC 2   UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING 20",
    "TOPIC 2   UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING      21",
    "2 TOPIC 1 ESTABLISHING COMMON GROUND",
    "4 TOPIC 1 ESTABLISHING COMMON GROUND",
    "6 TOPIC 1 ESTABLISHING COMMON GROUND",
    # Simulate what pdf_oxide might output (Markdown headings)
    "## TOPIC 2 UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING 19",
    "## TOPIC 2 UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING  21",
    "#  TOPIC 2 UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING 18",
    # Should NOT match
    "TOPIC 2 UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING",
    "According to the nativist, young children",
]

print("Testing is_header_footer_line:")
for test in test_cases:
    result = is_header_footer_line(test, set())
    print(f"  {'✓' if result else '✗'} '{test[:60]}...' -> {result}")

print("\nTesting raw patterns:")
for test in test_cases:
    trimmed = test.strip()
    clean_text = re.sub(r'^#+\s*', '', trimmed).strip()
    matched = False
    for i, pattern in enumerate(HEADER_FOOTER_PATTERNS):
        if re.search(pattern, trimmed, re.IGNORECASE):
            print(f"  Matched pattern {i+1} (raw): '{test[:50]}...'")
            matched = True
            break
        if clean_text != trimmed and re.search(pattern, clean_text, re.IGNORECASE):
            print(f"  Matched pattern {i+1} (clean): '{test[:50]}...'")
            matched = True
            break
    if not matched:
        print(f"  NO MATCH: '{test[:50]}...'")
