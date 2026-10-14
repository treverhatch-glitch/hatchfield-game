#!/usr/bin/env python3
"""Decode pack6 *.b64 sidecars into public/art/refs/pack6/*.jpg. Run from repo root."""
from __future__ import annotations
import base64, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# HERE = <repo>/public/art/refs/pack6/_pack6_b64
ROOT = HERE.parents[4]
if not (ROOT / ".git").exists() and not (ROOT / "package.json").exists():
    # fallback: cwd
    ROOT = Path.cwd()
manifest = json.loads((HERE / "MANIFEST.json").read_text())
for item in manifest:
    dest = ROOT / item["path"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(base64.b64decode((HERE / item["b64"]).read_text().strip()))
    print(f"wrote {dest.relative_to(ROOT)} ({dest.stat().st_size} bytes)")
print("done", len(manifest), "files", file=sys.stderr)
