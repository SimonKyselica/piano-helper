export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export const STEPS: readonly Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A spelled note: letter + accidental (-2..2) + octave (scientific pitch, C4 = middle C). */
export interface Note {
  step: Step;
  alter: number;
  octave: number;
}

export type Naming = 'english' | 'german' | 'solfege';

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const MIDDLE_C = 60;

export function parseNote(id: string): Note {
  const m = /^([A-G])(##|#|bb|b)?(-?\d)$/.exec(id);
  if (!m) throw new Error(`Bad note id: ${id}`);
  const acc = m[2] ?? '';
  const alter = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 }[acc] ?? 0;
  return { step: m[1] as Step, alter, octave: Number(m[3]) };
}

export function noteId(n: Note): string {
  const acc = n.alter > 0 ? '#'.repeat(n.alter) : 'b'.repeat(-n.alter);
  return `${n.step}${acc}${n.octave}`;
}

export function toMidi(n: Note): number {
  return (n.octave + 1) * 12 + STEP_SEMITONES[n.step] + n.alter;
}

/** Position on the staff: one unit per line/space. */
export function diatonic(n: Note): number {
  return n.octave * 7 + STEPS.indexOf(n.step);
}

export function fromDiatonic(d: number): Note {
  return { step: STEPS[mod(d, 7)], alter: 0, octave: Math.floor(d / 7) };
}

const SHARP_SPELLING: [Step, number][] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];
const FLAT_SPELLING: [Step, number][] = [
  ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
  ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
];

export function noteFromMidi(midi: number, prefer: 'sharp' | 'flat' = 'sharp'): Note {
  const [step, alter] = (prefer === 'flat' ? FLAT_SPELLING : SHARP_SPELLING)[mod(midi, 12)];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(mod(midi, 12));

export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const freqToMidi = (freq: number) => 69 + 12 * Math.log2(freq / 440);

export function accidentalSymbol(alter: number): string {
  if (alter > 0) return '♯'.repeat(alter);
  if (alter < 0) return '♭'.repeat(-alter);
  return '';
}

const SOLFEGE: Record<Step, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

/** Central European naming: B♭ = B, B = H, sharps add "-is", flats add "-es". */
function germanName(step: Step, alter: number): string {
  if (step === 'B') {
    if (alter === 0) return 'H';
    if (alter === -1) return 'B';
    if (alter > 0) return 'H' + 'is'.repeat(alter);
    return 'H' + 'es'.repeat(-alter);
  }
  if (alter === 0) return step;
  if (alter > 0) return step + 'is'.repeat(alter);
  if (step === 'E' || step === 'A') return step + 's' + 'es'.repeat(-alter - 1);
  return step + 'es'.repeat(-alter);
}

export function noteName(n: Note, naming: Naming, withOctave = false): string {
  let name: string;
  if (naming === 'german') name = germanName(n.step, n.alter);
  else if (naming === 'solfege') name = SOLFEGE[n.step] + accidentalSymbol(n.alter);
  else name = n.step + accidentalSymbol(n.alter);
  return withOctave ? name + n.octave : name;
}

export function midiName(midi: number, naming: Naming, withOctave = false): string {
  return noteName(noteFromMidi(midi), naming, withOctave);
}

/** Label for a pitch class, showing both spellings for black keys ("C♯/D♭"). */
export function pitchClassLabel(pc: number, naming: Naming): string {
  const sharp = noteFromMidi(pc + 60, 'sharp');
  const flat = noteFromMidi(pc + 60, 'flat');
  const a = noteName(sharp, naming);
  const b = noteName(flat, naming);
  return a === b ? a : `${a}/${b}`;
}

export function rangeMidi(from: number, to: number): number[] {
  const out: number[] = [];
  for (let m = from; m <= to; m++) out.push(m);
  return out;
}
