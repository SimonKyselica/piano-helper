import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { ScoreStaff } from '../../components/ScoreStaff';
import { PageHeader, Segmented } from '../../components/ui';
import type { Clef } from '../../music/levels';
import { buildSong, readSongFile, type ImportedFile } from '../../music/import';
import { layoutScore } from '../../music/scoreLayout';
import { parseSongText, type Song } from '../../music/song';
import { go } from '../../state/router';
import { saveUserSong, userSongText } from '../../state/songs';

const EXAMPLE = `title: My song
time: 4/4
tempo: 90
clef: treble

E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | E4q. D4e D4h |`;

export function AddSong({ editId }: { editId?: string }) {
  const [tab, setTab] = useState<'file' | 'text'>(editId ? 'text' : 'file');
  return (
    <div className="page add-song-page">
      <PageHeader title={editId ? 'Edit song' : 'Add a song'} backTo="/songs" />
      {!editId && (
        <Segmented
          label="How to add"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'file', label: 'Import a file' },
            { value: 'text', label: 'Type the notes' },
          ]}
        />
      )}
      {tab === 'file' ? <FileImport /> : <TextEntry editId={editId} />}
    </div>
  );
}

function Preview({ song }: { song: Omit<Song, 'id' | 'builtin'> }) {
  const layout = useMemo(() => layoutScore({ ...song, measures: song.measures.slice(0, 8) }), [song]);
  return (
    <div className="card preview">
      <div className="card-head">
        <h3>Preview</h3>
        <span className="muted small">
          {song.measures.length} bars · {song.clef === 'treble' ? 'treble clef' : 'bass clef'}
        </span>
      </div>
      <ScoreStaff layout={layout} scale={9} ariaLabel="Preview of the first bars" />
    </div>
  );
}

function save(song: Omit<Song, 'id' | 'builtin'>, id?: string) {
  const newId = saveUserSong(song, id);
  go(`/songs/play/${newId}`);
}

function FileImport() {
  const [file, setFile] = useState<ImportedFile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState('');
  const [title, setTitle] = useState('');
  const [tempo, setTempo] = useState(90);
  const [clef, setClef] = useState<Clef | 'auto'>('auto');

  const song = useMemo(() => (file ? buildSong(file, choice, { title, tempo, clef: clef === 'auto' ? undefined : clef }) : null), [file, choice, title, tempo, clef]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError('');
    try {
      const imported = await readSongFile(f);
      setFile(imported);
      setChoice(imported.defaultChoice);
      setTitle(imported.title);
      setTempo(imported.tempo);
      setClef('auto');
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : 'This file couldn’t be read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card">
        <p className="muted small">
          Search <b>musescore.com</b> for “<i>song name</i> easy piano” and download it as <b>MIDI</b> or <b>MusicXML</b>. Simple arrangements work best. The app takes one melody line from the file and writes it out as sheet music. Only use files you’re allowed to use.
        </p>
        <label className="btn primary block file-btn">
          <Icon name="upload" size={18} /> {busy ? 'Reading…' : file ? 'Choose another file' : 'Choose a file'}
          <input type="file" accept=".mid,.midi,.musicxml,.xml,.mxl,audio/midi" onChange={(e) => onFile(e.target.files?.[0])} hidden />
        </label>
        {error && <p className="form-error">{error}</p>}
      </section>

      {file && (
        <>
          <section className="card form">
            <label className="field">
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="field">
              <span>Which part to play</span>
              <div className="choice-list">
                {file.choices.map((c) => (
                  <label key={c.id} className={`choice-row ${choice === c.id ? 'active' : ''}`}>
                    <input type="radio" name="part" checked={choice === c.id} onChange={() => setChoice(c.id)} />
                    <span>
                      <b>{c.label}</b>
                      <small>{c.detail}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="detail-row">
              <span>Clef</span>
              <Segmented
                label="Clef"
                value={clef}
                onChange={setClef}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'treble', label: 'Treble' },
                  { value: 'bass', label: 'Bass' },
                ]}
              />
            </div>
            <label className="field inline">
              <span>Tempo (♩ per minute)</span>
              <input type="number" min={30} max={220} value={tempo} onChange={(e) => setTempo(Number(e.target.value) || 90)} />
            </label>
          </section>
          {song ? <Preview song={song} /> : <p className="form-error">No notes in this part. Pick another one.</p>}
          <div className="sticky-cta">
            <button className="btn primary block" disabled={!song} onClick={() => song && save(song)}>
              Save song
            </button>
          </div>
        </>
      )}
    </>
  );
}

function TextEntry({ editId }: { editId?: string }) {
  const [text, setText] = useState(() => (editId && userSongText(editId)) || EXAMPLE);
  const { song, errors } = useMemo(() => parseSongText(text), [text]);
  return (
    <>
      <section className="card">
        <textarea className="song-text-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={10} aria-label="Song notes" />
        {errors.length > 0 && (
          <ul className="form-error">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        <details className="format-help">
          <summary>How to write notes</summary>
          <p>
            Each note is a <b>name + octave</b> (C4 = Middle C, F#4, Bb3) and a <b>length</b>: <code>w</code> whole, <code>h</code> half, <code>q</code> quarter, <code>e</code> eighth,{' '}
            <code>s</code> sixteenth.
          </p>
          <p>
            Add <code>.</code> for a dotted note, <code>t</code> for a triplet and <code>~</code> to tie to the next note. <code>R</code> is a rest (<code>Rq</code>). Separate bars with <code>|</code>.
          </p>
          <p>
            Example: <code>C4q D4e E4e F4h | G4w |</code>
          </p>
        </details>
      </section>
      {song && <Preview song={song} />}
      <div className="sticky-cta">
        <button className="btn primary block" disabled={!song || errors.length > 0} onClick={() => song && save(song, editId)}>
          {editId ? 'Save changes' : 'Save song'}
        </button>
      </div>
    </>
  );
}
