# Performance

Measured with `scripts/perf-bench.mts`. The target is an RTX 4070 Super class desktop GPU.
SwiftShader (software GL) rows are relative numbers only. They show the script works and are
fill-bound, so they say nothing about desktop frame rate.

## Run it

```
npm run build && npx vite preview --port 45217 &
npm run perf:bench -- --quality ultra --seconds 20 --speed 5x --out docs/perf/ultra.json
```

- On a real GPU use the default `--gpu on`. For headless software GL add `--gpu off`.
- By default the camera follows a fixed key-driven path (pan and zoom, same schedule every run).
  Turn it off with `--path off`.
- Output: avg fps, min fps, 1% low fps, p99 frame ms, plus the `?perf` overlay text
  (draw calls, triangles, textures).

## Before (SwiftShader, 1920x1080, 10 s, 5x speed, fixed camera, no path)

Source: the baseline in issue #232, branch `claude/issue-232-20261014-1015`.

| quality | avg fps | p99 ms | draws | tris | textures |
|---|---|---|---|---|---|
| low | 50.8 | 33.4 | 91 | 45.2k | 31 (~24.2 MB) |
| high | 10.3 | 183.3 | 117 | 92.3k | 57 (~110.8 MB) |
| ultra | 10.6 | 133.4 | 122 | 83.3k | 57 (~31.8 MB) |

## After

Not measured. This pass ran in CI with no GPU and no Chromium installed, and no rendering
change from this pass is active yet. The table with avg / min / 1% low per tier on the camera
path is still to be filled in by running the command above on the 4070 Super.

## Status of the second pass

- Bench camera path, min fps and 1% low: done, not yet run.
- Cascade split and texel-snap math: `src/render/quality/cascades.ts`, unit tested, not wired
  into the sun shadow in `render/world.ts`.
- Building model instancing and merging: not done. `src/build/models` does not exist in this
  repo.
- SMAA: not done.
