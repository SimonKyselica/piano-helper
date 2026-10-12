import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get: () => T;
  set: (update: Partial<T> | ((s: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

/** A tiny global store persisted to localStorage (silently in-memory if storage is blocked). */
export function createPersistentStore<T extends object>(key: string, initial: T): Store<T> {
  let state = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch {
    /* private mode or corrupt data: start fresh */
  }
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(update) {
      state = typeof update === 'function' ? update(state) : { ...state, ...update };
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage full or blocked */
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
