import { describe, expect, it } from 'vitest';
import { chordFingering, scaleFingering } from './fingering';
import { LEVELS } from './levels';
import { noteFromMidi, noteId, noteName, parseNote, pitchClassLabel, toMidi, type Note } from './notes';
import { CHORD_TYPES, SCALE_TYPES, chordNotes, scaleNotes, stepPattern, transpose } from './theory';

const names = (ns: Note[]) => ns.map((n) => noteId(n).replace(/-?\d+$/, '')).join(' ');
const chord = (id: string) => CHORD_TYPES.find((c) => c.id === id)!;
const scale = (id: string) => SCALE_TYPES.find((s) => s.id === id)!;

describe('notes', () => {
  it('converts to MIDI and back', () => {
    expect(toMidi(parseNote('C4'))).toBe(60);
    expect(toMidi(parseNote('A4'))).toBe(69);
    expect(toMidi(parseNote('Bb3'))).toBe(58);
    expect(toMidi(parseNote('B#3'))).toBe(60);
    expect(noteId(noteFromMidi(61))).toBe('C#4');
    expect(noteId(noteFromMidi(61, 'flat'))).toBe('Db4');
  });

  it('names notes in English, Central European and solfège', () => {
    const n = (id: string, naming: 'english' | 'german' | 'solfege') => noteName(parseNote(id), naming);
    expect(n('F#4', 'english')).toBe('F♯');
    expect(n('B4', 'german')).toBe('H');
    expect(n('Bb4', 'german')).toBe('B');
    expect(n('Eb4', 'german')).toBe('Es');
    expect(n('Ab4', 'german')).toBe('As');
    expect(n('Db4', 'german')).toBe('Des');
    expect(n('C#4', 'german')).toBe('Cis');
    expect(n('B#4', 'german')).toBe('His');
    expect(n('G4', 'solfege')).toBe('Sol');
    expect(n('C#4', 'solfege')).toBe('Do♯');
    expect(pitchClassLabel(1, 'english')).toBe('C♯/D♭');
    expect(pitchClassLabel(10, 'german')).toBe('Ais/B');
  });
});

describe('theory', () => {
  it('transposes with correct spelling', () => {
    expect(noteId(transpose(parseNote('D4'), 'M3'))).toBe('F#4');
    expect(noteId(transpose(parseNote('E4'), 'm2'))).toBe('F4');
    expect(noteId(transpose(parseNote('B3'), 'M2'))).toBe('C#4');
    expect(noteId(transpose(parseNote('Eb4'), 'A5'))).toBe('B4');
  });

  it('spells scales with the fewest accidentals', () => {
    expect(names(scaleNotes(0, scale('major')))).toBe('C D E F G A B C');
    expect(names(scaleNotes(2, scale('major')))).toBe('D E F# G A B C# D');
    expect(names(scaleNotes(5, scale('major')))).toBe('F G A Bb C D E F');
    expect(names(scaleNotes(1, scale('major')))).toBe('Db Eb F Gb Ab Bb C Db');
    expect(names(scaleNotes(6, scale('major')))).toBe('F# G# A# B C# D# E# F#');
    expect(names(scaleNotes(1, scale('minor')))).toBe('C# D# E F# G# A B C#');
    expect(names(scaleNotes(8, scale('minor')))).toBe('G# A# B C# D# E F# G#');
    expect(names(scaleNotes(9, scale('harmonic')))).toBe('A B C D E F G# A');
    expect(names(scaleNotes(0, scale('blues')))).toBe('C Eb F Gb G Bb C');
  });

  it('builds chords and inversions', () => {
    expect(names(chordNotes(11, chord('dim')))).toBe('B D F');
    expect(names(chordNotes(6, chord('7')))).toBe('F# A# C# E');
    expect(names(chordNotes(3, chord('min')))).toBe('Eb Gb Bb');
    expect(chordNotes(0, chord('maj7'), 1).map(noteId)).toEqual(['E4', 'G4', 'B4', 'C5']);
    expect(chordNotes(0, chord('maj'), 2).map(noteId)).toEqual(['G4', 'C5', 'E5']);
  });

  it('describes step patterns', () => {
    expect(stepPattern(scaleNotes(0, scale('major'))).join(' ')).toBe('W W H W W W H');
    expect(stepPattern(scaleNotes(9, scale('harmonic'))).join(' ')).toBe('W H W W H W+H H');
  });

  it('has fingering for every common major scale', () => {
    for (let pc = 0; pc < 12; pc++) {
      const notes = scaleNotes(pc, scale('major'));
      expect(scaleFingering('major', notes, 'rh'), names(notes)).toHaveLength(8);
      expect(scaleFingering('major', notes, 'lh'), names(notes)).toHaveLength(8);
    }
    expect(chordFingering('maj', 3, 0, 'rh')).toEqual([1, 3, 5]);
    expect(chordFingering('maj', 3, 1, 'lh')).toEqual([5, 3, 1]);
  });
});

describe('levels', () => {
  it('have unique ids and notes on the right staff', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const l of LEVELS) {
      expect(l.items.length).toBeGreaterThan(3);
      if (l.layout === 'treble' || l.layout === 'bass') expect(l.items.every((it) => it.staff === l.layout)).toBe(true);
    }
  });
});
