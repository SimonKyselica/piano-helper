import { useState } from 'react';
import { unlockAudio } from '../../audio/context';
import { mic } from '../../audio/mic';
import { playNote } from '../../audio/synth';
import { Icon } from '../../components/Icon';
import { Keyboard, keyboardRange } from '../../components/Keyboard';
import { Staff } from '../../components/Staff';
import { PageHeader, Stars } from '../../components/ui';
import { getLevel, itemsRange, type Clef, type ReadingItem } from '../../music/levels';
import { noteName, toMidi } from '../../music/notes';
import { useProgress } from '../../state/progress';
import { go } from '../../state/router';
import { settingsStore, useSettings } from '../../state/settings';

/** Called from a tap: unlock audio and, if the user used the mic before, start it right away. */
export function startPractice(levelId: string) {
  unlockAudio();
  if (settingsStore.get().micWanted) void mic.start();
  go(`/notes/play/${levelId}`);
}

export function LevelLearn({ id }: { id: string }) {
  const level = getLevel(id);
  const { naming } = useSettings();
  const progress = useProgress();
  const [active, setActive] = useState<number | null>(null);
  if (!level) return <p className="page">Level not found.</p>;

  const stat = progress.levels[level.id];
  const [lo, hi] = itemsRange(level.items);
  const [from, to] = keyboardRange(lo, hi);
  const activeMidi = active !== null ? toMidi(level.items[active].note) : null;

  const marks: Record<number, 'on' | 'soft'> = {};
  const labels: Record<number, string> = {};
  for (const it of level.items) {
    const m = toMidi(it.note);
    marks[m] = 'soft';
    labels[m] = labels[m] && labels[m] !== noteName(it.note, naming) ? `${labels[m]}/${noteName(it.note, naming)}` : noteName(it.note, naming);
  }
  if (activeMidi !== null) marks[activeMidi] = 'on';

  const tapItem = (i: number) => {
    unlockAudio();
    playNote(toMidi(level.items[i].note));
    setActive(i);
  };
  const tapKey = (m: number) => {
    const i = level.items.findIndex((it) => toMidi(it.note) === m);
    setActive(i >= 0 ? i : null);
  };

  const staffFor = (items: { it: ReadingItem; i: number }[], layout: Clef | 'grand') => (
    <div className="staff-scroll">
      <Staff
        layout={layout}
        columns={items.map(({ it }) => ({ notes: [{ note: it.note, staff: it.staff }], label: noteName(it.note, naming) }))}
        scale={items.length > 6 ? 11 : undefined}
        activeColumn={(() => {
          const k = items.findIndex(({ i }) => i === active);
          return k >= 0 ? k : null;
        })()}
        onColumnTap={(k) => tapItem(items[k].i)}
        ariaLabel={`All notes in ${level.title}`}
      />
    </div>
  );

  const indexed = level.items.map((it, i) => ({ it, i }));

  return (
    <div className="page learn">
      <PageHeader title={level.title} backTo="/notes" right={<Stars n={stat?.stars ?? 0} />} />
      <section className="card prose">
        {level.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>The notes</h3>
          <span className="muted small">Tap a note to hear it</span>
        </div>
        {level.layout === 'mixed' ? (
          <>
            {staffFor(indexed.filter(({ it }) => it.staff === 'treble'), 'treble')}
            {staffFor(indexed.filter(({ it }) => it.staff === 'bass'), 'bass')}
          </>
        ) : (
          staffFor(indexed, level.layout)
        )}
        <Keyboard from={from} to={to} marks={marks} labels={labels} naming={null} onPress={tapKey} focus={activeMidi} height={140} />
      </section>

      {level.tip && (
        <section className="card tip">
          <b>{level.tip.title}</b>
          <p>{level.tip.text}</p>
        </section>
      )}

      <div className="sticky-cta">
        <button className="btn primary block" onClick={() => startPractice(level.id)}>
          <Icon name="play" size={18} />
          Practise {stat ? 'again' : 'now'}
        </button>
      </div>
    </div>
  );
}
