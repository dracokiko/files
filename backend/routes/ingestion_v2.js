import express from 'express'
import { ingestDocument } from '../ingestion/pipeline.js'
import { mimeToKind } from '../ingestion/parsers/index.js'

/**
 * Factory: returns an Express router for the v2 knowledge ingestion API.
 * Mount at /admin/api/v2/ingest (behind requireAdmin in server.js).
 */
export default function ingestionV2Routes({ supabaseAdmin, genai }) {
  const router = express.Router()

  // ── POST /ingest/sync — synchronous ingest ───────────────────────────────
  // The only ingest entry point: awaits the full pipeline before responding,
  // which is what actually works correctly on Vercel's serverless runtime
  // (a fire-and-forget continuation after res.json() is not reliably run
  // to completion there). Used by the admin panel and ingest_one.js.
  router.post('/ingest/sync', async (req, res) => {
    const { base64, filename, mimeType, courseId, title, langCode } = req.body

    if (!base64 || !filename || !courseId)
      return res.status(400).json({ error: 'base64, filename, courseId required' })

    const sourceKind = mimeToKind(mimeType, filename)
    if (!sourceKind) return res.status(400).json({ error: `Unsupported file type` })

    const buffer = Buffer.from(base64, 'base64')

    try {
      const result = await ingestDocument({
        buffer, sourceKind, filename, courseId,
        documentTitle: title ?? filename,
        langCode: langCode ?? 'pt-PT',
        supabaseAdmin, genai,
      })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /jobs/:id — poll job status ──────────────────────────────────────
  router.get('/jobs/:id', async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('ingestion_jobs')
      .select('id, job_type, status, attempt_no, metrics, error_payload, started_at, finished_at')
      .eq('id', req.params.id)
      .single()
    if (error || !data) return res.status(404).json({ error: 'Job not found' })
    res.json(data)
  })

  // ── GET /jobs/:id/issues — validation issues for a job ───────────────────
  router.get('/jobs/:id/issues', async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('validation_issues')
      .select('*')
      .eq('ingestion_job_id', req.params.id)
      .order('severity')
    if (error) return res.status(500).json({ error: error.message })
    res.json(data ?? [])
  })

  // ── GET /documents — list documents ──────────────────────────────────────
  router.get('/documents', async (req, res) => {
    const { courseId, limit = 50 } = req.query
    let q = supabaseAdmin
      .from('documents')
      .select('id, title, source_kind, original_filename, lang_code, course_id, created_at')
      .order('created_at', { ascending: false })
      .limit(Number(limit))
    if (courseId) q = q.eq('course_id', courseId)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json(data ?? [])
  })

  // ── DELETE /documents/:id — remove a document and all graph data ───────
  // Related versions, chunks, formulas and jobs are removed by the schema's
  // cascading foreign keys.
  router.delete('/documents/:id', async (req, res) => {
    const { error } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // ── GET /documents/:id/versions — list versions ──────────────────────────
  router.get('/documents/:id/versions', async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('document_versions')
      .select('id, version_no, status, source_sha256, parser_name, page_count, token_count, created_at')
      .eq('document_id', req.params.id)
      .order('version_no', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    res.json(data ?? [])
  })

  // ── POST /documents/:id/reindex — rebuild from stored artifact ───────────
  router.post('/documents/:id/reindex', async (req, res) => {
    // Mark all current versions as superseded, then re-ingest latest
    const { data: versions } = await supabaseAdmin
      .from('document_versions')
      .select('id, status')
      .eq('document_id', req.params.id)
      .order('version_no', { ascending: false })

    if (!versions?.length) return res.status(404).json({ error: 'No versions found' })

    res.json({ message: 'Reindex not yet supported via API — re-upload the file to create a new version.' })
  })

  // ── GET /courses — list courses ───────────────────────────────────────────
  router.get('/courses', async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('id, code, title, lang_code, cadeira_id, created_at')
      .order('title')
    if (error) return res.status(500).json({ error: error.message })
    res.json(data ?? [])
  })

  // ── POST /courses — create a course ──────────────────────────────────────
  router.post('/courses', async (req, res) => {
    const { code, title, langCode = 'pt-PT', cadeiraId } = req.body
    if (!code || !title) return res.status(400).json({ error: 'code and title required' })
    const { data, error } = await supabaseAdmin
      .from('courses')
      .insert({ code, title, lang_code: langCode, cadeira_id: cadeiraId ?? null })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  return router
}
