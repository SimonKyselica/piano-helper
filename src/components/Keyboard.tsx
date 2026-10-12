import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from '../audio/context';
import { playNote } from '../audio/synth';
import { isBlackKey, midiName, mod, rangeMidi, type Naming } from '../music/notes';

export type KeyMark = 'on' | 'lit' | 'target' | 'correct' | 'wrong' | 'soft';

interface Props {
  from: number;
  to: number;
  marks?: Partial<Record<number, KeyMark>>;
  labels?: Partial<Record<number, string>>;
  /** Small numbered badges (finger numbers). */
  badges?: Partial<Record<number, number>>;
  /** Name every white key. */
  naming?: Naming | null;
  onPress?: (midi: number) => void;
  sound?: boolean;
  minKeyWidth?: number;
  height?: number;
  /** Keep this key scrolled into view. */
  focus?: number | null;
  /** Show the C3/C4… labels and the Middle C dot (off for "find the C" exercises). */
  landmarks?: boolean;
  className?: string;
}

/** Nudge black keys off-centre like a real piano. */
const BLACK_OFFSET: Record<number, number> = { 1: -0.15, 3: 0.15, 6: -0.18, 8: 0, 10: 0.18 };

/** Range from the C at or below `lo` to a white key at or above `hi`, at least one octave. */
export function keyboardRange(lo: number, hi: number): [number, number] {
  const from = lo - mod(lo, 12);
  let to = Math.max(hi, from + 12);
  if (isBlackKey(to)) to++;
  return [from, to];
}

export function Keyboard({
  from,
  to,
  marks = {},
  labels = {},
  badges = {},
  naming = null,
  onPress,
  sound = true,
  minKeyWidth = 34,
  height = 168,
  focus = null,
  landmarks = true,
  className = '',
}: Props) {
  const [pressed, setPressed] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const keys = rangeMidi(from, to);
  const whites = keys.filter((m) => !isBlackKey(m));
  const w = 100 / whites.length;
  const bw = w * 0.62;

  // Scroll the focused (or first marked) key into view horizontally.
  const scrollTarget = focus ?? Number(Object.keys(marks)[0] ?? NaN);
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth || Number.isNaN(scrollTarget)) return;
    const key = el.querySelector<HTMLElement>(`[data-midi="${scrollTarget}"]`);
    if (!key) return;
    const left = key.offsetLeft + key.offsetWidth / 2 - el.clientWidth / 2;
    el.scrollTo({ left, behavior: 'smooth' });
  }, [scrollTarget]);

  // Start centred when the keyboard doesn't fit.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth && Number.isNaN(scrollTarget)) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [from, to]);

  const press = (midi: number) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    unlockAudio();
    if (sound) playNote(midi);
    setPressed(midi);
    window.setTimeout(() => setPressed((p) => (p === midi ? null : p)), 180);
    onPress?.(midi);
  };

  const keyProps = (midi: number) => ({
    'data-midi': midi,
    'aria-label': midiName(midi, naming ?? 'english', true),
    onPointerDown: press(midi),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const content = (midi: number) => {
    const label = labels[midi] ?? (naming && !isBlackKey(midi) ? midiName(midi, naming) : null);
    return (
      <>
        {midi === 60 && landmarks && <span className="key-middle" title="Middle C" />}
        {badges[midi] !== undefined && <span className="key-badge">{badges[midi]}</span>}
        {label && <span className="key-label">{label}</span>}
        {mod(midi, 12) === 0 && !label && landmarks && <span className="key-octave">C{midi / 12 - 1}</span>}
      </>
    );
  };

  return (
    <div className={`kb-scroll ${className}`} ref={scroller}>
      <div className="kb" style={{ minWidth: whites.length * minKeyWidth, height }}>
        {whites.map((m, i) => (
          <button
            key={m}
            className={`key white ${marks[m] ?? ''} ${pressed === m ? 'pressed' : ''}`}
            style={{ left: `${i * w}%`, width: `${w}%` }}
            {...keyProps(m)}
          >
            {content(m)}
          </button>
        ))}
        {keys.filter(isBlackKey).map((m) => {
          const i = whites.indexOf(m - 1);
          const left = (i + 1) * w - bw / 2 + BLACK_OFFSET[mod(m, 12)] * bw;
          return (
            <button
              key={m}
              className={`key black ${marks[m] ?? ''} ${pressed === m ? 'pressed' : ''}`}
              style={{ left: `${left}%`, width: `${bw}%` }}
              {...keyProps(m)}
            >
              {content(m)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
