import express from 'express'
import { calculateLevel, computeQuizXP } from '../services/xp.js'

const QUIZ_MODEL = process.env.ANSWER_MODEL ?? 'gemini-flash-lite-latest'
const QUIZ_CHUNK_TYPES = ['definition', 'example', 'exercise', 'body']

/**
 * Server-validated gamification: progress/XP, buddies, challenges, quizzes.
 * Mounted at /api/gamification behind requireUser — every route trusts
 * req.userId (verified server-side), never a client-supplied id.
 */
export default function gamificationRoutes({ supabase, supabaseAdmin, genai }) {
  const router = express.Router()
  const db = supabaseAdmin ?? supabase

  // ── Progress ────────────────────────────────────────────────────────────
  router.get('/progress', async (req, res) => {
    const { cadeira_id } = req.query
    if (!cadeira_id) return res.status(400).json({ error: 'cadeira_id em falta.' })

    const { data: profile, error: pErr } = await db
      .from('profiles').select('global_xp, streak_current, streak_last_active_date')
      .eq('id', req.userId).single()
    if (pErr) return res.status(500).json({ error: pErr.message })

    const { data: subject } = await db
      .from('user_subject_progress').select('xp, correct_answers, total_answers')
      .eq('user_id', req.userId).eq('cadeira_id', cadeira_id).maybeSingle()

    const { data: chapters } = await db
      .from('user_chapter_progress').select('chapter_id, xp, correct_answers, wrong_answers, attempts_count')
      .eq('user_id', req.userId).eq('cadeira_id', cadeira_id)

    const { data: badges } = await db
      .from('earned_badges').select('badge_id').eq('user_id', req.userId)

    res.json({
      globalXP: profile.global_xp,
      globalLevel: calculateLevel(profile.global_xp),
      streak: { current: profile.streak_current, lastActiveDate: profile.streak_last_active_date },
      earnedBadges: (badges ?? []).map(b => b.badge_id),
      subject: subject ?? { xp: 0, correct_answers: 0, total_answers: 0 },
      chapters: Object.fromEntries((chapters ?? []).map(c => [c.chapter_id, c])),
    })
  })

  // Bulk per-subject XP for the subject-list dashboard (avoids N+1 calls).
  router.get('/progress/bulk', async (req, res) => {
    const cadeiraIds = (req.query.cadeira_ids ?? '').split(',').filter(Boolean)
    if (!cadeiraIds.length) return res.status(400).json({ error: 'cadeira_ids em falta.' })

    const [{ data: profile, error: pErr }, { data: rows }] = await Promise.all([
      db.from('profiles').select('global_xp, streak_current, streak_last_active_date').eq('id', req.userId).single(),
      db.from('user_subject_progress').select('cadeira_id, xp').eq('user_id', req.userId).in('cadeira_id', cadeiraIds),
    ])
    if (pErr) return res.status(500).json({ error: pErr.message })

    res.json({
      globalXP: profile.global_xp,
      streak: { current: profile.streak_current, lastActiveDate: profile.streak_last_active_date },
      subjectXP: Object.fromEntries((rows ?? []).map(r => [r.cadeira_id, r.xp])),
    })
  })

  // ── Buddies ─────────────────────────────────────────────────────────────
  router.get('/buddies', async (req, res) => {
    const { cadeira_id } = req.query
    if (!cadeira_id) return res.status(400).json({ error: 'cadeira_id em falta.' })

    const { data: links, error } = await db
      .from('buddies').select('buddy_user_id, profiles!buddies_buddy_user_id_fkey(id, name)')
      .eq('user_id', req.userId)
    if (error) return res.status(500).json({ error: error.message })

    const buddyIds = (links ?? []).map(l => l.buddy_user_id)
    const { data: xpRows } = buddyIds.length
      ? await db.from('user_subject_progress').select('user_id, xp').eq('cadeira_id', cadeira_id).in('user_id', buddyIds)
      : { data: [] }
    const xpByUser = Object.fromEntries((xpRows ?? []).map(r => [r.user_id, r.xp]))

    const buddies = (links ?? []).map(l => ({
      id: l.buddy_user_id,
      name: l.profiles?.name ?? 'Buddy',
      xp: xpByUser[l.buddy_user_id] ?? 0,
    }))

    const { data: challenges } = await db
      .from('challenges').select('id, from_user_id, message, status, created_at, profiles!challenges_from_user_id_fkey(name)')
      .eq('to_user_id', req.userId).eq('cadeira_id', cadeira_id).eq('status', 'open')
      .order('created_at', { ascending: false })

    res.json({
      buddies,
      challenges: (challenges ?? []).map(c => ({
        id: c.id, fromName: c.profiles?.name ?? 'Buddy', message: c.message, createdAt: c.created_at,
      })),
    })
  })

  router.post('/buddies', async (req, res) => {
    const { email } = req.body
    if (!email?.trim()) return res.status(400).json({ error: 'Email em falta.' })

    const { data: target, error: tErr } = await db
      .from('profiles').select('id, name').ilike('email', email.trim()).maybeSingle()
    if (tErr) return res.status(500).json({ error: tErr.message })
    if (!target) return res.status(404).json({ error: 'Não encontrámos nenhum aluno com esse email.' })
    if (target.id === req.userId) return res.status(400).json({ error: 'Não podes adicionar-te a ti próprio.' })

    const { error } = await db.from('buddies').upsert([
      { user_id: req.userId, buddy_user_id: target.id },
      { user_id: target.id, buddy_user_id: req.userId },
    ], { onConflict: 'user_id,buddy_user_id', ignoreDuplicates: true })
    if (error) return res.status(500).json({ error: error.message })

    res.json({ id: target.id, name: target.name })
  })

  // ── Challenges ──────────────────────────────────────────────────────────
  router.post('/challenges', async (req, res) => {
    const { buddy_user_id, cadeira_id, message } = req.body
    if (!buddy_user_id || !cadeira_id) return res.status(400).json({ error: 'buddy_user_id e cadeira_id em falta.' })

    const { data: link } = await db.from('buddies').select('user_id')
      .eq('user_id', req.userId).eq('buddy_user_id', buddy_user_id).maybeSingle()
    if (!link) return res.status(403).json({ error: 'Só podes desafiar buddies reais.' })

    const { data, error } = await db.from('challenges')
      .insert({ from_user_id: req.userId, to_user_id: buddy_user_id, cadeira_id, message: message ?? null })
      .select('id, status, created_at').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  router.post('/challenges/:id/seen', async (req, res) => {
    const { error } = await db.from('challenges')
      .update({ status: 'seen', seen_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('to_user_id', req.userId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // ── Quiz generation ─────────────────────────────────────────────────────
  router.post('/quiz/generate', async (req, res) => {
    const { cadeira_id, chapter_id } = req.body
    if (!cadeira_id || !chapter_id) return res.status(400).json({ error: 'cadeira_id e chapter_id em falta.' })
    if (!genai) return res.status(500).json({ error: 'Gemini não configurado.' })

    const { data: chunks, error: cErr } = await db
      .from('chunks').select('id, content_markdown, chunk_type')
      .eq('chapter_id', chapter_id).in('chunk_type', QUIZ_CHUNK_TYPES).limit(12)
    if (cErr) return res.status(500).json({ error: cErr.message })
    if (!chunks?.length) return res.status(404).json({ error: 'Sem material disponível para este capítulo.' })

    const excerpts = chunks.map((c, i) => `<excerto ${i + 1}>\n${c.content_markdown}\n</excerto>`).join('\n\n')
    const prompt = `Cria exatamente 5 perguntas de escolha múltipla (4 opções cada) em português de Portugal, baseadas EXCLUSIVAMENTE nos excertos abaixo. Não inventes factos fora dos excertos.

${excerpts}

Responde APENAS com um array JSON válido, sem markdown, no formato:
[{"question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..."}]`

    let questions
    try {
      const model = genai.getGenerativeModel({
        model: QUIZ_MODEL,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 2000 },
      })
      const result = await model.generateContent(prompt)
      questions = JSON.parse(result.response.text())
      if (!Array.isArray(questions) || questions.length === 0) throw new Error('empty')
      for (const q of questions) {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctIndex !== 'number') {
          throw new Error('malformed question')
        }
      }
    } catch {
      return res.status(502).json({ error: 'Não foi possível gerar o quiz. Tenta novamente.' })
    }

    const { data: quizSet, error: qsErr } = await db.from('quiz_sets')
      .insert({ cadeira_id, chapter_id, generated_for_user_id: req.userId, source_chunk_ids: chunks.map(c => c.id), model: QUIZ_MODEL })
      .select('id').single()
    if (qsErr) return res.status(500).json({ error: qsErr.message })

    const rows = questions.slice(0, 5).map((q, i) => ({
      quiz_set_id: quizSet.id, ordinal: i, question: q.question,
      options: q.options, correct_index: q.correctIndex, explanation: q.explanation ?? '',
    }))
    const { data: inserted, error: qErr } = await db.from('quiz_questions').insert(rows).select('id, ordinal, question, options')
    if (qErr) return res.status(500).json({ error: qErr.message })

    res.json({ quiz_set_id: quizSet.id, questions: inserted.sort((a, b) => a.ordinal - b.ordinal) })
  })

  router.post('/quiz/:quizSetId/answer', async (req, res) => {
    const { ordinal, selected } = req.body
    if (ordinal == null || selected == null) return res.status(400).json({ error: 'ordinal e selected em falta.' })

    const { data: question, error: qErr } = await db.from('quiz_questions')
      .select('correct_index, explanation').eq('quiz_set_id', req.params.quizSetId).eq('ordinal', ordinal).single()
    if (qErr || !question) return res.status(404).json({ error: 'Pergunta não encontrada.' })

    const { data: attempt } = await db.from('quiz_attempts')
      .select('answers').eq('quiz_set_id', req.params.quizSetId).eq('user_id', req.userId).maybeSingle()
    const answers = attempt?.answers ? [...attempt.answers] : []
    answers[ordinal] = selected

    const { error: uErr } = await db.from('quiz_attempts')
      .upsert({ quiz_set_id: req.params.quizSetId, user_id: req.userId, answers }, { onConflict: 'quiz_set_id,user_id' })
    if (uErr) return res.status(500).json({ error: uErr.message })

    res.json({ correct: selected === question.correct_index, correct_index: question.correct_index, explanation: question.explanation })
  })

  router.post('/quiz/:quizSetId/complete', async (req, res) => {
    const { data: quizSet, error: qsErr } = await db.from('quiz_sets')
      .select('cadeira_id, chapter_id').eq('id', req.params.quizSetId).single()
    if (qsErr || !quizSet) return res.status(404).json({ error: 'Quiz não encontrado.' })

    const { data: questions, error: qErr } = await db.from('quiz_questions')
      .select('ordinal, correct_index').eq('quiz_set_id', req.params.quizSetId).order('ordinal')
    if (qErr) return res.status(500).json({ error: qErr.message })

    const { data: attempt, error: aErr } = await db.from('quiz_attempts')
      .select('answers, completed_at').eq('quiz_set_id', req.params.quizSetId).eq('user_id', req.userId).single()
    if (aErr || !attempt) return res.status(404).json({ error: 'Nenhuma tentativa encontrada.' })
    if (attempt.completed_at) return res.status(409).json({ error: 'Este quiz já foi concluído.' })

    const totalQuestions = questions.length
    const firstTryCorrect = questions.map(q => attempt.answers[q.ordinal] === q.correct_index)
    const correctAnswers = firstTryCorrect.filter(Boolean).length

    const { cadeira_id, chapter_id } = quizSet

    const [{ data: profile }, { data: subjectRow }, { data: chapterRow }, { data: badgeRows }] = await Promise.all([
      db.from('profiles').select('global_xp, streak_current, streak_last_active_date').eq('id', req.userId).single(),
      db.from('user_subject_progress').select('xp, correct_answers, total_answers').eq('user_id', req.userId).eq('cadeira_id', cadeira_id).maybeSingle(),
      chapter_id ? db.from('user_chapter_progress').select('xp, correct_answers, wrong_answers, attempts_count').eq('user_id', req.userId).eq('chapter_id', chapter_id).maybeSingle() : { data: null },
      db.from('earned_badges').select('badge_id').eq('user_id', req.userId),
    ])

    const prevSubject = subjectRow ?? { xp: 0, correct_answers: 0, total_answers: 0 }
    const prevChapter = chapterRow ?? { xp: 0, correct_answers: 0, wrong_answers: 0, attempts_count: 0 }
    const wasChapterWeak = prevChapter.wrong_answers > prevChapter.correct_answers

    const xpResult = computeQuizXP({
      correctAnswers, totalQuestions, firstTryCorrect,
      streak: { current: profile.streak_current, lastActiveDate: profile.streak_last_active_date },
      prevChapter: { xp: prevChapter.xp }, prevSubject: { xp: prevSubject.xp },
      earnedBadgeIds: new Set((badgeRows ?? []).map(b => b.badge_id)),
      chapterCorrectTotal: prevChapter.correct_answers + correctAnswers,
      chapterWrongTotal: prevChapter.wrong_answers + (totalQuestions - correctAnswers),
      isFirstAttemptForChapter: prevChapter.attempts_count === 0,
      wasChapterWeak,
    })

    const newGlobalXP = Math.max(0, profile.global_xp + xpResult.xpDelta)

    await Promise.all([
      db.from('profiles').update({
        global_xp: newGlobalXP, streak_current: xpResult.newStreak.current, streak_last_active_date: xpResult.newStreak.lastActiveDate,
      }).eq('id', req.userId),
      db.from('user_subject_progress').upsert({
        user_id: req.userId, cadeira_id,
        xp: xpResult.newSubjectXP,
        correct_answers: prevSubject.correct_answers + correctAnswers,
        total_answers: prevSubject.total_answers + totalQuestions,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,cadeira_id' }),
      chapter_id ? db.from('user_chapter_progress').upsert({
        user_id: req.userId, chapter_id, cadeira_id,
        xp: xpResult.newChapterXP,
        correct_answers: prevChapter.correct_answers + correctAnswers,
        wrong_answers: prevChapter.wrong_answers + (totalQuestions - correctAnswers),
        attempts_count: prevChapter.attempts_count + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,chapter_id' }) : Promise.resolve(),
      xpResult.newBadges.length
        ? db.from('earned_badges').insert(xpResult.newBadges.map(badge_id => ({ user_id: req.userId, badge_id })))
        : Promise.resolve(),
      db.from('quiz_attempts').update({
        correct_count: correctAnswers, xp_awarded: xpResult.xpDelta, completed_at: new Date().toISOString(),
      }).eq('quiz_set_id', req.params.quizSetId).eq('user_id', req.userId),
    ])

    res.json({
      correctAnswers, totalQuestions, isPerfect: xpResult.isPerfect,
      xpGained: xpResult.xpDelta, newGlobalXP, newSubjectXP: xpResult.newSubjectXP, newChapterXP: xpResult.newChapterXP,
      newBadges: xpResult.newBadges,
    })
  })

  return router
}
