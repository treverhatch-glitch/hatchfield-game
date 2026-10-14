/**
 * Buffer playback for the CC0 clips. Loops honour intensity the same way the
 * procedural voices do: throttle raises pitch and level, level only loudness.
 */
import type { Voice } from './synth';
import type { SampleSpec } from './library';

export function buildSample(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  out: AudioNode,
  spec: SampleSpec,
  looping: boolean,
): Voice {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = looping;
  src.playbackRate.setValueAtTime(spec.rate, ctx.currentTime);
  const g = ctx.createGain();
  g.gain.setValueAtTime(spec.gain, ctx.currentTime);
  src.connect(g).connect(out);
  src.start(ctx.currentTime);
  let stopped = false;
  const rate = spec.rate > 0 ? spec.rate : 1;
  return {
    duration: looping ? Infinity : buffer.duration / rate + 0.05,
    setIntensity(v) {
      if (stopped || spec.drive === 'none') return;
      const t = ctx.currentTime;
      const k = Math.max(0, Math.min(1, v));
      if (spec.drive === 'throttle') {
        src.playbackRate.setTargetAtTime(spec.rate * (0.8 + k * 0.4), t, 0.25);
        g.gain.setTargetAtTime(spec.gain * (0.45 + k * 0.55), t, 0.25);
      } else {
        g.gain.setTargetAtTime(spec.gain * (0.12 + k * 0.88), t, 0.35);
      }
    },
    stop(fade = 0.25) {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, fade));
      src.stop(t + fade + 0.03);
    },
  };
}
