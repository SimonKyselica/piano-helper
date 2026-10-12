# Piano Helper
**Build with help of AI**. 
An installable web app (PWA) for learning piano:

- **Learn:** five short interactive chapters covering the keyboard pattern, note names and octaves, a staff ↔ keys explorer (tap a key, tap the staff or play your piano), sharps/flats/naturals, and note lengths and rhythm.
- **Songs:** real sheet music to play along with. "Wait for me" moves on only when you play the right note; "Keep the beat" scrolls in time and scores your timing. Includes public-domain classical themes, plus import of your own songs from **MIDI** or **MusicXML** (`.mid`, `.musicxml`, `.mxl`), or typed in a simple text format.
- **Read notes:** 10 guided levels from Middle C to the full grand staff, ledger lines and sharps/flats. You answer on your real piano (the microphone detects the note) or on the on-screen keys. It asks more often about the notes you miss or answer slowly.
- **Ear training:** find a note by ear, name intervals (with song memory aids), and tell major, minor, diminished and augmented chords apart.
- **Chords & scales:** every root and type, correctly spelled, shown on the staff and keyboard with fingering and playback.

Progress is saved in the browser on this device. The app works offline once installed.

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (theory, pitch tracker, note picker)
npm run build    # production build in dist/
npm run preview  # serve the build locally
npm run icons    # regenerate PWA icons from public/favicon.svg
```

## Putting it on your phone

The microphone and "install app" only work over **HTTPS** (or on `localhost`). Deploy `dist/` to any static host, for example Netlify, Vercel, Cloudflare Pages or GitHub Pages. Then open the URL on your phone:

- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** menu → Install app

Routing uses the URL hash, so no server rewrites are needed. If you host under a sub-path (e.g. GitHub Pages `/piano-helper/`), set `base` in `vite.config.ts` and update the absolute icon links in `index.html`.

## Song text format

```
title: Ode to Joy
time: 4/4
tempo: 100
clef: treble
E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | E4q. D4e D4h |
```

Each note is pitch plus octave (`C4` = Middle C, `F#4`, `Bb3`) followed by a length: `w h q e s` (whole to sixteenth). Add `.` for dotted, `t` for a triplet and `~` to tie to the next note. Rests are `R` (`Rq`) and bars are separated by `|`. Imported songs are stored in this format too, so they can be edited.

## How it works

- `src/music/`: note spelling, chords and scales, fingerings, reading levels, ear-training data
- `src/audio/`: a synthesised piano voice (no sample downloads) and microphone pitch tracking. Pitch uses the McLeod method via [pitchy](https://github.com/ianprime0509/pitchy), with onset detection in `noteTracker.ts`.
- `src/components/Staff.tsx`: renders the staff in SVG using a 9 KB subset of the [Bravura](https://github.com/steinbergmedia/bravura) music font (SIL Open Font License)
- `src/components/Keyboard.tsx`: the on-screen piano
- `src/music/song.ts`, `scoreLayout.ts`, `components/ScoreStaff.tsx`: the song model and the sheet-music engraver (stems, beams, flags, dots, ties, rests, accidentals per bar)
- `src/music/import/`: MIDI and MusicXML readers that turn one part into a single readable melody line
