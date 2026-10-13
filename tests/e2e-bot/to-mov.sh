#!/usr/bin/env bash
# Convert a bot run's Playwright webm to H.264 yuv420p .mov for the Drive videos folder.
# usage: tests/e2e-bot/to-mov.sh <out-dir> <name>   → <out-dir>/<name>.mov
set -euo pipefail
ffmpeg -y -loglevel error -i "$1/run.webm" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 23 -movflags +faststart -an "$1/$2.mov"
echo "$1/$2.mov"
