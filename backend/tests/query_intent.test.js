/**
 * Tests for intent classification and updated parseQuery in query_parser.js
 */

import assert from 'node:assert/strict'
import { classifyIntent, parseQuery, INTENT_CHUNK_TYPES } from '../retrieval/query_parser.js'

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

// ── classifyIntent ────────────────────────────────────────────────────────────

test('classifies definition query (Portuguese)', () => {
  assert.equal(classifyIntent('o que é um espaço vectorial?'), 'definition')
})

test('classifies definition query (English)', () => {
  assert.equal(classifyIntent('what is a linear transformation?'), 'definition')
})

test('classifies formula query', () => {
  assert.equal(classifyIntent('qual é a fórmula da derivada?'), 'formula')
})

test('classifies formula query with LaTeX', () => {
  assert.equal(classifyIntent('como usar $\\int_0^\\infty e^{-x}dx$?'), 'formula')
})

test('classifies exercise query', () => {
  assert.equal(classifyIntent('resolve o exercício: 2x + 3 = 7'), 'exercise')
})

test('classifies exercise query (solve)', () => {
  assert.equal(classifyIntent('solve the system of equations'), 'exercise')
})

test('classifies summary query', () => {
  assert.equal(classifyIntent('faz um resumo do capítulo'), 'summary')
})

test('classifies comparison query', () => {
  assert.equal(classifyIntent('qual é a diferença entre integral definida e indefinida?'), 'comparison')
})

test('classifies table query', () => {
  assert.equal(classifyIntent('mostra a tabela de constantes físicas'), 'table')
})

test('returns default for ambiguous query', () => {
  assert.equal(classifyIntent('álgebra linear'), 'default')
})

// ── parseQuery with intent ────────────────────────────────────────────────────

test('parseQuery includes intent field', () => {
  const p = parseQuery('o que é integral?')
  assert.ok('intent' in p)
})

test('parseQuery includes preferredChunkTypes', () => {
  const p = parseQuery('o que é integral?')
  assert.ok(Array.isArray(p.preferredChunkTypes))
  assert.ok(p.preferredChunkTypes.length > 0)
})

test('definition intent prefers definition chunks', () => {
  const p = parseQuery('o que é derivada?')
  assert.equal(p.intent, 'definition')
  assert.ok(p.preferredChunkTypes.includes('definition'))
})

test('formula intent prefers formula_only chunks', () => {
  const p = parseQuery('equação da transformação de Fourier?')
  assert.equal(p.intent, 'formula')
  assert.ok(p.preferredChunkTypes.includes('formula_only'))
})

test('exercise intent prefers exercise chunks', () => {
  const p = parseQuery('resolve passo a passo 3x - 2 = 7')
  assert.equal(p.intent, 'exercise')
  assert.ok(p.preferredChunkTypes.includes('exercise'))
})

test('INTENT_CHUNK_TYPES covers all known intents', () => {
  const expectedIntents = ['definition', 'formula', 'exercise', 'summary', 'comparison', 'table', 'default']
  for (const intent of expectedIntents) {
    assert.ok(intent in INTENT_CHUNK_TYPES, `Missing intent: ${intent}`)
    assert.ok(INTENT_CHUNK_TYPES[intent].length > 0, `Empty chunk types for intent: ${intent}`)
  }
})

test('definition intent weights concept signal higher than lexical', () => {
  const p = parseQuery('o que é um conjunto aberto?')
  assert.ok(p.weights.concept > p.weights.lexical, 'concept weight should exceed lexical for definition intent')
})

test('formula intent weights formula signal high', () => {
  const p = parseQuery('qual é a fórmula de Euler?')
  assert.ok(p.weights.formula >= 0.20, 'formula weight should be high for formula intent')
})

test('explicit LaTeX overrides intent formula weights upward', () => {
  const p1 = parseQuery('derivada')
  const p2 = parseQuery('derivada de $e^x$')
  assert.ok(p2.weights.formula >= p1.weights.formula, 'explicit LaTeX should boost formula weight')
})

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
