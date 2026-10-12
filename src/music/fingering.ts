import { noteId, type Note } from './notes';

export type Hand = 'rh' | 'lh';
interface Fingering { rh: number[]; lh: number[] }

const STANDARD: Fingering = { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] };
const B_LIKE: Fingering = { rh: STANDARD.rh, lh: [4, 3, 2, 1, 4, 3, 2, 1] };
const F_LIKE: Fingering = { rh: [1, 2, 3, 4, 1, 2, 3, 4], lh: STANDARD.lh };
const FLAT_LH = [3, 2, 1, 4, 3, 2, 1, 3];
const F_SHARP: Fingering = { rh: [2, 3, 4, 1, 2, 3, 1, 2], lh: [4, 3, 2, 1, 3, 2, 1, 4] };

/** Standard one-octave fingerings, keyed by root spelling (ascending, low to high). */
const MAJOR: Record<string, Fingering> = {
  C: STANDARD, G: STANDARD, D: STANDARD, A: STANDARD, E: STANDARD,
  B: B_LIKE, F: F_LIKE,
  Bb: { rh: [2, 1, 2, 3, 1, 2, 3, 4], lh: FLAT_LH },
  Eb: { rh: [3, 1, 2, 3, 4, 1, 2, 3], lh: FLAT_LH },
  Ab: { rh: [3, 4, 1, 2, 3, 1, 2, 3], lh: FLAT_LH },
  Db: { rh: [2, 3, 1, 2, 3, 4, 1, 2], lh: FLAT_LH },
  'F#': F_SHARP, Gb: F_SHARP,
};

const MINOR: Record<string, Fingering> = {
  A: STANDARD, E: STANDARD, D: STANDARD, G: STANDARD, C: STANDARD,
  B: B_LIKE, F: F_LIKE,
};

const rootKey = (n: Note) => noteId(n).replace(/-?\d+$/, '');

export function scaleFingering(scaleId: string, notes: Note[], hand: Hand): number[] | null {
  const table = scaleId === 'major' ? MAJOR : scaleId === 'minor' || scaleId === 'harmonic' ? MINOR : null;
  return table?.[rootKey(notes[0])]?.[hand] ?? null;
}

export function chordFingering(chordId: string, size: number, inversion: number, hand: Hand): number[] {
  if (size === 4) return hand === 'rh' ? [1, 2, 3, 5] : [5, 3, 2, 1];
  if (chordId === 'sus2' && inversion === 0) return hand === 'rh' ? [1, 2, 5] : [5, 4, 1];
  if (chordId === 'sus4' && inversion === 0) return hand === 'rh' ? [1, 4, 5] : [5, 2, 1];
  if (hand === 'rh') return inversion === 1 ? [1, 2, 5] : [1, 3, 5];
  return inversion === 2 ? [5, 2, 1] : [5, 3, 1];
}
