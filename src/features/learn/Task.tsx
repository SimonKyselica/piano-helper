import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';

/** Small "do this" task with a progress line. */
export function Task({ title, children, done }: { title: string; children: ReactNode; done?: boolean }) {
  return (
    <section className={`card task ${done ? 'done' : ''}`}>
      <div className="task-head">
        <span className="task-badge">{done ? <Icon name="check" size={16} /> : 'Try it'}</span>
        <b>{title}</b>
      </div>
      {children}
    </section>
  );
}
