#!/usr/bin/env python3
"""Unpack building textures: python3 public/art/textures/buildings/_b64/unpack.py (run from repo root)."""
import base64, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '..', '..', '..', '..', '..'))
done = 0
for item in json.load(open(os.path.join(here, 'MANIFEST.json'))):
    dst = os.path.join(root, item['path'])
    if os.path.exists(dst) and os.path.getsize(dst) == item['nbytes']:
        continue
    data = base64.b64decode(open(os.path.join(here, item['b64'])).read())
    if len(data) != item['nbytes']:
        sys.exit(f"size mismatch for {item['path']}")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'wb').write(data)
    done += 1
print(f'unpacked {done} texture(s)')
