let ctx: AudioContext | null = null;
let micActive = false;
let playbackUntil = 0;

type SessionType = 'auto' | 'playback' | 'play-and-record';

export function audioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
  }
  return ctx;
}

/**
 * iOS: the "playback" session keeps sound on even with the ring/silent switch muted;
 * "play-and-record" is required while the microphone is in use.
 */
export function setAudioSession(type: SessionType) {
  const session = (navigator as Navigator & { audioSession?: { type: SessionType } }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    /* unsupported value on this browser */
  }
}

/** Must be called from a user gesture (tap/click) before the first sound on iOS. */
export function unlockAudio() {
  if (!micActive) setAudioSession('playback');
  const c = audioContext();
  if (c.state !== 'running') void c.resume();
}

export function setMicActive(active: boolean) {
  micActive = active;
  setAudioSession(active ? 'play-and-record' : 'playback');
}

/** The app is making sound until `ms` from now; the mic ignores notes meanwhile. */
export function markPlayback(ms: number) {
  playbackUntil = Math.max(playbackUntil, performance.now() + ms);
}

export const isPlaybackActive = () => performance.now() < playbackUntil;
