import { Icon } from '../../components/Icon';
import { Stars } from '../../components/ui';
import type { Song } from '../../music/song';
import { BUILTIN_SONGS } from '../../music/songs';
import { useProgress } from '../../state/progress';
import { go } from '../../state/router';
import { useUserSongs } from '../../state/songs';
import { TopHeader } from '../TopHeader';

const LEVEL_NAMES = { 1: 'Easy', 2: 'Medium', 3: 'Harder' } as const;

export function SongsHome() {
  const mine = useUserSongs();
  return (
    <div className="page">
      <TopHeader title="Songs" />
      <p className="muted lead">Read real sheet music and play along. Start with “Wait for me”: the song only moves on when you hit the right note.</p>

      {([1, 2, 3] as const).map((d) => (
        <section key={d}>
          <h3 className="section-title">{LEVEL_NAMES[d]}</h3>
          <div className="song-list">
            {BUILTIN_SONGS.filter((s) => s.difficulty === d).map((s) => (
              <SongCard key={s.id} song={s} />
            ))}
          </div>
        </section>
      ))}

      <section>
        <h3 className="section-title">My songs</h3>
        <div className="song-list">
          {mine.map((s) => (
            <SongCard key={s.id} song={s} />
          ))}
          <button className="card add-song" onClick={() => go('/songs/add')}>
            <span className="mode-icon">
              <Icon name="plus" size={24} />
            </span>
            <span className="mode-text">
              <b>Add a song</b>
              <small>Anime, film or game music: import a MIDI or MusicXML file (e.g. from MuseScore), or type the notes yourself.</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

function SongCard({ song }: { song: Song }) {
  const stat = useProgress().songs[song.id];
  return (
    <button className="card song-card" onClick={() => go(`/songs/play/${song.id}`)}>
      <span className={`song-clef ${song.clef}`} aria-hidden="true">
        {song.clef === 'treble' ? '' : ''}
      </span>
      <span className="song-text">
        <b>{song.title}</b>
        <small>{song.composer ?? (song.builtin ? '' : 'Your song')}</small>
        <small className="song-tags">
          {song.clef === 'treble' ? 'Right hand' : 'Left hand'} · {song.time[0]}/{song.time[1]}
          {stat ? ` · played ${stat.plays}×` : ''}
        </small>
      </span>
      <Stars n={stat?.stars ?? 0} size={14} />
    </button>
  );
}
