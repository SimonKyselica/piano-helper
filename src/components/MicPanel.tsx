import { useEffect, useRef } from 'react';
import { mic, useMicStatus } from '../audio/mic';
import { rmsForSensitivity } from '../audio/noteTracker';
import { midiName } from '../music/notes';
import { settingsStore, useSettings } from '../state/settings';
import { Icon } from './Icon';

let stopTimer = 0;

/** Map RMS to 0..1 on a -60..-6 dB scale. */
const levelOf = (rms: number) => Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-9) + 60) / 54));

export function startMicFromGesture() {
  settingsStore.set({ micWanted: true });
  void mic.start();
}

/** Mic on/off control with a live level meter and the note currently heard. */
export function MicPanel({ showCents = false, stopOnUnmount = true }: { showCents?: boolean; stopOnUnmount?: boolean }) {
  const status = useMicStatus();
  const { naming, micSensitivity } = useSettings();
  const meter = useRef<HTMLDivElement>(null);
  const heard = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (status !== 'on') return;
    let lastText = 0;
    return mic.onFrame((f) => {
      if (meter.current) meter.current.style.transform = `scaleX(${levelOf(f.rms)})`;
      const now = performance.now();
      if (heard.current && now - lastText > 90) {
        lastText = now;
        const cents = showCents && f.midi !== null ? ` ${f.cents >= 0 ? '+' : ''}${f.cents}¢` : '';
        heard.current.textContent = f.midi !== null ? midiName(f.midi, naming, true) + cents : '…';
      }
    });
  }, [status, naming, showCents]);

  useEffect(() => mic.setSensitivity(micSensitivity), [micSensitivity]);
  // Release the mic when leaving the screen. Deferred, so moving between two screens
  // that both listen (or a StrictMode remount) keeps it running.
  useEffect(() => {
    clearTimeout(stopTimer);
    return () => {
      if (stopOnUnmount) stopTimer = window.setTimeout(() => mic.stop(), 150);
    };
  }, [stopOnUnmount]);

  if (status === 'on') {
    return (
      <div className="mic-panel on">
        <span className="mic-live">
          <Icon name="mic" size={18} />
        </span>
        <div className="mic-meter" aria-hidden="true">
          <div className="mic-meter-fill" ref={meter} />
          <div className="mic-meter-gate" style={{ left: `${levelOf(rmsForSensitivity(micSensitivity)) * 100}%` }} />
        </div>
        <span className="mic-heard">
          Hearing <span ref={heard}>…</span>
        </span>
        <button
          className="btn small ghost"
          onClick={() => {
            settingsStore.set({ micWanted: false });
            mic.stop();
          }}
        >
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="mic-panel">
      <button className="btn small mic-start" onClick={startMicFromGesture} disabled={status === 'starting'}>
        <Icon name="mic" size={18} />
        {status === 'starting' ? 'Starting…' : 'Listen to my piano'}
      </button>
      {mic.error ? <p className="mic-error">{mic.error}</p> : <span className="mic-hint">or tap the keys below</span>}
    </div>
  );
}
