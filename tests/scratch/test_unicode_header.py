import sys
sys.path.insert(0, '/Users/johnsonhwang/Desktop/OUM-AIGC-V2-immersive-simulation/booktogame-ai-agent')

from pdf_extractor_oxide import is_header_footer_line

# Test with actual formats from database (using Unicode right single quotation mark)
test_cases = [
    "\uf075   TOPIC 2   UNDERSTANDING YOUNG CHILDREN\u2019S LANGUAGE LEARNING 18",
    "TOPIC 2   UNDERSTANDING YOUNG CHILDREN\u2019S LANGUAGE LEARNING   \uf074   19",
    "\uf075   TOPIC 2   UNDERSTANDING YOUNG CHILDREN\u2019S LANGUAGE LEARNING 20",
    "TOPIC 2   UNDERSTANDING YOUNG CHILDREN\u2019S LANGUAGE LEARNING   \uf074   21",
    "2 TOPIC 1 ESTABLISHING COMMON GROUND",
    "4 TOPIC 1 ESTABLISHING COMMON GROUND",
    "6 TOPIC 1 ESTABLISHING COMMON GROUND",
    # Should NOT match
    "TOPIC 2 UNDERSTANDING YOUNG CHILDREN\u2019S LANGUAGE LEARNING",
    "According to the nativist, young children",
]

print("Testing is_header_footer_line with Unicode right single quotation mark:")
for test in test_cases:
    result = is_header_footer_line(test, set())
    status = "✓" if result else "✗"
    print(f"  {status} '{test[:60]}...' -> {result}")
