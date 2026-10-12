import { useState, type ReactNode } from 'react';
import { unlockAudio } from '../../audio/context';
import { stopAll } from '../../audio/synth';
import { Icon } from '../../components/Icon';
import { PageHeader, StreakBadge } from '../../components/ui';
import { recordEar } from '../../state/progress';

export interface Question {
  answer: string;
  midis: number[];
  play: () => void;
}

interface Props {
  mode: string;
  title: string;
  intro: string;
  controls: ReactNode;
  options: { id: string; label: string; sub?: string }[];
  make: (prev: Question | null) => Question;
  /** Play what the chosen (wrong) answer would have sounded like. */
  playAs: (q: Question, answerId: string) => void;
  reveal: (q: Question) => ReactNode;
}

/** Listen → pick an answer → see why. Shared by intervals and chords. */
export function ChoiceDrill({ mode, title, intro, controls, options, make, playAs, reveal }: Props) {
  const [q, setQ] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });

  const next = () => {
    unlockAudio();
    stopAll();
    const question = make(q);
    setQ(question);
    setChosen(null);
    question.play();
  };

  const choose = (id: string) => {
    if (!q || chosen) return;
    const correct = id === q.answer;
    const streak = correct ? score.streak + 1 : 0;
    recordEar(mode, correct, streak);
    setScore({ right: score.right + (correct ? 1 : 0), total: score.total + 1, streak });
    setChosen(id);
  };

  const replay = () => {
    unlockAudio();
    stopAll();
    q?.play();
  };

  return (
    <div className="page drill">
      <PageHeader title={title} backTo="/ear" right={<span className="counter">{score.right}/{score.total}</span>} />
      <div className="drill-controls">{controls}</div>

      <div className="listen-card card">
        <StreakBadge n={score.streak} />
        {q ? (
          <button className="play-big" onClick={replay} aria-label="Replay">
            <Icon name="speaker" size={36} />
          </button>
        ) : (
          <button className="play-big" onClick={next} aria-label="Start">
            <Icon name="play" size={40} />
          </button>
        )}
        <p className="muted">{q ? (chosen ? 'Tap the speaker to hear it again.' : 'What did you hear?') : intro}</p>
      </div>

      {q && (
        <div className={`choice-grid n${options.length}`}>
          {options.map((o) => {
            const state = !chosen ? '' : o.id === q.answer ? 'correct' : o.id === chosen ? 'wrong' : 'dim';
            return (
              <button key={o.id} className={`choice ${state}`} onClick={() => choose(o.id)} disabled={Boolean(chosen)}>
                <b>{o.label}</b>
                {o.sub && <small>{o.sub}</small>}
              </button>
            );
          })}
        </div>
      )}

      {q && chosen && (
        <section className={`card reveal ${chosen === q.answer ? 'good' : 'bad'}`}>
          <p className="reveal-verdict">
            <Icon name={chosen === q.answer ? 'check' : 'x'} size={20} />
            {chosen === q.answer ? 'Correct!' : 'Not this time.'}
          </p>
          {reveal(q)}
          <div className="reveal-actions">
            {chosen !== q.answer && (
              <button
                className="btn small ghost"
                onClick={() => {
                  unlockAudio();
                  stopAll();
                  playAs(q, chosen);
                }}
              >
                <Icon name="speaker" size={16} /> Hear your answer
              </button>
            )}
            <button className="btn primary" onClick={next}>
              Next <Icon name="chevron" size={18} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
