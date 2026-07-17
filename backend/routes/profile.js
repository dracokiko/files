import express from 'express'
import { requireUser } from '../middleware/auth.js'

// First 24h after signup: unlimited course/year changes (fixes a wrong
// choice made during registration). After that: at most once every 30 days.
const COURSE_CHANGE_GRACE_MS = 24 * 60 * 60 * 1000
const COURSE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

function mapProfileRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    institution: row.institution,
    institutionId: row.institution_id,
    course: row.course,
    courseId: row.course_id,
    year: row.year,
    yearLabel: row.year_label,
    plan: row.plan,
    preferences: row.preferences,
    createdAt: row.created_at,
    courseChangedAt: row.course_changed_at,
  }
}

function courseChangeEligibility({ createdAt, courseChangedAt }) {
  const now = Date.now()
  if (now - new Date(createdAt).getTime() < COURSE_CHANGE_GRACE_MS) {
    return { eligible: true, availableAt: null }
  }
  if (!courseChangedAt) {
    return { eligible: true, availableAt: null }
  }
  const availableAt = new Date(new Date(courseChangedAt).getTime() + COURSE_CHANGE_COOLDOWN_MS)
  return { eligible: now >= availableAt.getTime(), availableAt: availableAt.toISOString() }
}

/**
 * Personal profile/settings API. Every route derives the caller from
 * req.userId (verified server-side by requireUser) — the course-change
 * cooldown is re-checked here on every PATCH, never trusted from the
 * client, since the eligibility window controls a business rule (not just
 * a UI affordance).
 */
export default function profileRoutes({ supabase, supabaseAdmin }) {
  const router = express.Router()
  const db = supabaseAdmin

  router.use(requireUser(supabase))

  router.get('/', async (req, res) => {
    const { data, error } = await db.from('profiles').select('*').eq('id', req.userId).single()
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    const courseChange = courseChangeEligibility({ createdAt: data.created_at, courseChangedAt: data.course_changed_at })
    res.json({ profile: mapProfileRow(data), courseChange })
  })

  router.patch('/course', async (req, res) => {
    const { institutionId, institutionName, courseId, courseName, year, yearLabel } = req.body ?? {}
    if (!institutionId || !institutionName || !courseId || !courseName || !Number.isFinite(year) || !yearLabel) {
      return res.status(422).json({ error: 'INVALID_INPUT', message: 'Dados de curso incompletos.' })
    }

    const { data: current, error: fetchErr } = await db
      .from('profiles').select('created_at, course_changed_at').eq('id', req.userId).single()
    if (fetchErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: fetchErr.message })

    const { eligible, availableAt } = courseChangeEligibility({
      createdAt: current.created_at, courseChangedAt: current.course_changed_at,
    })
    if (!eligible) {
      return res.status(403).json({
        error: 'COURSE_CHANGE_LOCKED',
        message: `Só podes voltar a alterar o curso/ano a partir de ${new Date(availableAt).toLocaleDateString('pt-PT')}.`,
        availableAt,
      })
    }

    const { data, error } = await db.from('profiles').update({
      institution: institutionName,
      institution_id: institutionId,
      course: courseName,
      course_id: courseId,
      year,
      year_label: yearLabel,
      course_changed_at: new Date().toISOString(),
    }).eq('id', req.userId).select().single()
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    res.json({ profile: mapProfileRow(data) })
  })

  return router
}
