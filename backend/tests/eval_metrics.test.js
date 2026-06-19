/**
 * Tests for retrieval eval metric functions (no DB calls)
 */

import assert from 'node:assert/strict'
import {
  recallAtK,
  precisionAtK,
  reciprocalRank,
  ndcgAtK,
} from '../evals/retrieval_eval.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`)
    failed++
  }
}

const approx = (a, b, tol = 0.0001) => Math.abs(a - b) < tol

// ── Recall@K ──────────────────────────────────────────────────────────────────

test('recall@3: all relevant found', () => {
  assert.equal(recallAtK(['a', 'b', 'c'], ['a', 'b'], 3), 1.0)
})

test('recall@3: none relevant found', () => {
  assert.equal(recallAtK(['x', 'y', 'z'], ['a', 'b'], 3), 0.0)
})

test('recall@3: partial — 1 of 2 found', () => {
  assert.equal(recallAtK(['a', 'x', 'y'], ['a', 'b'], 3), 0.5)
})

test('recall@1: only top-1 checked', () => {
  // relevant: ['b'], retrieved: ['a','b','c'] — top-1 is 'a', not relevant
  assert.equal(recallAtK(['a', 'b', 'c'], ['b'], 1), 0.0)
  assert.equal(recallAtK(['b', 'a', 'c'], ['b'], 1), 1.0)
})

test('recall with empty relevant list returns 0', () => {
  assert.equal(recallAtK(['a', 'b'], [], 10), 0)
})

// ── Precision@K ───────────────────────────────────────────────────────────────

test('precision@3: 2 of 3 retrieved are relevant', () => {
  assert.ok(approx(precisionAtK(['a', 'b', 'x'], ['a', 'b', 'c'], 3), 2 / 3))
})

test('precision@3: all relevant', () => {
  assert.equal(precisionAtK(['a', 'b', 'c'], ['a', 'b', 'c'], 3), 1.0)
})

test('precision@3: none relevant', () => {
  assert.equal(precisionAtK(['x', 'y', 'z'], ['a', 'b', 'c'], 3), 0.0)
})

test('precision@0 returns 0', () => {
  assert.equal(precisionAtK(['a', 'b'], ['a'], 0), 0)
})

// ── MRR (Reciprocal Rank) ─────────────────────────────────────────────────────

test('rr: first result is relevant → 1.0', () => {
  assert.equal(reciprocalRank(['a', 'b', 'c'], ['a']), 1.0)
})

test('rr: second result is relevant → 0.5', () => {
  assert.equal(reciprocalRank(['x', 'a', 'c'], ['a']), 0.5)
})

test('rr: third result is relevant → 1/3', () => {
  assert.ok(approx(reciprocalRank(['x', 'y', 'a'], ['a']), 1 / 3))
})

test('rr: no relevant result → 0', () => {
  assert.equal(reciprocalRank(['x', 'y', 'z'], ['a']), 0)
})

// ── nDCG@K ────────────────────────────────────────────────────────────────────

test('ndcg@3: perfect ranking → 1.0', () => {
  assert.ok(approx(ndcgAtK(['a', 'b', 'c'], ['a', 'b', 'c'], 3), 1.0))
})

test('ndcg@3: no relevant → 0', () => {
  assert.equal(ndcgAtK(['x', 'y', 'z'], ['a', 'b'], 3), 0.0)
})

test('ndcg@3: relevant but at wrong position is less than 1.0', () => {
  // ideal: [a,b] at positions 1,2; actual: [x,a,b] — relevant at 2,3
  const score = ndcgAtK(['x', 'a', 'b'], ['a', 'b'], 3)
  assert.ok(score > 0 && score < 1.0, `nDCG should be between 0 and 1, got ${score}`)
})

test('ndcg with empty relevant list returns 0', () => {
  assert.equal(ndcgAtK(['a', 'b', 'c'], [], 10), 0)
})

test('ndcg@1: single relevant item at top → 1.0', () => {
  assert.equal(ndcgAtK(['a'], ['a'], 1), 1.0)
})

test('ndcg@1: single relevant item not at top → 0', () => {
  assert.equal(ndcgAtK(['b'], ['a'], 1), 0.0)
})

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
