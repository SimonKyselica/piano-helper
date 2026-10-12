import { midiToFreq } from '../music/notes';
import { settingsStore } from '../state/settings';
import { audioContext, markPlayback } from './context';

/** Harmonic amplitudes for a soft, piano-like tone. */
const HARMONICS = [0, 1, 0.45, 0.3, 0.18, 0.11, 0.07, 0.05, 0.03, 0.02, 0.012, 0.008];

interface Voice {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
}

let master: GainNode | null = null;
let wave: PeriodicWave | null = null;
let noise: AudioBuffer | null = null;
const voices = new Set<Voice>();

function setup(ctx: AudioContext) {
  if (master) return master;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  comp.connect(ctx.destination);
  master = ctx.createGain();
  master.connect(comp);
  wave = ctx.createPeriodicWave(new Float32Array(HARMONICS.length), Float32Array.from(HARMONICS));
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  return master;
}

export interface PlayOptions {
  /** Seconds from now. */
  when?: number;
  /** Seconds the key is held. */
  duration?: number;
  velocity?: number;
}

export function playNote(midi: number, { when = 0, duration = 1.2, velocity = 0.8 }: PlayOptions = {}) {
  const settings = settingsStore.get();
  if (!settings.sound) return;
  const ctx = audioContext();
  if (ctx.state !== 'running') void ctx.resume();
  const out = setup(ctx);
  master!.gain.value = settings.volume;

  const t0 = ctx.currentTime + when + 0.005;
  const end = t0 + duration;
  const f = midiToFreq(midi);
  const loudness = midi < 48 ? 1.25 : midi > 84 ? 0.7 : 1;
  const peak = 0.3 * velocity * loudness;
  // Lower strings ring longer.
  const decay = Math.min(3.5, Math.max(0.5, 2.6 - (midi - 48) * 0.035));

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.005);
  gain.gain.setTargetAtTime(peak * 0.4, t0 + 0.005, 0.1);
  gain.gain.setTargetAtTime(0.0001, t0 + 0.3, decay / 3);
  gain.gain.setTargetAtTime(0, end, 0.07);
  gain.connect(out);

  // Brightness fades as the note rings.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.6;
  filter.frequency.setValueAtTime(Math.min(f * 9, 15000), t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 500), t0 + 1.4);
  filter.connect(gain);

  const sources: AudioScheduledSourceNode[] = [];
  // Two slightly detuned "strings".
  for (const detune of [-2, 2.5]) {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave!);
    osc.frequency.value = f;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = 0.55;
    osc.connect(g).connect(filter);
    sources.push(osc);
  }

  // Short hammer knock.
  const knock = ctx.createBufferSource();
  knock.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(f * 3, 4000);
  const kg = ctx.createGain();
  kg.gain.value = 0.25 * velocity;
  knock.connect(bp).connect(kg).connect(gain);
  sources.push(knock);

  const voice: Voice = { gain, sources };
  voices.add(voice);
  for (const s of sources) {
    s.start(t0);
    s.stop(end + 0.6);
  }
  sources[0].onended = () => {
    voices.delete(voice);
    gain.disconnect();
  };
  markPlayback((when + duration + 0.35) * 1000);
}

/** Notes together (gap 0) or broken/arpeggiated (gap in seconds). Returns per-note start offsets in ms. */
export function playNotes(midis: number[], { gap = 0, duration = 1.4, when = 0 } = {}): number[] {
  return midis.map((m, i) => {
    const at = when + i * gap;
    playNote(m, { when: at, duration: gap ? Math.max(duration - i * gap * 0.3, gap * 1.2) : duration, velocity: gap ? 0.8 : 0.7 });
    return at * 1000;
  });
}

export function stopAll() {
  const ctx = audioContext();
  for (const v of voices) {
    v.gain.gain.cancelScheduledValues(ctx.currentTime);
    v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    for (const s of v.sources) {
      try {
        s.stop(ctx.currentTime + 0.15);
      } catch {
        /* already stopped */
      }
    }
  }
  voices.clear();
}
