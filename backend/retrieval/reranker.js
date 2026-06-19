/**
 * Heuristic reranker — Phase 14.
 *
 * Takes up to 50 fusion-scored candidates and re-scores them with
 * additional signals before returning the final top-K.
 *
 * Signals used:
 *  +0.20  exact formula match in query
 *  +0.15  exact concept name match in chunk heading
 *  +0.15  chunk_type matches query intent preference (top-1 type)
 *  +0.10  chunk_type matches intent (2nd/3rd preferred type)
 *  +0.10  document is active (non-superseded)
 *  +0.08  recent document version (within 30 days)
 *  +0.08  high-confidence concept mention in chunk
 *  +0.05  definition/theorem chunk always gets a small boost
 *  -0.20  superseded document version
 *  -0.10  very short chunk (< 100 chars)
 *
 * The reranker does NOT call an LLM — it is a fast, deterministic pass.
 * An optional LLM reranker can be plugged in behind this as a second pass.
 */

import { normalizeLaTeX, hashLaTeX } from '../ingestion/formula.js'
import { normalizeAlias } from '../ingestion/concepts.js'

/**
 * Rerank candidates.
 *
 * @param {object[]} candidates    — from hybridSearch (before dedup)
 * @param {object}   parsed        — from parseQuery
 * @param {object}   opts
 * @param {string=}  opts.courseId
 * @param {object}   opts.supabase
 * @param {number}   opts.topK
 * @returns {Promise<object[]>}    — re-ranked, top-K results
 */
export async function rerank(candidates, parsed, opts = {}) {
  const { topK = 10, supabase } = opts
  if (!candidates.length) return []

  // Precompute query signals
  const queryFormulaHashes = new Set(
    parsed.formulaExprs.map(e => hashLaTeX(normalizeLaTeX(e)))
  )
  const queryConceptNorms = new Set(
    parsed.clean.split(/\s+/).filter(w => w.length > 3).map(w => normalizeAlias(w))
  )
  const preferredTypes = parsed.preferredChunkTypes ?? []

  // Fetch concept mentions for candidate chunk_ids (batch)
  const chunkIds = [...new Set(candidates.map(c => c.chunk_id))].slice(0, 50)
  const mentionMap = await _fetchMentionConfidences(chunkIds, supabase)
  const formulaMap = await _fetchFormulas(chunkIds, supabase)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const reranked = candidates.map(cand => {
    let boost = 0
    const chunk = cand.chunk ?? {}
    const dv    = chunk.document_versions ?? {}

    // Chunk type matches intent
    if (preferredTypes[0] && chunk.chunk_type === preferredTypes[0]) boost += 0.15
    else if (chunk.chunk_type && preferredTypes.slice(1).includes(chunk.chunk_type)) boost += 0.10

    // Definition/theorem always slightly preferred
    if (['definition', 'theorem'].includes(chunk.chunk_type)) boost += 0.05

    // Document active status
    if (dv.status === 'processed') boost += 0.10
    if (dv.status === 'superseded') boost -= 0.20

    // Recent version
    if (dv.created_at && new Date(dv.created_at) > thirtyDaysAgo) boost += 0.08

    // Exact formula match
    const chunkFormulas = formulaMap.get(cand.chunk_id) ?? []
    if (queryFormulaHashes.size > 0 && chunkFormulas.some(f => queryFormulaHashes.has(f.formula_hash))) {
      boost += 0.20
    }

    // Concept match in heading path (normalize both sides to handle accents)
    const headingText = (chunk.heading_path ?? []).map(h => normalizeAlias(h)).join(' ')
    for (const norm of queryConceptNorms) {
      if (headingText.includes(norm)) { boost += 0.15; break }
    }

    // High-confidence mention in chunk
    const maxMentionConf = mentionMap.get(cand.chunk_id) ?? 0
    if (maxMentionConf >= 0.85) boost += 0.08
    else if (maxMentionConf >= 0.70) boost += 0.04

    // Penalize very short chunks
    if ((chunk.char_count ?? chunk.content_plain?.length ?? 9999) < 100) boost -= 0.10

    return { ...cand, rerank_boost: boost, final_score: cand.score + boost }
  })

  // Sort by final score, dedup by dedupe_hash
  reranked.sort((a, b) => b.final_score - a.final_score)

  const seen = new Set()
  const results = []
  for (const r of reranked) {
    const key = r.chunk?.dedupe_hash ?? r.chunk_id
    if (seen.has(key)) continue
    seen.add(key)
    results.push(r)
    if (results.length >= topK) break
  }

  return results
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _fetchMentionConfidences(chunkIds, supabase) {
  const map = new Map()
  if (!chunkIds.length || !supabase) return map
  try {
    const { data } = await supabase
      .from('concept_mentions')
      .select('chunk_id, confidence')
      .in('chunk_id', chunkIds)
    for (const r of data ?? []) {
      const cur = map.get(r.chunk_id) ?? 0
      if (r.confidence > cur) map.set(r.chunk_id, r.confidence)
    }
  } catch { /* non-critical — skip */ }
  return map
}

async function _fetchFormulas(chunkIds, supabase) {
  const map = new Map()
  if (!chunkIds.length || !supabase) return map
  try {
    const { data } = await supabase
      .from('formulas')
      .select('chunk_id, formula_hash')
      .in('chunk_id', chunkIds)
    for (const r of data ?? []) {
      const list = map.get(r.chunk_id) ?? []
      list.push(r)
      map.set(r.chunk_id, list)
    }
  } catch { /* non-critical — skip */ }
  return map
}
