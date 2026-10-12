import { Icon, type IconName } from './components/Icon';
import { ChordDrill } from './features/ear/ChordDrill';
import { EarHome } from './features/ear/EarHome';
import { FindNote } from './features/ear/FindNote';
import { IntervalDrill } from './features/ear/IntervalDrill';
import { LevelLearn } from './features/reading/LevelLearn';
import { ReadingHome } from './features/reading/ReadingHome';
import { ReadingPractice } from './features/reading/ReadingPractice';
import { SettingsPage } from './features/settings/SettingsPage';
import { Reference } from './features/theory/Reference';
import { ChapterPage } from './features/learn/ChapterPage';
import { LearnHome } from './features/learn/LearnHome';
import { AddSong } from './features/songs/AddSong';
import { SongPlayer } from './features/songs/SongPlayer';
import { SongsHome } from './features/songs/SongsHome';
import { switchTab, useRoute } from './state/router';

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'learn', label: 'Learn', icon: 'book' },
  { id: 'notes', label: 'Read', icon: 'staff' },
  { id: 'songs', label: 'Songs', icon: 'notes' },
  { id: 'ear', label: 'Ear', icon: 'ear' },
  { id: 'theory', label: 'Chords', icon: 'keys' },
];

function Screen({ route }: { route: string[] }) {
  const [tab, sub, arg] = route;
  switch (tab) {
    case 'ear':
      if (sub === 'find') return <FindNote />;
      if (sub === 'intervals') return <IntervalDrill />;
      if (sub === 'chords') return <ChordDrill />;
      return <EarHome />;
    case 'theory':
      return <Reference />;
    case 'settings':
      return <SettingsPage />;
    case 'songs':
      if (sub === 'play' && arg) return <SongPlayer key={arg} id={arg} />;
      if (sub === 'add') return <AddSong />;
      if (sub === 'edit' && arg) return <AddSong key={arg} editId={arg} />;
      return <SongsHome />;
    case 'notes':
      if (sub === 'learn' && arg) return <LevelLearn key={arg} id={arg} />;
      if (sub === 'play' && arg) return <ReadingPractice key={arg} id={arg} />;
      return <ReadingHome />;
    default:
      if (sub) return <ChapterPage key={sub} id={sub} />;
      return <LearnHome />;
  }
}

export function App() {
  const route = useRoute();
  const tab = TABS.some((t) => t.id === route[0]) ? route[0] : 'learn';
  const immersive = route.length > 1 || route[0] === 'settings';

  return (
    <div className={`app ${immersive ? 'immersive' : ''}`}>
      <main key={route.join('/')}>
        <Screen route={route} />
      </main>
      {!immersive && (
        <nav className="tabbar" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'active' : ''} aria-current={t.id === tab ? 'page' : undefined} onClick={() => switchTab(`/${t.id}`)}>
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
