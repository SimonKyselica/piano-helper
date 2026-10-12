import { describe, expect, it } from 'vitest';
import { midiToFreq } from '../music/notes';
import { NoteTracker } from './noteTracker';

const SR = 48000;
const FRAME = 4096;
const HOP = 800; // ~60 analyses per second, like requestAnimationFrame

interface Strike {
  midi: number;
  at: number;
  /** Strength of the fundamental relative to the 2nd harmonic (low piano notes are weak here). */
  fundamental?: number;
}

/** Piano-like test signal: inharmonic partials, fast attack, exponential decay, a little noise. */
function render(strikes: Strike[], seconds: number): Float32Array {
  const out = new Float32Array(Math.floor(seconds * SR));
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.002;
  strikes.forEach((s, idx) => {
    const end = idx + 1 < strikes.length ? strikes[idx + 1].at : seconds;
    const f = midiToFreq(s.midi);
    const partials = [s.fundamental ?? 1, 0.6, 0.35, 0.2, 0.12, 0.07];
    for (let i = Math.floor(s.at * SR); i < Math.floor(end * SR); i++) {
      const t = i / SR - s.at;
      const env = Math.min(1, t / 0.004) * Math.exp(-t * 2.5) * (end - i / SR < 0.03 ? (end - i / SR) / 0.03 : 1);
      let x = 0;
      partials.forEach((a, k) => {
        const n = k + 1;
        x += a * Math.sin(2 * Math.PI * f * n * Math.sqrt(1 + 0.0004 * n * n) * t);
      });
      out[i] += 0.15 * env * x;
    }
  });
  for (let i = 0; i < out.length; i++) out[i] += noise();
  return out;
}

function onsets(signal: Float32Array, silentUntil = 0): number[] {
  const tracker = new NoteTracker(FRAME);
  const found: number[] = [];
  for (let start = 0; start + FRAME <= signal.length; start += HOP) {
    const { onset } = tracker.process(signal.subarray(start, start + FRAME), SR, (start + FRAME) / SR < silentUntil);
    if (onset !== null) found.push(onset);
  }
  return found;
}

describe('NoteTracker', () => {
  it('detects a simple melody once per note', () => {
    const melody = [60, 62, 64, 65, 67];
    const sig = render(melody.map((midi, i) => ({ midi, at: 0.2 + i * 0.5 })), 3);
    expect(onsets(sig)).toEqual(melody);
  });

  it('counts the same key struck twice', () => {
    const sig = render(
      [
        { midi: 64, at: 0.2 },
        { midi: 64, at: 0.9 },
      ],
      1.6,
    );
    expect(onsets(sig)).toEqual([64, 64]);
  });

  it('handles bass notes with a weak fundamental and high treble notes', () => {
    for (const midi of [40, 43, 48, 72, 84]) {
      const sig = render([{ midi, at: 0.2, fundamental: midi < 50 ? 0.3 : 1 }], 1.2);
      expect(onsets(sig), `midi ${midi}`).toEqual([midi]);
    }
  });

  it('ignores notes while the app itself is playing', () => {
    const sig = render(
      [
        { midi: 67, at: 0.1 },
        { midi: 60, at: 1.0 },
      ],
      1.8,
    );
    expect(onsets(sig, 0.9)).toEqual([60]);
  });

  it('stays quiet on silence and noise', () => {
    const sig = new Float32Array(SR);
    for (let i = 0; i < sig.length; i++) sig[i] = (Math.random() - 0.5) * 0.002;
    expect(onsets(sig)).toEqual([]);
  });
});
