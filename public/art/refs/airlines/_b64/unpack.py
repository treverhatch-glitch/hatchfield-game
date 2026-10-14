#!/usr/bin/env python3
"""Decode airline livery packs into public/art/refs/airlines/*.jpg.
Run from repo root: python3 public/art/refs/airlines/_b64/unpack.py
Then commit the .jpg files and delete the _b64/ folder in the same commit."""
import base64, json
from pathlib import Path
HERE = Path(__file__).resolve().parent
OUT = HERE.parent
n = 0
for p in sorted(HERE.glob('pack*.json')):
    for name, b64 in json.loads(p.read_text()).items():
        (OUT / name).write_bytes(base64.b64decode(b64))
        print('wrote', OUT / name)
        n += 1
print('done', n, 'files')
