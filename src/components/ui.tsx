import type { ReactNode } from 'react';
import { back } from '../state/router';
import { Icon } from './Icon';

export function PageHeader({ title, backTo, right }: { title: ReactNode; backTo?: string; right?: ReactNode }) {
  return (
    <header className="page-header">
      {backTo !== undefined && (
        <button className="icon-btn" onClick={() => back(backTo)} aria-label="Back">
          <Icon name="back" size={24} />
        </button>
      )}
      <h1>{title}</h1>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="star" size={size} className={i < n ? 'star on' : 'star'} />
      ))}
    </span>
  );
}

export function StreakBadge({ n, label }: { n: number; label?: string }) {
  return (
    <span className={`streak-badge ${n > 0 ? 'hot' : ''}`}>
      <Icon name="flame" size={16} />
      {n}
      {label && <span className="streak-label">{label}</span>}
    </span>
  );
}
