import type { Naming } from '../music/notes';
import { createPersistentStore, useStore } from './store';

export interface Settings {
  naming: Naming;
  showKeyNames: boolean;
  sound: boolean;
  volume: number;
  /** 0..1, higher hears quieter playing. */
  micSensitivity: number;
  /** Reading practice: the octave must match too. */
  strictOctave: boolean;
  /** The user turned the mic on last time; start it automatically on the next practice. */
  micWanted: boolean;
  roundLength: number;
  findSet: 'white' | 'all';
  intervalSet: string;
  intervalDir: 'up' | 'down' | 'together';
  chordSet: 'basic' | 'all';
  chordStyle: 'block' | 'broken' | 'both';
  songMode: 'wait' | 'beat';
  songSpeed: number;
  songNames: boolean;
  songHints: boolean;
  songMetronome: boolean;
}

export const settingsStore = createPersistentStore<Settings>('piano-helper:settings', {
  naming: 'english',
  showKeyNames: false,
  sound: true,
  volume: 0.8,
  micSensitivity: 0.6,
  strictOctave: true,
  micWanted: false,
  roundLength: 20,
  findSet: 'white',
  intervalSet: 'starter',
  intervalDir: 'up',
  chordSet: 'basic',
  chordStyle: 'both',
  songMode: 'wait',
  songSpeed: 0.75,
  songNames: true,
  songHints: true,
  songMetronome: true,
});

export const useSettings = () => useStore(settingsStore);
