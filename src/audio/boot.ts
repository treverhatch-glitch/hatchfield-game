/**
 * Load the CC0 clips and play a click for interface controls.
 * The AudioContext stays closed until a pointer or key gesture. Until a clip
 * decodes, the engine keeps the procedural voice.
 */
import { getAudio, type AudioEngine } from './engine';
import { CLIP_FILES } from './library';

const staged = new WeakMap<AudioEngine, Map<string, ArrayBuffer>>();

export function audioBase(base = '/'): string {
  if (!base) return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Ogg first, then the mp3 twin. Same stem, under assets/audio. */
export function clipUrls(file: string, base = '/'): string[] {
  const root = audioBase(base);
  const urls = [`${root}assets/audio/${file}`];
  if (!file.endsWith('.mp3')) urls.push(`${root}assets/audio/${file.replace(/\.[^.]+$/, '')}.mp3`);
  return urls;
}

/** True for Ogg Vorbis or MPEG audio. HTML shells (a missing Pages file) are not audio. */
export function isAudioPayload(bytes: Uint8Array, contentType = ''): boolean {
  const type = contentType.toLowerCase();
  if (type.includes('text/html') || type.includes('application/json') || type.startsWith('text/')) return false;
  if (bytes.length < 4) return false;
  const ogg = bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const mp3 = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return ogg || id3 || mp3;
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : 'unknown error');

async function decodeInto(audio: AudioEngine, ctx: AudioContext, file: string, raw: ArrayBuffer, from: string): Promise<boolean> {
  try {
    const buf = await ctx.decodeAudioData(raw.slice(0));
    audio.setClip(file, buf);
    return true;
  } catch (err) {
    console.warn(`[audio] failed to decode ${file} from ${from}: ${reasonOf(err)}`);
    return false;
  }
}

async function acquire(file: string, audio: AudioEngine, base: string): Promise<boolean> {
  if (audio.hasClip(file)) return true;
  const queued = staged.get(audio)?.get(file);
  const ready = audio.context;
  if (ready && queued) {
    staged.get(audio)?.delete(file);
    if (await decodeInto(audio, ready, file, queued, 'staged')) return true;
  }
  for (const url of clipUrls(file, base)) {
    let raw: ArrayBuffer;
    let type = '';
    try {
      const res = await fetch(url);
      type = res.headers.get('content-type') ?? '';
      if (!res.ok) {
        console.warn(`[audio] failed to load ${file} from ${url}: HTTP ${res.status}`);
        continue;
      }
      raw = await res.arrayBuffer();
    } catch (err) {
      console.warn(`[audio] failed to load ${file} from ${url}: ${reasonOf(err)}`);
      continue;
    }
    if (!isAudioPayload(new Uint8Array(raw), type)) {
      console.warn(`[audio] failed to load ${file} from ${url}: not an audio file (${type || 'unknown type'})`);
      continue;
    }
    const ctx = audio.context;
    if (!ctx) {
      let map = staged.get(audio);
      if (!map) staged.set(audio, map = new Map());
      map.set(file, raw);
      return false;
    }
    if (await decodeInto(audio, ctx, file, raw, url)) return true;
  }
  if (!staged.get(audio)?.has(file)) console.warn(`[audio] clip ${file} unavailable`);
  return false;
}

/**
 * Fetch clips and decode them once a context exists. Does not create or resume
 * the context — call `unlock()` from a gesture first, then call this again.
 */
export async function preloadAudioClips(audio: AudioEngine = getAudio(), base = import.meta.env.BASE_URL ?? '/'): Promise<number> {
  let loaded = 0;
  await Promise.all(CLIP_FILES.map(async (file) => {
    if (await acquire(file, audio, base)) loaded += 1;
  }));
  return loaded;
}

/**
 * Resume on any pointer or key, including the apron canvas. Capture phase so a
 * handler on the canvas cannot swallow the gesture before the context resumes.
 */
export function installGestureUnlock(target?: EventTarget, audio?: AudioEngine, afterUnlock?: () => void): () => void {
  const sink = audio ?? getAudio();
  const host = target ?? (typeof window !== 'undefined' ? window : null);
  if (!host) return () => {};
  const kick = () => {
    sink.unlock();
    afterUnlock?.();
  };
  const capture: AddEventListenerOptions = { capture: true };
  host.addEventListener('pointerdown', kick, capture);
  host.addEventListener('keydown', kick, capture);
  return () => {
    host.removeEventListener('pointerdown', kick, capture);
    host.removeEventListener('keydown', kick, capture);
  };
}

/** Pointer clicks on buttons and toggles. Sliders stay quiet so a drag is not a click. */
export function bindUiClicks(audio: AudioEngine = getAudio()): () => void {
  const onDown = (event: Event) => {
    const node = event.target;
    if (!(node instanceof Element)) return;
    if (node.closest('input[type="range"]')) return;
    const hit = node.closest('button, a, summary, [role="button"], label');
    if (!hit) return;
    audio.unlock();
    void preloadAudioClips(audio);
    if (audio.isMuted() || audio.getMasterVolume() <= 0) return;
    audio.play('uiClick');
  };
  const capture: AddEventListenerOptions = { capture: true };
  window.addEventListener('pointerdown', onDown, capture);
  return () => window.removeEventListener('pointerdown', onDown, capture);
}
