import { useState } from 'react';
import type { QuizQuestion } from '../../types/progress';
import type { Chapter } from '../../data/chapters';
import type { Subject } from '../../types';

interface QuizViewProps {
  subject: Subject;
  chapter: Chapter;
  questions: QuizQuestion[];
  onComplete: (correctAnswers: number, firstTryCorrect: boolean[]) => void;
  onBack: () => void;
  onOpenTutor: () => void;
}

type AnswerState = { selected: number; isCorrect: boolean } | null;

export default function QuizView({ subject, chapter, questions, onComplete, onBack, onOpenTutor }: QuizViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerStates, setAnswerStates] = useState<AnswerState[]>(Array(questions.length).fill(null));
  const [finished, setFinished] = useState(false);
  const [totalXP, setTotalXP] = useState(0);

  const current = questions[currentIndex];
  const currentAnswer = answerStates[currentIndex];

  function handleSelectOption(optionIndex: number) {
    if (currentAnswer !== null) return; // already answered
    const isCorrect = optionIndex === current.correctIndex;
    const xpGain = isCorrect ? 25 : 0;
    setTotalXP((x) => Math.max(0, x + xpGain - (isCorrect ? 0 : 5)));
    const updated = [...answerStates];
    updated[currentIndex] = { selected: optionIndex, isCorrect };
    setAnswerStates(updated);
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Quiz done
      const correctCount = answerStates.filter((a) => a?.isCorrect).length;
      const firstTryCorrect = answerStates.map((a) => a?.isCorrect ?? false);
      // Add completion bonus
      const completionXP = 40 + (correctCount === questions.length ? 100 : 0);
      setTotalXP((x) => x + completionXP);
      setFinished(true);
      onComplete(correctCount, firstTryCorrect);
    }
  }

  const correctCount = answerStates.filter((a) => a?.isCorrect).length;
  const isPerfect = finished && correctCount === questions.length;

  // ── Results screen ────────────────────────────────────────────────────────
  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-8 animate-fade-in">
        <div className="text-5xl mb-4">{isPerfect ? '💯' : correctCount >= 3 ? '🎉' : '💪'}</div>
        <h2 className="text-2xl font-black text-gray-900 mb-1">
          {isPerfect ? 'Quiz Perfeito!' : `${correctCount}/${questions.length} corretas`}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {chapter.name} · {subject.name}
        </p>

        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-5 w-full max-w-xs mb-6 border border-blue-100">
          <div className="text-3xl font-black text-blue-600 mb-1">+{totalXP} XP</div>
          <p className="text-xs text-gray-500">
            {isPerfect ? 'Bónus de quiz perfeito incluído! 🔥' : 'Continua a treinar para bónus maiores.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setAnswerStates(Array(questions.length).fill(null));
              setFinished(false);
              setTotalXP(0);
            }}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl hover:scale-[1.01] transition-all"
          >
            Repetir quiz
          </button>
          <button
            onClick={onBack}
            className="w-full py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
          >
            Voltar ao capítulo
          </button>
          <button
            onClick={onOpenTutor}
            className="w-full py-3 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Abrir tutor IA
          </button>
        </div>
      </div>
    );
  }

  // ── Question screen ───────────────────────────────────────────────────────
  const progress = ((currentIndex) / questions.length) * 100;

  return (
    <div className="flex flex-col gap-6 py-4 animate-fade-in">
      {/* Progress header */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span>{chapter.name}</span>
          <span>{currentIndex + 1}/{questions.length}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-sm font-bold text-gray-900 leading-relaxed">{current.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {current.options.map((option, idx) => {
          let style = 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50 text-gray-700';
          if (currentAnswer !== null) {
            if (idx === current.correctIndex) {
              style = 'border-emerald-400 bg-emerald-50 text-emerald-800';
            } else if (idx === currentAnswer.selected && !currentAnswer.isCorrect) {
              style = 'border-red-400 bg-red-50 text-red-700';
            } else {
              style = 'border-gray-100 bg-gray-50 text-gray-400';
            }
          }
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectOption(idx)}
              disabled={currentAnswer !== null}
              className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${style}`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  currentAnswer !== null && idx === current.correctIndex
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : currentAnswer !== null && idx === currentAnswer.selected && !currentAnswer.isCorrect
                    ? 'border-red-400 bg-red-400 text-white'
                    : 'border-gray-300'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                {option}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {currentAnswer !== null && (
        <div className={`rounded-xl p-4 border text-sm leading-relaxed animate-fade-in ${
          currentAnswer.isCorrect
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="font-bold mb-1">{currentAnswer.isCorrect ? '✓ Correto! +25 XP' : '✗ Errado. -5 XP'}</p>
          <p className="text-sm opacity-90">{current.explanation}</p>
        </div>
      )}

      {/* Next */}
      {currentAnswer !== null && (
        <button
          onClick={handleNext}
          className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl hover:scale-[1.01] transition-all duration-200 animate-slide-up"
        >
          {currentIndex < questions.length - 1 ? 'Próxima pergunta' : 'Ver resultados'}
        </button>
      )}

      {/* Back */}
      <button
        onClick={onBack}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
      >
        ← Voltar ao capítulo
      </button>
    </div>
  );
}
