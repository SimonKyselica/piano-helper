import { diatonic, fromDiatonic, mod, noteFromMidi, toMidi, type Note } from './notes';

export type IntervalId =
  | 'P1' | 'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'A4' | 'd5'
  | 'P5' | 'A5' | 'm6' | 'M6' | 'm7' | 'M7' | 'P8';

export const INTERVALS: Record<IntervalId, { steps: number; semitones: number }> = {
  P1: { steps: 0, semitones: 0 },
  m2: { steps: 1, semitones: 1 },
  M2: { steps: 1, semitones: 2 },
  m3: { steps: 2, semitones: 3 },
  M3: { steps: 2, semitones: 4 },
  P4: { steps: 3, semitones: 5 },
  A4: { steps: 3, semitones: 6 },
  d5: { steps: 4, semitones: 6 },
  P5: { steps: 4, semitones: 7 },
  A5: { steps: 4, semitones: 8 },
  m6: { steps: 5, semitones: 8 },
  M6: { steps: 5, semitones: 9 },
  m7: { steps: 6, semitones: 10 },
  M7: { steps: 6, semitones: 11 },
  P8: { steps: 7, semitones: 12 },
};

/** Transpose with correct spelling (e.g. D + M3 = F♯, not G♭). */
export function transpose(n: Note, id: IntervalId): Note {
  const { steps, semitones } = INTERVALS[id];
  const target = fromDiatonic(diatonic(n) + steps);
  return { ...target, alter: toMidi(n) + semitones - toMidi(target) };
}

export interface ChordType {
  id: string;
  name: string;
  symbol: string;
  intervals: IntervalId[];
  formula: string;
  feel: string;
}

export const CHORD_TYPES: ChordType[] = [
  { id: 'maj', name: 'major', symbol: '', intervals: ['P1', 'M3', 'P5'], formula: '1 · 3 · 5', feel: 'Bright, happy, stable.' },
  { id: 'min', name: 'minor', symbol: 'm', intervals: ['P1', 'm3', 'P5'], formula: '1 · ♭3 · 5', feel: 'Darker, sad or serious.' },
  { id: 'dim', name: 'diminished', symbol: 'dim', intervals: ['P1', 'm3', 'd5'], formula: '1 · ♭3 · ♭5', feel: 'Tense, wants to move on.' },
  { id: 'aug', name: 'augmented', symbol: 'aug', intervals: ['P1', 'M3', 'A5'], formula: '1 · 3 · ♯5', feel: 'Dreamy and unresolved.' },
  { id: 'sus2', name: 'sus2', symbol: 'sus2', intervals: ['P1', 'M2', 'P5'], formula: '1 · 2 · 5', feel: 'Open and airy — neither major nor minor.' },
  { id: 'sus4', name: 'sus4', symbol: 'sus4', intervals: ['P1', 'P4', 'P5'], formula: '1 · 4 · 5', feel: 'Suspended, likes to resolve to major.' },
  { id: '7', name: 'dominant 7th', symbol: '7', intervals: ['P1', 'M3', 'P5', 'm7'], formula: '1 · 3 · 5 · ♭7', feel: 'Bluesy, pulls toward the next chord.' },
  { id: 'maj7', name: 'major 7th', symbol: 'maj7', intervals: ['P1', 'M3', 'P5', 'M7'], formula: '1 · 3 · 5 · 7', feel: 'Soft, jazzy, warm.' },
  { id: 'm7', name: 'minor 7th', symbol: 'm7', intervals: ['P1', 'm3', 'P5', 'm7'], formula: '1 · ♭3 · 5 · ♭7', feel: 'Mellow and smooth.' },
];

export interface ScaleType {
  id: string;
  name: string;
  intervals: IntervalId[];
  feel: string;
}

export const SCALE_TYPES: ScaleType[] = [
  { id: 'major', name: 'major', intervals: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'], feel: 'The “do-re-mi” scale. Happy and bright.' },
  { id: 'minor', name: 'natural minor', intervals: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'], feel: 'Same notes as the major scale three half steps up. Sad or serious.' },
  { id: 'harmonic', name: 'harmonic minor', intervals: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'M7'], feel: 'Natural minor with a raised 7th — sounds exotic.' },
  { id: 'majpent', name: 'major pentatonic', intervals: ['P1', 'M2', 'M3', 'P5', 'M6'], feel: 'Five notes, no wrong notes. Great for improvising.' },
  { id: 'minpent', name: 'minor pentatonic', intervals: ['P1', 'm3', 'P4', 'P5', 'm7'], feel: 'The rock and blues workhorse.' },
  { id: 'blues', name: 'blues', intervals: ['P1', 'm3', 'P4', 'd5', 'P5', 'm7'], feel: 'Minor pentatonic plus the “blue note” ♭5.' },
];

/** Pitch classes where a tie in accidental count should prefer the flat spelling. */
const PREFER_FLAT_ON_TIE = new Set([1, 3, 8, 10]);

function rootCandidates(pc: number, octave: number): Note[] {
  const midi = (octave + 1) * 12 + mod(pc, 12);
  const sharp = noteFromMidi(midi, 'sharp');
  const flat = noteFromMidi(midi, 'flat');
  if (sharp.alter === 0) return [sharp];
  return PREFER_FLAT_ON_TIE.has(mod(pc, 12)) ? [flat, sharp] : [sharp, flat];
}

function accidentalCost(notes: Note[]): number {
  return notes.reduce((sum, n) => sum + Math.abs(n.alter) + (Math.abs(n.alter) > 1 ? 4 : 0), 0);
}

/** Build notes from a root pitch class, picking the spelling with the fewest accidentals. */
export function spellFromRoot(pc: number, intervals: IntervalId[], octave = 4): Note[] {
  let best: Note[] | null = null;
  for (const root of rootCandidates(pc, octave)) {
    const notes = intervals.map((iv) => transpose(root, iv));
    if (!best || accidentalCost(notes) < accidentalCost(best)) best = notes;
  }
  return best!;
}

export function chordNotes(pc: number, type: ChordType, inversion = 0): Note[] {
  const notes = spellFromRoot(pc, type.intervals);
  const k = Math.min(inversion, notes.length - 1);
  return [...notes.slice(k), ...notes.slice(0, k).map((n) => ({ ...n, octave: n.octave + 1 }))];
}

export function scaleNotes(pc: number, type: ScaleType): Note[] {
  return spellFromRoot(pc, [...type.intervals, 'P8']);
}

export function stepPattern(notes: Note[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < notes.length; i++) {
    const d = toMidi(notes[i]) - toMidi(notes[i - 1]);
    out.push(d === 1 ? 'H' : d === 2 ? 'W' : d === 3 ? 'W+H' : `${d}`);
  }
  return out;
}

export function inversionName(i: number): string {
  return ['Root position', '1st inversion', '2nd inversion', '3rd inversion'][i] ?? `${i}th inversion`;
}
