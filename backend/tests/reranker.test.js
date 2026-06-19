/**
 * Tests for backend/retrieval/reranker.js
 * Pure heuristic scoring — no DB calls (supabase passed as null)
 */

import assert from 'node:assert/strict'
import { rerank } from '../retrieval/reranker.js'
import { parseQuery } from '../retrieval/query_parser.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCandidate({ id, score = 0.5, chunkType = 'body', headingPath = [], dvStatus = 'processed', contentLen = 500 }) {
  return {
    chunk_id: id,
    score,
    chunk: {
      id,
      chunk_type: chunkType,
      heading_path: headingPath,
      content_plain: 'x'.repeat(contentLen),
      dedupe_hash: id,
      document_versions: { status: dvStatus, created_at: new Date().toISOString() },
    },
  }
}

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`)
    failed++
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

await test('returns empty array for no candidates', async () => {
  const result = await rerank([], parseQuery('vector space'), {})
  assert.deepEqual(result, [])
})

await test('respects topK limit', async () => {
  const candidates = Array.from({ length: 20 }, (_, i) => makeCandidate({ id: `c${i}` }))
  const result = await rerank(candidates, parseQuery('test query'), { topK: 5 })
  assert.equal(result.length, 5)
})

await test('definition intent boosts definition chunks', async () => {
  const parsed = parseQuery('o que é um espaço vectorial')
  assert.equal(parsed.intent, 'definition')

  // body gets +0.10 (secondary preferred type for definition intent)
  // definition gets +0.15 (primary) + 0.05 (definition bonus) = +0.20
  // net boost advantage for definition: +0.10 → needs gap < 0.10 to overcome
  const candidates = [
    makeCandidate({ id: 'body1',       score: 0.52, chunkType: 'body' }),
    makeCandidate({ id: 'definition1', score: 0.50, chunkType: 'definition' }),
    makeCandidate({ id: 'theorem1',    score: 0.40, chunkType: 'theorem' }),
  ]
  const result = await rerank(candidates, parsed, { topK: 3 })

  const defIdx = result.findIndex(r => r.chunk_id === 'definition1')
  const bodyIdx = result.findIndex(r => r.chunk_id === 'body1')
  assert.ok(defIdx < bodyIdx, `definition (pos ${defIdx}) should beat body (pos ${bodyIdx}) for definition intent`)
})

await test('formula intent boosts formula_only chunks', async () => {
  const parsed = parseQuery('fórmula da derivada')
  assert.equal(parsed.intent, 'formula')

  // formula_only gets +0.15 (primary type), body gets no type boost
  // net advantage for formula_only: +0.15 → needs gap < 0.15 to win
  const candidates = [
    makeCandidate({ id: 'body1',        score: 0.52, chunkType: 'body' }),
    makeCandidate({ id: 'formula_only', score: 0.50, chunkType: 'formula_only' }),
  ]
  const result = await rerank(candidates, parsed, { topK: 2 })

  const formulaIdx = result.findIndex(r => r.chunk_id === 'formula_only')
  const bodyIdx = result.findIndex(r => r.chunk_id === 'body1')
  assert.ok(formulaIdx < bodyIdx, `formula_only (pos ${formulaIdx}) should beat body (pos ${bodyIdx}) for formula intent`)
})

await test('superseded version is penalized', async () => {
  const parsed = parseQuery('vector space')
  // superseded: -0.20; active: +0.10 (processed) + 0.08 (recent) = +0.18 → net swing: 0.38
  // gap must be < 0.38 for active to win
  const candidates = [
    makeCandidate({ id: 'superseded', score: 0.65, dvStatus: 'superseded' }),
    makeCandidate({ id: 'active',     score: 0.50, dvStatus: 'processed' }),
  ]
  const result = await rerank(candidates, parsed, { topK: 2 })

  const supersededIdx = result.findIndex(r => r.chunk_id === 'superseded')
  const activeIdx     = result.findIndex(r => r.chunk_id === 'active')
  assert.ok(supersededIdx > activeIdx, `superseded (pos ${supersededIdx}) should rank below active (pos ${activeIdx})`)
})

await test('very short chunks are penalized', async () => {
  const parsed = parseQuery('derivada')
  // tiny: -0.10; normal: no penalty. Net swing: 0.10
  // gap must be < 0.10 for normal to win
  const candidates = [
    makeCandidate({ id: 'tiny',   score: 0.55, contentLen: 50  }),
    makeCandidate({ id: 'normal', score: 0.50, contentLen: 500 }),
  ]
  const result = await rerank(candidates, parsed, { topK: 2 })

  const tinyIdx   = result.findIndex(r => r.chunk_id === 'tiny')
  const normalIdx = result.findIndex(r => r.chunk_id === 'normal')
  assert.ok(tinyIdx > normalIdx, `tiny chunk (pos ${tinyIdx}) should rank below normal (pos ${normalIdx})`)
})

await test('heading path match boosts score', async () => {
  const parsed = parseQuery('álgebra linear')
  // matching gets +0.15 (heading path match); unrelated gets 0
  // gap must be < 0.15 for matching to win
  const candidates = [
    makeCandidate({ id: 'unrelated', score: 0.38, headingPath: ['Capítulo 1', 'Cálculo'] }),
    makeCandidate({ id: 'matching',  score: 0.30, headingPath: ['Álgebra Linear', 'Espaços Vectoriais'] }),
  ]
  const result = await rerank(candidates, parsed, { topK: 2 })

  const matchIdx     = result.findIndex(r => r.chunk_id === 'matching')
  const unrelatedIdx = result.findIndex(r => r.chunk_id === 'unrelated')
  assert.ok(matchIdx < unrelatedIdx, `heading match (pos ${matchIdx}) should beat unrelated (pos ${unrelatedIdx})`)
})

await test('dedup by dedupe_hash keeps only first occurrence', async () => {
  const parsed = parseQuery('test')
  const candidates = [
    { chunk_id: 'a1', score: 0.9, chunk: { id: 'a1', dedupe_hash: 'same-hash', chunk_type: 'body', heading_path: [], content_plain: 'content', document_versions: { status: 'processed', created_at: new Date().toISOString() } } },
    { chunk_id: 'a2', score: 0.8, chunk: { id: 'a2', dedupe_hash: 'same-hash', chunk_type: 'body', heading_path: [], content_plain: 'content', document_versions: { status: 'processed', created_at: new Date().toISOString() } } },
    { chunk_id: 'b1', score: 0.7, chunk: { id: 'b1', dedupe_hash: 'diff-hash', chunk_type: 'body', heading_path: [], content_plain: 'content', document_versions: { status: 'processed', created_at: new Date().toISOString() } } },
  ]
  const result = await rerank(candidates, parsed, { topK: 10 })

  assert.equal(result.length, 2, 'should have 2 unique chunks (not 3)')
  const ids = result.map(r => r.chunk_id)
  assert.ok(!ids.includes('a2'), 'a2 (duplicate hash) should be removed')
})

await test('final_score is sum of original score + rerank_boost', async () => {
  const parsed = parseQuery('o que é derivada')
  const candidates = [makeCandidate({ id: 'x1', score: 0.6, chunkType: 'definition' })]
  const result = await rerank(candidates, parsed, { topK: 5 })

  assert.ok(result[0].final_score >= result[0].score, 'final_score should be >= base score')
  assert.ok(result[0].rerank_boost !== undefined, 'rerank_boost should be present')
  assert.ok(Math.abs(result[0].final_score - (result[0].score + result[0].rerank_boost)) < 0.001)
})

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
