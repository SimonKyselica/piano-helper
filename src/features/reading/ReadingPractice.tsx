import { useEffect, useMemo, useRef, useState } from 'react';
import { mic, useMicNotes } from '../../audio/mic';
import { playNote } from '../../audio/synth';
import { Icon } from '../../components/Icon';
import { Keyboard, keyboardRange, type KeyMark } from '../../components/Keyboard';
import { MicPanel } from '../../components/MicPanel';
import { Staff } from '../../components/Staff';
import { PageHeader, Stars, StreakBadge } from '../../components/ui';
import { LEVELS, getLevel, itemKey, itemsRange, type ReadingItem } from '../../music/levels';
import { midiName, mod, noteName, toMidi } from '../../music/notes';
import { progressStore, recordNote, recordRound, starsFor, weakItems } from '../../state/progress';
import { go } from '../../state/router';
import { settingsStore, useSettings } from '../../state/settings';
import { pickItem } from './pick';

type Phase = 'ask' | 'retry' | 'correct' | 'done';

interface Result {
  item: ReadingItem;
  correct: boolean;
  ms: number;
}

interface RoundState {
  current: ReadingItem;
  phase: Phase;
  results: Result[];
  streak: number;
  bestStreak: number;
  feedback: { kind: 'good' | 'bad' | 'info'; text: string } | null;
  wrong: number | null;
  shownAt: number;
}

export function ReadingPractice({ id }: { id: string }) {
  const settings = useSettings();
  const level = getLevel(id);
  const items = useMemo(
    () => (id === 'weak' ? weakItems(progressStore.get().notes, 8).map((w) => w.item) : (level?.items ?? [])),
    [id, level],
  );
  if (!items.length) {
    return (
      <div className="page">
        <PageHeader title="Practice" backTo="/notes" />
        <p className="muted">Nothing to practise here yet.</p>
      </div>
    );
  }
  return <Round key={id} id={id} items={items} title={level?.title ?? 'Notes to work on'} grand={level?.layout === 'grand'} roundLength={settings.roundLength} />;
}

function Round({ id, items, title, grand, roundLength }: { id: string; items: ReadingItem[]; title: string; grand: boolean; roundLength: number }) {
  const { naming, strictOctave, showKeyNames } = useSettings();
  const fresh = (): RoundState => ({
    current: pickItem(items, null, progressStore.get().notes),
    phase: 'ask',
    results: [],
    streak: 0,
    bestStreak: 0,
    feedback: null,
    wrong: null,
    shownAt: performance.now(),
  });
  const [state, setState] = useState<RoundState>(fresh);
  const ref = useRef(state);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const update = (patch: Partial<RoundState>) => {
    ref.current = { ...ref.current, ...patch };
    setState(ref.current);
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const [lo, hi] = itemsRange(items);
  const [from, to] = keyboardRange(lo, hi);
  const target = toMidi(state.current.note);
  const targetName = noteName(state.current.note, naming);

  function advance() {
    const s = ref.current;
    if (s.results.length >= roundLength) {
      if (id !== 'weak') recordRound(id, s.results.filter((r) => r.correct).length / s.results.length);
      update({ phase: 'done' });
      return;
    }
    update({ current: pickItem(items, s.current, progressStore.get().notes), phase: 'ask', feedback: null, wrong: null, shownAt: performance.now() });
  }

  function miss(s: RoundState): Partial<RoundState> {
    recordNote(itemKey(s.current), false, 0);
    return { results: [...s.results, { item: s.current, correct: false, ms: 0 }], streak: 0 };
  }

  function answer(midi: number, fromMic: boolean) {
    const s = ref.current;
    if (s.phase === 'correct' || s.phase === 'done') return;
    const want = toMidi(s.current.note);
    const name = noteName(s.current.note, naming);
    const sameName = mod(midi - want, 12) === 0;

    if (midi === want || (fromMic && sameName && !strictOctave)) {
      let patch: Partial<RoundState> = {};
      if (s.phase === 'ask') {
        const ms = performance.now() - s.shownAt;
        recordNote(itemKey(s.current), true, ms);
        const streak = s.streak + 1;
        patch = { results: [...s.results, { item: s.current, correct: true, ms }], streak, bestStreak: Math.max(s.bestStreak, streak) };
      }
      const streak = patch.streak ?? 0;
      const text = streak >= 5 && streak % 5 === 0 ? `${name}! ${streak} in a row!` : `${name}, correct!`;
      update({ ...patch, phase: 'correct', wrong: null, feedback: { kind: 'good', text } });
      later(advance, s.phase === 'ask' ? 600 : 900);
      return;
    }

    if (sameName) {
      update({ feedback: { kind: 'info', text: `Right note, wrong octave. Try the ${name} further ${midi < want ? 'right (higher)' : 'left (lower)'}.` } });
      return;
    }

    update({
      ...(s.phase === 'ask' ? miss(s) : {}),
      phase: 'retry',
      wrong: midi,
      feedback: { kind: 'bad', text: `That was ${midiName(midi, naming)}. This note is ${name}. Play it to continue.` },
    });
    later(() => ref.current.wrong === midi && update({ wrong: null }), 700);
  }

  useMicNotes((m) => answer(m, true));

  const showMe = () => {
    const s = ref.current;
    if (s.phase !== 'ask') return;
    update({ ...miss(s), phase: 'retry', feedback: { kind: 'info', text: `This note is ${targetName}. Play it to continue.` } });
  };
  const skip = () => {
    const s = ref.current;
    if (s.phase === 'ask') update(miss(s));
    advance();
  };
  const restart = () => {
    timers.current.forEach(clearTimeout);
    if (settingsStore.get().micWanted) void mic.start();
    ref.current = fresh();
    setState(ref.current);
  };

  if (state.phase === 'done') return <Summary id={id} title={title} grand={grand} results={state.results} bestStreak={state.bestStreak} onRestart={restart} />;

  const marks: Partial<Record<number, KeyMark>> = {};
  if (state.phase === 'retry') marks[target] = 'target';
  if (state.phase === 'correct') marks[target] = 'correct';
  if (state.wrong !== null) marks[state.wrong] = 'wrong';
  const reveal = state.phase === 'retry' || state.phase === 'correct';
  const answered = state.results.length;

  return (
    <div className="practice">
      <PageHeader
        title={title}
        backTo="/notes"
        right={
          <span className="counter">
            {Math.min(answered + (state.phase === 'ask' ? 1 : 0), roundLength)}/{roundLength}
          </span>
        }
      />
      <div className="progressbar" aria-hidden="true">
        <div style={{ width: `${(answered / roundLength) * 100}%` }} />
      </div>

      <div className={`quiz-card ${state.phase}`}>
        <StreakBadge n={state.streak} />
        <Staff
          layout={grand ? 'grand' : state.current.staff}
          columns={[
            {
              notes: [{ note: state.current.note, staff: state.current.staff }],
              label: reveal ? targetName : undefined,
              color: state.phase === 'correct' ? 'var(--good)' : state.phase === 'retry' ? 'var(--accent)' : undefined,
            },
          ]}
          minWidth={grand ? 15 : 13}
          className="quiz-staff"
          ariaLabel="Which note is this?"
        />
      </div>

      <p className={`feedback ${state.feedback?.kind ?? ''}`} aria-live="polite">
        {state.feedback?.text ?? 'Play the note you see'}
      </p>

      <div className="quiz-actions">
        <button className="btn small ghost" onClick={() => playNote(target)}>
          <Icon name="speaker" size={18} /> Hear it
        </button>
        <button className="btn small ghost" onClick={showMe} disabled={state.phase !== 'ask'}>
          <Icon name="eye" size={18} /> Show me
        </button>
        <button className="btn small ghost" onClick={skip} disabled={state.phase === 'correct'}>
          <Icon name="skip" size={18} /> Skip
        </button>
      </div>

      <div className="practice-bottom">
        <MicPanel />
        <Keyboard
          from={from}
          to={to}
          marks={marks}
          naming={showKeyNames ? naming : null}
          onPress={(m) => answer(m, false)}
          focus={state.phase === 'retry' ? target : null}
        />
      </div>
    </div>
  );
}

function Summary({
  id,
  title,
  grand,
  results,
  bestStreak,
  onRestart,
}: {
  id: string;
  title: string;
  grand: boolean;
  results: Result[];
  bestStreak: number;
  onRestart: () => void;
}) {
  const { naming } = useSettings();
  const correct = results.filter((r) => r.correct);
  const accuracy = results.length ? correct.length / results.length : 0;
  const stars = starsFor(accuracy);
  const avg = correct.length ? correct.reduce((a, r) => a + r.ms, 0) / correct.length / 1000 : 0;
  const missed = [...new Map(results.filter((r) => !r.correct).map((r) => [itemKey(r.item), r.item])).values()].slice(0, 8);
  const bothStaves = new Set(missed.map((m) => m.staff)).size > 1;
  const nextLevel = LEVELS[LEVELS.findIndex((l) => l.id === id) + 1];
  const headline =
    accuracy >= 0.95 ? 'Outstanding!' : accuracy >= 0.8 ? 'Great job!' : accuracy >= 0.6 ? 'Good progress' : 'Keep going, it gets easier';

  return (
    <div className="page summary">
      <PageHeader title={title} backTo="/notes" />
      <section className="card summary-card">
        <Stars n={stars} size={40} />
        <h2>{headline}</h2>
        <div className="stat-grid">
          <div>
            <b>{Math.round(accuracy * 100)}%</b>
            <small>correct</small>
          </div>
          <div>
            <b>{avg ? `${avg.toFixed(1)}s` : '–'}</b>
            <small>per note</small>
          </div>
          <div>
            <b>{bestStreak}</b>
            <small>best streak</small>
          </div>
        </div>
      </section>

      {missed.length > 0 && (
        <section className="card">
          <h3>Notes you missed</h3>
          <Staff
            layout={grand || bothStaves ? 'grand' : missed[0].staff}
            columns={missed.map((it) => ({ notes: [{ note: it.note, staff: it.staff }], label: noteName(it.note, naming) }))}
            ariaLabel="Missed notes"
          />
        </section>
      )}

      <div className="button-stack">
        <button className="btn primary block" onClick={onRestart}>
          <Icon name="retry" size={18} /> Practise again
        </button>
        {stars >= 2 && nextLevel && id !== 'weak' && (
          <button className="btn block" onClick={() => go(`/notes/learn/${nextLevel.id}`)}>
            Next level: {nextLevel.title} <Icon name="chevron" size={18} />
          </button>
        )}
        <button className="btn ghost block" onClick={() => go('/notes')}>
          All levels
        </button>
      </div>
    </div>
  );
}
