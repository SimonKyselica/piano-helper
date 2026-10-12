import { useEffect, useRef, useState } from 'react';
import { useMicNotes } from '../../audio/mic';
import { Keyboard, type KeyMark } from '../../components/Keyboard';
import { MicPanel } from '../../components/MicPanel';
import { Segmented } from '../../components/ui';
import { STEPS, isBlackKey, midiName, mod, noteName, rangeMidi } from '../../music/notes';
import { useSettings } from '../../state/settings';
import { Task } from './Task';

const TWO = [1, 3];
const THREE = [6, 8, 10];

export function KeyboardChapter() {
  const [groups, setGroups] = useState<'2' | '3' | 'none'>('2');
  const marks: Partial<Record<number, KeyMark>> = {};
  for (const m of rangeMidi(48, 72)) {
    const pc = mod(m, 12);
    if ((groups === '2' && TWO.includes(pc)) || (groups === '3' && THREE.includes(pc))) marks[m] = 'on';
  }
  const cf: Partial<Record<number, KeyMark>> = {};
  const cfLabels: Record<number, string> = {};
  for (const m of [48, 53, 60, 65, 72]) {
    cf[m] = mod(m, 12) === 0 ? 'on' : 'soft';
    cfLabels[m] = mod(m, 12) === 0 ? 'C' : 'F';
  }
  return (
    <>
      <section className="card prose">
        <p>
          A piano looks like a long row of the same keys, but the <b>black keys</b> make a pattern: a group of <b>two</b>, then a group of <b>three</b>, over and over.
        </p>
        <p>That pattern is your map. Every note sits in the same spot in the pattern, all the way up and down the piano.</p>
        <Segmented
          label="Highlight"
          value={groups}
          onChange={setGroups}
          options={[
            { value: '2', label: 'Groups of 2' },
            { value: '3', label: 'Groups of 3' },
            { value: 'none', label: 'None' },
          ]}
        />
        <Keyboard from={48} to={72} marks={marks} height={130} minKeyWidth={22} />
      </section>

      <section className="card prose">
        <p>
          <b>C</b> is the white key just <b>left of the two black keys</b>. <b>F</b> is just <b>left of the three</b>.
        </p>
        <p>Once you can find C and F, you can count up the letters to find any other note.</p>
        <Keyboard from={48} to={72} marks={cf} labels={cfLabels} height={130} minKeyWidth={22} />
      </section>

      <FindAll />
    </>
  );
}

const FIND_TASKS = [
  { pc: 0, text: 'Tap every C (left of the 2 black keys)' },
  { pc: 5, text: 'Now every F (left of the 3 black keys)' },
  { pc: 4, text: 'Every E (right of the 2 black keys)' },
  { pc: 11, text: 'Every B (right of the 3 black keys)' },
];

function FindAll() {
  const [task, setTask] = useState(0);
  const [found, setFound] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const t = FIND_TASKS[task];
  const all = t ? rangeMidi(48, 72).filter((m) => mod(m, 12) === t.pc) : [];
  const marks: Partial<Record<number, KeyMark>> = {};
  found.forEach((m) => (marks[m] = 'correct'));
  if (wrong !== null) marks[wrong] = 'wrong';

  const press = (m: number) => {
    if (!t) return;
    if (mod(m, 12) !== t.pc) {
      setWrong(m);
      window.setTimeout(() => setWrong((w) => (w === m ? null : w)), 500);
      return;
    }
    const next = found.includes(m) ? found : [...found, m];
    setFound(next);
    if (next.length === all.length) {
      window.setTimeout(() => {
        setTask((i) => i + 1);
        setFound([]);
      }, 700);
    }
  };

  return (
    <Task title={t ? t.text : 'You can find your way around the keyboard!'} done={!t}>
      {t ? (
        <>
          <p className="muted small">
            Found {found.length} of {all.length}
          </p>
          <Keyboard from={48} to={72} marks={marks} onPress={press} height={140} minKeyWidth={22} landmarks={false} />
        </>
      ) : (
        <button
          className="btn small ghost"
          onClick={() => {
            setTask(0);
            setFound([]);
          }}
        >
          Do it again
        </button>
      )}
    </Task>
  );
}

export function NamesChapter() {
  const { naming } = useSettings();
  const letters = [...STEPS, ...STEPS, 'C' as const].map((step) => noteName({ step, alter: 0, octave: 4 }, naming));
  const whiteLabels = Object.fromEntries(rangeMidi(48, 72).filter((m) => !isBlackKey(m)).map((m) => [m, midiName(m, naming)]));
  const octaveLabels = Object.fromEntries(rangeMidi(36, 84).filter((m) => mod(m, 12) === 0).map((m) => [m, midiName(m, naming, true)]));
  return (
    <>
      <section className="card prose">
        <p>
          White keys are named with just <b>seven letters</b>. After the last one the names start again:
        </p>
        <div className="alphabet">
          {letters.map((l, i) => (
            <span key={i} className={i % 7 === 0 ? 'alpha c' : 'alpha'}>
              {l}
            </span>
          ))}
        </div>
        {naming === 'german' && <p className="muted small">In Central Europe the note B is called H, and B means B♭.</p>}
        <Keyboard from={48} to={72} labels={whiteLabels} height={130} minKeyWidth={22} />
      </section>

      <section className="card prose">
        <p>
          From one C up to the next C is an <b>octave</b>. Each octave gets a number. The C in the middle of the piano is <b>C4</b>, called <b>Middle C</b> (marked with a dot).
        </p>
        <p className="muted small">
          On an 88-key piano, Middle C is the 4th C from the left, usually right under the brand name. On a 61-key keyboard it’s the 3rd C.
        </p>
        <Keyboard from={36} to={84} marks={{ 60: 'on' }} labels={octaveLabels} height={120} minKeyWidth={20} focus={60} />
      </section>

      <NameGame />
    </>
  );
}

const ROUNDS = 10;

function NameGame() {
  const { naming, strictOctave } = useSettings();
  const makeTarget = (prev: number | null) => {
    const pool = rangeMidi(48, 71).filter((m) => !isBlackKey(m) && m !== prev);
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(() => makeTarget(null));
  const [right, setRight] = useState(0);
  const [flash, setFlash] = useState<{ m: number; ok: boolean } | null>(null);
  const missed = useRef(false);
  const exact = round >= 6;
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const answer = (m: number, fromMic: boolean) => {
    if (round >= ROUNDS || flash?.ok) return;
    const sameName = mod(m - target, 12) === 0;
    const ok = exact ? m === target || (fromMic && !strictOctave && sameName) : sameName;
    setFlash({ m, ok });
    if (!ok) {
      missed.current = true;
      timer.current = window.setTimeout(() => setFlash(null), 500);
      return;
    }
    if (!missed.current) setRight((r) => r + 1);
    timer.current = window.setTimeout(() => {
      missed.current = false;
      setFlash(null);
      setRound((r) => r + 1);
      setTarget((t) => makeTarget(t));
    }, 600);
  };
  useMicNotes((m) => answer(m, true));

  const marks: Partial<Record<number, KeyMark>> = {};
  if (flash) marks[flash.m] = flash.ok ? 'correct' : 'wrong';
  const done = round >= ROUNDS;

  return (
    <Task title={done ? `Done! ${right} of ${ROUNDS} on the first try.` : exact ? `Find ${midiName(target, naming, true)}` : `Find any ${midiName(target, naming)}`} done={done}>
      {!done ? (
        <>
          <p className="muted small">
            Round {round + 1} of {ROUNDS}. {exact ? 'Now the octave counts: C3 is the C below Middle C.' : 'Any octave is fine. Play it on your piano or tap the keys.'}
          </p>
          <MicPanel />
          <Keyboard from={48} to={72} marks={marks} onPress={(m) => answer(m, false)} height={140} minKeyWidth={22} />
        </>
      ) : (
        <button
          className="btn small ghost"
          onClick={() => {
            setRound(0);
            setRight(0);
          }}
        >
          Play again
        </button>
      )}
    </Task>
  );
}
