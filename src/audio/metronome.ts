import { settingsStore } from '../state/settings';
import { audioContext } from './context';

let noise: AudioBuffer | null = null;

/**
 * Unpitched clicks (filtered noise) so the pitch tracker doesn't mistake them for notes.
 * Returns a function that cancels every scheduled click.
 */
export function scheduleClicks(times: { at: number; accent: boolean }[]): () => void {
  const { sound, volume } = settingsStore.get();
  if (!sound || !times.length) return () => {};
  const ctx = audioContext();
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  }
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);
  const sources = times.map(({ at, accent }) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = accent ? 3200 : 2200;
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.value = accent ? 0.9 : 0.55;
    src.connect(bp).connect(g).connect(out);
    src.start(Math.max(at, ctx.currentTime));
    return src;
  });
  return () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already finished */
      }
    }
    out.disconnect();
  };
}
