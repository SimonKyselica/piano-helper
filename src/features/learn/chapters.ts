export const CHAPTERS = [
  { id: 'keyboard', title: 'Find your way around', blurb: 'The black-key pattern, and how to find C and F anywhere.' },
  { id: 'names', title: 'Note names & octaves', blurb: 'Seven letters that repeat, octave numbers and Middle C.' },
  { id: 'staff', title: 'From the staff to the keys', blurb: 'Lines, spaces and clefs. Tap a key and see where it’s written.' },
  { id: 'sharps', title: 'Sharps, flats & naturals', blurb: 'What ♯ ♭ ♮ mean and why a black key has two names.' },
  { id: 'rhythm', title: 'Note lengths & rhythm', blurb: 'Whole, half, quarter and eighth notes, rests, dots, ties and bars.' },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]['id'];
