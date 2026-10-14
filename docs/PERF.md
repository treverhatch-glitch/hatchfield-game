# Performance

Measured with `scripts/perf-bench.mts`. The target is an RTX 4070 Super class desktop GPU.
SwiftShader (software GL) rows are relative numbers only. They are fill-bound CPU rasterisation,
so they say nothing about desktop frame rate.

## Run it

```
npm run build && npx vite preview --port 45217 &
npm run perf:bench -- --quality ultra --seconds 20 --speed 5x --out docs/perf/ultra.json
```

- On a real GPU use the default `--gpu on`. For headless software GL add `--gpu off`.
- By default the camera follows a fixed key-driven path (pan and zoom, same schedule every run).
  Turn it off with `--path off`.
- `--save <file>` writes a save snapshot to the game's save slot and presses Continue, so a heavy
  late-game airport can be benched. Without it the run starts a fresh passenger game with the
  starter kit. **Both tables below used the fresh game, not a heavy save.**
- `--shot <file.png>` takes a screenshot at the end of the run.
- Output: avg fps, min fps, 1% low fps, p99 frame ms, plus the `?perf` overlay text
  (draw calls, triangles, textures).

## Before / after SMAA (SwiftShader, 1920x1080, 10 s, 5x speed, camera path, fresh game)

Before = this branch without the post stack. After = with it (SMAA on High/Ultra).
Draws and triangles are from the overlay at the end of the run, so they move with the camera.
After counts include the post passes (about 6-10 extra draws).

| quality | | avg fps | min fps | 1% low fps | draws | tris |
|---|---|---|---|---|---|---|
| low | before | 6.7 | 2.6 | 2.6 | 60 | 28.6k |
| low | after | 6.6 | 2.2 | 2.2 | 60 | 28.6k |
| med | before | 1.7 | 0.9 | 0.9 | 127 | 66.2k |
| med | after | 1.8 | 0.9 | 0.9 | 115 | 50.5k |
| high | before | 1.6 | 0.8 | 0.8 | 125 | 92.1k |
| high | after | 1.1 | 0.4 | 0.4 | 132 | 92.1k |
| ultra | before | 1.3 | 0.4 | 0.4 | 151 | 127.5k |
| ultra | after | 0.7 | 0.2 | 0.2 | 156 | 127.5k |

Low and Med do not use the post stack, so their rows are run-to-run noise. High and Ultra lose
frame rate here because SwiftShader pays for the extra full-screen passes in software. On a GPU
those passes are cheap, but that is not measured yet. Run the command above on the 4070 Super.
Screenshots per tier: `docs/devlog/media/perf-{low,med,high,ultra}.png`.

An earlier SwiftShader baseline from issue #232 (different flow, 50 fps on low) is not comparable
to these rows.

## Status of the second pass

- Bench camera path, min fps, 1% low, `--save`, `--shot`: done and run headless.
- SMAA: done. High and Ultra render through `src/render/quality/post.ts` (Render, SMAA, Output).
  Ultra also uses a 4x multisampled target; High relies on SMAA alone. Low and Med render
  straight to the canvas as before. Tone mapping runs once, in the output pass.
- Cascaded shadows: not wired. `src/render/quality/cascades.ts` has the split and texel-snap
  math with tests. The existing sun shadow already follows the camera and snaps to texels, and
  swapping it for cascades needs a GPU check for seams.
- Building model instancing and merging: not done. `src/build/models` does not exist in this
  repo, and no building geometry module matched the description.
