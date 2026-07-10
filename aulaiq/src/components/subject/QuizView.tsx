import { useState, useEffect } from 'react';
import type { Chapter } from '../../data/chapters';
import type { Subject } from '../../types';
import { generateQuiz, answerQuizQuestion, completeQuiz, type RemoteQuizQuestion, type QuizCompleteResult } from '../../api/gamification';

interface QuizViewProps {
  subject: Subject;
  chapter: Chapter;
  onComplete: (result: QuizCompleteResult) => void;
  onBack: () => void;
  onOpenTutor: () => void;
}

type AnswerState = { selected: number; isCorrect: boolean; correctIndex: number; explanation: string } | null;

export default function QuizView({ subject, chapter, onComplete, onBack, onOpenTutor }: QuizViewProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quizSetId, setQuizSetId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<RemoteQuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerStates, setAnswerStates] = useState<AnswerState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<QuizCompleteResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    generateQuiz(subject.id, chapter.id)
      .then(({ quizSetId, questions }) => {
        if (cancelled) return;
        setQuizSetId(quizSetId);
        setQuestions(questions);
        setAnswerStates(Array(questions.length).fill(null));
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message ?? 'Erro ao gerar quiz.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [subject.id, chapter.id]);

  const current = questions[currentIndex];
  const currentAnswer = answerStates[currentIndex];

  async function handleSelectOption(optionIndex: number) {
    if (currentAnswer !== null || !quizSetId || submitting) return;
    setSubmitting(true);
    try {
      const res = await answerQuizQuestion(quizSetId, currentIndex, optionIndex);
      const updated = [...answerStates];
      updated[currentIndex] = { selected: optionIndex, isCorrect: res.correct, correctIndex: res.correctIndex, explanation: res.explanation };
      setAnswerStates(updated);
    } catch {
      // leave unanswered so the student can retry
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      return;
    }
    if (!quizSetId) return;
    setSubmitting(true);
    try {
      const res = await completeQuiz(quizSetId);
      setResult(res);
      setFinished(true);
      onComplete(res);
    } catch {
      // if completion fails, let the student see the last answer and retry
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4 py-8">
        <div className="flex gap-1 mb-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        <p className="text-sm text-gray-400">A gerar perguntas a partir do material da cadeira...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4 py-8">
        <p className="text-sm text-red-500 mb-4">{loadError}</p>
        <button onClick={onBack} className="text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-2 transition-colors">
          Voltar ao capítulo
        </button>
      </div>
    );
  }

  // ── Results screen ────────────────────────────────────────────────────────
  if (finished && result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-8 animate-fade-in">
        <div className="text-5xl mb-4">{result.isPerfect ? '💯' : result.correctAnswers >= 3 ? '🎉' : '💪'}</div>
        <h2 className="text-2xl font-black text-gray-900 mb-1">
          {result.isPerfect ? 'Quiz Perfeito!' : `${result.correctAnswers}/${result.totalQuestions} corretas`}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {chapter.name} · {subject.name}
        </p>

        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-5 w-full max-w-xs mb-6 border border-blue-100">
          <div className="text-3xl font-black text-blue-600 mb-1">+{result.xpGained} XP</div>
          <p className="text-xs text-gray-500">
            {result.isPerfect ? 'Bónus de quiz perfeito incluído! 🔥' : 'Continua a treinar para bónus maiores.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
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

  if (!current) return null;

  // ── Question screen ───────────────────────────────────────────────────────
  const progress = (currentIndex / questions.length) * 100;

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
            if (idx === currentAnswer.correctIndex) {
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
              disabled={currentAnswer !== null || submitting}
              className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${style}`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  currentAnswer !== null && idx === currentAnswer.correctIndex
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
          <p className="text-sm opacity-90">{currentAnswer.explanation}</p>
        </div>
      )}

      {/* Next */}
      {currentAnswer !== null && (
        <button
          onClick={handleNext}
          disabled={submitting}
          className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl hover:scale-[1.01] transition-all duration-200 animate-slide-up disabled:opacity-60"
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
