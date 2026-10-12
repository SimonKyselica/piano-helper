import { useEffect, useMemo, useRef, useState } from 'react';
import { audioContext, unlockAudio } from '../../audio/context';
import { scheduleClicks } from '../../audio/metronome';
import { playNote, stopAll } from '../../audio/synth';
import { Icon } from '../../components/Icon';
import { ScoreStaff, type NoteState } from '../../components/ScoreStaff';
import { noteName } from '../../music/notes';
import { layoutScore } from '../../music/scoreLayout';
import { measureTicks, parseSongText, playables } from '../../music/song';
import { useSettings } from '../../state/settings';

/** A short example in text notation with a Listen button that counts the beats. */
export function MiniScore({ text, tempo = 80, caption, labels = false }: { text: string; tempo?: number; caption?: string; labels?: boolean }) {
  const { naming } = useSettings();
  const song = useMemo(() => parseSongText(text).song!, [text]);
  const layout = useMemo(() => layoutScore(song), [song]);
  const P = useMemo(() => playables(song), [song]);
  const [lit, setLit] = useState<number[]>([]);
  const [beat, setBeat] = useState<number | null>(null);
  const running = useRef<{ timers: number[]; cancel: () => void }>({ timers: [], cancel: () => {} });

  const stop = () => {
    running.current.timers.forEach(clearTimeout);
    running.current.cancel();
    running.current = { timers: [], cancel: () => {} };
    setLit([]);
    setBeat(null);
  };
  useEffect(() => stop, []);

  const play = () => {
    stop();
    stopAll();
    unlockAudio();
    const ctx = audioContext();
    const spt = 60 / tempo / 24;
    const beatTicks = 96 / song.time[1];
    const bar = measureTicks(song.time);
    const length = song.measures.length * bar;
    const t0 = ctx.currentTime + 0.1;
    const start = t0 + bar * spt; // one bar of counting first
    const clicks = [];
    for (let t = 0; t < bar + length; t += beatTicks) clicks.push({ at: t0 + t * spt, accent: t % bar === 0 });
    running.current.cancel = scheduleClicks(clicks);
    const delay = (at: number) => Math.max(0, (at - ctx.currentTime) * 1000);
    clicks.forEach((c, i) => running.current.timers.push(window.setTimeout(() => setBeat((i % (bar / beatTicks)) + 1), delay(c.at))));
    for (const p of P) {
      playNote(p.midi, { when: start - ctx.currentTime + p.start * spt, duration: p.ticks * spt * 0.95 });
      running.current.timers.push(window.setTimeout(() => setLit(p.indices), delay(start + p.start * spt)));
      running.current.timers.push(window.setTimeout(() => setLit((l) => (l === p.indices ? [] : l)), delay(start + (p.start + p.ticks) * spt) - 30));
    }
    running.current.timers.push(window.setTimeout(stop, delay(start + length * spt) + 200));
  };

  const states: Record<number, NoteState> = Object.fromEntries(lit.map((i) => [i, 'lit']));
  const names = labels ? Object.fromEntries(layout.notes.filter((n) => n.note).map((n) => [n.index, noteName(n.note!, naming)])) : null;
  const playing = beat !== null;

  return (
    <div className="mini-score">
      <ScoreStaff layout={layout} states={states} labels={names} scale={8} />
      <div className="mini-score-foot">
        <button className="btn small" onClick={playing ? stop : play}>
          <Icon name={playing ? 'stop' : 'speaker'} size={16} /> {playing ? 'Stop' : 'Listen'}
        </button>
        {playing ? <span className="beat-count">{beat}</span> : caption && <span className="muted small">{caption}</span>}
      </div>
    </div>
  );
}
