import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from '../../audio/context';
import { useMicNotes } from '../../audio/mic';
import { playNote } from '../../audio/synth';
import { Keyboard, type KeyMark } from '../../components/Keyboard';
import { MicPanel } from '../../components/MicPanel';
import { Staff, type StaffColumn } from '../../components/Staff';
import type { Clef } from '../../music/levels';
import { diatonic, isBlackKey, midiName, mod, noteFromMidi, noteName, parseNote, toMidi, type Note } from '../../music/notes';
import { useSettings } from '../../state/settings';
import { MiniScore } from './MiniScore';
import { Task } from './Task';

const ORD = ['1st', '2nd', '3rd', '4th', '5th'];

/** "2nd line of the treble staff", "1 ledger line below the bass staff"… */
export function whereOnStaff(n: Note, clef: Clef): string {
  const d = diatonic(n) - (clef === 'treble' ? 30 : 18);
  const staff = `${clef} staff`;
  if (d >= 0 && d <= 8) return d % 2 === 0 ? `${ORD[d / 2]} line of the ${staff}` : `${ORD[(d - 1) / 2]} space of the ${staff}`;
  if (d === -1) return `just below the ${staff}`;
  if (d === 9) return `just above the ${staff}`;
  const below = d < 0;
  const ledger = Math.floor((below ? -d : d - 8) / 2);
  const on = (below ? -d : d - 8) % 2 === 0;
  return `${on ? 'on' : below ? 'under' : 'above'} ledger line ${ledger} ${below ? 'below' : 'above'} the ${staff}`;
}

function columnsFor(midi: number, naming: ReturnType<typeof useSettings>['naming']): StaffColumn[] {
  if (midi === 60) {
    const c4 = parseNote('C4');
    return [{ notes: [{ note: c4, staff: 'treble' }, { note: c4, staff: 'bass' }] }];
  }
  const staff: Clef = midi >= 60 ? 'treble' : 'bass';
  const spellings = isBlackKey(midi) ? [noteFromMidi(midi, 'sharp'), noteFromMidi(midi, 'flat')] : [noteFromMidi(midi)];
  return spellings.map((note) => ({ notes: [{ note, staff }], label: spellings.length > 1 ? noteName(note, naming) : undefined }));
}

const LANDMARKS = [
  { label: 'Middle C', midi: 60 },
  { label: 'Treble G', midi: 67, tip: 'The treble clef curls around the G line.' },
  { label: 'Bass F', midi: 53, tip: 'The two dots of the bass clef sit around the F line.' },
  { label: 'Treble C', midi: 72, tip: '3rd space of the treble staff.' },
  { label: 'Bass C', midi: 48, tip: '2nd space of the bass staff.' },
];

const RHYMES = [
  { label: 'Treble lines', words: 'Every Good Boy Does Fine', seq: [64, 67, 71, 74, 77] },
  { label: 'Treble spaces', words: 'F-A-C-E spells FACE', seq: [65, 69, 72, 76] },
  { label: 'Bass lines', words: 'Good Boys Do Fine Always', seq: [43, 47, 50, 53, 57] },
  { label: 'Bass spaces', words: 'All Cows Eat Grass', seq: [45, 48, 52, 55] },
];

export function StaffChapter() {
  const { naming } = useSettings();
  const [midi, setMidi] = useState(60);
  const [tip, setTip] = useState('Middle C sits between the two staves, on its own little ledger line.');
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const select = (m: number, sound: boolean, why = '') => {
    timers.current.forEach(clearTimeout);
    setMidi(m);
    setTip(why);
    if (sound) {
      unlockAudio();
      playNote(m);
    }
  };
  useMicNotes((m) => m >= 36 && m <= 84 && select(m, false, 'You played this on your piano.'));

  const walk = (seq: number[], words: string) => {
    timers.current.forEach(clearTimeout);
    unlockAudio();
    seq.forEach((m, i) =>
      timers.current.push(
        window.setTimeout(() => {
          setMidi(m);
          setTip(words);
          playNote(m, { duration: 0.6 });
        }, i * 650),
      ),
    );
  };
  const stepWhite = (dir: 1 | -1) => {
    let m = midi + dir;
    while (isBlackKey(m)) m += dir;
    if (m >= 36 && m <= 84) select(m, true);
  };

  const note = noteFromMidi(midi);
  const staff: Clef = midi >= 60 ? 'treble' : 'bass';
  const name = isBlackKey(midi) ? `${noteName(noteFromMidi(midi, 'sharp'), naming, true)} / ${noteName(noteFromMidi(midi, 'flat'), naming, true)}` : noteName(note, naming, true);
  const where = midi === 60 ? 'ledger line between the staves (in either staff)' : whereOnStaff(isBlackKey(midi) ? noteFromMidi(midi, 'sharp') : note, staff);

  return (
    <>
      <section className="card prose">
        <p>
          Music is written on a <b>staff</b> of five lines. Every <b>line</b> and every <b>space</b> between lines is one white key. One step up the staff (line → space → line) is one white key to the right.
        </p>
        <p>
          The <b>clef</b> at the start tells you which keys the lines mean. The <b>treble clef 𝄞</b> is for higher notes (usually the right hand), the <b>bass clef 𝄢</b> for lower notes (usually the left hand). Piano music joins them into the <b>grand staff</b>.
        </p>
      </section>

      <section className="card explorer">
        <div className="explorer-head">
          <span className="explorer-name">{name}</span>
          <span className="muted small">{where}</span>
        </div>
        <Staff layout="grand" columns={columnsFor(midi, naming)} minWidth={15} onPick={(n) => select(toMidi(n), true)} className="explorer-staff" ariaLabel={`${name} on the grand staff`} />
        <p className="explorer-tip muted small">{tip || 'Tap a key, tap the staff, or play your piano.'}</p>
        <div className="explorer-controls">
          <button className="btn small" onClick={() => stepWhite(-1)} aria-label="One step lower">
            ◀ Lower
          </button>
          <button className="btn small" onClick={() => stepWhite(1)} aria-label="One step higher">
            Higher ▶
          </button>
        </div>
        <div className="chip-row scroll">
          {LANDMARKS.map((l) => (
            <button key={l.label} className={`chip ${midi === l.midi ? 'active' : ''}`} onClick={() => select(l.midi, true, l.tip ?? '')}>
              {l.label}
            </button>
          ))}
        </div>
        <MicPanel />
        <Keyboard from={36} to={84} marks={{ [midi]: 'on' }} labels={{ [midi]: midiName(midi, naming) }} onPress={(m) => select(m, false)} focus={midi} minKeyWidth={24} height={150} />
      </section>

      <section className="card">
        <h3>Rhymes for the lines and spaces</h3>
        <p className="muted small">Tap one to see and hear the notes, bottom to top.</p>
        <div className="rhymes">
          {RHYMES.map((r) => (
            <button key={r.label} className="rhyme" onClick={() => walk(r.seq, `${r.label}: ${r.words}`)}>
              <b>{r.label}</b>
              <span>{r.words}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

const QUIZ = ['C#4', 'Db4', 'D#4', 'Eb4', 'F#4', 'Gb4', 'G#4', 'Ab4', 'A#4', 'Bb4'].map(parseNote);
const QUIZ_ROUNDS = 6;

export function SharpsChapter() {
  const { naming, strictOctave } = useSettings();
  const [picked, setPicked] = useState(61);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(() => QUIZ[Math.floor(Math.random() * QUIZ.length)]);
  const [flash, setFlash] = useState<{ m: number; ok: boolean } | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const answer = (m: number, fromMic: boolean) => {
    if (round >= QUIZ_ROUNDS || flash?.ok) return;
    const want = toMidi(target);
    const ok = m === want || (fromMic && !strictOctave && mod(m - want, 12) === 0);
    setFlash({ m, ok });
    timer.current = window.setTimeout(() => {
      setFlash(null);
      if (ok) {
        setRound((r) => r + 1);
        setTarget((t) => {
          const pool = QUIZ.filter((q) => q !== t);
          return pool[Math.floor(Math.random() * pool.length)];
        });
      }
    }, ok ? 600 : 500);
  };
  useMicNotes((m) => answer(m, true));

  const quizMarks: Partial<Record<number, KeyMark>> = {};
  if (flash) quizMarks[flash.m] = flash.ok ? 'correct' : 'wrong';
  const done = round >= QUIZ_ROUNDS;

  return (
    <>
      <section className="card prose">
        <p>
          A <b>sharp ♯</b> raises a note to the very next key on the <b>right</b>. A <b>flat ♭</b> lowers it to the very next key on the <b>left</b>. Usually that’s a black key.
        </p>
        <p>So every black key has two names: the key between C and D is both C♯ and D♭. Tap a key to see both ways of writing it.</p>
        <Staff layout="treble" columns={columnsFor(picked, naming)} minWidth={13} className="sharps-staff" />
        <Keyboard from={60} to={72} marks={{ [picked]: 'on' }} onPress={setPicked} height={130} />
      </section>

      <section className="card prose">
        <p>
          A <b>natural ♮</b> cancels a sharp or flat. A ♯ or ♭ lasts until the end of the <b>bar</b> (the vertical line), so if the same note comes back plain in that bar, it gets a ♮.
        </p>
        <MiniScore text="F4q F#4q F#4q F4q | G4q F#4q G4h |" labels caption="F, F♯, F♯ (still sharp), F♮…" />
      </section>

      <Task title={done ? 'Great, you can read sharps and flats!' : `Play this note (${round + 1} of ${QUIZ_ROUNDS})`} done={done}>
        {!done ? (
          <>
            <Staff layout="treble" columns={[{ notes: [{ note: target }] }]} minWidth={11} className="sharps-staff" ariaLabel="Which key is this?" />
            <MicPanel />
            <Keyboard from={60} to={72} marks={quizMarks} onPress={(m) => answer(m, false)} height={130} />
          </>
        ) : (
          <button className="btn small ghost" onClick={() => setRound(0)}>
            Play again
          </button>
        )}
      </Task>
    </>
  );
}
