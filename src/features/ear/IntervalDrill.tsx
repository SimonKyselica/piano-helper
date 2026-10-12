import { playNotes } from '../../audio/synth';
import { Keyboard, keyboardRange } from '../../components/Keyboard';
import { Segmented } from '../../components/ui';
import { EAR_INTERVALS, INTERVAL_SETS } from '../../music/ear';
import { midiName } from '../../music/notes';
import { settingsStore, useSettings, type Settings } from '../../state/settings';
import { ChoiceDrill, type Question } from './ChoiceDrill';

const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

function playInterval(lo: number, hi: number, dir: Settings['intervalDir']) {
  if (dir === 'together') playNotes([lo, hi], { duration: 1.8 });
  else playNotes(dir === 'down' ? [hi, lo] : [lo, hi], { gap: 0.75, duration: 1.5 });
}

export function IntervalDrill() {
  const { intervalSet, intervalDir, naming } = useSettings();
  const set = INTERVAL_SETS.find((s) => s.id === intervalSet) ?? INTERVAL_SETS[0];
  const intervals = EAR_INTERVALS.filter((i) => set.ids.includes(i.id));

  const make = (prev: Question | null): Question => {
    const pool = intervals.length > 1 ? intervals.filter((i) => i.id !== prev?.answer) : intervals;
    const iv = pool[Math.floor(Math.random() * pool.length)];
    const lo = randInt(48, 72 - iv.semitones);
    const hi = lo + iv.semitones;
    return { answer: iv.id, midis: [lo, hi], play: () => playInterval(lo, hi, intervalDir) };
  };

  const playAs = (q: Question, id: string) => {
    const iv = EAR_INTERVALS.find((i) => i.id === id)!;
    playInterval(q.midis[0], q.midis[0] + iv.semitones, intervalDir);
  };

  const reveal = (q: Question) => {
    const iv = EAR_INTERVALS.find((i) => i.id === q.answer)!;
    const [lo, hi] = q.midis;
    const song = intervalDir === 'down' ? iv.down : iv.up;
    const [from, to] = keyboardRange(lo, hi);
    return (
      <>
        <p className="reveal-title">
          {iv.name} <span className="muted">· {iv.semitones} half step{iv.semitones > 1 ? 's' : ''}</span>
        </p>
        {song ? (
          <p className="reveal-song">
            Sounds like the start of <b>{song}</b>
            {intervalDir === 'together' ? ' (played one note after the other)' : ''}
          </p>
        ) : (
          <p className="reveal-song muted">Going up, it sounds like {iv.up}.</p>
        )}
        <Keyboard
          from={from}
          to={to}
          marks={{ [lo]: 'on', [hi]: 'on' }}
          labels={{ [lo]: midiName(lo, naming), [hi]: midiName(hi, naming) }}
          height={110}
          minKeyWidth={22}
        />
      </>
    );
  };

  return (
    <ChoiceDrill
      key={`${intervalSet}-${intervalDir}`}
      mode="intervals"
      title="Intervals"
      intro="You’ll hear two notes. Name the distance between them."
      controls={
        <>
          <Segmented label="Interval set" value={set.id} onChange={(v) => settingsStore.set({ intervalSet: v })} options={INTERVAL_SETS.map((s) => ({ value: s.id, label: s.label }))} />
          <Segmented
            label="Direction"
            value={intervalDir}
            onChange={(v) => settingsStore.set({ intervalDir: v })}
            options={[
              { value: 'up', label: 'Up' },
              { value: 'down', label: 'Down' },
              { value: 'together', label: 'Together' },
            ]}
          />
        </>
      }
      options={intervals.map((i) => ({ id: i.id, label: i.name, sub: i.short }))}
      make={make}
      playAs={playAs}
      reveal={reveal}
    />
  );
}
