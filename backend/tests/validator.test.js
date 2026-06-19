/**
 * Unit tests for backend/ingestion/validator.js
 * Run: node backend/tests/validator.test.js
 */

import { strict as assert } from 'assert'
import {
  validateChapters,
  validateSections,
  validateChunks,
  validateFormulas,
  validateEmbedding,
  mergeValidation,
} from '../ingestion/validator.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

console.log('\n── validator.js ────────────────────────────')

test('validateChapters: monotonic order passes', () => {
  const r = validateChapters([{ chapter_no: 1 }, { chapter_no: 2 }, { chapter_no: 3 }])
  assert.equal(r.passed, true)
  assert.equal(r.issues.length, 0)
})

test('validateChapters: non-monotonic order fails', () => {
  const r = validateChapters([{ chapter_no: 1 }, { chapter_no: 3 }, { chapter_no: 2 }])
  assert.equal(r.passed, false)
  assert.ok(r.issues.some(i => i.issue_code === 'CHAPTER_ORDER_NON_MONOTONIC'))
})

test('validateChapters: empty array passes', () => {
  const r = validateChapters([])
  assert.equal(r.passed, true)
})

test('validateChunks: valid chunk passes', () => {
  const chapterIds = ['ch1']
  const sectionIds = ['sec1']
  const chunks = [{ chunk_no: 0, token_count: 500, chapter_id: 'ch1', section_id: 'sec1' }]
  const r = validateChunks(chunks, chapterIds, sectionIds)
  assert.equal(r.passed, true)
})

test('validateChunks: orphan chapter_id fails', () => {
  const r = validateChunks(
    [{ chunk_no: 0, token_count: 100, chapter_id: 'unknown', section_id: 'sec1' }],
    ['ch1'], ['sec1']
  )
  assert.equal(r.passed, false)
  assert.ok(r.issues.some(i => i.issue_code === 'CHUNK_ORPHAN_CHAPTER'))
})

test('validateChunks: oversized chunk creates warning not error', () => {
  const r = validateChunks(
    [{ chunk_no: 0, token_count: 2000, chapter_id: 'ch1', section_id: 'sec1' }],
    ['ch1'], ['sec1']
  )
  const warning = r.issues.find(i => i.issue_code === 'CHUNK_OVERSIZED')
  assert.ok(warning)
  assert.equal(warning.severity, 'warning')
  assert.equal(r.passed, true)   // warnings don't fail validation
})

test('validateFormulas: valid formula passes', () => {
  const r = validateFormulas([
    { ordinal_in_chunk: 0, original_latex: 'x^2', extraction_confidence: 0.95 }
  ])
  assert.equal(r.passed, true)
})

test('validateFormulas: empty latex is error', () => {
  const r = validateFormulas([
    { ordinal_in_chunk: 0, original_latex: '', extraction_confidence: 0.95 }
  ])
  assert.equal(r.passed, false)
  assert.ok(r.issues.some(i => i.issue_code === 'FORMULA_EMPTY_LATEX'))
})

test('validateFormulas: low confidence creates warning', () => {
  const r = validateFormulas([
    { ordinal_in_chunk: 0, original_latex: 'x', extraction_confidence: 0.50 }
  ])
  assert.ok(r.issues.some(i => i.issue_code === 'FORMULA_LOW_CONFIDENCE' && i.severity === 'warning'))
})

test('validateEmbedding: correct dimension passes', () => {
  const v = Array(768).fill(0.1)
  const r = validateEmbedding(v, 768)
  assert.equal(r.passed, true)
})

test('validateEmbedding: wrong dimension fails', () => {
  const v = Array(1024).fill(0.1)
  const r = validateEmbedding(v, 768)
  assert.equal(r.passed, false)
  assert.ok(r.issues.some(i => i.issue_code === 'EMBEDDING_DIM_MISMATCH'))
})

test('validateEmbedding: null vector passes (embeddings disabled)', () => {
  const r = validateEmbedding(null, 768)
  assert.equal(r.passed, true)
})

test('mergeValidation: all passed', () => {
  const r = mergeValidation({ passed: true, issues: [] }, { passed: true, issues: [] })
  assert.equal(r.passed, true)
  assert.equal(r.issues.length, 0)
})

test('mergeValidation: one failed makes all fail', () => {
  const r = mergeValidation(
    { passed: true, issues: [] },
    { passed: false, issues: [{ severity: 'error', issue_code: 'X', message: 'err' }] }
  )
  assert.equal(r.passed, false)
  assert.equal(r.issues.length, 1)
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
