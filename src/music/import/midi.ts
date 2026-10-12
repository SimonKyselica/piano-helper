import { QUARTER } from '../song';
import type { RawNote } from './notate';

export interface MidiTrack {
  name: string;
  channel: number;
  notes: RawNote[];
}

export interface MidiData {
  title?: string;
  tracks: MidiTrack[];
  /** Quarter notes per minute. */
  tempo?: number;
  time?: [number, number];
  /** Key signature: number of sharps (negative = flats). */
  keySharps?: number;
}

/** Minimal Standard MIDI File reader: notes, tempo, time and key signature. */
export function parseMidi(buf: ArrayBuffer): MidiData {
  const v = new DataView(buf);
  const text = (o: number, n: number) => String.fromCharCode(...new Uint8Array(buf, o, n));
  if (buf.byteLength < 14 || text(0, 4) !== 'MThd') throw new Error('This is not a MIDI file.');
  const ntrks = v.getUint16(10);
  const division = v.getUint16(12);
  if (division & 0x8000) throw new Error('This MIDI file uses SMPTE timing, which isn’t supported.');
  const ppq = division;

  const data: MidiData = { tracks: [] };
  const unnamed: string[] = [];
  let pos = 8 + v.getUint32(4);

  for (let t = 0; t < ntrks && pos + 8 <= buf.byteLength; t++) {
    if (text(pos, 4) !== 'MTrk') throw new Error('The MIDI file looks damaged.');
    const end = pos + 8 + v.getUint32(pos + 4);
    let p = pos + 8;
    pos = end;
    let tick = 0;
    let status = 0;
    let name = '';
    const open = new Map<number, { start: number; channel: number }[]>();
    const byChannel = new Map<number, RawNote[]>();

    const vlq = () => {
      let n = 0;
      let b: number;
      do {
        b = v.getUint8(p++);
        n = (n << 7) | (b & 0x7f);
      } while (b & 0x80 && p < end);
      return n;
    };
    const noteOff = (ch: number, key: number) => {
      const starts = open.get(ch * 128 + key);
      const s = starts?.shift();
      if (!s) return;
      const list = byChannel.get(ch) ?? [];
      list.push({ start: (s.start * QUARTER) / ppq, dur: ((tick - s.start) * QUARTER) / ppq, midi: key });
      byChannel.set(ch, list);
    };

    while (p < end) {
      tick += vlq();
      let b = v.getUint8(p);
      if (b & 0x80) p++;
      else b = status;
      if (b === 0xff) {
        const type = v.getUint8(p++);
        const len = vlq();
        if (type === 0x03 && !name) name = text(p, len).trim();
        if (type === 0x51 && data.tempo === undefined) data.tempo = 60_000_000 / ((v.getUint8(p) << 16) | (v.getUint8(p + 1) << 8) | v.getUint8(p + 2));
        if (type === 0x58 && !data.time) data.time = [v.getUint8(p), 2 ** v.getUint8(p + 1)];
        if (type === 0x59 && data.keySharps === undefined) data.keySharps = v.getInt8(p);
        p += len;
      } else if (b === 0xf0 || b === 0xf7) {
        p += vlq();
      } else {
        status = b;
        const kind = b & 0xf0;
        const ch = b & 0x0f;
        if (kind === 0xc0 || kind === 0xd0) p += 1;
        else {
          const key = v.getUint8(p);
          const vel = v.getUint8(p + 1);
          p += 2;
          if (kind === 0x90 && vel > 0) {
            const k = ch * 128 + key;
            open.set(k, [...(open.get(k) ?? []), { start: tick, channel: ch }]);
          } else if (kind === 0x80 || kind === 0x90) noteOff(ch, key);
        }
      }
    }

    if (!byChannel.size && name) unnamed.push(name);
    for (const [ch, notes] of byChannel) {
      if (ch === 9) continue; // drums
      const label = name || `Track ${t + 1}`;
      data.tracks.push({ name: byChannel.size > 1 ? `${label} (channel ${ch + 1})` : label, channel: ch, notes });
    }
  }
  if (unnamed.length) data.title = unnamed[0];
  if (!data.tracks.length) throw new Error('No notes found in this MIDI file.');
  return data;
}
