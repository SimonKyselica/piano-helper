import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/ui';
import { markLearned } from '../../state/progress';
import { go } from '../../state/router';
import { CHAPTERS, type ChapterId } from './chapters';
import { KeyboardChapter, NamesChapter } from './KeyboardChapters';
import { RhythmChapter } from './RhythmChapter';
import { SharpsChapter, StaffChapter } from './StaffChapters';

const BODIES: Record<ChapterId, () => ReactNode> = {
  keyboard: KeyboardChapter,
  names: NamesChapter,
  staff: StaffChapter,
  sharps: SharpsChapter,
  rhythm: RhythmChapter,
};

export function ChapterPage({ id }: { id: string }) {
  const index = CHAPTERS.findIndex((c) => c.id === id);
  if (index < 0) return <p className="page">Chapter not found.</p>;
  const chapter = CHAPTERS[index];
  const next = CHAPTERS[index + 1];
  const Body = BODIES[chapter.id];
  return (
    <div className="page learn chapter">
      <PageHeader title={chapter.title} backTo="/learn" right={<span className="counter">{index + 1}/{CHAPTERS.length}</span>} />
      <Body />
      <div className="button-stack">
        <button
          className="btn primary block"
          onClick={() => {
            markLearned(chapter.id);
            go(next ? `/learn/${next.id}` : '/songs');
          }}
        >
          {next ? `Next: ${next.title}` : 'Play your first song'} <Icon name="chevron" size={18} />
        </button>
      </div>
    </div>
  );
}
