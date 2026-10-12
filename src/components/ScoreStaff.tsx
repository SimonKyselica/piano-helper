import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { FONT, SP, xAtTick, type ScoreLayout } from '../music/scoreLayout';

export type NoteState = 'cur' | 'ok' | 'fix' | 'miss' | 'lit';

export interface ScoreHandle {
  /** Move the playhead (and scroll with it); null hides it. */
  setPlayhead: (tick: number | null) => void;
}

interface Props {
  layout: ScoreLayout;
  states?: Partial<Record<number, NoteState>>;
  labels?: Partial<Record<number, string>> | null;
  /** Pixels per staff space. */
  scale?: number;
  /** Keep this event index in view. */
  follow?: number | null;
  onNoteTap?: (index: number) => void;
  handle?: Ref<ScoreHandle>;
  className?: string;
  ariaLabel?: string;
}

export function ScoreStaff({ layout, states = {}, labels, scale = 11, follow = null, onNoteTap, handle, className = '', ariaLabel }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const playhead = useRef<SVGLineElement>(null);
  const k = scale / SP;
  const height = layout.maxY - layout.minY;

  useImperativeHandle(handle, () => ({
    setPlayhead(tick) {
      const line = playhead.current;
      const el = scroller.current;
      if (!line || !el) return;
      if (tick === null) {
        line.style.display = 'none';
        return;
      }
      const x = xAtTick(layout.timeline, tick);
      line.style.display = '';
      line.setAttribute('x1', String(x));
      line.setAttribute('x2', String(x));
      el.scrollLeft = x * k - el.clientWidth * 0.3;
    },
  }));

  useEffect(() => {
    const el = scroller.current;
    const n = layout.notes.find((n) => n.index === follow);
    if (!el || !n) return;
    const target = n.x * k - el.clientWidth * 0.3;
    if (Math.abs(el.scrollLeft - target) > el.clientWidth * 0.25) el.scrollTo({ left: target, behavior: 'smooth' });
  }, [follow, layout, k]);

  const cls = (idx?: number) => (idx !== undefined && states[idx] ? `st-${states[idx]}` : undefined);

  return (
    <div className={`score-scroll ${className}`} ref={scroller}>
      <svg
        className="score"
        width={layout.width * k}
        height={height * k}
        viewBox={`0 ${layout.minY} ${layout.width} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        {layout.ops.map((op, i) => {
          switch (op.k) {
            case 'line':
              return <line key={i} className={cls(op.idx)} x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} strokeWidth={op.w} />;
            case 'glyph':
              return (
                <text key={i} className={`smufl ${cls(op.idx) ?? ''}`} x={op.x} y={op.y} fontSize={FONT}>
                  {op.ch}
                </text>
              );
            case 'rect':
              return <rect key={i} className={cls(op.idx)} x={op.x} y={op.y} width={op.w} height={op.h} />;
            case 'path':
              return <path key={i} className={cls(op.idx)} d={op.d} />;
            case 'text':
              return (
                <text key={i} className={op.cls} x={op.x} y={op.y}>
                  {op.s}
                </text>
              );
          }
        })}
        {labels &&
          layout.notes.map((n) =>
            n.note && !n.continuation && labels[n.index] ? (
              <text key={`l${n.index}`} className={`score-label ${cls(n.index) ?? ''}`} x={n.x} y={layout.labelY}>
                {labels[n.index]}
              </text>
            ) : null,
          )}
        <line ref={playhead} className="score-playhead" x1={0} x2={0} y1={-1.5 * SP} y2={5.5 * SP} style={{ display: 'none' }} />
        {onNoteTap &&
          layout.notes.map((n) =>
            n.note && !n.continuation ? (
              <rect
                key={`h${n.index}`}
                className="score-hit"
                x={n.x - 1.6 * SP}
                y={layout.minY}
                width={3.2 * SP}
                height={height}
                onClick={() => onNoteTap(n.index)}
              />
            ) : null,
          )}
      </svg>
    </div>
  );
}
