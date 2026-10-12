import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from '../../audio/context';
import { playNotes, stopAll } from '../../audio/synth';
import { Icon } from '../../components/Icon';
import { Keyboard, keyboardRange, type KeyMark } from '../../components/Keyboard';
import { Staff } from '../../components/Staff';
import { Segmented } from '../../components/ui';
import { chordFingering, scaleFingering, type Hand } from '../../music/fingering';
import { noteName, pitchClassLabel, toMidi } from '../../music/notes';
import { CHORD_TYPES, SCALE_TYPES, chordNotes, inversionName, scaleNotes, stepPattern } from '../../music/theory';
import { createPersistentStore, useStore } from '../../state/store';
import { useSettings } from '../../state/settings';
import { TopHeader } from '../TopHeader';

const refStore = createPersistentStore('piano-helper:reference', {
  mode: 'chords' as 'chords' | 'scales',
  root: 0,
  chord: 'maj',
  scale: 'major',
  inversion: 0,
  hand: 'rh' as Hand,
});

export function Reference() {
  const { naming } = useSettings();
  const r = useStore(refStore);
  const [lit, setLit] = useState<number[]>([]);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLit([]);
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const chord = CHORD_TYPES.find((c) => c.id === r.chord) ?? CHORD_TYPES[0];
  const scale = SCALE_TYPES.find((s) => s.id === r.scale) ?? SCALE_TYPES[0];
  const isChord = r.mode === 'chords';
  const inversion = Math.min(r.inversion, chord.intervals.length - 1);
  const notes = isChord ? chordNotes(r.root, chord, inversion) : scaleNotes(r.root, scale);
  const rootNote = isChord ? chordNotes(r.root, chord, 0)[0] : notes[0];
  const midis = notes.map(toMidi);
  const fingers = isChord ? chordFingering(chord.id, notes.length, inversion, r.hand) : scaleFingering(scale.id, notes, r.hand);
  const [from, to] = keyboardRange(Math.min(...midis), Math.max(...midis));
  const rootName = noteName(rootNote, naming);
  const symbol = isChord ? `${rootName}${chord.symbol}${inversion ? `/${noteName(notes[0], naming)}` : ''}` : null;

  const set = (patch: Partial<ReturnType<typeof refStore.get>>) => {
    stopAll();
    clearTimers();
    refStore.set(patch);
  };

  /** Play a sequence of note indices, lighting each key as it sounds. */
  const play = (seq: number[][], gap: number) => {
    unlockAudio();
    stopAll();
    clearTimers();
    seq.forEach((group, i) => {
      playNotes(group.map((k) => midis[k]), { when: i * gap, duration: group.length > 1 ? 1.6 : Math.max(gap * 1.6, 0.6) });
      timers.current.push(window.setTimeout(() => setLit(group), i * gap * 1000));
    });
    timers.current.push(window.setTimeout(() => setLit([]), (seq.length - 1) * gap * 1000 + 900));
  };

  const indices = notes.map((_, i) => i);
  const marks: Partial<Record<number, KeyMark>> = {};
  midis.forEach((m, i) => (marks[m] = lit.includes(i) ? 'lit' : 'on'));
  const labels = Object.fromEntries(midis.map((m, i) => [m, noteName(notes[i], naming)]));
  const badges = fingers ? Object.fromEntries(midis.map((m, i) => [m, fingers[i]])) : {};
  const steps = isChord ? [] : stepPattern(notes);

  return (
    <div className="page reference">
      <TopHeader title="Chords & scales" />

      <Segmented
        label="Chords or scales"
        value={r.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'chords', label: 'Chords' },
          { value: 'scales', label: 'Scales' },
        ]}
      />

      <div className="root-grid" role="radiogroup" aria-label="Root note">
        {Array.from({ length: 12 }, (_, pc) => (
          <button key={pc} role="radio" aria-checked={r.root === pc} className={`root-btn ${r.root === pc ? 'active' : ''} ${[1, 3, 6, 8, 10].includes(pc) ? 'black' : ''}`} onClick={() => set({ root: pc })}>
            {pitchClassLabel(pc, naming).replace('/', '/\u200b')}
          </button>
        ))}
      </div>

      <div className="chip-row scroll" role="radiogroup" aria-label={isChord ? 'Chord type' : 'Scale type'}>
        {(isChord ? CHORD_TYPES : SCALE_TYPES).map((t) => {
          const active = t.id === (isChord ? chord.id : scale.id);
          return (
            <button key={t.id} role="radio" aria-checked={active} className={`chip ${active ? 'active' : ''}`} onClick={() => set(isChord ? { chord: t.id } : { scale: t.id })}>
              {t.name}
            </button>
          );
        })}
      </div>

      <section className="card ref-card">
        <div className="ref-title">
          <div>
            <h2>
              {rootName} {isChord ? chord.name : scale.name}
            </h2>
            <p className="muted">{isChord ? chord.feel : scale.feel}</p>
          </div>
          {symbol && <span className="symbol">{symbol}</span>}
        </div>

        <div className="note-chips">
          {notes.map((n, i) => (
            <span key={i} className="note-chip-wrap">
              <span className={`note-chip ${lit.includes(i) ? 'lit' : ''}`}>{noteName(n, naming)}</span>
              {steps[i] && <span className="step">{steps[i]}</span>}
            </span>
          ))}
        </div>

        <div className="staff-scroll">
          <Staff
            layout="treble"
            columns={
              isChord
                ? [{ notes: notes.map((note) => ({ note })), label: symbol ?? undefined }]
                : notes.map((note, i) => ({ notes: [{ note }], label: noteName(note, naming), label2: fingers ? String(fingers[i]) : undefined }))
            }
            activeColumn={isChord ? (lit.length ? 0 : null) : lit.length === 1 ? lit[0] : null}
            minWidth={isChord ? 14 : 0}
            scale={isChord ? undefined : 10}
            ariaLabel={`${rootName} ${isChord ? chord.name : scale.name} on the staff`}
            className={isChord ? 'chord-staff' : ''}
          />
        </div>

        <Keyboard from={from} to={to} marks={marks} labels={labels} badges={badges} height={150} minKeyWidth={26} />

        <div className="ref-actions">
          {isChord ? (
            <>
              <button className="btn primary" onClick={() => play([indices], 0)}>
                <Icon name="play" size={16} /> Play
              </button>
              <button className="btn" onClick={() => play([...indices.map((i) => [i]), indices], 0.35)}>
                Broken
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={() => play([...indices, ...indices.slice(0, -1).reverse()].map((i) => [i]), 0.32)}>
              <Icon name="play" size={16} /> Play up & down
            </button>
          )}
        </div>
      </section>

      <section className="card ref-details">
        {isChord && (
          <div className="detail-row">
            <span className="muted">Inversion</span>
            <Segmented
              label="Inversion"
              value={String(inversion)}
              onChange={(v) => set({ inversion: Number(v) })}
              options={chord.intervals.map((_, i) => ({ value: String(i), label: i === 0 ? 'Root' : `${i}${['', 'st', 'nd', 'rd'][i]}` }))}
            />
          </div>
        )}
        <div className="detail-row">
          <span className="muted">Fingering</span>
          <Segmented
            label="Hand"
            value={r.hand}
            onChange={(hand) => set({ hand })}
            options={[
              { value: 'rh', label: 'Right hand' },
              { value: 'lh', label: 'Left hand' },
            ]}
          />
        </div>
        <dl className="facts">
          {isChord ? (
            <>
              <dt>Formula</dt>
              <dd>{chord.formula}</dd>
              <dt>Position</dt>
              <dd>{inversionName(inversion)}</dd>
            </>
          ) : (
            <>
              <dt>Steps</dt>
              <dd>{steps.join(' · ')}</dd>
            </>
          )}
          <dt>Fingers</dt>
          <dd>
            {fingers ? fingers.join(' · ') : 'No standard fingering for this one. Use what feels comfortable and avoid putting your thumb on black keys.'}
          </dd>
        </dl>
        <p className="muted small">Finger numbers: thumb = 1, index = 2, middle = 3, ring = 4, pinky = 5. W = whole step (2 keys), H = half step (next key).</p>
      </section>
    </div>
  );
}
