import re

patterns = [
    r'^\d{1,3}\s+(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\-]+$',
    r'^(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\-]+\s+\d{1,3}$',
    r'^(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\-]+\s+[^\w\s]+\s*\d{1,3}$',
    r'^[^\w\s]+\s*(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\-]+\s+\d{1,3}$',
    r'^[^\w\s]+\s*(?:TOPIC|CHAPTER|UNIT|SECTION)\s+\d+\s+[A-Z][A-Z\s\'\-]+\s+[^\w\s]+\s*\d{1,3}$',
]

test_cases = [
    "   TOPIC 2   UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING 18",
    "TOPIC 2   UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING      19",
    "   TOPIC 2   UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING 20",
    "TOPIC 2   UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING      21",
    "2 TOPIC 1 ESTABLISHING COMMON GROUND",
    "4 TOPIC 1 ESTABLISHING COMMON GROUND",
    "6 TOPIC 1 ESTABLISHING COMMON GROUND",
    # Should NOT match (actual content)
    "TOPIC 2 UNDERSTANDING YOUNG CHILDREN'S LANGUAGE LEARNING",
    "According to the nativist, young children",
]

for test in test_cases:
    print(f'Testing: "{test}"')
    for i, p in enumerate(patterns):
        if re.search(p, test, re.IGNORECASE):
            print(f'  -> Matched pattern {i+1}')
            break
    else:
        print(f'  -> NO MATCH')
    print()
