/**
 * Load the CC0 clips and play a click for interface controls.
 * Until a clip decodes, the engine keeps the procedural voice.
 */
import { getAudio } from './engine';
import { CLIP_FILES } from './library';

export async function preloadAudioClips(): Promise<number> {
  const audio = getAudio();
  const ctx = audio.unlock();
  const base = import.meta.env.BASE_URL ?? '/';
  let loaded = 0;
  await Promise.all(CLIP_FILES.map(async (file) => {
    if (audio.hasClip(file)) {
      loaded += 1;
      return;
    }
    try {
      const res = await fetch(`${base}assets/audio/${file}`);
      if (!res.ok) return;
      const raw = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(raw.slice(0));
      audio.setClip(file, buf);
      loaded += 1;
    } catch {
      // Missing file or a locked context: the synth voice covers the cue.
    }
  }));
  return loaded;
}

/** Pointer clicks on buttons and toggles. Sliders stay quiet so a drag is not a click. */
export function bindUiClicks(): () => void {
  const onDown = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('input[type="range"]')) return;
    const hit = target.closest('button, a, summary, [role="button"], label');
    if (!hit) return;
    const audio = getAudio();
    audio.unlock();
    void preloadAudioClips();
    if (audio.isMuted() || audio.getMasterVolume() <= 0) return;
    audio.play('uiClick');
  };
  window.addEventListener('pointerdown', onDown, true);
  return () => window.removeEventListener('pointerdown', onDown, true);
}
