import express from 'express'
import { hybridSearch } from '../retrieval/hybrid.js'
import { parseQuery } from '../retrieval/query_parser.js'

/**
 * Factory: returns an Express router for the retrieval API.
 * Mount at /api/v2/search (public, subject to plan limits)
 * and at /admin/api/v2/search (admin, unrestricted).
 */
export default function retrievalRoutes({ supabase, supabaseAdmin }) {
  const router = express.Router()

  // ── POST /search — hybrid search ─────────────────────────────────────────
  router.post('/search', async (req, res) => {
    const {
      query,
      courseId,
      documentId,
      chunkTypes,
      topK = 10,
    } = req.body

    if (!query?.trim()) return res.status(400).json({ error: 'query required' })

    try {
      const results = await hybridSearch(query, {
        courseId,
        documentId,
        chunkTypes,
        topK: Math.min(Number(topK), 50),
        supabase: supabaseAdmin ?? supabase,
      })
      res.json({ query, results })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /search — same but via query params (convenient for testing) ──────
  router.get('/search', async (req, res) => {
    const { q, courseId, documentId, topK } = req.query
    if (!q?.trim()) return res.status(400).json({ error: 'q param required' })

    try {
      const results = await hybridSearch(q, {
        courseId,
        documentId,
        topK: Math.min(Number(topK ?? 10), 50),
        supabase: supabaseAdmin ?? supabase,
      })
      res.json({ query: q, results })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /formula/:hash — exact formula lookup ─────────────────────────────
  router.get('/formula/:hash', async (req, res) => {
    const { data, error } = await (supabaseAdmin ?? supabase)
      .from('formulas')
      .select(`
        id, original_latex, normalized_latex, formula_hash, is_display, symbols, extraction_confidence,
        chunks (
          id, content_markdown, heading_path,
          document_versions ( documents ( title ) )
        )
      `)
      .eq('formula_hash', req.params.hash)
      .limit(20)
    if (error) return res.status(500).json({ error: error.message })
    res.json(data ?? [])
  })

  // ── GET /concept — search concepts by alias ───────────────────────────────
  router.get('/concept', async (req, res) => {
    const { alias, courseId } = req.query
    if (!alias) return res.status(400).json({ error: 'alias param required' })

    const norm = alias.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

    let q = (supabaseAdmin ?? supabase)
      .from('concept_aliases')
      .select(`
        alias_text, alias_kind, weight,
        concepts (
          id, canonical_name, concept_type, definition, confidence, status,
          concept_mentions (
            chunk_id, mention_kind, confidence,
            chunks ( id, content_markdown, heading_path )
          )
        )
      `)
      .eq('alias_norm', norm)
      .order('weight', { ascending: false })
      .limit(10)
    if (courseId) q = q.eq('concepts.course_id', courseId)

    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json(data ?? [])
  })

  // ── GET /parse-query — debug endpoint to inspect query analysis ───────────
  router.get('/parse-query', (req, res) => {
    const { q } = req.query
    if (!q) return res.status(400).json({ error: 'q required' })
    res.json(parseQuery(q))
  })

  return router
}
