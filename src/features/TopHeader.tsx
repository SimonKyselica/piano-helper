import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { go } from '../state/router';

/** Header for top-level tabs, with the settings button. */
export function TopHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <div className="page-header-right">
        {right}
        <button className="icon-btn settings-btn" onClick={() => go('/settings')} aria-label="Settings">
          <Icon name="sliders" size={22} />
        </button>
      </div>
    </header>
  );
}
