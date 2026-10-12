import { parseSongText, type Song } from './song';

/** Public-domain melodies, arranged for one hand. Written in the text notation from song.ts. */
const SOURCES: Record<string, string> = {
  'beethoven-5': `
    title: Symphony No. 5 (opening)
    composer: Beethoven
    info: The most famous four notes in music. Count the rest first: (1) da-da-da DUM!
    time: 2/4
    tempo: 108
    difficulty: 1
    Re G4e G4e G4e | Eb4h | Re F4e F4e F4e | D4h~ | D4h |`,

  twinkle: `
    title: Twinkle Twinkle Little Star
    composer: Traditional · Mozart’s variations
    info: Mozart wrote 12 variations on this French melody. Only quarter and half notes.
    time: 4/4
    tempo: 100
    difficulty: 1
    C4q C4q G4q G4q | A4q A4q G4h | F4q F4q E4q E4q | D4q D4q C4h |
    G4q G4q F4q F4q | E4q E4q D4h | G4q G4q F4q F4q | E4q E4q D4h |
    C4q C4q G4q G4q | A4q A4q G4h | F4q F4q E4q E4q | D4q D4q C4h |`,

  'ode-to-joy': `
    title: Ode to Joy
    composer: Beethoven · Symphony No. 9
    info: Five fingers on C D E F G cover almost everything. Watch the dotted quarter at the end of each line.
    time: 4/4
    tempo: 100
    difficulty: 1
    E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | E4q. D4e D4h |
    E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | D4q. C4e C4h |
    D4q D4q E4q C4q | D4q E4e F4e E4q C4q | D4q E4e F4e E4q D4q | C4q D4q G3h |
    E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | D4q. C4e C4h |`,

  'ode-to-joy-lh': `
    title: Ode to Joy (left hand)
    composer: Beethoven · Symphony No. 9
    info: The same tune an octave lower, in the bass clef. Great for learning to read bass notes.
    time: 4/4
    tempo: 90
    clef: bass
    difficulty: 1
    E3q E3q F3q G3q | G3q F3q E3q D3q | C3q C3q D3q E3q | E3q. D3e D3h |
    E3q E3q F3q G3q | G3q F3q E3q D3q | C3q C3q D3q E3q | D3q. C3e C3h |
    D3q D3q E3q C3q | D3q E3e F3e E3q C3q | D3q E3e F3e E3q D3q | C3q D3q G2h |
    E3q E3q F3q G3q | G3q F3q E3q D3q | C3q C3q D3q E3q | D3q. C3e C3h |`,

  'canon-bass': `
    title: Canon – bass line (left hand)
    composer: Pachelbel · arranged in C
    info: Eight notes that repeat. Once you know them, the whole famous piece is built on top.
    time: 4/4
    tempo: 66
    clef: bass
    difficulty: 1
    C3q G2q A2q E2q | F2q C2q F2q G2q | C3q G2q A2q E2q | F2q C2q F2q G2q |
    C3q G2q A2q E2q | F2q C2q F2q G2q | C3w |`,

  canon: `
    title: Canon (melody)
    composer: Pachelbel · arranged in C
    info: The slow tune first, then the well-known eighth-note pattern.
    time: 4/4
    tempo: 66
    difficulty: 1
    E5q D5q C5q B4q | A4q G4q A4q B4q | C5q B4q A4q G4q | F4q E4q F4q D4q |
    C5e E5e G5e F5e E5e C5e E5e D5e | C5e A4e C5e G4e F4e A4e G4e F4e | E4w |`,

  zarathustra: `
    title: Also sprach Zarathustra
    composer: Richard Strauss · 2001: A Space Odyssey
    info: The sunrise from the film. Hold each note for its full length, then the big finish.
    time: 4/4
    tempo: 72
    difficulty: 1
    C4w | G4w | C5w | E5q Eb5h. |`,

  lullaby: `
    title: Lullaby (Wiegenlied)
    composer: Brahms
    info: In 3/4: count 1-2-3. It starts with a pickup: two short notes before the first full bar.
    time: 3/4
    tempo: 80
    difficulty: 2
    E4e E4e | G4h E4e E4e | G4h E4e G4e | C5q B4q. A4e | A4q G4q D4e E4e |
    F4q D4q D4e E4e | F4h D4e F4e | B4e A4e G4q B4q | C5h. |`,

  greensleeves: `
    title: Greensleeves
    composer: Traditional English
    info: A 400-year-old tune in 3/4 with a pickup. Watch for G♯ (one key right of G).
    time: 3/4
    tempo: 96
    difficulty: 2
    A4q | C5h D5q | E5q. F5e E5q | D5h B4q | G4q. A4e B4q | C5h A4q | A4q. G#4e A4q | B4h G#4q | E4h A4q |
    C5h D5q | E5q. F5e E5q | D5h B4q | G4q. A4e B4q | C5q. B4e A4q | G#4q. F#4e G#4q | A4h. |`,

  minuet: `
    title: Minuet in G
    composer: Christian Petzold (once credited to Bach)
    info: A classic first “real” piece. Keep the eighth notes even.
    time: 3/4
    tempo: 104
    difficulty: 2
    D5q G4e A4e B4e C5e | D5q G4q G4q | E5q C5e D5e E5e F#5e | G5q G4q G4q |
    C5q D5e C5e B4e A4e | B4q C5e B4e A4e G4e | F#4q G4e A4e B4e G4e | A4h. |
    D5q G4e A4e B4e C5e | D5q G4q G4q | E5q C5e D5e E5e F#5e | G5q G4q G4q |
    C5q D5e C5e B4e A4e | B4q C5e B4e A4e G4e | A4q B4e A4e G4e F#4e | G4h. |`,

  prelude: `
    title: Prelude in C (simplified)
    composer: J. S. Bach · Well-Tempered Clavier
    info: Broken chords: each bar is one chord played note by note. Great for reading ledger lines.
    time: 4/4
    tempo: 76
    difficulty: 2
    C4e E4e G4e C5e E5e G4e C5e E5e | C4e D4e A4e D5e F5e A4e D5e F5e |
    B3e D4e G4e D5e F5e G4e D5e F5e | C4e E4e G4e C5e E5e G4e C5e E5e |
    C4e E4e A4e E5e A5e A4e E5e A5e | C4e D4e F#4e A4e D5e F#4e A4e D5e |
    B3e D4e G4e D5e G5e G4e D5e G5e | B3e C4e E4e G4e C5e E4e G4e C5e |
    C4e E4e G4e C5e E5h |`,

  'fur-elise': `
    title: Für Elise (opening)
    composer: Beethoven
    info: The famous E–D♯ wiggle. Sixteenth notes in 3/8 — start slow!
    time: 3/8
    tempo: 50
    difficulty: 3
    E5s D#5s | E5s D#5s E5s B4s D5s C5s | A4e Rs C4s E4s A4s | B4e Rs E4s G#4s B4s | C5e Rs E4s E5s D#5s |
    E5s D#5s E5s B4s D5s C5s | A4e Rs C4s E4s A4s | B4e Rs E4s C5s B4s | A4q. |`,
};

export const BUILTIN_SONGS: Song[] = Object.entries(SOURCES).map(([id, text]) => {
  const { song, errors } = parseSongText(text);
  if (!song || errors.length) throw new Error(`Built-in song ${id}: ${errors.join(' ')}`);
  return { ...song, id, builtin: true };
});
