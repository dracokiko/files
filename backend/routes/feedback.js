/**
 * Feedback API — Phase 12.
 * POST /api/v2/feedback          — submit thumbs up/down or detailed feedback
 * GET  /api/v2/feedback/stats    — aggregate feedback stats (admin)
 * GET  /api/v2/feedback          — recent feedback entries (admin)
 */

import express from 'express'

const VALID_FEEDBACK_TYPES = [
  'thumbs_up', 'thumbs_down', 'wrong_chapter', 'missing_formula',
  'too_long', 'too_short', 'hallucinated', 'irrelevant', 'useful', 'other',
]

export default function feedbackRoutes({ supabase, supabaseAdmin }) {
  const router = express.Router()

  // POST /api/v2/feedback
  router.post('/feedback', async (req, res) => {
    const {
      answer_log_id,
      retrieval_log_id,
      feedback_type,
      feedback_text,
      query,
      retrieved_chunk_ids,
      user_id,
      subject_id,
      tenant_id,
    } = req.body

    if (!feedback_type) return res.status(400).json({ error: 'feedback_type is required' })
    if (!VALID_FEEDBACK_TYPES.includes(feedback_type)) {
      return res.status(400).json({
        error: `Invalid feedback_type. Must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}`,
      })
    }

    const row = {
      feedback_type,
      feedback_text:        feedback_text ?? null,
      query:                query ?? null,
      answer_log_id:        answer_log_id ?? null,
      retrieval_log_id:     retrieval_log_id ?? null,
      retrieved_chunk_ids:  retrieved_chunk_ids ?? null,
      user_id:              user_id ?? null,
      subject_id:           subject_id ?? null,
      tenant_id:            tenant_id ?? null,
    }

    const { data, error } = await supabase.from('query_feedback').insert(row).select('id').single()
    if (error) return res.status(500).json({ error: error.message })

    return res.status(201).json({ feedback_id: data.id, message: 'Feedback recorded. Thank you.' })
  })

  // GET /api/v2/feedback/stats  (admin)
  router.get('/feedback/stats', async (req, res) => {
    const { subject_id, since } = req.query
    const client = supabaseAdmin ?? supabase

    let q = client
      .from('query_feedback')
      .select('feedback_type, subject_id, created_at')

    if (subject_id) q = q.eq('subject_id', subject_id)
    if (since)      q = q.gte('created_at', since)

    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })

    // Aggregate by type
    const counts = {}
    for (const row of data ?? []) {
      counts[row.feedback_type] = (counts[row.feedback_type] ?? 0) + 1
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const positive = (counts.thumbs_up ?? 0) + (counts.useful ?? 0)
    const negative = (counts.thumbs_down ?? 0) + (counts.hallucinated ?? 0) + (counts.irrelevant ?? 0)

    return res.json({
      total,
      positive,
      negative,
      satisfaction_rate: total > 0 ? +(positive / (positive + negative)).toFixed(3) : null,
      by_type: counts,
    })
  })

  // GET /api/v2/feedback  (admin)
  router.get('/feedback', async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit ?? '50', 10), 200)
    const offset = parseInt(req.query.offset ?? '0', 10)
    const client = supabaseAdmin ?? supabase

    const { data, error } = await client
      .from('query_feedback')
      .select('id, feedback_type, feedback_text, query, subject_id, user_id, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ feedback: data, limit, offset })
  })

  return router
}
