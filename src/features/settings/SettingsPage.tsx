import { unlockAudio } from '../../audio/context';
import { playNotes } from '../../audio/synth';
import { Icon } from '../../components/Icon';
import { MicPanel } from '../../components/MicPanel';
import { PageHeader, Segmented, Toggle } from '../../components/ui';
import { isIOS, isStandalone, useInstallPrompt } from '../../state/install';
import { resetProgress } from '../../state/progress';
import { settingsStore, useSettings } from '../../state/settings';

export function SettingsPage() {
  const s = useSettings();
  const { available, install } = useInstallPrompt();

  return (
    <div className="page settings">
      <PageHeader title="Settings" backTo="/learn" />

      {!isStandalone() && (
        <section className="card install-card">
          <h3>
            <Icon name="download" size={20} /> Install on your phone
          </h3>
          {available ? (
            <>
              <p className="muted">Add Piano Helper to your home screen. It works offline, too.</p>
              <button className="btn primary" onClick={install}>
                Install app
              </button>
            </>
          ) : isIOS() ? (
            <p className="muted">
              In Safari, tap <b>Share</b> and then <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p className="muted">
              Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h3>Note names</h3>
        <Segmented
          label="Note names"
          value={s.naming}
          onChange={(naming) => settingsStore.set({ naming })}
          options={[
            { value: 'english', label: 'C D E … B' },
            { value: 'german', label: 'C D E … H' },
            { value: 'solfege', label: 'Do Re Mi' },
          ]}
        />
        <p className="muted small">
          {s.naming === 'german'
            ? 'Central European: B♭ is “B”, B is “H”, sharps end in -is (Cis), flats in -es (Es).'
            : s.naming === 'solfege'
              ? 'Fixed do: C = Do, D = Re, E = Mi, F = Fa, G = Sol, A = La, B = Si.'
              : 'International letter names, as used in English.'}
        </p>
        <Toggle label="Show names on the keys" hint="Handy at first. Turn it off once you know the keyboard." checked={s.showKeyNames} onChange={(showKeyNames) => settingsStore.set({ showKeyNames })} />
      </section>

      <section className="card">
        <h3>Sound</h3>
        <Toggle label="App sounds" checked={s.sound} onChange={(sound) => settingsStore.set({ sound })} />
        <label className="slider-row">
          <span>Volume</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={s.volume}
            onChange={(e) => settingsStore.set({ volume: Number(e.target.value) })}
            onPointerUp={() => {
              unlockAudio();
              playNotes([60, 64, 67], { gap: 0.12 });
            }}
          />
        </label>
      </section>

      <section className="card">
        <h3>Practice</h3>
        <div className="detail-row">
          <span>Notes per round</span>
          <Segmented
            label="Notes per round"
            value={String(s.roundLength)}
            onChange={(v) => settingsStore.set({ roundLength: Number(v) })}
            options={[
              { value: '10', label: '10' },
              { value: '20', label: '20' },
              { value: '30', label: '30' },
            ]}
          />
        </div>
        <Toggle
          label="Octave must match"
          hint="When playing on your piano, the exact key counts, not just the note name. Turn this off if the mic often hears the wrong octave."
          checked={s.strictOctave}
          onChange={(strictOctave) => settingsStore.set({ strictOctave })}
        />
      </section>

      <section className="card">
        <h3>Microphone</h3>
        <p className="muted small">
          Put your phone on the music stand and play one note at a time. If it misses notes, raise the sensitivity. If it hears notes you didn’t play, lower it. The thin line on the meter shows the threshold.
        </p>
        <label className="slider-row">
          <span>Sensitivity</span>
          <input type="range" min={0} max={1} step={0.05} value={s.micSensitivity} onChange={(e) => settingsStore.set({ micSensitivity: Number(e.target.value) })} />
        </label>
        <MicPanel showCents />
      </section>

      <section className="card">
        <h3>Progress</h3>
        <p className="muted small">Your progress is stored only on this device.</p>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Reset all progress? Stars, statistics and streaks will be deleted.')) resetProgress();
          }}
        >
          Reset progress
        </button>
      </section>

      <p className="muted small center">Piano Helper · music font Bravura (SIL Open Font License)</p>
    </div>
  );
}
