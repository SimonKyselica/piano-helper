import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from '../../audio/context';
import { useMicNotes } from '../../audio/mic';
import { playNote } from '../../audio/synth';
import { Icon } from '../../components/Icon';
import { Keyboard, type KeyMark } from '../../components/Keyboard';
import { MicPanel } from '../../components/MicPanel';
import { PageHeader, Segmented, StreakBadge } from '../../components/ui';
import { midiName, mod, rangeMidi, isBlackKey } from '../../music/notes';
import { recordEar } from '../../state/progress';
import { settingsStore, useSettings } from '../../state/settings';

type Phase = 'idle' | 'listen' | 'correct' | 'reveal';

interface State {
  target: number;
  phase: Phase;
  tries: number;
  wrong: number | null;
  streak: number;
  right: number;
  total: number;
  text: string;
}

export function FindNote() {
  const { findSet, naming, showKeyNames } = useSettings();
  const pool = rangeMidi(60, 71).filter((m) => findSet === 'all' || !isBlackKey(m));
  const [s, setS] = useState<State>({ target: 60, phase: 'idle', tries: 0, wrong: null, streak: 0, right: 0, total: 0, text: '' });
  const ref = useRef(s);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const update = (patch: Partial<State>) => {
    ref.current = { ...ref.current, ...patch };
    setS(ref.current);
  };

  const next = () => {
    unlockAudio();
    const options = pool.filter((m) => m !== ref.current.target);
    const target = options[Math.floor(Math.random() * options.length)];
    update({ target, phase: 'listen', tries: 0, wrong: null, text: 'Which note was that? Find it on the keys.' });
    playNote(target, { duration: 1.5 });
  };

  const answer = (midi: number) => {
    const cur = ref.current;
    if (cur.phase !== 'listen' && cur.phase !== 'reveal') return;
    const name = midiName(cur.target, naming);
    if (mod(midi - cur.target, 12) === 0) {
      const firstTry = cur.phase === 'listen' && cur.tries === 0;
      const streak = firstTry ? cur.streak + 1 : 0;
      if (firstTry) recordEar('find', true, streak);
      update({
        phase: 'correct',
        streak,
        right: cur.right + (firstTry ? 1 : 0),
        total: cur.total + (firstTry ? 1 : 0),
        wrong: null,
        text: firstTry ? `Yes, it was ${name}!` : `That's it: ${name}.`,
      });
      timers.current.push(window.setTimeout(next, 1300));
      return;
    }
    if (cur.tries === 0) recordEar('find', false, 0);
    const tries = cur.tries + 1;
    const sameOctave = cur.target - mod(cur.target, 12) + mod(midi, 12);
    const direction = cur.target > sameOctave ? 'higher' : 'lower';
    update({
      tries,
      streak: 0,
      total: cur.total + (cur.tries === 0 ? 1 : 0),
      wrong: midi,
      phase: tries >= 2 ? 'reveal' : cur.phase,
      text: tries >= 2 ? `It was ${name}. Play it to continue.` : `Not quite. It’s ${direction}. Tap Replay to hear it again.`,
    });
    timers.current.push(window.setTimeout(() => ref.current.wrong === midi && update({ wrong: null }), 700));
  };

  useMicNotes(answer);

  const marks: Partial<Record<number, KeyMark>> = {};
  if (s.phase === 'reveal') marks[s.target] = 'target';
  if (s.phase === 'correct') marks[s.target] = 'correct';
  if (s.wrong !== null) marks[s.wrong] = 'wrong';

  return (
    <div className="practice">
      <PageHeader title="Find the note" backTo="/ear" right={<span className="counter">{s.right}/{s.total}</span>} />
      <div className="drill-controls">
        <Segmented
          label="Notes"
          value={findSet}
          onChange={(v) => {
            settingsStore.set({ findSet: v });
            update({ phase: 'idle', text: '' });
          }}
          options={[
            { value: 'white', label: 'White keys' },
            { value: 'all', label: 'All 12 notes' },
          ]}
        />
      </div>

      <div className="listen-card card">
        <StreakBadge n={s.streak} />
        {s.phase === 'idle' ? (
          <>
            <button className="play-big" onClick={next} aria-label="Start">
              <Icon name="play" size={40} />
            </button>
            <p className="muted">Tap to hear a note between Middle C and the next B, then find it on the keys or your piano. Any octave counts.</p>
          </>
        ) : (
          <>
            <button className="play-big" onClick={() => playNote(ref.current.target, { duration: 1.5 })} aria-label="Replay the note">
              <Icon name="speaker" size={36} />
            </button>
            <div className="listen-actions">
              <button className="btn small ghost" onClick={() => playNote(ref.current.target, { duration: 1.5 })}>
                <Icon name="retry" size={16} /> Replay
              </button>
              <button className="btn small ghost" onClick={() => playNote(60, { duration: 1.2 })}>
                Play C for reference
              </button>
            </div>
          </>
        )}
      </div>

      <p className={`feedback ${s.phase === 'correct' ? 'good' : s.wrong !== null || s.phase === 'reveal' ? 'bad' : ''}`} aria-live="polite">
        {s.text || ' '}
      </p>

      <div className="practice-bottom">
        <MicPanel />
        <Keyboard from={60} to={72} marks={marks} naming={showKeyNames ? naming : null} onPress={answer} height={180} />
      </div>
    </div>
  );
}
