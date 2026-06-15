import type { Subject } from '../../types';
import type { SubjectProgress } from '../../types/progress';
import type { Chapter } from '../../data/chapters';
import ChapterProgressCard from '../progress/ChapterProgressCard';
import UpsellPopup from '../UpsellPopup';
import { useState } from 'react';

interface ChaptersTabProps {
  subject: Subject;
  chapters: Chapter[];
  subjectProgress: SubjectProgress | undefined;
  isPaid: boolean;
  onStartQuiz: (chapter: Chapter) => void;
}

export default function ChaptersTab({
  subject,
  chapters,
  subjectProgress,
  isPaid,
  onStartQuiz,
}: ChaptersTabProps) {
  const [showUpsell, setShowUpsell] = useState(false);

  function handleChapterClick(chapter: Chapter) {
    if (!isPaid) {
      setShowUpsell(true);
      return;
    }
    onStartQuiz(chapter);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{subject.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{chapters.length} capítulos disponíveis</p>
        </div>
        {!isPaid && (
          <span className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded-lg font-medium border border-amber-100">
            Quizzes bloqueados
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {chapters.map((chapter) => {
          const chapterProgress = subjectProgress?.chapters[chapter.id];
          return (
            <ChapterProgressCard
              key={chapter.id}
              chapterName={chapter.name}
              chapterId={chapter.id}
              progress={chapterProgress}
              isPaid={isPaid}
              isLocked={!isPaid}
              onClick={() => handleChapterClick(chapter)}
            />
          );
        })}
      </div>

      {!isPaid && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold text-amber-800 mb-1">Quizzes automáticos são premium</p>
          <p className="text-xs text-amber-600 leading-relaxed mb-3">
            Desbloqueia quizzes por capítulo para treinar exactamente o tipo de pergunta que pode sair.
          </p>
          <button
            onClick={() => setShowUpsell(true)}
            className="text-xs font-bold text-white px-4 py-2 bg-gradient-to-r from-blue-500 to-violet-500 rounded-xl hover:scale-[1.02] transition-all"
          >
            Ver planos pagos
          </button>
        </div>
      )}

      {showUpsell && <UpsellPopup onClose={() => setShowUpsell(false)} />}
    </div>
  );
}
