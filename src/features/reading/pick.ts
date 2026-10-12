import { itemKey, type ReadingItem } from '../../music/levels';
import type { NoteStat } from '../../state/progress';

/** Weight for how much a note needs practice: missed often, slow, or new → picked more. */
export function needWeight(stat: NoteStat | undefined): number {
  if (!stat) return 2.5;
  const accuracy = (stat.correct + 1) / (stat.seen + 2);
  const avgSeconds = stat.correct ? stat.ms / stat.correct / 1000 : 4;
  const slowness = Math.min(1, Math.max(0, (avgSeconds - 1.5) / 3));
  const fresh = stat.seen < 3 ? 0.7 : 0;
  return 0.6 + (1 - accuracy) * 3 + slowness + fresh;
}

/** Weighted random pick that never repeats the previous note. */
export function pickItem(items: ReadingItem[], prev: ReadingItem | null, stats: Record<string, NoteStat>, rand = Math.random): ReadingItem {
  const pool = items.length > 1 && prev ? items.filter((it) => itemKey(it) !== itemKey(prev)) : items;
  const weights = pool.map((it) => needWeight(stats[itemKey(it)]));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
