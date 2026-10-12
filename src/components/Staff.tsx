import { useRef } from 'react';
import type { Clef } from '../music/levels';
import { diatonic, fromDiatonic, toMidi, type Note } from '../music/notes';

/** One staff space in SVG units. SMuFL fonts are designed so 1em = 4 staff spaces. */
const S = 10;
const FONT = 4 * S;
const GLYPH = { gClef: '', fClef: '', whole: '', flat: '', sharp: '', brace: '' };
const NOTE_W = (422 / 250) * S;
const CLEF_W = (684 / 250) * S;
const ACC_W = { sharp: (249 / 250) * S, flat: (226 / 250) * S };
/** Diatonic index of each staff's bottom line: E4 (treble), G2 (bass). */
const BOTTOM_LINE: Record<Clef, number> = { treble: 30, bass: 18 };
const GRAND_GAP = 6 * S;
const LINE_W = 0.13 * S;
const LEDGER_W = 0.18 * S;

export interface StaffNote {
  note: Note;
  staff?: Clef;
  color?: string;
}

export interface StaffColumn {
  notes: StaffNote[];
  label?: string;
  label2?: string;
  color?: string;
}

interface Props {
  layout: Clef | 'grand';
  columns: StaffColumn[];
  /** Minimum width in staff spaces; short content is centred. */
  minWidth?: number;
  /** Fixed pixels per staff space (for scrollable wide staves). Omit to fill the container. */
  scale?: number;
  activeColumn?: number | null;
  onColumnTap?: (index: number) => void;
  /** Tap anywhere on the staff to pick the line or space under your finger. */
  onPick?: (note: Note, staff: Clef) => void;
  className?: string;
  ariaLabel?: string;
}

interface PlacedNote {
  y: number;
  x: number;
  color?: string;
  acc?: { x: number; glyphs: string };
}

interface PlacedColumn {
  x: number;
  width: number;
  center: number;
  notes: PlacedNote[];
  ledgers: { y: number; x1: number; x2: number }[];
  label?: string;
  label2?: string;
  color?: string;
}

export function Staff({ layout, columns, minWidth = 0, scale, activeColumn, onColumnTap, onPick, className, ariaLabel }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const staves: Clef[] = layout === 'grand' ? ['treble', 'bass'] : [layout];
  const top: Record<Clef, number> = layout === 'grand' ? { treble: 0, bass: 4 * S + GRAND_GAP } : { treble: 0, bass: 0 };
  const staffOf = (n: StaffNote): Clef => n.staff ?? (layout === 'grand' ? (toMidi(n.note) < 60 ? 'bass' : 'treble') : layout);
  const yOf = (n: Note, clef: Clef) => top[clef] + 4 * S - ((diatonic(n) - BOTTOM_LINE[clef]) * S) / 2;

  const lineStart = layout === 'grand' ? 2 * S : 0.2 * S;
  const clefX = lineStart + 0.8 * S;
  const contentStart = clefX + CLEF_W + 1.6 * S;

  let cursor = contentStart;
  const placed: PlacedColumn[] = columns.map((col) => {
    const groups = new Map<Clef, StaffNote[]>();
    for (const n of col.notes) {
      const clef = staffOf(n);
      groups.set(clef, [...(groups.get(clef) ?? []), n]);
    }

    // Accidental columns per staff, so stacked sharps/flats don't collide.
    let accWidth = 0;
    const layoutGroups = [...groups.entries()].map(([clef, notes]) => {
      const sorted = [...notes].sort((a, b) => diatonic(a.note) - diatonic(b.note));
      const offset = sorted.map(() => false);
      for (let i = 1; i < sorted.length; i++) {
        if (diatonic(sorted[i].note) - diatonic(sorted[i - 1].note) === 1 && !offset[i - 1]) offset[i] = true;
      }
      const accCols: number[][] = [];
      const accCol = new Map<StaffNote, number>();
      for (const n of [...sorted].reverse()) {
        if (!n.note.alter) continue;
        const d = diatonic(n.note);
        let c = accCols.findIndex((col) => col.every((other) => Math.abs(other - d) >= 6));
        if (c === -1) c = accCols.push([]) - 1;
        accCols[c].push(d);
        accCol.set(n, c);
      }
      const maxAlter = Math.max(1, ...notes.map((n) => Math.abs(n.note.alter)));
      const colW = maxAlter * ACC_W.sharp + 0.25 * S;
      if (accCols.length) accWidth = Math.max(accWidth, accCols.length * colW + 0.2 * S);
      return { clef, sorted, offset, accCol, colW };
    });

    const noteX = cursor + accWidth;
    const hasOffset = layoutGroups.some((g) => g.offset.some(Boolean));
    const inner = hasOffset ? NOTE_W * 2 : NOTE_W;
    const labelW = Math.max(col.label?.length ?? 0, col.label2?.length ?? 0) * 0.85 * S;
    const width = Math.max(accWidth + inner + 2.6 * S, labelW + 1.2 * S, 4 * S);

    const notes: PlacedNote[] = [];
    const ledgers: PlacedColumn['ledgers'] = [];
    for (const g of layoutGroups) {
      g.sorted.forEach((n, i) => {
        const x = noteX + (g.offset[i] ? NOTE_W : 0);
        const p: PlacedNote = { x, y: yOf(n.note, g.clef), color: n.color };
        const c = g.accCol.get(n);
        if (c !== undefined) {
          const glyph = n.note.alter > 0 ? GLYPH.sharp : GLYPH.flat;
          p.acc = { x: noteX - (c + 1) * g.colW, glyphs: glyph.repeat(Math.abs(n.note.alter)) };
        }
        notes.push(p);
      });
      const ds = g.sorted.map((n) => diatonic(n.note));
      const lo = Math.min(...ds);
      const hi = Math.max(...ds);
      const bl = BOTTOM_LINE[g.clef];
      const lines: number[] = [];
      for (let l = bl - 2; l >= lo; l -= 2) lines.push(l);
      for (let l = bl + 10; l <= hi; l += 2) lines.push(l);
      for (const l of lines) {
        const y = top[g.clef] + 4 * S - ((l - bl) * S) / 2;
        ledgers.push({ y, x1: noteX - 0.45 * S, x2: noteX + inner + 0.45 * S });
      }
    }

    const c: PlacedColumn = { x: cursor, width, center: noteX + inner / 2, notes, ledgers, label: col.label, label2: col.label2, color: col.color };
    cursor += width;
    return c;
  });

  // Centre short content within minWidth.
  let lineEnd = cursor + 0.4 * S;
  if (minWidth * S > lineEnd) {
    const shift = (minWidth * S - lineEnd) / 2;
    for (const c of placed) {
      c.x += shift;
      c.center += shift;
      c.notes.forEach((n) => {
        n.x += shift;
        if (n.acc) n.acc.x += shift;
      });
      c.ledgers.forEach((l) => {
        l.x1 += shift;
        l.x2 += shift;
      });
    }
    lineEnd = minWidth * S;
  }

  // Vertical extent: staves, clefs, notes, labels.
  let minY = top.treble - 1.6 * S;
  let maxY = Math.max(...staves.map((c) => top[c] + 4 * S)) + (staves.includes('treble') && layout !== 'grand' ? 1.9 * S : 1 * S);
  for (const c of placed) {
    for (const n of c.notes) {
      minY = Math.min(minY, n.y - (n.acc ? 2 : 1) * S);
      maxY = Math.max(maxY, n.y + 1.2 * S);
    }
  }
  const hasLabels = placed.some((c) => c.label);
  const hasLabels2 = placed.some((c) => c.label2);
  const labelY = maxY + 1.6 * S;
  const label2Y = labelY + (hasLabels ? 1.8 * S : 0);
  if (hasLabels) maxY = labelY + 0.6 * S;
  if (hasLabels2) maxY = label2Y + 0.6 * S;
  minY -= 0.4 * S;
  maxY += 0.4 * S;

  const vbW = lineEnd + 0.2 * S;
  const vbH = maxY - minY;
  const systemTop = top.treble;
  const systemBottom = Math.max(...staves.map((c) => top[c] + 4 * S));
  const braceScale = (systemBottom - systemTop) / ((997 / 1000) * FONT);

  return (
    <svg
      ref={svgRef}
      className={`staff ${className ?? ''}`}
      viewBox={`0 ${minY} ${vbW} ${vbH}`}
      width={scale ? (vbW / S) * scale : '100%'}
      height={scale ? (vbH / S) * scale : undefined}
      role="img"
      aria-label={ariaLabel}
    >
      {staves.map((clef) =>
        [0, 1, 2, 3, 4].map((i) => (
          <line key={`${clef}${i}`} className="staff-line" x1={lineStart} x2={lineEnd} y1={top[clef] + i * S} y2={top[clef] + i * S} strokeWidth={LINE_W} />
        )),
      )}
      {layout === 'grand' && (
        <>
          <line className="staff-line" x1={lineStart} x2={lineStart} y1={systemTop} y2={systemBottom} strokeWidth={LINE_W * 1.4} />
          <text className="smufl" fontSize={FONT} transform={`translate(${lineStart - 0.4 * S - 0.336 * S * braceScale} ${systemBottom}) scale(${braceScale})`}>
            {GLYPH.brace}
          </text>
        </>
      )}
      {staves.map((clef) => (
        <text key={clef} className="smufl" x={clefX} y={top[clef] + (clef === 'treble' ? 3 : 1) * S} fontSize={FONT}>
          {clef === 'treble' ? GLYPH.gClef : GLYPH.fClef}
        </text>
      ))}
      {placed.map((c, i) => {
        const active = activeColumn === i;
        const colColor = active ? 'var(--accent)' : c.color;
        return (
          <g key={i} className={active ? 'staff-col active' : 'staff-col'}>
            {c.ledgers.map((l, j) => (
              <line key={j} className="staff-line" x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} strokeWidth={LEDGER_W} />
            ))}
            {c.notes.map((n, j) => (
              <g key={j} fill={n.color ?? colColor ?? 'currentColor'}>
                {n.acc && (
                  <text className="smufl" x={n.acc.x} y={n.y} fontSize={FONT}>
                    {n.acc.glyphs}
                  </text>
                )}
                <text className="smufl" x={n.x} y={n.y} fontSize={FONT}>
                  {GLYPH.whole}
                </text>
              </g>
            ))}
            {c.label && (
              <text className="staff-label" x={c.center} y={labelY} fill={colColor ?? 'currentColor'}>
                {c.label}
              </text>
            )}
            {c.label2 && (
              <text className="staff-label2" x={c.center} y={label2Y}>
                {c.label2}
              </text>
            )}
            {onColumnTap && (
              <rect
                className="staff-hit"
                x={c.x}
                y={minY}
                width={c.width}
                height={vbH}
                fill="transparent"
                onClick={() => onColumnTap(i)}
              />
            )}
          </g>
        );
      })}
      {onPick && (
        <rect
          className="staff-hit"
          x={0}
          y={minY}
          width={vbW}
          height={vbH}
          fill="transparent"
          onPointerDown={(e) => {
            const ctm = svgRef.current?.getScreenCTM();
            if (!ctm) return;
            const y = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()).y;
            const clef: Clef = staves.length === 2 && y > (top.treble + 4 * S + top.bass) / 2 ? 'bass' : staves[0];
            const d = BOTTOM_LINE[clef] + Math.round((top[clef] + 4 * S - y) / (S / 2));
            onPick(fromDiatonic(Math.max(BOTTOM_LINE[clef] - 6, Math.min(BOTTOM_LINE[clef] + 14, d))), clef);
          }}
        />
      )}
    </svg>
  );
}
