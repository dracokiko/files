/**
 * Server-side XP math — the single source of truth, replacing the
 * client-computed version that used to live in aulaiq/src/utils/progress.ts
 * (deleted; the client no longer supplies its own correctness/XP numbers).
 */

const LISBON_TZ = 'Europe/Lisbon'

function lisbonToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LISBON_TZ }).format(date)
}

export function calculateLevel(xp) {
  return Math.floor(xp / 100) + 1
}

export function calculateMastery(correctAnswers, wrongAnswers) {
  const total = correctAnswers + wrongAnswers
  if (total === 0) return 0
  return Math.round((correctAnswers / total) * 100)
}

/**
 * @param {object} params
 * @param {number} params.correctAnswers
 * @param {number} params.totalQuestions
 * @param {boolean[]} params.firstTryCorrect — per-question, in order answered
 * @param {{current: number, lastActiveDate: string}} params.streak — current DB state
 * @param {{xp: number}} params.prevChapter
 * @param {{xp: number}} params.prevSubject
 * @param {Set<string>} params.earnedBadgeIds — badges the user already has
 * @param {number} params.chapterCorrectTotal — chapter correct answers after this attempt
 * @param {number} params.chapterWrongTotal — chapter wrong answers after this attempt
 * @param {boolean} params.isFirstAttemptForChapter
 * @param {boolean} params.wasChapterWeak — prior wrongAnswers > correctAnswers
 */
export function computeQuizXP(params) {
  const {
    correctAnswers, totalQuestions, firstTryCorrect,
    streak, prevChapter, prevSubject, earnedBadgeIds,
    chapterCorrectTotal, chapterWrongTotal,
    isFirstAttemptForChapter, wasChapterWeak,
  } = params

  let xpDelta = 0
  for (let i = 0; i < totalQuestions; i++) {
    if (i < correctAnswers) {
      xpDelta += firstTryCorrect[i] ? 25 : 15
    } else {
      xpDelta = Math.max(0, xpDelta - 5)
    }
  }

  const completionXP = 40
  xpDelta += completionXP

  const isPerfect = correctAnswers === totalQuestions
  const perfectBonus = isPerfect ? 100 : 0
  xpDelta += perfectBonus

  const today = lisbonToday()
  let streakBonus = 0
  const newStreak = { ...streak }
  if (newStreak.lastActiveDate !== today) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = lisbonToday(yesterday)
    newStreak.current = newStreak.lastActiveDate === yStr ? newStreak.current + 1 : 1
    newStreak.lastActiveDate = today
    streakBonus = 20
    xpDelta += streakBonus
  }

  const newChapterXP = Math.max(0, prevChapter.xp + xpDelta)
  const newSubjectXP = Math.max(0, prevSubject.xp + xpDelta)

  const earned = new Set(earnedBadgeIds)
  const newBadges = []
  const addBadge = (id) => { if (!earned.has(id)) { earned.add(id); newBadges.push(id) } }

  if (isFirstAttemptForChapter) addBadge('first_quiz')
  if (isPerfect) addBadge('perfect_quiz')
  if (newSubjectXP >= 100) addBadge('xp_100_subject')
  if (newStreak.current >= 3) addBadge('streak_3')
  const chapterMastery = calculateMastery(chapterCorrectTotal, chapterWrongTotal)
  if (chapterMastery >= 80) addBadge('chapter_mastered')
  if (wasChapterWeak && chapterCorrectTotal > chapterWrongTotal) addBadge('recovered_weak_chapter')

  return {
    xpDelta, completionXP, perfectBonus, streakBonus, isPerfect,
    newStreak, newChapterXP, newSubjectXP, newBadges,
  }
}
