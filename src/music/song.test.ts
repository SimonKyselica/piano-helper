import { describe, expect, it } from 'vitest';
import { noteId } from './notes';
import { layoutScore } from './scoreLayout';
import { decompose, eventTicks, flatten, measureTicks, parseSongText, playables, rebar, songToText, type SongEvent } from './song';
import { BUILTIN_SONGS } from './songs';

const bar = (m: SongEvent[]) => m.map((e) => `${e.note ? noteId(e.note) : 'R'}${e.type}${e.dotted ? '.' : ''}${e.tie ? '~' : ''}`).join(' ');

describe('song text format', () => {
  it('parses notes, rests, dots, ties and bars', () => {
    const { song, errors } = parseSongText('title: Test\ntime: 3/4\ntempo: 80\nE4e E4e | G4h. | C5q~ C5q Rq |');
    expect(errors).toEqual([]);
    expect(song!.title).toBe('Test');
    expect(song!.time).toEqual([3, 4]);
    expect(song!.measures.map(bar)).toEqual(['E4e E4e', 'G4h.', 'C5q~ C5q Rq']);
  });

  it('reports bars with the wrong length', () => {
    const { errors } = parseSongText('C4q D4q | E4q | F4w |');
    expect(errors.join(' ')).toMatch(/Bar 2 has 1 beat/);
  });

  it('reports unreadable notes', () => {
    expect(parseSongText('C4q X9 |').errors[0]).toMatch(/Can’t read “X9”/);
  });

  it('splits long notes over bar lines when there are no bars', () => {
    const { song } = parseSongText('C4h. D4h E4q');
    expect(song!.measures.map(bar)).toEqual(['C4h. D4q~', 'D4q E4q']);
  });

  it('round-trips through text', () => {
    const { song } = parseSongText('title: Round\ntime: 6/8\nC4q. D4e E4e F4e | G4q.~ G4q. |');
    const again = parseSongText(songToText(song!)).song!;
    expect(again.measures).toEqual(song!.measures);
    expect(again.time).toEqual([6, 8]);
  });

  it('merges tied notes into one thing to play', () => {
    const { song } = parseSongText('E4h G4h~ | G4q Rq C5h |');
    const p = playables(song!);
    expect(p.map((x) => [x.midi, x.start, x.ticks])).toEqual([
      [64, 0, 48],
      [67, 48, 72],
      [72, 144, 48],
    ]);
    expect(p[1].indices).toEqual([1, 2]);
  });
});

describe('notation helpers', () => {
  it('decomposes durations into note values', () => {
    expect(decompose(30).map((v) => v.type + (v.dotted ? '.' : ''))).toEqual(['q', 's']);
    expect(decompose(42).map((v) => v.type + (v.dotted ? '.' : ''))).toEqual(['q.', 's']);
    expect(decompose(96).map((v) => v.type)).toEqual(['w']);
  });

  it('rebar ties notes across the bar line', () => {
    const { song } = parseSongText('time: 2/4\nC4q D4h E4q');
    const measures = rebar(song!.measures.flat(), [2, 4]);
    expect(measures.map(bar)).toEqual(['C4q D4q~', 'D4q E4q']);
  });
});

describe('built-in songs', () => {
  it('all parse, and every full bar has the right length', () => {
    expect(BUILTIN_SONGS.length).toBeGreaterThanOrEqual(10);
    for (const s of BUILTIN_SONGS) {
      const full = measureTicks(s.time);
      s.measures.slice(1, -1).forEach((m, i) => expect(m.reduce((a, e) => a + eventTicks(e), 0), `${s.id} bar ${i + 2}`).toBe(full));
      expect(playables(s).length, s.id).toBeGreaterThan(3);
    }
  });

  it('lay out without NaN and with correct accidentals', () => {
    for (const s of BUILTIN_SONGS) {
      const l = layoutScore(s);
      expect(JSON.stringify(l.ops).includes('null'), s.id).toBe(false);
      expect(l.notes.length).toBe(flatten(s).length);
    }
    // Für Elise bars 1 and 5: E D# E B D C — the D after D# needs a natural sign each time.
    const elise = layoutScore(BUILTIN_SONGS.find((s) => s.id === 'fur-elise')!);
    const glyphs = elise.ops.filter((o) => o.k === 'glyph').map((o) => (o as { ch: string }).ch);
    expect(glyphs.filter((c) => c === '').length).toBe(2);
  });

  it('beams eighth notes in fours in 4/4', () => {
    const prelude = BUILTIN_SONGS.find((s) => s.id === 'prelude')!;
    const beams = layoutScore({ ...prelude, measures: prelude.measures.slice(0, 1) }).ops.filter((o) => o.k === 'rect');
    // 2 beams + final bar line
    expect(beams.length).toBe(3);
  });
});
