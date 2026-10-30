#!/usr/bin/env python3
"""
Production Build & Obfuscation Pipeline for Racquet Rumble & Badminton 101.
Extracts JavaScript from smashheroes.src.html, bundles, compresses, and
mangles variables using Terser, then generates the minified production distribution.
"""

import os
import re
import subprocess
import sys
import tempfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_FILE = os.path.join(BASE_DIR, 'smashheroes.src.html')
OUT_HTML = os.path.join(BASE_DIR, 'smashheroes.html')
OUT_JS = os.path.join(BASE_DIR, 'smashheroes.min.js')

if not os.path.exists(SRC_FILE):
    print(f"Error: Source file not found at {SRC_FILE}")
    sys.exit(1)

with open(SRC_FILE, 'r', encoding='utf-8') as f:
    src_content = f.read()

# Locate the main application logic script (the last <script> tag)
script_pattern = re.compile(r'<script\b[^>]*>(.*?)</script>', re.DOTALL)
script_matches = list(script_pattern.finditer(src_content))
if not script_matches:
    print("Error: No <script> tag found in source HTML.")
    sys.exit(1)

main_script_match = script_matches[-1]
raw_js = main_script_match.group(1)

# Write raw JS to temporary file for terser processing
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tmp_in:
    tmp_in.write(raw_js)
    tmp_in_path = tmp_in.name

tmp_out_path = tmp_in_path.replace('.js', '.min.js')

try:
    print("Running Terser code bundling, compression & variable mangling...")
    cmd = [
        'terser', tmp_in_path,
        '--compress', 'passes=2,drop_console=false',
        '--mangle',
        '--output', tmp_out_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Terser error:", res.stderr)
        sys.exit(1)

    with open(tmp_out_path, 'r', encoding='utf-8') as f:
        min_js = f.read()

    # Syntax check on minified JS
    check_res = subprocess.run(['node', '--check', tmp_out_path], capture_output=True, text=True)
    if check_res.returncode != 0:
        print("Node syntax check failed on minified output:", check_res.stderr)
        sys.exit(1)

    # Re-inject minified JS into HTML
    start_pos = main_script_match.start(1)
    end_pos = main_script_match.end(1)

    prod_html = (
        src_content[:start_pos] +
        '/* Racquet Rumble & Badminton 101 - Production Bundle (Minified & Obfuscated) */\n' +
        min_js +
        src_content[end_pos:]
    )

    with open(OUT_HTML, 'w', encoding='utf-8') as f:
        f.write(prod_html)

    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write(min_js)

    orig_html_size = len(src_content.encode('utf-8'))
    prod_html_size = len(prod_html.encode('utf-8'))
    orig_js_size = len(raw_js.encode('utf-8'))
    prod_js_size = len(min_js.encode('utf-8'))
    js_reduction = (1 - (prod_js_size / orig_js_size)) * 100
    total_reduction = (1 - (prod_html_size / orig_html_size)) * 100

    print("\n========================================================")
    print("✓ BUILD & MINIFICATION COMPLETED SUCCESSFULLY")
    print("========================================================")
    print(f"JavaScript: {orig_js_size:,} bytes -> {prod_js_size:,} bytes ({js_reduction:.1f}% reduction)")
    print(f"Total HTML: {orig_html_size:,} bytes -> {prod_html_size:,} bytes ({total_reduction:.1f}% reduction)")
    print(f"Output files:")
    print(f" - Production App: {OUT_HTML} ({prod_html_size:,} bytes)")
    print(f" - Standalone JS:  {OUT_JS} ({prod_js_size:,} bytes)")
    print("========================================================\n")

finally:
    if os.path.exists(tmp_in_path):
        os.remove(tmp_in_path)
    if os.path.exists(tmp_out_path):
        os.remove(tmp_out_path)
