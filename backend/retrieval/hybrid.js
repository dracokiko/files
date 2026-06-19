/**
 * Hybrid retrieval pipeline.
 *
 * Sources:
 *   1. FTS — PostgreSQL websearch_to_tsquery over chunks.fts_vector
 *   2. Vector ANN — pgvector cosine similarity on chunks.embedding
 *   3. Concept — alias lookup → concept_mentions → chunks
 *   4. Formula — exact hash match + pg_trgm fuzzy on normalized_latex
 *   5. Structure — chapter/section filter
 *
 * Fusion: weighted linear combination of normalised per-source scores.
 */

import { parseQuery } from './query_parser.js'
import { embedQuery } from '../ingestion/embeddings.js'
import { normalizeLaTeX, hashLaTeX } from '../ingestion/formula.js'
import { normalizeAlias } from '../ingestion/concepts.js'

const DEFAULT_TOP_K = parseInt(process.env.RETRIEVAL_TOP_K ?? '10')
const HNSW_EF = parseInt(process.env.HNSW_EF_SEARCH ?? '100')

// ── Main search function ──────────────────────────────────────────────────────

/**
 * Hybrid search over the knowledge graph.
 *
 * @param {string} rawQuery
 * @param {object} opts
 * @param {string=}   opts.courseId      - Filter to a specific course
 * @param {string=}   opts.documentId    - Filter to a specific document
 * @param {string[]=} opts.chunkTypes    - Filter by chunk type
 * @param {number=}   opts.topK          - Number of results to return
 * @param {object}    opts.supabase      - Supabase client
 * @returns {Promise<SearchResult[]>}
 */
export async function hybridSearch(rawQuery, opts = {}) {
  const { courseId, documentId, chunkTypes, topK = DEFAULT_TOP_K, supabase } = opts

  const parsed = parseQuery(rawQuery)
  const { weights } = parsed

  // Gather candidates from all sources in parallel
  const [ftsResults, vectorResults, conceptResults, formulaResults] = await Promise.all([
    weights.lexical > 0 ? fetchFTS(parsed, supabase, { courseId, documentId, chunkTypes, topK: topK * 3 }) : [],
    weights.semantic > 0 ? fetchVector(parsed, supabase, { courseId, documentId, chunkTypes, topK: topK * 3 }) : [],
    weights.concept > 0  ? fetchConcept(parsed, supabase, { courseId, topK: topK * 2 }) : [],
    weights.formula > 0 && parsed.hasFormula ? fetchFormula(parsed, supabase, { courseId }) : [],
  ])

  // Fuse scores
  const scoreMap = new Map()   // chunk_id → accumulated scores + metadata

  const addScores = (results, sourceKey, weight) => {
    if (!results.length) return
    const maxScore = Math.max(...results.map(r => r.score))
    for (const r of results) {
      const normScore = maxScore > 0 ? r.score / maxScore : 0
      if (!scoreMap.has(r.chunk_id)) {
        scoreMap.set(r.chunk_id, {
          chunk_id: r.chunk_id,
          chunk: r.chunk,
          scores: { fts: 0, semantic: 0, concept: 0, formula: 0, structure: 0 },
          total: 0,
        })
      }
      const entry = scoreMap.get(r.chunk_id)
      entry.scores[sourceKey] = normScore * weight
      if (r.chunk && !entry.chunk) entry.chunk = r.chunk
    }
  }

  addScores(ftsResults,     'fts',      weights.lexical)
  addScores(vectorResults,  'semantic', weights.semantic)
  addScores(conceptResults, 'concept',  weights.concept)
  addScores(formulaResults, 'formula',  weights.formula)

  // Compute totals and dedupe by dedupe_hash
  const seenDedupeHash = new Set()
  const ranked = []

  for (const entry of scoreMap.values()) {
    entry.total = Object.values(entry.scores).reduce((a, b) => a + b, 0)
    ranked.push(entry)
  }

  ranked.sort((a, b) => b.total - a.total)

  // Fetch full chunk data for top results
  const topChunkIds = ranked.slice(0, topK * 2).map(r => r.chunk_id)
  const fullChunks = await fetchChunkDetails(topChunkIds, supabase)

  const results = []
  for (const entry of ranked) {
    const chunk = fullChunks.get(entry.chunk_id)
    if (!chunk) continue

    // Version precedence: prefer non-superseded versions
    if (chunk.document_versions?.status === 'superseded') continue

    const dedupeKey = chunk.dedupe_hash ?? entry.chunk_id
    if (seenDedupeHash.has(dedupeKey)) continue
    seenDedupeHash.add(dedupeKey)

    results.push({
      chunk_id: entry.chunk_id,
      score: entry.total,
      score_breakdown: entry.scores,
      provenance: buildProvenance(chunk),
      content_markdown: chunk.content_markdown,
      content_plain: chunk.content_plain,
      chunk_type: chunk.chunk_type,
      heading_path: chunk.heading_path,
    })

    if (results.length >= topK) break
  }

  return results
}

// ── FTS search ────────────────────────────────────────────────────────────────

async function fetchFTS(parsed, supabase, { courseId, documentId, chunkTypes, topK }) {
  // websearch_to_tsquery handles quoted phrases, negation, OR
  const query = `
    SELECT
      c.id AS chunk_id,
      ts_rank_cd(c.fts_vector, query, 32) AS score
    FROM chunks c
    JOIN document_versions dv ON dv.id = c.document_version_id
    JOIN documents d ON d.id = dv.document_id
    , websearch_to_tsquery('pg_catalog.portuguese', $1) query
    WHERE c.fts_vector @@ query
      ${courseId ? 'AND d.course_id = $2' : ''}
      ${documentId ? `AND d.id = $${courseId ? 3 : 2}` : ''}
      ${chunkTypes?.length ? `AND c.chunk_type = ANY($${[courseId, documentId].filter(Boolean).length + 2}::text[])` : ''}
    ORDER BY score DESC
    LIMIT $${[courseId, documentId].filter(Boolean).length + 2 + (chunkTypes?.length ? 1 : 0)}
  `
  // Use Supabase RPC for raw SQL
  const params = [parsed.clean, courseId, documentId, chunkTypes, topK].filter(Boolean)

  try {
    const { data, error } = await supabase.rpc('fts_search', {
      query_text: parsed.clean,
      p_course_id: courseId ?? null,
      p_document_id: documentId ?? null,
      p_chunk_types: chunkTypes ?? null,
      p_limit: topK,
    })
    if (error) return []
    return (data ?? []).map(r => ({ chunk_id: r.chunk_id, score: r.score, chunk: null }))
  } catch { return [] }
}

// ── Vector search ─────────────────────────────────────────────────────────────

async function fetchVector(parsed, supabase, { courseId, documentId, chunkTypes, topK }) {
  let queryVector
  try {
    queryVector = await embedQuery(parsed.clean)
  } catch { return [] }
  if (!queryVector) return []

  try {
    const { data, error } = await supabase.rpc('vector_search', {
      query_vector: queryVector,
      p_course_id: courseId ?? null,
      p_document_id: documentId ?? null,
      p_chunk_types: chunkTypes ?? null,
      p_limit: topK,
      p_ef_search: HNSW_EF,
    })
    if (error) return []
    return (data ?? []).map(r => ({ chunk_id: r.chunk_id, score: r.score, chunk: null }))
  } catch { return [] }
}

// ── Concept search ────────────────────────────────────────────────────────────

async function fetchConcept(parsed, supabase, { courseId, topK }) {
  const norm = normalizeAlias(parsed.clean)
  try {
    const { data, error } = await supabase.rpc('concept_search', {
      query_norm: norm,
      p_course_id: courseId ?? null,
      p_limit: topK,
    })
    if (error) return []
    return (data ?? []).map(r => ({ chunk_id: r.chunk_id, score: r.score ?? 0.5, chunk: null }))
  } catch { return [] }
}

// ── Formula search ────────────────────────────────────────────────────────────

async function fetchFormula(parsed, supabase, { courseId }) {
  const results = []
  for (const expr of parsed.formulaExprs) {
    const normalized = normalizeLaTeX(expr)
    const hash = hashLaTeX(normalized)

    // Exact match
    try {
      const { data } = await supabase
        .from('formulas')
        .select('chunk_id')
        .eq('formula_hash', hash)
        .limit(20)
      for (const r of data ?? []) {
        results.push({ chunk_id: r.chunk_id, score: 1.0, chunk: null })
      }
    } catch { /* skip */ }

    // Fuzzy via pg_trgm (only if no exact match)
    if (!results.length) {
      try {
        const { data } = await supabase.rpc('formula_fuzzy_search', {
          query_latex: normalized,
          p_course_id: courseId ?? null,
          p_limit: 10,
        })
        for (const r of data ?? []) {
          results.push({ chunk_id: r.chunk_id, score: r.similarity ?? 0.5, chunk: null })
        }
      } catch { /* skip */ }
    }
  }
  return results
}

// ── Chunk detail fetch ────────────────────────────────────────────────────────

async function fetchChunkDetails(chunkIds, supabase) {
  if (!chunkIds.length) return new Map()
  const { data, error } = await supabase
    .from('chunks')
    .select(`
      id, chunk_type, heading_path, content_markdown, content_plain, dedupe_hash,
      token_count, page_start, page_end,
      chapters ( chapter_no, title ),
      sections ( section_level, title, heading_path ),
      document_versions ( status, version_no, documents ( title, original_filename, course_id ) )
    `)
    .in('id', chunkIds)
  if (error) return new Map()
  const map = new Map()
  for (const c of data ?? []) map.set(c.id, c)
  return map
}

// ── Provenance builder ────────────────────────────────────────────────────────

function buildProvenance(chunk) {
  const doc = chunk.document_versions?.documents
  const dv  = chunk.document_versions
  const ch  = chunk.chapters
  const sec = chunk.sections
  return {
    course_id:      doc?.course_id ?? null,
    document_title: doc?.title ?? doc?.original_filename ?? null,
    version_no:     dv?.version_no ?? null,
    chapter_no:     ch?.chapter_no ?? null,
    chapter_title:  ch?.title ?? null,
    section_title:  sec?.title ?? null,
    heading_path:   sec?.heading_path ?? chunk.heading_path ?? [],
    page_start:     chunk.page_start,
    page_end:       chunk.page_end,
    chunk_id:       chunk.id,
  }
}
