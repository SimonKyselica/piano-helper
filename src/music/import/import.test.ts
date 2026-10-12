// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { noteId } from '../notes';
import type { SongEvent } from '../song';
import { buildSong, readSongFile } from './index';
import { parseMidi } from './midi';
import { parseMusicXml } from './musicxml';
import { makeSpeller } from './notate';

const bar = (m: SongEvent[]) => m.map((e) => `${e.note ? noteId(e.note) : 'R'}${e.type}${e.dotted ? '.' : ''}${e.tie ? '~' : ''}`).join(' ');

/** Build a format-0 MIDI file from (delta, bytes) events. */
function midiFile(ppq: number, events: [number, number[]][]): ArrayBuffer {
  const vlq = (n: number) => {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  };
  const body = events.flatMap(([d, bytes]) => [...vlq(d), ...bytes]).concat([0, 0xff, 0x2f, 0]);
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const bytes = [
    ...[0x4d, 0x54, 0x68, 0x64], ...u32(6), 0, 0, 0, 1, (ppq >> 8) & 255, ppq & 255,
    ...[0x4d, 0x54, 0x72, 0x6b], ...u32(body.length), ...body,
  ];
  return new Uint8Array(bytes).buffer;
}

const on = (key: number) => [0x90, key, 90];
const off = (key: number) => [0x80, key, 0];

describe('MIDI import', () => {
  const ppq = 96;
  const file = midiFile(ppq, [
    [0, [0xff, 0x03, 4, ...[...'Test'].map((c) => c.charCodeAt(0))]],
    [0, [0xff, 0x51, 3, 0x07, 0xa1, 0x20]], // 500000 µs = 120 bpm
    [0, [0xff, 0x58, 4, 3, 2, 24, 8]], // 3/4
    [0, on(60)], [0, on(48)], // C4 with a bass C3 underneath
    [96, off(60)], [0, off(48)],
    [0, on(64)], [48, off(64)], // E4 eighth
    [0, on(67)], [146, off(67)], // G4 slightly short of a dotted quarter
    [0, on(72)], [288, off(72)], // C5 dotted half
  ]);

  it('reads notes, tempo and time signature', () => {
    const m = parseMidi(file);
    expect(m.tempo).toBeCloseTo(120);
    expect(m.time).toEqual([3, 4]);
    expect(m.tracks).toHaveLength(1);
    expect(m.tracks[0].notes.map((n) => n.midi)).toEqual([60, 48, 64, 67, 72]);
  });

  it('turns the top line into tidy bars', async () => {
    const imported = await readSongFile(new File([file], 'test.mid'));
    const song = buildSong(imported, imported.defaultChoice, { title: 'T', tempo: imported.tempo })!;
    expect(song.time).toEqual([3, 4]);
    expect(song.measures.map(bar)).toEqual(['C4q E4e G4q.', 'C5h.']);
    expect(song.clef).toBe('treble');
  });
});

describe('MusicXML import', () => {
  const xml = `<?xml version="1.0"?>
  <score-partwise version="4.0">
    <work><work-title>Little Piece</work-title></work>
    <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
    <part id="P1">
      <measure number="1">
        <attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>
        <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><staff>1</staff></note>
        <note><chord/><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><staff>1</staff></note>
        <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><voice>1</voice><staff>1</staff></note>
        <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><tie type="start"/><voice>1</voice><staff>1</staff></note>
        <backup><duration>8</duration></backup>
        <note><pitch><step>C</step><octave>3</octave></pitch><duration>8</duration><voice>5</voice><staff>2</staff></note>
      </measure>
      <measure number="2">
        <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><tie type="stop"/><voice>1</voice><staff>1</staff></note>
        <note><rest/><duration>2</duration><voice>1</voice><staff>1</staff></note>
        <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
        <backup><duration>8</duration></backup>
        <note><pitch><step>G</step><octave>2</octave></pitch><duration>8</duration><voice>5</voice><staff>2</staff></note>
      </measure>
    </part>
  </score-partwise>`;

  it('splits the piano into hands, joins ties and keeps spelling', () => {
    const score = parseMusicXml(xml);
    expect(score.title).toBe('Little Piece');
    expect(score.tracks.map((t) => t.name)).toEqual(['Piano – right hand', 'Piano – left hand']);
    const rh = score.tracks[0].notes;
    expect(rh.find((n) => n.midi === 67)!.dur).toBe(72); // half + quarter tied
  });

  it('builds a song from the right hand', async () => {
    const imported = await readSongFile(new File([xml], 'piece.musicxml'));
    const song = buildSong(imported, imported.defaultChoice, { title: '', tempo: 90 })!;
    expect(song.title).toBe('Little Piece');
    expect(song.measures.map(bar)).toEqual(['E4q F#4q G4h~', 'G4q Rq Bb4h']);
  });
});

describe('spelling', () => {
  it('uses flats in flat keys and sharps in sharp keys', () => {
    const fMajor = makeSpeller([65, 67, 69, 70, 72, 74, 76, 77, 70, 70]);
    expect(noteId(fMajor(70))).toBe('Bb4');
    const dMajor = makeSpeller([62, 64, 66, 67, 69, 71, 73, 74, 66, 73]);
    expect(noteId(dMajor(66))).toBe('F#4');
    expect(noteId(makeSpeller([], -3)(63))).toBe('Eb4');
  });
});
