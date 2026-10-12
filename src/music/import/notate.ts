import { mod, noteFromMidi, toMidi, type Note, type Step } from '../notes';
import { barSpans, measureTicks, type SongEvent } from '../song';
import { spellFromRoot } from '../theory';

/** A note from a file: times in ticks (24 per quarter), not yet tidy. */
export interface RawNote {
  start: number;
  dur: number;
  midi: number;
  /** Spelling from the file, if it has one (MusicXML). */
  note?: Note;
}

export interface NotateOptions {
  time: [number, number];
  /** Which note to keep when several sound together. */
  voice: 'top' | 'bottom';
  minMidi?: number;
  maxMidi?: number;
  spell: (midi: number) => Note;
}

const GRID = 6; // sixteenth notes

/** Turn raw notes into a single readable line of bars. */
export function notate(raw: RawNote[], opts: NotateOptions): SongEvent[][] {
  const picked = new Map<number, RawNote & { end: number }>();
  for (const n of raw) {
    if (opts.minMidi !== undefined && n.midi < opts.minMidi) continue;
    if (opts.maxMidi !== undefined && n.midi > opts.maxMidi) continue;
    const start = Math.round(n.start / GRID) * GRID;
    let end = Math.round((n.start + n.dur) / GRID) * GRID;
    if (end <= start) end = start + GRID;
    const prev = picked.get(start);
    if (!prev || (opts.voice === 'top' ? n.midi > prev.midi : n.midi < prev.midi)) picked.set(start, { ...n, start, end });
  }
  const notes = [...picked.values()].sort((a, b) => a.start - b.start);
  if (!notes.length) return [];

  const full = measureTicks(opts.time);
  const shift = Math.floor(notes[0].start / full) * full;
  const spans: { note: Note | null; ticks: number }[] = [];
  let t = 0;
  notes.forEach((n, i) => {
    const start = n.start - shift;
    const end = Math.min(n.end - shift, i + 1 < notes.length ? notes[i + 1].start - shift : Infinity);
    if (start > t) spans.push({ note: null, ticks: start - t });
    spans.push({ note: n.note ?? opts.spell(n.midi), ticks: end - start });
    t = end;
  });
  if (t % full) spans.push({ note: null, ticks: full - (t % full) });
  return barSpans(spans, opts.time);
}

const SEMI: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const FLAT_TONICS = new Set([5, 10, 3, 8, 1]);

export function spellAs(midi: number, step: Step, alter: number): Note {
  return { step, alter, octave: Math.floor((midi - SEMI[step] - alter) / 12) - 1 };
}

/** Guess the key (or use the file's key signature) and spell notes to match it. */
export function makeSpeller(midis: number[], keySharps?: number): (midi: number) => Note {
  let tonic: number;
  if (keySharps !== undefined) tonic = mod(keySharps * 7, 12);
  else {
    const counts = new Array(12).fill(0);
    for (const m of midis) counts[mod(m, 12)]++;
    let best = -1;
    tonic = 0;
    for (const t of [0, 7, 5, 2, 10, 9, 3, 4, 8, 11, 1, 6]) {
      const score = MAJOR.reduce((a, d) => a + counts[(t + d) % 12], 0);
      if (score > best) {
        best = score;
        tonic = t;
      }
    }
  }
  const flats = keySharps !== undefined ? keySharps < 0 : FLAT_TONICS.has(tonic);
  const inKey = new Map(spellFromRoot(tonic, ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7']).map((n) => [mod(toMidi(n), 12), n]));
  const cMajorExtras: Record<number, Note> = { 3: noteFromMidi(63, 'flat'), 10: noteFromMidi(70, 'flat') };
  return (midi) => {
    const pc = mod(midi, 12);
    const n = inKey.get(pc) ?? (tonic === 0 ? cMajorExtras[pc] : undefined);
    return n ? spellAs(midi, n.step, n.alter) : noteFromMidi(midi, flats ? 'flat' : 'sharp');
  };
}
