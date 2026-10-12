import { playNotes } from '../../audio/synth';
import { Keyboard, keyboardRange } from '../../components/Keyboard';
import { Segmented } from '../../components/ui';
import { EAR_CHORDS } from '../../music/ear';
import { mod, noteName } from '../../music/notes';
import { CHORD_TYPES, spellFromRoot } from '../../music/theory';
import { settingsStore, useSettings, type Settings } from '../../state/settings';
import { ChoiceDrill, type Question } from './ChoiceDrill';

function playChord(midis: number[], style: Settings['chordStyle']) {
  if (style === 'broken') playNotes(midis, { gap: 0.38, duration: 1.6 });
  else {
    playNotes(midis, { duration: 1.6 });
    if (style === 'both') playNotes(midis, { gap: 0.38, duration: 1.4, when: 1.5 });
  }
}

export function ChordDrill() {
  const { chordSet, chordStyle, naming } = useSettings();
  const chords = chordSet === 'basic' ? EAR_CHORDS.slice(0, 2) : EAR_CHORDS;

  const make = (): Question => {
    const c = chords[Math.floor(Math.random() * chords.length)];
    const root = 48 + Math.floor(Math.random() * 13);
    const midis = c.semitones.map((s) => root + s);
    return { answer: c.id, midis, play: () => playChord(midis, chordStyle) };
  };

  const playAs = (q: Question, id: string) => {
    const c = EAR_CHORDS.find((x) => x.id === id)!;
    playChord(c.semitones.map((s) => q.midis[0] + s), chordStyle);
  };

  const reveal = (q: Question) => {
    const c = EAR_CHORDS.find((x) => x.id === q.answer)!;
    const type = CHORD_TYPES.find((t) => t.id === c.id)!;
    const spelled = spellFromRoot(mod(q.midis[0], 12), type.intervals);
    const [from, to] = keyboardRange(q.midis[0], q.midis[q.midis.length - 1]);
    const labels = Object.fromEntries(q.midis.map((m, i) => [m, noteName(spelled[i], naming)]));
    return (
      <>
        <p className="reveal-title">
          {noteName(spelled[0], naming)} {type.name} <span className="muted">· {c.hint}</span>
        </p>
        <p className="reveal-song muted">Notes: {spelled.map((n) => noteName(n, naming)).join(' – ')}</p>
        <Keyboard from={from} to={to} marks={Object.fromEntries(q.midis.map((m) => [m, 'on' as const]))} labels={labels} height={110} minKeyWidth={22} />
      </>
    );
  };

  return (
    <ChoiceDrill
      key={`${chordSet}-${chordStyle}`}
      mode="chords"
      title="Major or minor?"
      intro="You’ll hear a chord. Is it happy (major) or sad (minor)?"
      controls={
        <>
          <Segmented
            label="Chord types"
            value={chordSet}
            onChange={(v) => settingsStore.set({ chordSet: v })}
            options={[
              { value: 'basic', label: 'Major · Minor' },
              { value: 'all', label: '+ Dim · Aug' },
            ]}
          />
          <Segmented
            label="Play as"
            value={chordStyle}
            onChange={(v) => settingsStore.set({ chordStyle: v })}
            options={[
              { value: 'both', label: 'Both' },
              { value: 'block', label: 'Together' },
              { value: 'broken', label: 'Broken' },
            ]}
          />
        </>
      }
      options={chords.map((c) => ({ id: c.id, label: c.name, sub: c.hint }))}
      make={make}
      playAs={playAs}
      reveal={reveal}
    />
  );
}
