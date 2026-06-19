/**
 * Tests for backend/answering/guardrails.js
 */

import assert from 'node:assert/strict'
import { checkAnswer, sanitizeAnswer } from '../answering/guardrails.js'

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

const mockResults = [
  { chunk_id: 'c1', chunk: { content_markdown: 'A transformação linear $T(v) = Av$ satisfaz $T(u+v) = T(u)+T(v)$.' } },
  { chunk_id: 'c2', chunk: { content_markdown: 'A derivada é $f\'(x) = \\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}$.' } },
]

// ── Tests ──────────────────────────────────────────────────────────────────────

test('safe answer with valid citations passes guardrails', () => {
  const answer = 'A transformação linear preserva adição [1]. A derivada é um limite [2].'
  const { safe, flags } = checkAnswer(answer, mockResults, { citationCount: 2 })
  assert.equal(safe, true)
  assert.equal(flags.length, 0)
})

test('detects citation out of range', () => {
  const answer = 'Conforme visto em [5], a derivada é um limite.'
  const { flags } = checkAnswer(answer, mockResults, { citationCount: 2 })
  const outRange = flags.find(f => f.code === 'CITATION_OUT_OF_RANGE')
  assert.ok(outRange, 'should flag citation [5] as out of range')
})

test('detects citation index 0 as invalid', () => {
  const answer = 'Conforme [0] mostra, é assim.'
  const { flags } = checkAnswer(answer, mockResults, { citationCount: 2 })
  const outRange = flags.find(f => f.code === 'CITATION_OUT_OF_RANGE')
  assert.ok(outRange, 'should flag citation [0] as out of range')
})

test('detects hallucination keywords', () => {
  const answer = 'Segundo estudos recentes, a transformação linear tem propriedades especiais.'
  const { safe, flags } = checkAnswer(answer, mockResults, { citationCount: 0 })
  const hallFlag = flags.find(f => f.code === 'HALLUCINATION_KEYWORD')
  assert.ok(hallFlag, 'should flag hallucination keyword')
  assert.equal(safe, false)
})

test('detects "de acordo com Author et al" hallucination pattern', () => {
  const answer = 'De acordo com Silva et al, o resultado é x².'
  const { flags } = checkAnswer(answer, mockResults)
  assert.ok(flags.some(f => f.code === 'HALLUCINATION_KEYWORD'))
})

test('flags very short answer as warning', () => {
  const answer = 'Sim.'
  const { flags } = checkAnswer(answer, mockResults)
  assert.ok(flags.some(f => f.code === 'ANSWER_TOO_SHORT'))
})

test('flags answer over 3500 chars as warning', () => {
  const answer = 'x'.repeat(3501)
  const { flags } = checkAnswer(answer, mockResults)
  assert.ok(flags.some(f => f.code === 'ANSWER_TOO_LONG'))
})

test('display formula not in context is flagged as warning', () => {
  // Context has T(v)=Av and limit formula; this answer invents \\int_{0}^{\\infty}
  const answer = 'A integral imprópria $$\\int_{0}^{\\infty} e^{-x} dx = 1$$ é usada aqui [1].'
  const { flags } = checkAnswer(answer, mockResults, { citationCount: 2 })
  const formulaFlag = flags.find(f => f.code === 'POSSIBLE_INVENTED_FORMULA')
  assert.ok(formulaFlag, 'should flag invented display formula')
  assert.equal(formulaFlag.severity, 'warning')
})

test('formula present in context is NOT flagged', () => {
  // The inline formula $T(v) = Av$ IS in the context
  const answer = 'Temos $T(v) = Av$ conforme definido [1].'
  const { flags } = checkAnswer(answer, mockResults, { citationCount: 2 })
  const formulaFlag = flags.find(f => f.code === 'POSSIBLE_INVENTED_FORMULA')
  assert.equal(formulaFlag, undefined, 'should NOT flag formula that is in context')
})

test('safe answer passes through sanitize unchanged', () => {
  const answer = 'Uma resposta segura e razoável [1].'
  const result = { flags: [], safe: true }
  const sanitized = sanitizeAnswer(answer, result)
  assert.equal(sanitized, answer)
})

test('unsafe answer with HALLUCINATION_KEYWORD is replaced with refusal', () => {
  const answer = 'Segundo estudos recentes...'
  const result = { flags: [{ code: 'HALLUCINATION_KEYWORD', severity: 'error' }], safe: false }
  const sanitized = sanitizeAnswer(answer, result)
  assert.ok(sanitized.includes('Não foi possível'), 'should replace with refusal message')
  assert.notEqual(sanitized, answer)
})

test('unsafe answer with CITATION_OUT_OF_RANGE is replaced', () => {
  const answer = 'Ver [99] para mais detalhes.'
  const result = { flags: [{ code: 'CITATION_OUT_OF_RANGE', severity: 'error' }], safe: false }
  const sanitized = sanitizeAnswer(answer, result)
  assert.ok(sanitized.includes('Não foi possível'), 'should replace with refusal message')
})

test('multiple valid citations do not trigger out-of-range', () => {
  const answer = 'Veja [1] e [2] para detalhes.'
  const { flags } = checkAnswer(answer, mockResults, { citationCount: 2 })
  assert.ok(!flags.some(f => f.code === 'CITATION_OUT_OF_RANGE'))
})

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
