#!/usr/bin/env python3
import re

patterns = [
    r'^[•\-\–\—]?\s*\d{1,4}\s*[•\-\–\—]?$',
    r'^(?:第\s*\d+\s*页|page\s*\d+|\d+\s*[-—]\s*页)(?:\/共\s*\d+\s*页)?$',
    r'(?:出版社|Publishing|Copyright|All\s+rights\s+reserved|版权所有|©)',
    r'(?:www\.|http:\/\/|https:\/\/)[\w\.\-\/]+',
    r'(?:ISBN|ISSN)\s*[\d\-]+',
    r'^(?:Topic|Chapter|Unit|Section|Module)\s+\d+\s+.+\s+\d{1,3}$',
    r'^\d{1,3}\s+(?:Topic|Chapter|Unit|Section|Module)\s+\d+',
    r'^[A-Za-z\s&]+\s+\d{1,3}$',
    r'^\d{1,3}\s+[A-Za-z\s&]+$',
    r'^[A-Z]{2,4}\d{3,4}$',
]

test_texts = [
    '4 TOPIC 1 REQUIREMENTS ENGINEERING',
    'TOPIC 1 REQUIREMENTS ENGINEERING 4',
    '4 TOPIC 1',
    'TOPIC 1 4',
    'TOPIC 1',
    'REQUIREMENTS ENGINEERING',
]

for text in test_texts:
    matched = False
    for i, p in enumerate(patterns):
        if re.search(p, text, re.IGNORECASE):
            print(f'"{text}" -> Matched pattern {i}')
            matched = True
            break
    if not matched:
        print(f'"{text}" -> NO MATCH')
