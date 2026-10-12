import { useEffect, useMemo, useRef, useState } from 'react';
import { audioContext, unlockAudio } from '../../audio/context';
import { mic, useMicNotes } from '../../audio/mic';
import { scheduleClicks } from '../../audio/metronome';
import { playNote, stopAll } from '../../audio/synth';
import { Icon } from '../../components/Icon';
import { Keyboard, keyboardRange, type KeyMark } from '../../components/Keyboard';
import { MicPanel } from '../../components/MicPanel';
import { ScoreStaff, type NoteState, type ScoreHandle } from '../../components/ScoreStaff';
import { PageHeader, Segmented, Stars } from '../../components/ui';
import { midiName, mod, noteName } from '../../music/notes';
import { layoutScore } from '../../music/scoreLayout';
import { measureTicks, pickupTicks, playables, songRange, type Song } from '../../music/song';
import { recordSong, starsFor, useProgress } from '../../state/progress';
import { go } from '../../state/router';
import { settingsStore, useSettings } from '../../state/settings';
import { deleteUserSong, findSong, userSongText, useUserSongs } from '../../state/songs';

type Phase = 'ready' | 'countin' | 'playing' | 'listening' | 'done';
type Grade = 'perfect' | 'good' | 'miss';

interface RunState {
  phase: Phase;
  /** Index into playables where this run starts (tap a note to start mid-song). */
  from: number;
  /** Wait mode: the note you have to play next. */
  cur: number;
  mistakes: number[];
  grades: (Grade | null)[];
  states: Record<number, NoteState>;
  wrong: number | null;
  right: number | null;
  lit: number | null;
  countIn: number | null;
  feedback: string;
  startedAt: number;
  endedAt: number;
}

/** Hit window for "Keep the beat", seconds either side of the note. */
const WINDOW = 0.3;
const PERFECT = 0.13;

export function SongPlayer({ id }: { id: string }) {
  useUserSongs(); // re-render after edits
  const song = findSong(id);
  if (!song) {
    return (
      <div className="page">
        <PageHeader title="Song" backTo="/songs" />
        <p className="muted">This song doesn’t exist anymore.</p>
      </div>
    );
  }
  return <Player key={song.builtin ? song.id : `${song.id}:${userSongText(song.id)}`} song={song} />;
}

function Player({ song }: { song: Song }) {
  const { naming, strictOctave, songMode: mode, songSpeed, songNames, songHints, songMetronome, showKeyNames } = useSettings();
  const stat = useProgress().songs[song.id];
  const layout = useMemo(() => layoutScore(song), [song]);
  const P = useMemo(() => playables(song), [song]);
  const labels = useMemo(
    () => Object.fromEntries(layout.notes.filter((n) => n.note).map((n) => [n.index, noteName(n.note!, naming)])),
    [layout, naming],
  );
  const [lo, hi] = songRange(song);
  const [from, to] = keyboardRange(lo, hi);
  const score = useRef<ScoreHandle>(null);
  const spt = 60 / (song.tempo * songSpeed) / 24;

  const initial = (fromIdx = 0): RunState => ({
    phase: 'ready',
    from: fromIdx,
    cur: fromIdx,
    mistakes: P.map(() => 0),
    grades: P.map(() => null),
    states: P[fromIdx] ? { [P[fromIdx].index]: 'cur' } : {},
    wrong: null,
    right: null,
    lit: null,
    countIn: null,
    feedback: '',
    startedAt: 0,
    endedAt: 0,
  });
  const [s, setS] = useState<RunState>(() => initial());
  const ref = useRef(s);
  const update = (patch: Partial<RunState>) => {
    ref.current = { ...ref.current, ...patch };
    setS(ref.current);
  };

  // Everything running in the background (animation frame, clicks, timers) is cancelled here.
  const running = useRef<{ raf: number; cancelClicks: () => void; timers: number[] }>({ raf: 0, cancelClicks: () => {}, timers: [] });
  const halt = () => {
    cancelAnimationFrame(running.current.raf);
    running.current.cancelClicks();
    running.current.timers.forEach(clearTimeout);
    running.current = { raf: 0, cancelClicks: () => {}, timers: [] };
    stopAll();
    score.current?.setPlayhead(null);
  };
  useEffect(() => halt, []);
  const flash = (patch: Partial<RunState>, key: 'wrong' | 'right', midi: number) => {
    update(patch);
    running.current.timers.push(window.setTimeout(() => ref.current[key] === midi && update({ [key]: null }), 450));
  };

  const reset = (fromIdx = ref.current.from) => {
    halt();
    ref.current = initial(fromIdx);
    setS(ref.current);
  };

  const finish = () => {
    const r = ref.current;
    const total = P.length - r.from;
    const score =
      mode === 'wait'
        ? r.mistakes.slice(r.from).filter((m) => m === 0).length / total
        : r.grades.slice(r.from).reduce((a, g) => a + (g === 'perfect' ? 1 : g === 'good' ? 0.75 : 0), 0) / total;
    if (r.from === 0) recordSong(song.id, mode, score);
    halt();
    update({ phase: 'done', endedAt: performance.now(), lit: null });
  };

  const matches = (midi: number, want: number, fromMic: boolean) => midi === want || (fromMic && !strictOctave && mod(midi - want, 12) === 0);

  /* ---------- Wait for me ---------- */
  function answerWait(midi: number, fromMic: boolean) {
    const r = ref.current;
    if (r.phase !== 'ready' && r.phase !== 'playing') return;
    const p = P[r.cur];
    if (!p) return;
    const startedAt = r.phase === 'ready' ? performance.now() : r.startedAt;
    if (matches(midi, p.midi, fromMic)) {
      const states = { ...r.states };
      for (const i of p.indices) states[i] = r.mistakes[r.cur] ? 'fix' : 'ok';
      const cur = r.cur + 1;
      if (P[cur]) states[P[cur].index] = 'cur';
      flash({ phase: 'playing', startedAt, cur, states, wrong: null, right: midi, feedback: '' }, 'right', midi);
      if (cur >= P.length) finish();
      return;
    }
    const mistakes = [...r.mistakes];
    mistakes[r.cur]++;
    const octave = mod(midi - p.midi, 12) === 0;
    flash(
      {
        phase: 'playing',
        startedAt,
        mistakes,
        wrong: midi,
        feedback: octave ? `Right note, wrong octave. Go ${midi < p.midi ? 'higher' : 'lower'}.` : `That was ${midiName(midi, naming)}. Try again!`,
      },
      'wrong',
      midi,
    );
  }

  /* ---------- Keep the beat ---------- */
  const clock = useRef({ songStart: 0, firstNote: 0 });

  function startBeat() {
    halt();
    unlockAudio();
    const ctx = audioContext();
    const r0 = initial(ref.current.from);
    const fromTick = P[r0.from]?.start ?? 0;
    const full = measureTicks(song.time);
    const pickup = pickupTicks(song);
    const barPos = (fromTick + (pickup ? full - pickup : 0)) % full;
    const t0 = ctx.currentTime + 0.3;
    const firstNote = t0 + (full + barPos) * spt;
    const songStart = firstNote - fromTick * spt;
    const end = songStart + (P[P.length - 1].start + P[P.length - 1].ticks) * spt;
    clock.current = { songStart, firstNote };

    const beat = 96 / song.time[1];
    const clicks: { at: number; accent: boolean }[] = [];
    for (let i = 0, t = t0; t < (songMetronome ? end : firstNote - 0.01); i++, t = t0 + i * beat * spt) clicks.push({ at: t, accent: (i * beat) % full === 0 });
    running.current.cancelClicks = scheduleClicks(clicks);

    ref.current = { ...r0, phase: 'countin', states: {}, startedAt: performance.now() };
    setS(ref.current);

    const loop = () => {
      const now = ctx.currentTime;
      const r = ref.current;
      const tick = (now - songStart) / spt;
      score.current?.setPlayhead(Math.max(tick, fromTick));
      const patch: Partial<RunState> = {};
      if (now < firstNote) {
        const left = Math.ceil((firstNote - now) / (beat * spt));
        if (left !== r.countIn) patch.countIn = left;
      } else if (r.phase === 'countin') {
        patch.phase = 'playing';
        patch.countIn = null;
      }
      // Notes whose window has passed are misses.
      let grades = r.grades;
      let states = r.states;
      let next = -1;
      for (let k = r.from; k < P.length; k++) {
        if (grades[k]) continue;
        const at = songStart + P[k].start * spt;
        if (at + WINDOW < now) {
          if (grades === r.grades) {
            grades = [...grades];
            states = { ...states };
          }
          grades[k] = 'miss';
          for (const i of P[k].indices) states[i] = 'miss';
        } else if (next === -1) next = k;
      }
      if (next !== -1 && states[P[next].index] !== 'cur') {
        if (states === r.states) states = { ...states };
        states[P[next].index] = 'cur';
      }
      if (grades !== r.grades) patch.grades = grades;
      if (states !== r.states) patch.states = states;
      if (next !== r.cur && next !== -1) patch.cur = next;
      if (Object.keys(patch).length) update(patch);
      if (now > end + WINDOW + 0.2) finish();
      else running.current.raf = requestAnimationFrame(loop);
    };
    running.current.raf = requestAnimationFrame(loop);
  }

  function answerBeat(midi: number, fromMic: boolean) {
    const r = ref.current;
    if (r.phase !== 'playing' && r.phase !== 'countin') return;
    const t = audioContext().currentTime - (fromMic ? 0.12 : 0.03);
    let best = -1;
    let bestDt = Infinity;
    for (let k = r.from; k < P.length; k++) {
      if (r.grades[k]) continue;
      const dt = t - (clock.current.songStart + P[k].start * spt);
      if (dt < -WINDOW) break;
      if (Math.abs(dt) <= WINDOW && matches(midi, P[k].midi, fromMic) && Math.abs(dt) < Math.abs(bestDt)) {
        best = k;
        bestDt = dt;
      }
    }
    if (best === -1) {
      flash({ wrong: midi, feedback: 'Wrong note or off the beat' }, 'wrong', midi);
      return;
    }
    const grades = [...r.grades];
    const grade: Grade = Math.abs(bestDt) <= PERFECT ? 'perfect' : 'good';
    grades[best] = grade;
    const states = { ...r.states };
    for (const i of P[best].indices) states[i] = 'ok';
    flash({ grades, states, right: midi, feedback: grade === 'perfect' ? 'Perfect!' : bestDt < 0 ? 'Good, a bit early' : 'Good, a bit late' }, 'right', midi);
  }

  /* ---------- Listen ---------- */
  function listen() {
    halt();
    unlockAudio();
    const ctx = audioContext();
    const r0 = initial(ref.current.from);
    const fromTick = P[r0.from]?.start ?? 0;
    const t0 = ctx.currentTime + 0.15;
    const rest = P.slice(r0.from);
    for (const p of rest) playNote(p.midi, { when: t0 - ctx.currentTime + (p.start - fromTick) * spt, duration: Math.max(0.15, p.ticks * spt * 0.92) });
    const end = t0 + (rest[rest.length - 1].start + rest[rest.length - 1].ticks - fromTick) * spt;
    ref.current = { ...r0, phase: 'listening', states: {} };
    setS(ref.current);
    const loop = () => {
      const now = ctx.currentTime;
      const tick = fromTick + (now - t0) / spt;
      score.current?.setPlayhead(Math.max(tick, fromTick));
      const k = rest.findIndex((p) => tick >= p.start && tick < p.start + p.ticks);
      const p = k >= 0 ? rest[k] : null;
      if ((p?.midi ?? null) !== ref.current.lit || (p && !ref.current.states[p.index])) {
        update({ lit: p?.midi ?? null, states: p ? Object.fromEntries(p.indices.map((i) => [i, 'lit' as NoteState])) : {} });
      }
      if (now > end + 0.3) reset();
      else running.current.raf = requestAnimationFrame(loop);
    };
    running.current.raf = requestAnimationFrame(loop);
  }

  useMicNotes((m) => (mode === 'wait' ? answerWait(m, true) : answerBeat(m, true)));
  const onKey = (m: number) => (mode === 'wait' ? answerWait(m, false) : answerBeat(m, false));

  const tapNote = (index: number) => {
    const phase = ref.current.phase;
    if (phase === 'countin' || phase === 'listening' || (mode === 'beat' && phase === 'playing')) return;
    const k = P.findIndex((p) => p.indices.includes(index));
    if (k >= 0) reset(k);
  };

  const target = P[s.cur];
  const marks: Partial<Record<number, KeyMark>> = {};
  if (target && s.phase !== 'listening' && s.phase !== 'done') {
    if (mode === 'wait' && s.mistakes[s.cur] >= 2) marks[target.midi] = 'target';
    else if (songHints) marks[target.midi] = 'soft';
  }
  if (s.lit !== null) marks[s.lit] = 'lit';
  if (s.right !== null) marks[s.right] = 'correct';
  if (s.wrong !== null) marks[s.wrong] = 'wrong';

  const busy = s.phase === 'countin' || s.phase === 'listening' || (mode === 'beat' && s.phase === 'playing');
  const doneCount = mode === 'wait' ? s.cur - s.from : s.grades.slice(s.from).filter(Boolean).length;
  const total = P.length - s.from;

  let message = s.feedback;
  if (!message) {
    if (s.phase === 'listening') message = 'Listen and follow the notes…';
    else if (s.phase === 'countin') message = 'Get ready…';
    else if (mode === 'wait') message = target ? (songNames ? `Play ${noteName(song.measures.flat()[target.index].note!, naming)}` : 'Play the blue note') : '';
    else if (s.phase === 'ready') message = 'Press Start. Play each note as the line reaches it.';
  }

  return (
    <div className="practice song-player">
      <PageHeader
        title={song.title}
        backTo="/songs"
        right={
          song.builtin ? (
            <Stars n={stat?.stars ?? 0} />
          ) : (
            <>
              <button className="icon-btn" aria-label="Edit song" onClick={() => go(`/songs/edit/${song.id}`)}>
                <Icon name="edit" size={20} />
              </button>
              <button
                className="icon-btn"
                aria-label="Delete song"
                onClick={() => {
                  if (confirm(`Delete “${song.title}”?`)) {
                    deleteUserSong(song.id);
                    go('/songs');
                  }
                }}
              >
                <Icon name="trash" size={20} />
              </button>
            </>
          )
        }
      />

      <div className="song-controls">
        <Segmented
          label="Play mode"
          value={mode}
          onChange={(songMode) => {
            settingsStore.set({ songMode });
            reset();
          }}
          options={[
            { value: 'wait', label: 'Wait for me' },
            { value: 'beat', label: 'Keep the beat' },
          ]}
        />
        <div className="chip-row scroll song-chips">
          <button className={`chip ${songNames ? 'active' : ''}`} onClick={() => settingsStore.set({ songNames: !songNames })}>
            Note names
          </button>
          <button className={`chip ${songHints ? 'active' : ''}`} onClick={() => settingsStore.set({ songHints: !songHints })}>
            Key hints
          </button>
          {mode === 'beat' && (
            <button className={`chip ${songMetronome ? 'active' : ''}`} onClick={() => settingsStore.set({ songMetronome: !songMetronome })}>
              Metronome
            </button>
          )}
          {[0.5, 0.75, 1].map((v) => (
            <button
              key={v}
              className={`chip ${songSpeed === v ? 'active' : ''}`}
              onClick={() => {
                settingsStore.set({ songSpeed: v });
                if (busy) reset();
              }}
            >
              {v === 1 ? 'Full speed' : `${v * 100}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="card score-card">
        <ScoreStaff
          layout={layout}
          states={s.states}
          labels={songNames ? labels : null}
          follow={mode === 'wait' && P[s.cur] ? P[s.cur].index : null}
          onNoteTap={tapNote}
          handle={score}
          ariaLabel={`Sheet music for ${song.title}`}
        />
        {s.countIn !== null && <div className="count-in">{s.countIn}</div>}
        <div className="score-foot">
          <span>
            {song.time[0]}/{song.time[1]} · ♩ = {Math.round(song.tempo * songSpeed)}
          </span>
          <span>
            {doneCount}/{total} notes
          </span>
        </div>
      </div>

      <p className={`feedback ${s.wrong !== null ? 'bad' : s.right !== null ? 'good' : ''}`} aria-live="polite">
        {message || ' '}
      </p>

      <div className="song-actions">
        {s.phase === 'listening' ? (
          <button className="btn" onClick={() => reset()}>
            <Icon name="stop" size={16} /> Stop
          </button>
        ) : (
          <button className="btn" onClick={listen} disabled={busy}>
            <Icon name="speaker" size={18} /> Listen
          </button>
        )}
        {mode === 'beat' &&
          (s.phase === 'countin' || s.phase === 'playing' ? (
            <button className="btn primary" onClick={() => reset()}>
              <Icon name="stop" size={16} /> Stop
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => {
                if (settingsStore.get().micWanted) void mic.start();
                startBeat();
              }}
            >
              <Icon name="play" size={16} /> Start
            </button>
          ))}
        {mode === 'wait' && (
          <button className="btn" onClick={() => reset(0)} disabled={s.phase === 'listening'}>
            <Icon name="retry" size={16} /> From the start
          </button>
        )}
      </div>
      {s.phase === 'ready' && s.from === 0 && song.info && <p className="song-info muted small">{song.info} Tip: tap any note to start from there.</p>}

      <div className="practice-bottom">
        <MicPanel />
        <Keyboard from={from} to={to} marks={marks} naming={showKeyNames ? naming : null} onPress={onKey} focus={target && s.phase !== 'done' ? target.midi : null} />
      </div>

      {s.phase === 'done' && <SongSummary song={song} run={s} mode={mode} total={total} onAgain={() => reset(s.from)} />}
    </div>
  );
}

function SongSummary({ song, run, mode, total, onAgain }: { song: Song; run: RunState; mode: 'wait' | 'beat'; total: number; onAgain: () => void }) {
  const firstTry = run.mistakes.slice(run.from).filter((m) => m === 0).length;
  const grades = run.grades.slice(run.from);
  const perfect = grades.filter((g) => g === 'perfect').length;
  const good = grades.filter((g) => g === 'good').length;
  const score = mode === 'wait' ? firstTry / total : (perfect + good * 0.75) / total;
  const seconds = Math.round((run.endedAt - run.startedAt) / 1000);
  const stars = starsFor(score);
  return (
    <div className="overlay" role="dialog" aria-label="Song finished">
      <section className="card summary-card">
        <Stars n={stars} size={40} />
        <h2>{stars === 3 ? 'Brilliant!' : stars === 2 ? 'Great playing!' : stars === 1 ? 'Nice work!' : 'You made it through!'}</h2>
        <p className="muted">{song.title}</p>
        <div className="stat-grid">
          {mode === 'wait' ? (
            <>
              <div>
                <b>{Math.round(score * 100)}%</b>
                <small>first try</small>
              </div>
              <div>
                <b>{total - firstTry}</b>
                <small>to practise</small>
              </div>
              <div>
                <b>
                  {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                </b>
                <small>time</small>
              </div>
            </>
          ) : (
            <>
              <div>
                <b>{perfect}</b>
                <small>perfect</small>
              </div>
              <div>
                <b>{good}</b>
                <small>good</small>
              </div>
              <div>
                <b>{total - perfect - good}</b>
                <small>missed</small>
              </div>
            </>
          )}
        </div>
        <div className="button-stack">
          <button className="btn primary block" onClick={onAgain}>
            <Icon name="retry" size={18} /> Play again
          </button>
          {mode === 'wait' && score >= 0.8 && (
            <button
              className="btn block"
              onClick={() => {
                settingsStore.set({ songMode: 'beat' });
                onAgain();
              }}
            >
              Try “Keep the beat”
            </button>
          )}
          <button className="btn ghost block" onClick={() => go('/songs')}>
            All songs
          </button>
        </div>
      </section>
    </div>
  );
}
