import { noteId, parseNote, toMidi, type Note } from './notes';

export type Clef = 'treble' | 'bass';
export type StaffLayout = Clef | 'grand' | 'mixed';

export interface ReadingItem {
  note: Note;
  staff: Clef;
}

export interface Level {
  id: string;
  title: string;
  subtitle: string;
  layout: StaffLayout;
  items: ReadingItem[];
  intro: string[];
  tip?: { title: string; text: string };
}

export const itemKey = (it: ReadingItem) => `${it.staff}:${noteId(it.note)}`;

export function parseItemKey(key: string): ReadingItem {
  const [staff, id] = key.split(':');
  return { staff: staff as Clef, note: parseNote(id) };
}

const on = (staff: Clef, ids: string) => ids.split(' ').map((id) => ({ staff, note: parseNote(id) }));
/** Grand staff: below middle C goes to bass, the rest to treble. */
const grand = (ids: string) =>
  ids.split(' ').map((id) => {
    const note = parseNote(id);
    return { note, staff: (toMidi(note) < 60 ? 'bass' : 'treble') as Clef };
  });

export const LEVELS: Level[] = [
  {
    id: 'treble-c',
    title: 'Middle C position',
    subtitle: 'Right hand · C D E F G',
    layout: 'treble',
    items: on('treble', 'C4 D4 E4 F4 G4'),
    intro: [
      'Music is written on a staff: five lines with four spaces between them. Every note sits either on a line or in a space. The higher it sits, the higher it sounds, which on the piano means further to the right.',
      'The curly symbol is the treble clef, used mostly for your right hand. Its curl wraps around the second line from the bottom, and that line is G.',
      'Middle C is the C nearest the middle of your piano. In the treble clef it sits below the staff on its own short line, called a ledger line.',
    ],
    tip: { title: 'One step = one white key', text: 'Line → space → line… each step up the staff is the next white key to the right.' },
  },
  {
    id: 'treble-octave',
    title: 'Up to treble C',
    subtitle: 'Right hand · C4 to C5',
    layout: 'treble',
    items: on('treble', 'C4 D4 E4 F4 G4 A4 B4 C5'),
    intro: [
      'Keep climbing past G to A, B and the C one octave above Middle C.',
      'B sits on the middle line of the staff. The next C (C5) sits in the third space.',
    ],
    tip: { title: 'Landmark', text: 'Treble C sits in the 3rd space, exactly one octave above Middle C.' },
  },
  {
    id: 'bass-c',
    title: 'Left hand C position',
    subtitle: 'Bass clef · C D E F G',
    layout: 'bass',
    items: on('bass', 'C3 D3 E3 F3 G3'),
    intro: [
      'The bass clef is for lower notes, usually played by your left hand.',
      'Its two dots surround the fourth line from the bottom, and that line is F.',
      'Bass C (C3) sits in the second space, one octave below Middle C.',
    ],
    tip: { title: 'Landmark', text: 'The bass clef dots hug the F line. Bass C is in the 2nd space.' },
  },
  {
    id: 'bass-octave',
    title: 'Bass: up to Middle C',
    subtitle: 'Left hand · C3 to C4',
    layout: 'bass',
    items: on('bass', 'C3 D3 E3 F3 G3 A3 B3 C4'),
    intro: [
      'Now the left hand climbs up to Middle C.',
      'In the bass clef, Middle C sits on a ledger line just above the staff. It is the same key as Middle C in the treble clef, just written from the other side.',
    ],
    tip: { title: 'Landmark', text: 'A3 is the top line of the bass staff. Middle C is one ledger line above it.' },
  },
  {
    id: 'treble-staff',
    title: 'Treble lines & spaces',
    subtitle: 'Whole staff · E4 to G5',
    layout: 'treble',
    items: on('treble', 'E4 F4 G4 A4 B4 C5 D5 E5 F5 G5'),
    intro: [
      'Time to cover the whole treble staff. Rhymes help a lot here.',
      'Lines, from bottom to top: E G B D F — “Every Good Boy Does Fine”.',
      'Spaces, from bottom to top, spell F A C E: “FACE”.',
    ],
    tip: { title: 'Rhymes', text: 'Lines: Every Good Boy Does Fine · Spaces: F-A-C-E' },
  },
  {
    id: 'bass-staff',
    title: 'Bass lines & spaces',
    subtitle: 'Whole staff · F2 to B3',
    layout: 'bass',
    items: on('bass', 'F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3'),
    intro: [
      'Now the whole bass staff.',
      'Lines, from bottom to top: G B D F A — “Good Boys Do Fine Always”.',
      'Spaces, from bottom to top: A C E G — “All Cows Eat Grass”.',
    ],
    tip: { title: 'Rhymes', text: 'Lines: Good Boys Do Fine Always · Spaces: All Cows Eat Grass' },
  },
  {
    id: 'grand-middle',
    title: 'Both hands',
    subtitle: 'Grand staff · C3 to C5',
    layout: 'grand',
    items: [...grand('C3 D3 E3 F3 G3 A3 B3'), { staff: 'bass', note: parseNote('C4') }, ...grand('C4 D4 E4 F4 G4 A4 B4 C5')],
    intro: [
      'Piano music uses the grand staff: a treble staff and a bass staff joined by a brace. The right hand usually reads the top staff and the left hand the bottom one.',
      'Middle C sits right between them and can be written in either staff. Both are the same key.',
    ],
    tip: { title: 'Look at the clef first', text: 'The same position means different notes in treble and bass, so always check which staff the note is on.' },
  },
  {
    id: 'ledger',
    title: 'Ledger lines',
    subtitle: 'Above & below the staff',
    layout: 'mixed',
    items: [...on('treble', 'C4 B3 A3 G5 A5 B5 C6'), ...on('bass', 'C4 D4 E4 F2 E2 D2 C2')],
    intro: [
      'Notes that go above or below the staff get short extra lines called ledger lines. Count them like normal staff lines.',
      'This level mixes both clefs, so check the clef on each note.',
    ],
    tip: { title: 'Count from a landmark', text: 'Treble: one ledger line below = Middle C, one above = A5. Bass: one above = Middle C, one below = E2.' },
  },
  {
    id: 'accidentals',
    title: 'Sharps & flats',
    subtitle: 'Black keys · C4 to C5',
    layout: 'treble',
    items: on('treble', 'C4 C#4 Db4 D4 D#4 Eb4 E4 F4 F#4 Gb4 G4 G#4 Ab4 A4 A#4 Bb4 B4 C5'),
    intro: [
      'A sharp (♯) raises a note to the very next key to the right, usually a black key.',
      'A flat (♭) lowers a note to the very next key to the left.',
      'So C♯ and D♭ are the same black key, just written in two different ways.',
    ],
    tip: { title: 'Sharp = right, flat = left', text: 'Find the white key first, then move one key right (♯) or left (♭).' },
  },
  {
    id: 'grand-wide',
    title: 'Grand staff challenge',
    subtitle: 'Everything · F2 to G5',
    layout: 'grand',
    items: grand('F2 G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5'),
    intro: ['Everything you have learned, across the full grand staff. Take your time. Accuracy matters more than speed.'],
  },
];

export const getLevel = (id: string) => LEVELS.find((l) => l.id === id);

export function itemsRange(items: ReadingItem[]): [number, number] {
  const ms = items.map((it) => toMidi(it.note));
  return [Math.min(...ms), Math.max(...ms)];
}
