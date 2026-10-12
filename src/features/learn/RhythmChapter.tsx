import { MiniScore } from './MiniScore';

const VALUES = [
  { name: 'Whole note', beats: '4 beats', text: 'C4w |', look: 'Hollow, no stem.' },
  { name: 'Half note', beats: '2 beats', text: 'C4h C4h |', look: 'Hollow with a stem.' },
  { name: 'Quarter note', beats: '1 beat', text: 'C4q C4q C4q C4q |', look: 'Filled in with a stem.' },
  { name: 'Eighth notes', beats: '½ beat each', text: 'C4e C4e C4e C4e C4e C4e C4e C4e |', look: 'One flag, or joined by one beam.' },
  { name: 'Sixteenth notes', beats: '¼ beat each', text: 'time: 2/4\nC4s C4s C4s C4s C4s C4s C4s C4s |', look: 'Two flags or two beams.' },
];

export function RhythmChapter() {
  return (
    <>
      <section className="card prose">
        <p>
          The <b>shape</b> of a note tells you <b>how long</b> to hold it. Music moves to a steady <b>beat</b>, like a clock ticking: count “1, 2, 3, 4” evenly.
        </p>
        <p>Tap Listen on each example. You’ll hear a count-in, then the notes with the beat clicking along.</p>
      </section>

      {VALUES.map((v) => (
        <section key={v.name} className="card rhythm-card">
          <div className="card-head">
            <h3>{v.name}</h3>
            <span className="rhythm-beats">{v.beats}</span>
          </div>
          <MiniScore text={v.text} caption={v.look} />
        </section>
      ))}

      <section className="card prose">
        <h3>Rests: silence that counts</h3>
        <p>A rest means “don’t play”, but keep counting. Each note length has a matching rest.</p>
        <MiniScore text="C4q Rq C4q Rq | C4h Rh | C4q Re C4e C4h |" caption="Quarter, half and eighth rests" />
      </section>

      <section className="card prose">
        <h3>Dots and ties</h3>
        <p>
          A <b>dot</b> after a note makes it half as long again: a dotted half note lasts 2 + 1 = 3 beats.
        </p>
        <MiniScore text="C4h. E4q | G4q. E4e C4h |" labels caption="Dotted half, dotted quarter" />
        <p>
          A <b>tie</b> (a curve joining two notes of the same pitch) makes one long note. Play the first one and keep holding through the second.
        </p>
        <MiniScore text="E4q G4q C5h~ | C5h G4h |" labels caption="The tied C lasts 4 beats" />
      </section>

      <section className="card prose">
        <h3>Bars and time signatures</h3>
        <p>
          Vertical <b>bar lines</b> split music into small chunks called <b>bars</b> (or measures). The two numbers at the start are the <b>time signature</b>: the top number is how many beats are in each bar.
        </p>
        <MiniScore text={'time: 4/4\nC4q D4q E4q F4q | G4h G4h |'} labels caption="4/4: count 1 2 3 4" />
        <MiniScore text={'time: 3/4\nC4h E4q | G4q G4q G4q | C5h. |'} labels caption="3/4: count 1 2 3, like a waltz" />
        <p className="muted small">Some songs start with a short bar called a pickup: count in and come in on the last beat or two.</p>
      </section>
    </>
  );
}
