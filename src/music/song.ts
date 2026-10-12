import type { Clef } from './levels';
import { noteId, parseNote, toMidi, type Note } from './notes';

/** Note values: whole, half, quarter, eighth, sixteenth. */
export type NoteType = 'w' | 'h' | 'q' | 'e' | 's';

/** Time unit: 24 ticks per quarter note (fits sixteenths, dots and triplets as integers). */
export const QUARTER = 24;
const BASE: Record<NoteType, number> = { w: 96, h: 48, q: 24, e: 12, s: 6 };

export interface SongEvent {
  /** null = rest */
  note: Note | null;
  type: NoteType;
  dotted: boolean;
  triplet: boolean;
  /** Tied to the next event (same pitch, played as one longer note). */
  tie: boolean;
}

export interface Song {
  id: string;
  title: string;
  composer?: string;
  info?: string;
  clef: Clef;
  time: [number, number];
  /** Quarter notes per minute. */
  tempo: number;
  difficulty: 1 | 2 | 3;
  measures: SongEvent[][];
  builtin: boolean;
}

export const eventTicks = (e: Pick<SongEvent, 'type' | 'dotted' | 'triplet'>) =>
  (BASE[e.type] * (e.dotted ? 1.5 : 1) * (e.triplet ? 2 : 3)) / 3;

export const measureTicks = ([n, d]: [number, number]) => n * (96 / d);

/** Beat grouping for beams: dotted quarters in compound time (6/8, 3/8…), quarters otherwise. */
export const beamSpan = ([n, d]: [number, number]) => (d === 8 && n % 3 === 0 ? 36 : 24);

/* ---------- Text notation ----------
 * Header lines:  title: …  composer: …  time: 3/4  tempo: 90  clef: treble|bass  difficulty: 1-3  info: …
 * Notes:  <pitch><value>[.][t][~]   pitch = C4, F#4, Bb3 … or R for a rest
 *         value = w h q e s (whole … sixteenth), "." dotted, "t" triplet, "~" tie to next
 * Bars:   |      Comments: % …
 */

const TOKEN = /^(R|[A-G](?:##|#|bb|b)?-?\d)([whqes])(\.)?(t)?(~)?$/;

export interface ParseResult {
  song: Omit<Song, 'id' | 'builtin'> | null;
  errors: string[];
}

export function parseSongText(text: string): ParseResult {
  const errors: string[] = [];
  const meta: Record<string, string> = {};
  const body: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/%.*$/, '').trim();
    if (!line) continue;
    const m = /^(title|composer|time|tempo|clef|difficulty|info)\s*:\s*(.*)$/i.exec(line);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
    else body.push(line);
  }

  const timeMatch = /^(\d+)\s*\/\s*(1|2|4|8|16)$/.exec(meta.time ?? '4/4');
  const time: [number, number] = timeMatch ? [Number(timeMatch[1]), Number(timeMatch[2])] : [4, 4];
  if (!timeMatch) errors.push(`Unknown time signature “${meta.time}”, using 4/4.`);

  const events: (SongEvent | '|')[] = [];
  const tokens = body.join(' ').replace(/\|/g, ' | ').split(/\s+/).filter(Boolean);
  tokens.forEach((tok, i) => {
    if (tok === '|') return void events.push('|');
    const m = TOKEN.exec(tok);
    if (!m) return void errors.push(`Can’t read “${tok}” (item ${i + 1}). Example: C4q, F#4e, Bb3h., Rq`);
    events.push({
      note: m[1] === 'R' ? null : parseNote(m[1]),
      type: m[2] as NoteType,
      dotted: Boolean(m[3]),
      triplet: Boolean(m[4]),
      tie: Boolean(m[5]) && m[1] !== 'R',
    });
  });

  const notes = events.filter((e): e is SongEvent => e !== '|');
  if (!notes.some((e) => e.note)) errors.push('The song has no notes yet.');

  let measures: SongEvent[][];
  if (events.includes('|')) {
    measures = [[]];
    for (const e of events) {
      if (e === '|') measures.push([]);
      else measures[measures.length - 1].push(e);
    }
    measures = measures.filter((m) => m.length);
    const full = measureTicks(time);
    measures.forEach((m, i) => {
      const sum = m.reduce((a, e) => a + eventTicks(e), 0);
      const pickup = i === 0 && measures.length > 1 && sum < full;
      const lastShort = i === measures.length - 1 && sum < full;
      if (sum !== full && !pickup && !lastShort) {
        errors.push(`Bar ${i + 1} has ${fmtBeats(sum, time)} but ${time[0]}/${time[1]} needs ${fmtBeats(full, time)}.`);
      }
    });
  } else {
    measures = rebar(notes, time);
  }

  const clef: Clef = meta.clef?.toLowerCase().startsWith('b') ? 'bass' : 'treble';
  const tempo = clampTempo(Number(meta.tempo) || 90);
  const d = Number(meta.difficulty);
  const difficulty = d === 1 || d === 2 || d === 3 ? d : estimateDifficulty(measures);
  return {
    song: notes.some((e) => e.note) ? { title: meta.title || 'Untitled', composer: meta.composer, info: meta.info, clef, time, tempo, difficulty, measures } : null,
    errors,
  };
}

const fmtBeats = (ticks: number, [, d]: [number, number]) => {
  const beats = ticks / (96 / d);
  return `${Number.isInteger(beats) ? beats : beats.toFixed(2)} beat${beats === 1 ? '' : 's'}`;
};

export const clampTempo = (t: number) => Math.round(Math.min(220, Math.max(30, t)));

export function songToText(song: Omit<Song, 'id' | 'builtin'>): string {
  const head = [
    `title: ${song.title}`,
    song.composer && `composer: ${song.composer}`,
    `time: ${song.time[0]}/${song.time[1]}`,
    `tempo: ${song.tempo}`,
    `clef: ${song.clef}`,
    `difficulty: ${song.difficulty}`,
    song.info && `info: ${song.info}`,
  ].filter(Boolean);
  const bars = song.measures.map(
    (m) => m.map((e) => `${e.note ? noteId(e.note) : 'R'}${e.type}${e.dotted ? '.' : ''}${e.triplet ? 't' : ''}${e.tie ? '~' : ''}`).join(' ') + ' |',
  );
  const lines: string[] = [];
  for (let i = 0; i < bars.length; i += 4) lines.push(bars.slice(i, i + 4).join(' '));
  return [...head, '', ...lines].join('\n');
}

/* ---------- Notation helpers ---------- */

const VALUES: { ticks: number; type: NoteType; dotted: boolean }[] = [
  { ticks: 96, type: 'w', dotted: false },
  { ticks: 72, type: 'h', dotted: true },
  { ticks: 48, type: 'h', dotted: false },
  { ticks: 36, type: 'q', dotted: true },
  { ticks: 24, type: 'q', dotted: false },
  { ticks: 18, type: 'e', dotted: true },
  { ticks: 12, type: 'e', dotted: false },
  { ticks: 9, type: 's', dotted: true },
  { ticks: 6, type: 's', dotted: false },
];

/** Split a duration (multiple of a sixteenth) into note values, largest first. */
export function decompose(ticks: number): { type: NoteType; dotted: boolean }[] {
  const out: { type: NoteType; dotted: boolean }[] = [];
  let left = Math.round(ticks / 6) * 6;
  while (left >= 6) {
    const v = VALUES.find((v) => v.ticks <= left && (v.ticks % 6 === 0 || left === v.ticks))!;
    out.push({ type: v.type, dotted: v.dotted });
    left -= v.ticks;
  }
  return out;
}

/** Lay notes of any length into bars, splitting across bar lines with ties. */
export function rebar(events: SongEvent[], time: [number, number]): SongEvent[][] {
  const spans = events.map((e) => ({ note: e.note, ticks: eventTicks(e), tie: e.tie, src: e }));
  return barSpans(spans, time);
}

interface Span {
  note: Note | null;
  ticks: number;
  tie?: boolean;
  src?: SongEvent;
}

export function barSpans(spans: Span[], time: [number, number]): SongEvent[][] {
  const full = measureTicks(time);
  const measures: SongEvent[][] = [[]];
  let pos = 0;
  for (const span of spans) {
    let left = span.ticks;
    while (left > 0) {
      const room = full - (pos % full);
      const piece = Math.min(left, room);
      // Keep the original value (dots, triplets) when it fits in one bar.
      const parts = piece === span.ticks && span.src ? [{ type: span.src.type, dotted: span.src.dotted, triplet: span.src.triplet }] : decompose(piece).map((p) => ({ ...p, triplet: false }));
      parts.forEach((p, i) => {
        const lastPiece = left - piece === 0 && i === parts.length - 1;
        measures[measures.length - 1].push({ note: span.note, ...p, tie: span.note ? (lastPiece ? Boolean(span.tie) : true) : false });
      });
      pos += piece;
      left -= piece;
      if (pos % full === 0) measures.push([]);
    }
  }
  return measures.filter((m) => m.length);
}

export interface Playable {
  /** Index of the first event (flattened across bars) — the one to highlight. */
  index: number;
  /** All event indices this sound covers (tied notes). */
  indices: number[];
  midi: number;
  start: number;
  ticks: number;
}

export interface FlatEvent {
  event: SongEvent;
  index: number;
  measure: number;
  start: number;
  ticks: number;
}

/** Events with absolute start times. A short first bar is a pickup and starts mid-bar. */
export function flatten(song: Pick<Song, 'measures' | 'time'>): FlatEvent[] {
  const out: FlatEvent[] = [];
  let t = 0;
  let index = 0;
  song.measures.forEach((m, mi) => {
    for (const event of m) {
      const ticks = eventTicks(event);
      out.push({ event, index: index++, measure: mi, start: t, ticks });
      t += ticks;
    }
  });
  return out;
}

export const pickupTicks = (song: Pick<Song, 'measures' | 'time'>) => {
  if (song.measures.length < 2) return 0;
  const sum = song.measures[0].reduce((a, e) => a + eventTicks(e), 0);
  const full = measureTicks(song.time);
  return sum < full ? sum : 0;
};

/** The notes you actually play: rests removed, tied notes merged. */
export function playables(song: Pick<Song, 'measures' | 'time'>): Playable[] {
  const out: Playable[] = [];
  let open: Playable | null = null;
  for (const f of flatten(song)) {
    const n = f.event.note;
    if (!n) {
      open = null;
      continue;
    }
    const midi = toMidi(n);
    if (open && open.midi === midi) {
      open.ticks += f.ticks;
      open.indices.push(f.index);
    } else {
      open = { index: f.index, indices: [f.index], midi, start: f.start, ticks: f.ticks };
      out.push(open);
    }
    if (!f.event.tie) open = null;
  }
  return out;
}

export function estimateDifficulty(measures: SongEvent[][]): 1 | 2 | 3 {
  const evs = measures.flat();
  const notes = evs.filter((e) => e.note);
  if (!notes.length) return 1;
  const midis = notes.map((e) => toMidi(e.note!));
  const range = Math.max(...midis) - Math.min(...midis);
  const accidentals = notes.filter((e) => e.note!.alter).length / notes.length;
  const fast = evs.filter((e) => e.type === 's' || e.triplet).length / evs.length;
  const score = (range > 12 ? 1 : 0) + (range > 19 ? 1 : 0) + (accidentals > 0.1 ? 1 : 0) + (fast > 0.15 ? 1 : 0) + (notes.length > 120 ? 1 : 0);
  return score >= 3 ? 3 : score >= 1 ? 2 : 1;
}

export function songRange(song: Pick<Song, 'measures'>): [number, number] {
  const midis = song.measures.flat().flatMap((e) => (e.note ? [toMidi(e.note)] : []));
  return [Math.min(...midis), Math.max(...midis)];
}
