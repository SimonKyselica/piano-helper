import { parseItemKey, type ReadingItem } from '../music/levels';
import { createPersistentStore, useStore } from './store';

export interface NoteStat {
  seen: number;
  correct: number;
  /** Total response time of correct answers, ms. */
  ms: number;
}

export interface LevelStat {
  rounds: number;
  best: number;
  stars: number;
}

export interface EarStat {
  answered: number;
  correct: number;
  bestStreak: number;
}

export interface SongStat {
  plays: number;
  bestWait: number;
  bestBeat: number;
  stars: number;
}

interface Progress {
  notes: Record<string, NoteStat>;
  songs: Record<string, SongStat>;
  /** Learn chapters marked done. */
  learned: Record<string, boolean>;
  levels: Record<string, LevelStat>;
  ear: Record<string, EarStat>;
  /** Local dates (YYYY-MM-DD) with any practice. */
  days: string[];
  todayDate: string;
  todayCount: number;
}

const EMPTY: Progress = { notes: {}, songs: {}, learned: {}, levels: {}, ear: {}, days: [], todayDate: '', todayCount: 0 };

export const progressStore = createPersistentStore<Progress>('piano-helper:progress', EMPTY);
export const useProgress = () => useStore(progressStore);

export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function practiced(p: Progress): Progress {
  const today = localDate();
  const days = p.days.includes(today) ? p.days : [...p.days, today].slice(-400);
  const todayCount = p.todayDate === today ? p.todayCount + 1 : 1;
  return { ...p, days, todayDate: today, todayCount };
}

export function recordNote(key: string, correct: boolean, ms: number) {
  progressStore.set((p) => {
    const s = p.notes[key] ?? { seen: 0, correct: 0, ms: 0 };
    const next = { seen: s.seen + 1, correct: s.correct + (correct ? 1 : 0), ms: s.ms + (correct ? ms : 0) };
    return practiced({ ...p, notes: { ...p.notes, [key]: next } });
  });
}

export const starsFor = (accuracy: number) => (accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : accuracy >= 0.6 ? 1 : 0);

export function recordRound(levelId: string, accuracy: number) {
  progressStore.set((p) => {
    const s = p.levels[levelId] ?? { rounds: 0, best: 0, stars: 0 };
    const next = { rounds: s.rounds + 1, best: Math.max(s.best, accuracy), stars: Math.max(s.stars, starsFor(accuracy)) };
    return { ...p, levels: { ...p.levels, [levelId]: next } };
  });
}

export function recordEar(mode: string, correct: boolean, streak: number) {
  progressStore.set((p) => {
    const s = p.ear[mode] ?? { answered: 0, correct: 0, bestStreak: 0 };
    const next = { answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0), bestStreak: Math.max(s.bestStreak, streak) };
    return practiced({ ...p, ear: { ...p.ear, [mode]: next } });
  });
}

export function recordSong(id: string, mode: 'wait' | 'beat', score: number) {
  progressStore.set((p) => {
    const s = p.songs[id] ?? { plays: 0, bestWait: 0, bestBeat: 0, stars: 0 };
    const next: SongStat = {
      plays: s.plays + 1,
      bestWait: mode === 'wait' ? Math.max(s.bestWait, score) : s.bestWait,
      bestBeat: mode === 'beat' ? Math.max(s.bestBeat, score) : s.bestBeat,
      stars: Math.max(s.stars, starsFor(score)),
    };
    return practiced({ ...p, songs: { ...p.songs, [id]: next } });
  });
}

export function markLearned(chapter: string) {
  if (progressStore.get().learned[chapter]) return;
  progressStore.set((p) => ({ ...p, learned: { ...p.learned, [chapter]: true } }));
}

/** Consecutive practice days ending today (or yesterday, so the streak survives until tonight). */
export function dayStreak(days: string[]): number {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(localDate(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(localDate(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const accuracyOf = (s: NoteStat) => (s.seen ? s.correct / s.seen : 0);

/** Notes seen a few times with the lowest accuracy. */
export function weakItems(notes: Record<string, NoteStat>, limit = 8): { item: ReadingItem; key: string; stat: NoteStat }[] {
  return Object.entries(notes)
    .filter(([, s]) => s.seen >= 3 && accuracyOf(s) < 0.8)
    .sort((a, b) => accuracyOf(a[1]) - accuracyOf(b[1]))
    .slice(0, limit)
    .map(([key, stat]) => ({ key, stat, item: parseItemKey(key) }));
}

export function resetProgress() {
  progressStore.set(() => EMPTY);
}
