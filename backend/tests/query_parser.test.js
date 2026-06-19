/**
 * Unit tests for backend/retrieval/query_parser.js
 * Run: node backend/tests/query_parser.test.js
 */

import { strict as assert } from 'assert'
import { parseQuery } from '../retrieval/query_parser.js'

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

console.log('\n── query_parser.js ────────────────────────')

test('extracts quoted phrases', () => {
  const r = parseQuery('"Teorema de Bayes" probabilidade')
  assert.deepEqual(r.quotedPhrases, ['Teorema de Bayes'])
  assert.equal(r.hasQuotedPhrase, true)
})

test('extracts chapter reference', () => {
  const r = parseQuery('definição no capítulo 3')
  assert.ok(r.chapterRefs.includes('3'))
  assert.equal(r.hasChapterRef, true)
})

test('extracts formula expression', () => {
  const r = parseQuery('como se aplica $\\sum_{i=0}^n x_i$')
  assert.equal(r.hasFormula, true)
  assert.ok(r.formulaExprs.length >= 1)
})

test('default weights sum to ~1.0', () => {
  const r = parseQuery('integral de Riemann')
  const total = Object.values(r.weights).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - 1.0) < 0.01, `Weights sum to ${total}`)
})

test('formula query increases formula weight', () => {
  const r = parseQuery('$E = mc^2$')
  assert.ok(r.weights.formula > 0.10, `formula weight ${r.weights.formula} should be > 0.10`)
})

test('quoted phrase increases lexical weight', () => {
  const r = parseQuery('"regra da cadeia"')
  assert.ok(r.weights.lexical > 0.30, `lexical weight ${r.weights.lexical} should be > 0.30`)
})

test('plain query has default weights', () => {
  const r = parseQuery('espaço vetorial')
  assert.equal(r.hasFormula, false)
  assert.equal(r.hasQuotedPhrase, false)
  assert.equal(r.hasChapterRef, false)
  // Default: semantic 0.35, lexical 0.30
  assert.ok(r.weights.semantic >= 0.30)
  assert.ok(r.weights.lexical >= 0.25)
})

test('raw query is preserved', () => {
  const q = 'exemplo de transformação linear'
  const r = parseQuery(q)
  assert.equal(r.raw, q)
})

test('weights values are between 0 and 1', () => {
  const r = parseQuery('qualquer texto qualquer')
  for (const [k, v] of Object.entries(r.weights)) {
    assert.ok(v >= 0 && v <= 1, `Weight ${k}=${v} out of range`)
  }
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
