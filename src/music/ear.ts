import type { IntervalId } from './theory';

export interface EarInterval {
  id: IntervalId;
  short: string;
  name: string;
  semitones: number;
  up?: string;
  down?: string;
}

/** Songs that start with each interval, a classic memory aid. */
export const EAR_INTERVALS: EarInterval[] = [
  { id: 'm2', short: 'm2', name: 'Minor 2nd', semitones: 1, up: 'Jaws theme', down: 'Für Elise (opening)' },
  { id: 'M2', short: 'M2', name: 'Major 2nd', semitones: 2, up: 'Happy Birthday (“Hap-py Birth-”)', down: 'Mary Had a Little Lamb' },
  { id: 'm3', short: 'm3', name: 'Minor 3rd', semitones: 3, up: 'Greensleeves · Smoke on the Water', down: 'Hey Jude' },
  { id: 'M3', short: 'M3', name: 'Major 3rd', semitones: 4, up: 'When the Saints Go Marching In', down: 'Swing Low, Sweet Chariot' },
  { id: 'P4', short: 'P4', name: 'Perfect 4th', semitones: 5, up: 'Here Comes the Bride · Amazing Grace', down: 'Eine kleine Nachtmusik' },
  { id: 'A4', short: 'TT', name: 'Tritone', semitones: 6, up: 'The Simpsons · Maria (West Side Story)', down: 'Black Sabbath (riff)' },
  { id: 'P5', short: 'P5', name: 'Perfect 5th', semitones: 7, up: 'Twinkle Twinkle Little Star · Star Wars', down: 'The Flintstones' },
  { id: 'm6', short: 'm6', name: 'Minor 6th', semitones: 8, up: 'The Entertainer' },
  { id: 'M6', short: 'M6', name: 'Major 6th', semitones: 9, up: 'My Bonnie Lies Over the Ocean', down: 'Nobody Knows the Trouble I’ve Seen' },
  { id: 'm7', short: 'm7', name: 'Minor 7th', semitones: 10, up: 'Somewhere (West Side Story) · Star Trek theme' },
  { id: 'M7', short: 'M7', name: 'Major 7th', semitones: 11, up: 'Take On Me (chorus)' },
  { id: 'P8', short: 'P8', name: 'Octave', semitones: 12, up: 'Somewhere Over the Rainbow' },
];

export const INTERVAL_SETS: { id: string; label: string; ids: IntervalId[] }[] = [
  { id: 'starter', label: 'Starter', ids: ['M2', 'M3', 'P5', 'P8'] },
  { id: 'more', label: 'More', ids: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'P8'] },
  { id: 'all', label: 'All 12', ids: EAR_INTERVALS.map((i) => i.id) },
];

export interface EarChord {
  id: string;
  name: string;
  semitones: number[];
  hint: string;
}

export const EAR_CHORDS: EarChord[] = [
  { id: 'maj', name: 'Major', semitones: [0, 4, 7], hint: 'Bright and happy' },
  { id: 'min', name: 'Minor', semitones: [0, 3, 7], hint: 'Dark or sad' },
  { id: 'dim', name: 'Diminished', semitones: [0, 3, 6], hint: 'Tense, like a horror film' },
  { id: 'aug', name: 'Augmented', semitones: [0, 4, 8], hint: 'Dreamy, floating, unresolved' },
];
