import { diatonic, toMidi, type Note } from './notes';
import { beamSpan, flatten, measureTicks, pickupTicks, type Song } from './song';

/** One staff space in SVG units. SMuFL glyphs: 1em = 4 spaces, so font-size = 4 * SP. */
export const SP = 10;
export const FONT = 4 * SP;

const G = {
  gClef: '',
  fClef: '',
  whole: '',
  half: '',
  black: '',
  dot: '',
  flag8Up: '',
  flag8Down: '',
  flag16Up: '',
  flag16Down: '',
  restW: '',
  restH: '',
  restQ: '',
  rest8: '',
  rest16: '',
};
const ACC: Record<number, { ch: string; w: number }> = {
  [-2]: { ch: '', w: 1.65 },
  [-1]: { ch: '', w: 0.9 },
  0: { ch: '', w: 0.67 },
  1: { ch: '', w: 1.0 },
  2: { ch: '', w: 1.0 },
};
const DIGIT_W = [1.88, 1.34, 1.78, 1.68, 1.88, 1.61, 1.74, 1.76, 1.74, 1.74];
const STEM = 3.4 * SP;
const STEM_W = 0.12 * SP;

export type Op =
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; idx?: number }
  | { k: 'glyph'; x: number; y: number; ch: string; idx?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; idx?: number }
  | { k: 'path'; d: string; idx?: number }
  | { k: 'text'; x: number; y: number; s: string; cls: string };

export interface LaidNote {
  index: number;
  x: number;
  note: Note | null;
  start: number;
  /** Tied continuation of the previous note (not played again). */
  continuation: boolean;
}

export interface ScoreLayout {
  width: number;
  minY: number;
  maxY: number;
  labelY: number;
  ops: Op[];
  notes: LaidNote[];
  /** Onset tick → x, for the moving playhead. */
  timeline: { tick: number; x: number }[];
}

interface Head {
  x: number;
  w: number;
  y: number;
  d: number;
  up: boolean;
}

export function layoutScore(song: Pick<Song, 'measures' | 'time' | 'clef'>): ScoreLayout {
  const bottom = song.clef === 'treble' ? 30 : 18;
  const mid = bottom + 4;
  const midY = 2 * SP;
  const yOf = (n: Note) => 4 * SP - ((diatonic(n) - bottom) * SP) / 2;
  const ops: Op[] = [];
  const notes: LaidNote[] = [];
  const timeline: { tick: number; x: number }[] = [];
  const heads = new Map<number, Head>();
  let minY = -1.8 * SP;
  let maxY = 6 * SP;

  ops.push({ k: 'glyph', x: 0.8 * SP, y: song.clef === 'treble' ? 3 * SP : SP, ch: song.clef === 'treble' ? G.gClef : G.fClef });

  // Time signature, numerator over denominator.
  const tsX = 4.6 * SP;
  const nums = [String(song.time[0]), String(song.time[1])];
  const widths = nums.map((s) => [...s].reduce((a, c) => a + DIGIT_W[Number(c)], 0) * SP);
  const tsW = Math.max(...widths);
  nums.forEach((s, row) => {
    let dx = tsX + (tsW - widths[row]) / 2;
    for (const c of s) {
      ops.push({ k: 'glyph', x: dx, y: row === 0 ? SP : 3 * SP, ch: String.fromCharCode(0xe080 + Number(c)) });
      dx += DIGIT_W[Number(c)] * SP;
    }
  });

  const flat = flatten(song);
  const full = measureTicks(song.time);
  const span = beamSpan(song.time);
  const pickup = pickupTicks(song);
  let x = tsX + tsW + 2.2 * SP;
  let prevNote: { note: Note | null; tie: boolean } | null = null;
  const beamGroups: number[][] = [];
  const triplets: number[] = [];

  song.measures.forEach((_, mi) => {
    const evs = flat.filter((f) => f.measure === mi);
    const barStart = evs[0].start - (mi === 0 && pickup ? full - pickup : 0);
    const accidentals = new Map<string, number>();
    // Runs of eighths/sixteenths within one beat; merged into half-bar groups below.
    const runs: { key: number; items: number[]; eighths: boolean }[] = [];
    let run: (typeof runs)[number] | null = null;

    for (const f of evs) {
      const { event: e, index } = f;
      const n = e.note;
      let acc: { ch: string; w: number } | null = null;
      if (n) {
        const key = `${n.step}${n.octave}`;
        const tiedOver = prevNote?.tie && prevNote.note && toMidi(prevNote.note) === toMidi(n);
        if ((accidentals.get(key) ?? 0) !== n.alter && !tiedOver) acc = ACC[n.alter] ?? null;
        accidentals.set(key, n.alter);
      }
      const accW = acc ? (acc.w + 0.3) * SP : 0;
      const headW = (e.type === 'w' ? 1.69 : 1.18) * SP;
      const hx = x + accW;
      timeline.push({ tick: f.start, x: hx + headW / 2 });
      notes.push({ index, x: hx + headW / 2, note: n, start: f.start, continuation: Boolean(prevNote?.tie && n && prevNote.note && toMidi(prevNote.note) === toMidi(n)) });

      if (!n) {
        const rest = { w: [G.restW, 1.13], h: [G.restH, 1.13], q: [G.restQ, 1.08], e: [G.rest8, 1.0], s: [G.rest16, 1.28] }[e.type] as [string, number];
        ops.push({ k: 'glyph', x: hx, y: e.type === 'w' ? SP : midY, ch: rest[0], idx: index });
        if (e.dotted) ops.push({ k: 'glyph', x: hx + rest[1] * SP + 0.3 * SP, y: 1.5 * SP, ch: G.dot, idx: index });
        run = null;
      } else {
        const d = diatonic(n);
        const y = yOf(n);
        minY = Math.min(minY, y - (acc ? 2 : 1) * SP);
        maxY = Math.max(maxY, y + 1.5 * SP);
        for (let l = bottom - 2; l >= d; l -= 2) ops.push({ k: 'line', x1: hx - 0.4 * SP, x2: hx + headW + 0.4 * SP, y1: yOf({ ...n, ...fromD(l) }), y2: yOf({ ...n, ...fromD(l) }), w: 0.18 * SP });
        for (let l = bottom + 10; l <= d; l += 2) ops.push({ k: 'line', x1: hx - 0.4 * SP, x2: hx + headW + 0.4 * SP, y1: yOf({ ...n, ...fromD(l) }), y2: yOf({ ...n, ...fromD(l) }), w: 0.18 * SP });
        if (acc) ops.push({ k: 'glyph', x: x, y, ch: acc.ch, idx: index });
        ops.push({ k: 'glyph', x: hx, y, ch: e.type === 'w' ? G.whole : e.type === 'h' ? G.half : G.black, idx: index });
        if (e.dotted) ops.push({ k: 'glyph', x: hx + headW + 0.3 * SP, y: (d - bottom) % 2 === 0 ? y - SP / 2 : y, ch: G.dot, idx: index });
        heads.set(index, { x: hx, w: headW, y, d, up: d < mid });
        if (e.triplet) triplets.push(index);

        const beamable = e.type === 'e' || e.type === 's';
        const key = Math.floor((f.start - barStart) / span);
        if (beamable && run && run.key === key) {
          run.items.push(index);
          run.eighths &&= e.type === 'e';
        } else if (beamable) {
          run = { key, items: [index], eighths: e.type === 'e' };
          runs.push(run);
        } else run = null;
      }
      prevNote = { note: n, tie: e.tie };
      const spacing = (2.4 + 2.6 * Math.sqrt(f.ticks / 24)) * SP;
      x = hx + Math.max(spacing, headW + (e.dotted ? 1.2 : 0) * SP + 1.4 * SP);
    }
    // In 2/4 and 4/4, plain eighths beam across half a bar (e.g. four eighths together).
    const halfBars = span === 24 && song.time[1] === 4 && (song.time[0] === 2 || song.time[0] === 4);
    const groups: (typeof runs)[number][] = [];
    for (const r of runs) {
      const prev = groups[groups.length - 1];
      const joinable = prev && prev.eighths && r.eighths && prev.items[prev.items.length - 1] + 1 === r.items[0];
      if (halfBars && joinable && Math.floor(prev.key / 2) === Math.floor(r.key / 2)) prev.items.push(...r.items);
      else groups.push({ ...r, items: [...r.items] });
    }
    for (const g of groups) if (g.items.length > 1) beamGroups.push(g.items);

    const last = mi === song.measures.length - 1;
    const barX = x - 0.9 * SP;
    if (last) {
      ops.push({ k: 'line', x1: barX, x2: barX, y1: 0, y2: 4 * SP, w: 0.16 * SP });
      ops.push({ k: 'rect', x: barX + 0.5 * SP, y: 0, w: 0.5 * SP, h: 4 * SP });
      x = barX + 1.2 * SP;
    } else {
      ops.push({ k: 'line', x1: barX, x2: barX, y1: 0, y2: 4 * SP, w: 0.16 * SP });
      x = barX + 1.8 * SP;
    }
  });

  const flatByIndex = new Map(flat.map((f) => [f.index, f]));
  const beamed = new Set(beamGroups.flat());

  // Stems and flags for notes that aren't beamed.
  for (const [index, h] of heads) {
    const e = flatByIndex.get(index)!.event;
    if (e.type === 'w' || beamed.has(index)) continue;
    const end = h.up ? Math.min(h.y - STEM, midY) : Math.max(h.y + STEM, midY);
    stem(index, h, end);
    if (e.type === 'e' || e.type === 's') {
      const ch = e.type === 'e' ? (h.up ? G.flag8Up : G.flag8Down) : h.up ? G.flag16Up : G.flag16Down;
      ops.push({ k: 'glyph', x: stemX(h) - STEM_W / 2, y: end, ch, idx: index });
    }
  }

  function stemX(h: Head) {
    return h.up ? h.x + h.w - STEM_W / 2 : h.x + STEM_W / 2;
  }
  function stem(index: number, h: Head, end: number) {
    const sx = stemX(h);
    ops.push({ k: 'line', x1: sx, x2: sx, y1: h.y + (h.up ? -0.17 : 0.17) * SP, y2: end, w: STEM_W, idx: index });
    minY = Math.min(minY, end - SP);
    maxY = Math.max(maxY, end + SP);
  }

  // Beams: one direction per group, flat beam at the outermost stem.
  for (const g of beamGroups) {
    const hs = g.map((i) => heads.get(i)!);
    const up = hs.reduce((a, h) => a + (h.d - mid), 0) < 0;
    hs.forEach((h) => (h.up = up));
    const beamY = up ? Math.min(midY, ...hs.map((h) => h.y - STEM)) : Math.max(midY, ...hs.map((h) => h.y + STEM));
    g.forEach((i, k) => stem(i, hs[k], beamY));
    const xs = hs.map(stemX);
    const t = 0.5 * SP;
    const beamAt = (level: number) => (up ? beamY + level * 0.75 * SP : beamY - level * 0.75 * SP - t);
    ops.push({ k: 'rect', x: xs[0] - STEM_W / 2, y: beamAt(0), w: xs[xs.length - 1] - xs[0] + STEM_W, h: t });
    const sixteenth = g.map((i) => flatByIndex.get(i)!.event.type === 's');
    for (let k = 0; k < g.length; k++) {
      if (!sixteenth[k]) continue;
      if (k > 0 && sixteenth[k - 1]) ops.push({ k: 'rect', x: xs[k - 1] - STEM_W / 2, y: beamAt(1), w: xs[k] - xs[k - 1] + STEM_W, h: t });
      else if (!(k + 1 < g.length && sixteenth[k + 1])) {
        const toLeft = k > 0;
        ops.push({ k: 'rect', x: toLeft ? xs[k] - 1.1 * SP : xs[k] - STEM_W / 2, y: beamAt(1), w: 1.1 * SP + STEM_W / 2, h: t });
      }
    }
  }

  // Ties curve away from the stems.
  for (const f of flat) {
    if (!f.event.tie || !f.event.note) continue;
    const a = heads.get(f.index);
    const b = heads.get(f.index + 1);
    const next = flatByIndex.get(f.index + 1)?.event.note;
    if (!a || !b || !next || toMidi(next) !== toMidi(f.event.note)) continue;
    const below = a.up || flatByIndex.get(f.index)!.event.type === 'w';
    const y0 = a.y + (below ? 0.6 : -0.6) * SP;
    const bulge = (below ? 1 : -1) * 0.9 * SP;
    const x1 = a.x + a.w * 0.8;
    const x2 = b.x + b.w * 0.2;
    const xm = (x1 + x2) / 2;
    ops.push({ k: 'path', d: `M${x1} ${y0} Q${xm} ${y0 + bulge * 1.5} ${x2} ${y0} Q${xm} ${y0 + bulge * 1.15} ${x1} ${y0}Z`, idx: f.index });
  }

  // "3" over each run of three triplet notes.
  for (let k = 0; k + 2 < triplets.length; k += 3) {
    const hs = triplets.slice(k, k + 3).map((i) => heads.get(i)!);
    const top = Math.min(...hs.map((h) => (h.up ? Math.min(h.y - STEM, midY) : h.y - SP))) - 1.2 * SP;
    ops.push({ k: 'text', x: (hs[0].x + hs[2].x + hs[2].w) / 2, y: top, s: '3', cls: 'score-tuplet' });
    minY = Math.min(minY, top - 1.4 * SP);
  }

  const width = x + 0.4 * SP;
  for (let i = 0; i < 5; i++) ops.unshift({ k: 'line', x1: 0, x2: width - 0.8 * SP, y1: i * SP, y2: i * SP, w: 0.13 * SP });

  const labelY = maxY + 1.4 * SP;
  return { width, minY: minY - 0.4 * SP, maxY: labelY + 0.8 * SP, labelY, ops, notes, timeline: [...timeline, { tick: flat.length ? flat[flat.length - 1].start + flat[flat.length - 1].ticks : 0, x: width }] };
}

function fromD(d: number) {
  const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
  return { step: steps[((d % 7) + 7) % 7], octave: Math.floor(d / 7), alter: 0 };
}

/** x position for any tick between onsets (linear between neighbours). */
export function xAtTick(timeline: { tick: number; x: number }[], tick: number): number {
  if (tick <= timeline[0].tick) return timeline[0].x;
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1];
    const b = timeline[i];
    if (tick <= b.tick) return a.x + ((b.x - a.x) * (tick - a.tick)) / Math.max(1, b.tick - a.tick);
  }
  return timeline[timeline.length - 1].x;
}
