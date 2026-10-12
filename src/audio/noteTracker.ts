import { PitchDetector } from 'pitchy';
import { freqToMidi } from '../music/notes';

export interface TrackerFrame {
  rms: number;
  freq: number | null;
  clarity: number;
  midi: number | null;
  cents: number;
}

export interface TrackerOptions {
  minRms: number;
  minClarity: number;
  /** Consecutive frames that must agree before a note counts. */
  stableFrames: number;
  minFreq: number;
  maxFreq: number;
}

export const DEFAULT_TRACKER: TrackerOptions = {
  minRms: 0.003,
  minClarity: 0.88,
  stableFrames: 3,
  minFreq: 27,
  maxFreq: 4300,
};

/** Frames after a note is emitted during which its own attack can't re-trigger it. */
const REFRACTORY_FRAMES = 10;
/** A level jump of this factor over the decaying floor counts as a new key strike. */
const ATTACK_RATIO = 2.2;
const ATTACK_TIMEOUT_FRAMES = 12;
const SILENCE_FRAMES = 4;

/** Converts a stream of audio frames into discrete "note played" onsets. Pure logic, no Web Audio. */
export class NoteTracker {
  opts: TrackerOptions;
  private detector: PitchDetector<Float32Array>;
  private candidate: number | null = null;
  private candidateCount = 0;
  private lastEmitted: number | null = null;
  private quietFrames = 0;
  private sinceEmit = Infinity;
  private floorRms = 0;
  private attackAge = -1;

  constructor(readonly size: number, opts: Partial<TrackerOptions> = {}) {
    this.opts = { ...DEFAULT_TRACKER, ...opts };
    this.detector = PitchDetector.forFloat32Array(size);
    this.detector.clarityThreshold = 0.9;
  }

  /** `silent` = analyse but don't report (the app itself is making sound). */
  process(buf: Float32Array, sampleRate: number, silent = false): { frame: TrackerFrame; onset: number | null } {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const frame: TrackerFrame = { rms, freq: null, clarity: 0, midi: null, cents: 0 };
    this.sinceEmit++;

    if (rms < this.opts.minRms) {
      this.candidate = null;
      this.candidateCount = 0;
      this.floorRms = Math.min(this.floorRms, rms);
      if (++this.quietFrames >= SILENCE_FRAMES) this.lastEmitted = null;
      return { frame, onset: null };
    }
    this.quietFrames = 0;

    if (this.sinceEmit <= REFRACTORY_FRAMES) {
      this.floorRms = Math.max(this.floorRms, rms);
    } else {
      if (rms > this.floorRms * ATTACK_RATIO) this.attackAge = 0;
      this.floorRms = Math.min(this.floorRms, rms);
    }
    if (this.attackAge >= 0 && ++this.attackAge > ATTACK_TIMEOUT_FRAMES) this.attackAge = -1;

    const [freq, clarity] = this.detector.findPitch(buf, sampleRate);
    frame.clarity = clarity;
    if (clarity < this.opts.minClarity || freq < this.opts.minFreq || freq > this.opts.maxFreq) {
      this.candidate = null;
      this.candidateCount = 0;
      return { frame, onset: null };
    }
    const exact = freqToMidi(freq);
    const midi = Math.round(exact);
    frame.freq = freq;
    frame.midi = midi;
    frame.cents = Math.round((exact - midi) * 100);

    if (midi === this.candidate) this.candidateCount++;
    else {
      this.candidate = midi;
      this.candidateCount = 1;
    }

    const isNew = midi !== this.lastEmitted || this.attackAge >= 0;
    if (this.candidateCount >= this.opts.stableFrames && isNew) {
      this.lastEmitted = midi;
      this.sinceEmit = 0;
      this.attackAge = -1;
      this.floorRms = rms;
      return { frame, onset: silent ? null : midi };
    }
    return { frame, onset: null };
  }
}

/** Map the 0..1 sensitivity slider to an RMS gate (logarithmic). */
export const rmsForSensitivity = (s: number) => 0.03 * 10 ** (-s * 2);
