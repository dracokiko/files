import type { ChapterProgress } from '../../types/progress';
import { calculateLevel, calculateMastery } from '../../utils/progress';
import XPBar from './XPBar';
import MasteryProgress from './MasteryProgress';

interface ChapterProgressCardProps {
  chapterName: string;
  chapterId: string;
  progress: ChapterProgress | undefined;
  isPaid: boolean;
  isLocked: boolean;
  onClick: () => void;
}

export default function ChapterProgressCard({
  chapterName,
  progress,
  isPaid,
  isLocked,
  onClick,
}: ChapterProgressCardProps) {
  const xp = progress?.xp ?? 0;
  const level = calculateLevel(xp);
  const mastery = calculateMastery(progress?.correctAnswers ?? 0, progress?.wrongAnswers ?? 0);
  const attempts = progress?.quizAttempts.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 relative overflow-hidden group ${
        isLocked
          ? 'border-gray-100 bg-gray-50 cursor-pointer'
          : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm'
      }`}
    >
      {/* Lock overlay for free plan */}
      {isLocked && !isPaid && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Upgrade para desbloquear
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">{chapterName}</p>
          <p className="text-xs text-gray-400 mt-0.5">Nível {level} · {attempts} quiz{attempts !== 1 ? 'zes' : ''}</p>
        </div>
        <div className="flex-shrink-0 ml-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-black">{level}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <XPBar xp={xp} showLabel={false} compact />
        <MasteryProgress mastery={mastery} size="sm" />
      </div>

      {isPaid && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">Quiz disponível</span>
          <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700">
            Iniciar →
          </span>
        </div>
      )}
    </button>
  );
}
