import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

let navigatedInApp = false;

/** Open a sub-page (adds a history entry so the system back gesture works). */
export function go(path: string) {
  navigatedInApp = true;
  location.hash = path;
}

/** Switch tabs without growing history. */
export function switchTab(path: string) {
  location.replace(`#${path}`);
}

export function back(fallback: string) {
  if (navigatedInApp && history.length > 1) history.back();
  else location.replace(`#${fallback}`);
}
