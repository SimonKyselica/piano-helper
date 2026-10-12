import { describe, expect, it } from 'vitest';
import { itemKey, LEVELS } from '../../music/levels';
import { pickItem } from './pick';

const items = LEVELS[0].items;

function seeded(seed = 42) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('pickItem', () => {
  it('never repeats the previous note', () => {
    const rand = seeded();
    let prev = items[0];
    for (let i = 0; i < 500; i++) {
      const next = pickItem(items, prev, {}, rand);
      expect(itemKey(next)).not.toBe(itemKey(prev));
      prev = next;
    }
  });

  it('picks weak notes more often than mastered ones', () => {
    const [weak, strong] = [itemKey(items[1]), itemKey(items[2])];
    const stats = Object.fromEntries(items.map((it) => [itemKey(it), { seen: 20, correct: 19, ms: 19 * 1200 }]));
    stats[weak] = { seen: 20, correct: 8, ms: 8 * 4000 };
    const rand = seeded(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const k = itemKey(pickItem(items, null, stats, rand));
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(counts[weak]).toBeGreaterThan(counts[strong] * 2);
  });
});
