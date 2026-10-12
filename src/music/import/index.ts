import type { Clef } from '../levels';
import { midiName, toMidi } from '../notes';
import { clampTempo, estimateDifficulty, type Song } from '../song';
import { parseMidi } from './midi';
import { parseMusicXml, readMxl } from './musicxml';
import { makeSpeller, notate, type RawNote } from './notate';

export interface ImportChoice {
  id: string;
  label: string;
  detail: string;
  notes: RawNote[];
  voice: 'top' | 'bottom';
  min?: number;
  max?: number;
}

export interface ImportedFile {
  title: string;
  composer?: string;
  time: [number, number];
  tempo: number;
  keySharps?: number;
  choices: ImportChoice[];
  defaultChoice: string;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 60;

function describe(notes: RawNote[]) {
  const ms = notes.map((n) => n.midi);
  return `${notes.length} notes · ${midiName(Math.min(...ms), 'english', true)}–${midiName(Math.max(...ms), 'english', true)}`;
}

export async function readSongFile(file: File): Promise<ImportedFile> {
  const buf = await file.arrayBuffer();
  const magic = String.fromCharCode(...new Uint8Array(buf, 0, Math.min(4, buf.byteLength)));
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Imported song';

  if (magic === 'MThd') {
    const midi = parseMidi(buf);
    const choices: ImportChoice[] = [];
    for (const [i, t] of midi.tracks.entries()) {
      const low = t.notes.filter((n) => n.midi < 55).length / t.notes.length;
      const high = t.notes.filter((n) => n.midi >= 60).length / t.notes.length;
      if (low > 0.15 && high > 0.15) {
        const rh = t.notes.filter((n) => n.midi >= 60);
        const lh = t.notes.filter((n) => n.midi < 60);
        choices.push({ id: `${i}-rh`, label: `${t.name}: right hand (Middle C and up)`, detail: describe(rh), notes: t.notes, voice: 'top', min: 60 });
        choices.push({ id: `${i}-top`, label: `${t.name}: melody (highest notes)`, detail: describe(t.notes), notes: t.notes, voice: 'top' });
        choices.push({ id: `${i}-lh`, label: `${t.name}: left hand (below Middle C)`, detail: describe(lh), notes: t.notes, voice: 'bottom', max: 59 });
      } else {
        choices.push({ id: `${i}-top`, label: t.name, detail: describe(t.notes), notes: t.notes, voice: 'top' });
      }
    }
    const best = choices.find((c) => c.id.endsWith('-rh')) ?? [...choices].sort((a, b) => median(b.notes.map((n) => n.midi)) - median(a.notes.map((n) => n.midi)))[0];
    return {
      title: midi.title || fallbackTitle,
      time: midi.time ?? [4, 4],
      tempo: clampTempo(midi.tempo ?? 100),
      keySharps: midi.keySharps,
      choices,
      defaultChoice: best.id,
    };
  }

  const xml = magic.startsWith('PK') ? await readMxl(buf) : new TextDecoder().decode(buf);
  const score = parseMusicXml(xml);
  const choices: ImportChoice[] = score.tracks.map((t, i) => ({
    id: `x${i}`,
    label: t.name,
    detail: describe(t.notes),
    notes: t.notes,
    voice: t.staff === 2 ? 'bottom' : 'top',
  }));
  return {
    title: score.title || fallbackTitle,
    composer: score.composer,
    time: score.time ?? [4, 4],
    tempo: clampTempo(score.tempo ?? 90),
    choices,
    defaultChoice: choices[0].id,
  };
}

export function buildSong(file: ImportedFile, choiceId: string, opts: { title: string; tempo: number; clef?: Clef }): Omit<Song, 'id' | 'builtin'> | null {
  const choice = file.choices.find((c) => c.id === choiceId) ?? file.choices[0];
  const midis = choice.notes.map((n) => n.midi);
  const measures = notate(choice.notes, {
    time: file.time,
    voice: choice.voice,
    minMidi: choice.min,
    maxMidi: choice.max,
    spell: makeSpeller(midis, file.keySharps),
  });
  if (!measures.length) return null;
  const used = measures.flat().flatMap((e) => (e.note ? [toMidi(e.note)] : []));
  return {
    title: opts.title.trim() || file.title,
    composer: file.composer,
    clef: opts.clef ?? (median(used) >= 57 ? 'treble' : 'bass'),
    time: file.time,
    tempo: clampTempo(opts.tempo),
    difficulty: estimateDifficulty(measures),
    measures,
  };
}
