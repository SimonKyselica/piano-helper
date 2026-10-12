import { Icon } from '../../components/Icon';
import { useProgress } from '../../state/progress';
import { go } from '../../state/router';
import { TopHeader } from '../TopHeader';
import { CHAPTERS } from './chapters';

export function LearnHome() {
  const { learned } = useProgress();
  const next = CHAPTERS.find((c) => !learned[c.id]);
  return (
    <div className="page">
      <TopHeader title="Learn" />
      <p className="muted lead">New to reading music? Go through these short chapters in order. Each one takes a few minutes and has something to tap and play.</p>
      <ol className="level-list">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <button className={`level-card ${c === next ? 'next' : ''}`} onClick={() => go(`/learn/${c.id}`)}>
              <span className={`level-num ${learned[c.id] ? 'done' : ''}`}>{learned[c.id] ? <Icon name="check" size={18} /> : i + 1}</span>
              <span className="level-text">
                <b>{c.title}</b>
                <small>{c.blurb}</small>
              </span>
              <Icon name="chevron" size={18} className="muted" />
            </button>
          </li>
        ))}
      </ol>

      <h3 className="section-title">Then practise</h3>
      <div className="mode-list">
        <button className="card mode-card" onClick={() => go('/notes')}>
          <span className="mode-icon">
            <Icon name="staff" size={26} />
          </span>
          <span className="mode-text">
            <b>Note reading drills</b>
            <small>Short rounds that build up from Middle C to the whole grand staff.</small>
          </span>
          <Icon name="chevron" size={20} className="muted" />
        </button>
        <button className="card mode-card" onClick={() => go('/songs')}>
          <span className="mode-icon">
            <Icon name="notes" size={26} />
          </span>
          <span className="mode-text">
            <b>Play songs</b>
            <small>Real sheet music. The song waits for you until you play the right note.</small>
          </span>
          <Icon name="chevron" size={20} className="muted" />
        </button>
      </div>
    </div>
  );
}
