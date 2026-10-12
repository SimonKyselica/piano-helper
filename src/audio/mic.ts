import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { settingsStore } from '../state/settings';
import { audioContext, isPlaybackActive, setMicActive, unlockAudio } from './context';
import { NoteTracker, rmsForSensitivity, type TrackerFrame } from './noteTracker';

export type MicStatus = 'off' | 'starting' | 'on' | 'denied' | 'error' | 'unsupported';

const FRAME_SIZE = 4096;

class Mic {
  status: MicStatus = 'off';
  error = '';
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buf = new Float32Array(FRAME_SIZE);
  private tracker = new NoteTracker(FRAME_SIZE);
  private raf = 0;
  /** Bumped by stop() so a start() still waiting for permission knows it was cancelled. */
  private generation = 0;
  private statusListeners = new Set<() => void>();
  private noteListeners = new Set<(midi: number) => void>();
  private frameListeners = new Set<(f: TrackerFrame) => void>();

  subscribe = (l: () => void) => {
    this.statusListeners.add(l);
    return () => void this.statusListeners.delete(l);
  };
  getStatus = () => this.status;

  onNote(l: (midi: number) => void) {
    this.noteListeners.add(l);
    return () => void this.noteListeners.delete(l);
  }

  onFrame(l: (f: TrackerFrame) => void) {
    this.frameListeners.add(l);
    return () => void this.frameListeners.delete(l);
  }

  setSensitivity(s: number) {
    this.tracker.opts.minRms = rmsForSensitivity(s);
  }

  private setStatus(status: MicStatus, error = '') {
    this.status = status;
    this.error = error;
    this.statusListeners.forEach((l) => l());
  }

  /** Call from a tap/click. */
  async start() {
    if (this.status === 'on' || this.status === 'starting') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setStatus('unsupported', 'This browser can’t use the microphone here. It needs HTTPS or an installed app.');
      return;
    }
    unlockAudio();
    this.setSensitivity(settingsStore.get().micSensitivity);
    this.setStatus('starting');
    const generation = ++this.generation;
    try {
      setMicActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = audioContext();
      if (ctx.state !== 'running') await ctx.resume();
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.source = ctx.createMediaStreamSource(stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = FRAME_SIZE;
      this.source.connect(this.analyser);
      this.setStatus('on');
      this.loop();
    } catch (e) {
      if (generation !== this.generation) return;
      setMicActive(false);
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        this.setStatus('denied', 'Microphone access was blocked. Allow it in your browser or phone settings, then try again.');
      } else {
        this.setStatus('error', `Couldn’t start the microphone (${name || 'unknown error'}).`);
      }
    }
  }

  stop() {
    this.generation++;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.source?.disconnect();
    this.stream = null;
    this.source = null;
    this.analyser = null;
    if (this.status !== 'off') {
      setMicActive(false);
      this.setStatus('off');
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    const { frame, onset } = this.tracker.process(this.buf, this.analyser.context.sampleRate, isPlaybackActive());
    this.frameListeners.forEach((l) => l(frame));
    if (onset !== null) this.noteListeners.forEach((l) => l(onset));
  };
}

export const mic = new Mic();

// Release the mic when the app goes to the background.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) mic.stop();
  });
}

export function useMicStatus(): MicStatus {
  return useSyncExternalStore(mic.subscribe, mic.getStatus);
}

/** Subscribe to notes heard by the mic. The handler always sees fresh state. */
export function useMicNotes(handler: (midi: number) => void) {
  const ref = useRef(handler);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  useEffect(() => mic.onNote((m) => ref.current(m)), []);
}
