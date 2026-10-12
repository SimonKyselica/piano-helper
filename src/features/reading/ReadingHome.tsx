import { Icon } from '../../components/Icon';
import { Staff } from '../../components/Staff';
import { Stars, StreakBadge } from '../../components/ui';
import { LEVELS } from '../../music/levels';
import { noteName } from '../../music/notes';
import { accuracyOf, dayStreak, localDate, useProgress, weakItems } from '../../state/progress';
import { go } from '../../state/router';
import { useSettings } from '../../state/settings';
import { TopHeader } from '../TopHeader';

export function ReadingHome() {
  const progress = useProgress();
  const { naming } = useSettings();
  const streak = dayStreak(progress.days);
  const today = progress.todayDate === localDate() ? progress.todayCount : 0;
  const nextIndex = Math.max(0, LEVELS.findIndex((l) => (progress.levels[l.id]?.stars ?? 0) < 2));
  const next = LEVELS[nextIndex];
  const started = Boolean(progress.levels[next.id]);
  const weak = weakItems(progress.notes, 8);

  return (
    <div className="page">
      <TopHeader title="Read notes" right={<StreakBadge n={streak} label={streak === 1 ? 'day' : 'days'} />} />

      <section className="card hero">
        <div className="hero-top">
          <div>
            <span className="eyebrow">{started ? 'Continue' : nextIndex === 0 ? 'Start here' : 'Up next'} · Level {nextIndex + 1}</span>
            <h2>{next.title}</h2>
            <p className="muted">{next.subtitle}</p>
          </div>
          <Stars n={progress.levels[next.id]?.stars ?? 0} />
        </div>
        <Staff
          layout={next.layout === 'mixed' ? next.items[0].staff : next.layout}
          columns={next.items.slice(0, 5).map((it) => ({ notes: [{ note: it.note, staff: it.staff }] }))}
          className="hero-staff"
          ariaLabel={`Preview of ${next.title}`}
        />
        <button className="btn primary block" onClick={() => go(`/notes/learn/${next.id}`)}>
          <Icon name="play" size={18} />
          {started ? 'Keep practising' : 'Start lesson'}
        </button>
        <p className="today muted">
          {today ? `${today} answers today. Nice work!` : 'A few minutes every day beats one long session.'}
        </p>
      </section>

      {weak.length >= 3 && (
        <section className="card">
          <h3>Notes to work on</h3>
          <p className="muted small">Notes you miss most often. A short round on just these helps a lot.</p>
          <div className="chip-row">
            {weak.map(({ key, item, stat }) => (
              <span className="chip weak" key={key}>
                {noteName(item.note, naming, true)} <small>{item.staff === 'treble' ? '𝄞' : '𝄢'} {Math.round(accuracyOf(stat) * 100)}%</small>
              </span>
            ))}
          </div>
          <button className="btn block" onClick={() => go('/notes/play/weak')}>
            Practise these
          </button>
        </section>
      )}

      <h3 className="section-title">All levels</h3>
      <ol className="level-list">
        {LEVELS.map((l, i) => {
          const stat = progress.levels[l.id];
          return (
            <li key={l.id}>
              <button className={`level-card ${i === nextIndex ? 'next' : ''}`} onClick={() => go(`/notes/learn/${l.id}`)}>
                <span className={`level-num ${stat?.stars ? 'done' : ''}`}>{i + 1}</span>
                <span className="level-text">
                  <b>{l.title}</b>
                  <small>{l.subtitle}</small>
                </span>
                <span className="level-meta">
                  <Stars n={stat?.stars ?? 0} size={14} />
                  {stat && <small>best {Math.round(stat.best * 100)}%</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
