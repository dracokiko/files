/**
 * Answering API — Phase 15.
 * POST /api/v2/answer  — generate an answer from retrieved context
 * GET  /api/v2/answer/logs — recent answer logs (admin)
 */

import express from 'express'
import { generateAnswer, logAnswer } from '../answering/generator.js'

export default function answeringRoutes({ supabase, supabaseAdmin, genai }) {
  const router = express.Router()

  // POST /api/v2/answer
  router.post('/answer', async (req, res) => {
    const {
      query,
      course_id,
      document_id,
      top_k = 8,
      candidate_k = 30,
      include_raw = false,
      user_id,
      subject_id,
      tenant_id,
    } = req.body

    if (!query?.trim()) return res.status(400).json({ error: 'query is required' })

    try {
      const result = await generateAnswer({
        query,
        courseId: course_id,
        documentId: document_id,
        topK: top_k,
        candidateK: candidate_k,
        includeRaw: include_raw,
        userId: user_id,
        subjectId: subject_id,
        tenantId: tenant_id,
        supabase,
        genai,
      })

      // Log asynchronously (don't block response)
      logAnswer(result, { query, userId: user_id, subjectId: subject_id, tenantId: tenant_id }, supabaseAdmin)
        .catch(() => {})

      return res.json(result)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  })

  // GET /api/v2/answer/logs  (admin only — mount behind requireAdmin in server.js)
  router.get('/answer/logs', async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit ?? '50', 10), 200)
    const offset = parseInt(req.query.offset ?? '0', 10)

    const { data, error } = await (supabaseAdmin ?? supabase)
      .from('answer_logs')
      .select('id, query, answer_model, latency_ms, safe:guardrail_flags, cited_chunk_ids, created_at, subject_id')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ logs: data, limit, offset })
  })

  return router
}
