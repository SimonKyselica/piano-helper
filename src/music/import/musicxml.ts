import { toMidi, type Note, type Step } from '../notes';
import { QUARTER } from '../song';
import type { RawNote } from './notate';

export interface XmlTrack {
  name: string;
  /** 1 = upper staff (right hand), 2 = lower staff (left hand). */
  staff: number;
  notes: RawNote[];
}

export interface XmlScore {
  title?: string;
  composer?: string;
  tracks: XmlTrack[];
  time?: [number, number];
  tempo?: number;
}

const child = (el: Element, name: string) => Array.from(el.children).find((c) => c.localName === name) ?? null;
const childText = (el: Element, name: string) => child(el, name)?.textContent?.trim() ?? '';

/** Reads notes, ties, chords and multiple staves from partwise MusicXML. */
export function parseMusicXml(xml: string): XmlScore {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The MusicXML file couldn’t be read.');
  const root = doc.documentElement;
  if (root.localName === 'score-timewise') throw new Error('“Timewise” MusicXML isn’t supported. Export as standard (partwise) MusicXML.');
  if (root.localName !== 'score-partwise') throw new Error('This is not a MusicXML score.');

  const out: XmlScore = { tracks: [] };
  out.title = root.querySelector('work > work-title')?.textContent?.trim() || root.querySelector('movement-title')?.textContent?.trim() || undefined;
  out.composer = root.querySelector('identification > creator[type="composer"]')?.textContent?.trim() || undefined;
  const names = new Map(Array.from(root.querySelectorAll('part-list > score-part')).map((p) => [p.getAttribute('id'), childText(p, 'part-name')]));

  for (const part of Array.from(root.children).filter((c) => c.localName === 'part')) {
    const byStaff = new Map<number, RawNote[]>();
    const openTies = new Map<string, RawNote>();
    let divisions = 1;
    let measureStart = 0;
    for (const measure of Array.from(part.children).filter((c) => c.localName === 'measure')) {
      let cursor = 0;
      let longest = 0;
      let lastOnset = 0;
      for (const el of Array.from(measure.children)) {
        const ticks = (n: number) => (n * QUARTER) / divisions;
        if (el.localName === 'attributes') {
          const d = Number(childText(el, 'divisions'));
          if (d > 0) divisions = d;
          const time = child(el, 'time');
          if (time && !out.time) {
            const beats = Number(childText(time, 'beats'));
            const type = Number(childText(time, 'beat-type'));
            if (beats > 0 && [1, 2, 4, 8, 16].includes(type)) out.time = [beats, type];
          }
        } else if (el.localName === 'backup') {
          cursor -= ticks(Number(childText(el, 'duration')));
        } else if (el.localName === 'forward') {
          cursor += ticks(Number(childText(el, 'duration')));
        } else if (el.localName === 'direction' || el.localName === 'sound') {
          const sound = el.localName === 'sound' ? el : el.querySelector('sound');
          const tempo = Number(sound?.getAttribute('tempo'));
          if (tempo > 0 && !out.tempo) out.tempo = tempo;
        } else if (el.localName === 'note') {
          if (child(el, 'grace')) continue;
          const dur = ticks(Number(childText(el, 'duration')) || 0);
          const isChord = Boolean(child(el, 'chord'));
          const onset = isChord ? lastOnset : cursor;
          if (!isChord) {
            lastOnset = cursor;
            cursor += dur;
            longest = Math.max(longest, cursor);
          }
          const pitch = child(el, 'pitch');
          if (!pitch) continue;
          const note: Note = { step: childText(pitch, 'step') as Step, alter: Math.round(Number(childText(pitch, 'alter')) || 0), octave: Number(childText(pitch, 'octave')) };
          const midi = toMidi(note);
          const staff = Number(childText(el, 'staff')) || 1;
          const ties = Array.from(el.children).filter((c) => c.localName === 'tie').map((c) => c.getAttribute('type'));
          const key = `${staff}:${midi}`;
          const start = measureStart + onset;
          const tied = ties.includes('stop') ? openTies.get(key) : undefined;
          if (tied) {
            tied.dur = start + dur - tied.start;
            if (!ties.includes('start')) openTies.delete(key);
            continue;
          }
          const raw: RawNote = { start, dur, midi, note };
          byStaff.set(staff, [...(byStaff.get(staff) ?? []), raw]);
          if (ties.includes('start')) openTies.set(key, raw);
        }
      }
      measureStart += Math.max(longest, cursor);
    }
    const name = names.get(part.getAttribute('id')) || 'Part';
    for (const [staff, notes] of [...byStaff].sort((a, b) => a[0] - b[0])) {
      const label = byStaff.size > 1 ? `${name} – ${staff === 1 ? 'right hand' : staff === 2 ? 'left hand' : `staff ${staff}`}` : name;
      out.tracks.push({ name: label, staff, notes });
    }
  }
  if (!out.tracks.length) throw new Error('No notes found in this MusicXML file.');
  return out;
}

/** Unpack a compressed .mxl file and return the main MusicXML document. */
export async function readMxl(buf: ArrayBuffer): Promise<string> {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('The .mxl file looks damaged.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries = new Map<string, { method: number; size: number; offset: number }>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const nameLen = v.getUint16(p + 28, true);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));
    entries.set(name, { method: v.getUint16(p + 10, true), size: v.getUint32(p + 20, true), offset: v.getUint32(p + 42, true) });
    p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  const read = async (name: string) => {
    const e = entries.get(name);
    if (!e) throw new Error(`Missing ${name} in .mxl file.`);
    const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
    const bytes = new Uint8Array(buf, start, e.size);
    if (e.method === 0) return decoder.decode(bytes);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return decoder.decode(await new Response(stream).arrayBuffer());
  };
  let main = [...entries.keys()].find((n) => !n.startsWith('META-INF') && /\.(musicxml|xml)$/i.test(n));
  if (entries.has('META-INF/container.xml')) {
    const container = await read('META-INF/container.xml');
    main = /full-path="([^"]+)"/.exec(container)?.[1] ?? main;
  }
  if (!main) throw new Error('No score found inside the .mxl file.');
  return read(main);
}
