import { useMemo } from 'react';
import { parseSongText, songToText, type Song } from '../music/song';
import { BUILTIN_SONGS } from '../music/songs';
import { createPersistentStore, useStore } from './store';

interface StoredSong {
  id: string;
  text: string;
  addedAt: number;
}

/** Your own songs, kept as text notation so they stay small and editable. */
export const userSongsStore = createPersistentStore<{ songs: StoredSong[] }>('piano-helper:songs', { songs: [] });

const cache = new Map<string, Song | null>();

function toSong(s: StoredSong): Song | null {
  const key = `${s.id}\n${s.text}`;
  if (!cache.has(key)) {
    const { song } = parseSongText(s.text);
    cache.set(key, song ? { ...song, id: s.id, builtin: false } : null);
  }
  return cache.get(key)!;
}

export function useUserSongs(): Song[] {
  const { songs } = useStore(userSongsStore);
  return useMemo(() => songs.map(toSong).filter((s): s is Song => s !== null), [songs]);
}

export function findSong(id: string): Song | undefined {
  const builtin = BUILTIN_SONGS.find((s) => s.id === id);
  if (builtin) return builtin;
  const stored = userSongsStore.get().songs.find((s) => s.id === id);
  return stored ? (toSong(stored) ?? undefined) : undefined;
}

export const userSongText = (id: string) => userSongsStore.get().songs.find((s) => s.id === id)?.text;

export function saveUserSong(song: Omit<Song, 'id' | 'builtin'>, id?: string): string {
  const text = songToText(song);
  const newId = id ?? `my-${Date.now().toString(36)}`;
  userSongsStore.set((st) => ({
    songs: id ? st.songs.map((s) => (s.id === id ? { ...s, text } : s)) : [...st.songs, { id: newId, text, addedAt: Date.now() }],
  }));
  return newId;
}

export function deleteUserSong(id: string) {
  userSongsStore.set((st) => ({ songs: st.songs.filter((s) => s.id !== id) }));
}
