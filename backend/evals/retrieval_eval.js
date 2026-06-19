/**
 * Retrieval evaluation framework — Phase 13.
 *
 * Metrics: Recall@K, Precision@K, MRR, nDCG@K
 *
 * Usage (CLI):
 *   node backend/evals/retrieval_eval.js --fixtures backend/evals/fixtures/expected_cases.json
 *
 * Usage (programmatic):
 *   import { runEval } from './retrieval_eval.js'
 *   const report = await runEval({ cases, supabase, topK: 10 })
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { parseArgs }     from 'util'
import { hybridSearch }  from '../retrieval/hybrid.js'
import { parseQuery }    from '../retrieval/query_parser.js'
import { rerank }        from '../retrieval/reranker.js'

// ── Core metric functions ─────────────────────────────────────────────────────

/**
 * Recall@K: fraction of relevant items found in top-K results.
 */
export function recallAtK(retrievedIds, relevantIds, k) {
  const topK = retrievedIds.slice(0, k)
  const relevant = new Set(relevantIds)
  const hits = topK.filter(id => relevant.has(id)).length
  return relevant.size > 0 ? hits / relevant.size : 0
}

/**
 * Precision@K: fraction of top-K results that are relevant.
 */
export function precisionAtK(retrievedIds, relevantIds, k) {
  const topK = retrievedIds.slice(0, k)
  const relevant = new Set(relevantIds)
  const hits = topK.filter(id => relevant.has(id)).length
  return k > 0 ? hits / Math.min(k, topK.length) : 0
}

/**
 * Mean Reciprocal Rank: 1/rank of the first relevant result (0 if none).
 */
export function reciprocalRank(retrievedIds, relevantIds) {
  const relevant = new Set(relevantIds)
  for (let i = 0; i < retrievedIds.length; i++) {
    if (relevant.has(retrievedIds[i])) return 1 / (i + 1)
  }
  return 0
}

/**
 * nDCG@K: normalized discounted cumulative gain.
 * Uses binary relevance: 1 if relevant, 0 otherwise.
 */
export function ndcgAtK(retrievedIds, relevantIds, k) {
  const relevant = new Set(relevantIds)
  const topK = retrievedIds.slice(0, k)

  let dcg = 0
  for (let i = 0; i < topK.length; i++) {
    if (relevant.has(topK[i])) {
      dcg += 1 / Math.log2(i + 2)
    }
  }

  // Ideal DCG: all relevant items in top positions
  const idealCount = Math.min(relevant.size, k)
  let idcg = 0
  for (let i = 0; i < idealCount; i++) {
    idcg += 1 / Math.log2(i + 2)
  }

  return idcg > 0 ? dcg / idcg : 0
}

// ── Eval runner ────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {object[]} opts.cases       — [{query, course_id, relevant_chunk_ids, tags?}]
 * @param {object}   opts.supabase
 * @param {number=}  opts.topK        — K for retrieval (default 10)
 * @param {boolean=} opts.useRerank   — whether to apply reranker (default true)
 * @returns {Promise<object>}          — eval report
 */
export async function runEval({ cases, supabase, topK = 10, useRerank = true }) {
  if (!cases?.length) throw new Error('No eval cases provided')

  const results = []

  for (const testCase of cases) {
    const { query, course_id, relevant_chunk_ids, tags } = testCase

    let retrieved = []
    try {
      const parsed = parseQuery(query)
      const candidates = await hybridSearch(query, { courseId: course_id, topK: topK * 3, supabase })

      if (useRerank) {
        const reranked = await rerank(candidates, parsed, { topK, supabase })
        retrieved = reranked.map(r => r.chunk_id)
      } else {
        retrieved = candidates.slice(0, topK).map(r => r.chunk_id)
      }
    } catch (err) {
      console.error(`[eval] Error for query "${query}":`, err.message)
      retrieved = []
    }

    const relevant = relevant_chunk_ids ?? []

    results.push({
      query,
      tags: tags ?? [],
      retrieved_count: retrieved.length,
      relevant_count: relevant.length,
      recall_at_k:    recallAtK(retrieved, relevant, topK),
      precision_at_k: precisionAtK(retrieved, relevant, topK),
      rr:             reciprocalRank(retrieved, relevant),
      ndcg_at_k:      ndcgAtK(retrieved, relevant, topK),
      retrieved_ids: retrieved,
    })
  }

  // Aggregate
  const n = results.length
  const avg = key => n > 0 ? +(results.reduce((s, r) => s + r[key], 0) / n).toFixed(4) : 0

  const report = {
    topK,
    useRerank,
    total_cases: n,
    metrics: {
      mean_recall_at_k:    avg('recall_at_k'),
      mean_precision_at_k: avg('precision_at_k'),
      mrr:                 avg('rr'),
      mean_ndcg_at_k:      avg('ndcg_at_k'),
    },
    zero_recall_cases: results.filter(r => r.recall_at_k === 0).length,
    perfect_recall_cases: results.filter(r => r.recall_at_k === 1.0).length,
    per_case: results,
    timestamp: new Date().toISOString(),
  }

  return report
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

const isMain = process.argv[1]?.endsWith('retrieval_eval.js')
if (isMain) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      fixtures: { type: 'string', default: 'backend/evals/fixtures/expected_cases.json' },
      topk:     { type: 'string', default: '10' },
      rerank:   { type: 'string', default: 'true' },
      output:   { type: 'string', default: '-' },
    },
  })

  const cases = JSON.parse(readFileSync(values.fixtures, 'utf8'))
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  console.log(`[eval] Running ${cases.length} test cases (K=${values.topk})...`)

  runEval({
    cases,
    supabase,
    topK: parseInt(values.topk, 10),
    useRerank: values.rerank !== 'false',
  }).then(report => {
    const out = JSON.stringify(report, null, 2)
    if (values.output === '-') {
      console.log('\n=== Eval Report ===')
      console.log(`Total cases:   ${report.total_cases}`)
      console.log(`Mean Recall@${values.topk}:    ${report.metrics.mean_recall_at_k}`)
      console.log(`Mean Precision@${values.topk}: ${report.metrics.mean_precision_at_k}`)
      console.log(`MRR:           ${report.metrics.mrr}`)
      console.log(`nDCG@${values.topk}:          ${report.metrics.mean_ndcg_at_k}`)
      console.log(`Zero-recall:   ${report.zero_recall_cases}/${report.total_cases}`)
    } else {
      require('fs').writeFileSync(values.output, out, 'utf8')
      console.log(`[eval] Report written to ${values.output}`)
    }
  }).catch(err => {
    console.error('[eval] Fatal:', err.message)
    process.exit(1)
  })
}
