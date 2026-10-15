/**
 * Settings sliders → the audio engine. Volumes live in the shared settings
 * store so a reload keeps the mix.
 */
import { AUDIO_BUSES, sharedSettings, type Settings, type SettingsStore } from '../features/settings/settings.ts';
import { getAudio, type Category } from './engine';

export function audioSettings(): SettingsStore {
  return sharedSettings();
}

export function applyAudioSettings(s: Settings): void {
  const audio = getAudio();
  audio.setMasterVolume(s.masterVolume);
  audio.setMuted(s.audioMuted);
  for (const bus of AUDIO_BUSES) audio.setCategoryVolume(bus as Category, s.busVolume[bus]);
}

export function applyStoredAudio(): Settings {
  const s = audioSettings().get();
  applyAudioSettings(s);
  return s;
}
