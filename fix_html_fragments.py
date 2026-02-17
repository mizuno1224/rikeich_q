#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix HTML files that are full documents to HTML fragments"""

import re
import os

files_to_fix = [
    'data/explanations/exam_private/ritsumei/2026/2026_ritsumei_3.html',
    'data/explanations/exam_private/doshisha/2026/pv-graph.html',
    'data/explanations/exam_private/doshisha/2026/2026_doshisha_3.html',
    'data/explanations/exam_private/doshisha/2026/2026_doshisha_2.html',
    'data/explanations/exam_national/tsukuba/2024/2024_3.html',
    'data/explanations/exam_private/doshisha/2026/2026_doshisha_1.html',
    'data/explanations/exam_private/ritsumei/2026/2026_ritsumei_1.html',
    'data/explanations/exam_private/ritsumei/2026/2026_ritsumei_2.html',
    'data/explanations/exam_national/kyushu/2018/2018_zenki_1.html',
    'data/explanations/exam_private/tokyo_rika/2025/2025_souzou_1.html',
    'data/explanations/exam_national/chiba/2021/2021_zenki_1.html',
    'data/explanations/exam_private/tokyo_rika/2023/2023_kou_1.html',
    'data/explanations/exam_national/tohoku/2017/2017_zenki_1.html',
]

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        print(f"Warning: {filepath} not found, skipping")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if it's a full HTML document
    if not content.strip().startswith('<!DOCTYPE html>') and not content.strip().startswith('<html'):
        print(f"Skipping {filepath} - not a full HTML document")
        continue
    
    # Extract content from <div class="explanation-area">
    # Pattern: find <div class="explanation-area"> and extract its content until </div>
    match = re.search(r'<div\s+class=["\']explanation-area["\'][^>]*>([\s\S]*?)</div>\s*</div>\s*</body>', content, re.DOTALL)
    
    if match:
        fragment = match.group(1).strip()
        # Write the fragment back
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fragment)
        print(f"Fixed: {filepath}")
    else:
        # Fallback: try to extract from <body> tag
        match = re.search(r'<body[^>]*>([\s\S]*?)</body>', content, re.DOTALL)
        if match:
            body_content = match.group(1).strip()
            # Remove viewer-container and explanation-area wrappers
            body_content = re.sub(r'^\s*<div\s+class=["\']viewer-container["\'][^>]*>\s*', '', body_content, flags=re.MULTILINE)
            body_content = re.sub(r'^\s*<div\s+class=["\']explanation-area["\'][^>]*>\s*', '', body_content, flags=re.MULTILINE)
            body_content = re.sub(r'\s*</div>\s*</div>\s*$', '', body_content, flags=re.MULTILINE)
            body_content = body_content.strip()
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(body_content)
            print(f"Fixed (fallback): {filepath}")
        else:
            print(f"Warning: Could not extract content from {filepath}")

print("Done!")
