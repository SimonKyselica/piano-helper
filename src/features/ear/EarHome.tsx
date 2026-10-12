import { Icon, type IconName } from '../../components/Icon';
import { useProgress } from '../../state/progress';
import { go } from '../../state/router';
import { TopHeader } from '../TopHeader';

const MODES: { id: string; title: string; text: string; icon: IconName }[] = [
  { id: 'find', title: 'Find the note', text: 'Hear a note, then find it on your piano.', icon: 'keys' },
  { id: 'intervals', title: 'Intervals', text: 'How far apart are two notes? Learn them with famous songs.', icon: 'notes' },
  { id: 'chords', title: 'Major or minor?', text: 'Tell happy chords from sad ones, then tense and dreamy ones.', icon: 'ear' },
];

export function EarHome() {
  const progress = useProgress();
  return (
    <div className="page">
      <TopHeader title="Ear training" />
      <p className="muted lead">Training your ear helps you play by ear, spot mistakes and learn songs faster. Use headphones or turn the sound up.</p>
      <div className="mode-list">
        {MODES.map((m) => {
          const s = progress.ear[m.id];
          return (
            <button key={m.id} className="card mode-card" onClick={() => go(`/ear/${m.id}`)}>
              <span className="mode-icon">
                <Icon name={m.icon} size={26} />
              </span>
              <span className="mode-text">
                <b>{m.title}</b>
                <small>{m.text}</small>
                {s && (
                  <small className="mode-stats">
                    {Math.round((s.correct / s.answered) * 100)}% of {s.answered} · best streak {s.bestStreak}
                  </small>
                )}
              </span>
              <Icon name="chevron" size={20} className="muted" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
