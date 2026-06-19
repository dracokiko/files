/**
 * Unit tests for backend/ingestion/formula.js
 * Run: node --experimental-vm-modules backend/tests/formula.test.js
 * Or with jest: npx jest backend/tests/formula.test.js
 */

import { strict as assert } from 'assert'
import {
  extractFormulas,
  normalizeLaTeX,
  hashLaTeX,
  extractSymbols,
  hasUnclosedDisplayFormula,
} from '../ingestion/formula.js'

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

console.log('\n── formula.js ──────────────────────────────')

test('extracts display formula $$...$$', () => {
  const md = 'Some text $$E = mc^2$$ more text'
  const fs = extractFormulas(md)
  assert.equal(fs.length, 1)
  assert.equal(fs[0].original_latex, 'E = mc^2')
  assert.equal(fs[0].is_display, true)
  assert.ok(fs[0].extraction_confidence >= 0.90)
})

test('extracts display formula \\[...\\]', () => {
  const md = 'Text \\[ \\int_0^1 f(x) dx \\] end'
  const fs = extractFormulas(md)
  assert.equal(fs.length, 1)
  assert.equal(fs[0].is_display, true)
})

test('extracts inline formula $...$', () => {
  const md = 'The function $f(x) = x^2$ is convex.'
  const fs = extractFormulas(md)
  assert.equal(fs.length, 1)
  assert.equal(fs[0].original_latex, 'f(x) = x^2')
  assert.equal(fs[0].is_display, false)
})

test('extracts \\begin{equation}...\\end{equation}', () => {
  const md = '\\begin{equation}\n  ax^2 + bx + c = 0\n\\end{equation}'
  const fs = extractFormulas(md)
  assert.equal(fs.length, 1)
  assert.ok(fs[0].original_latex.includes('ax^2'))
  assert.equal(fs[0].is_display, true)
})

test('does not duplicate display and inline matches', () => {
  const md = 'Here $$\\alpha + \\beta$$ and $x+y$.'
  const fs = extractFormulas(md)
  assert.equal(fs.length, 2)
})

test('normalizeLaTeX removes \\left and \\right', () => {
  const norm = normalizeLaTeX('\\left( x + y \\right)')
  assert.ok(!norm.includes('\\left'))
  assert.ok(!norm.includes('\\right'))
  assert.ok(norm.includes('x + y'))
})

test('normalizeLaTeX collapses whitespace', () => {
  const norm = normalizeLaTeX('  x  +   y  ')
  assert.equal(norm, 'x + y')
})

test('hashLaTeX is stable and hex', () => {
  const h1 = hashLaTeX('x^2 + y^2')
  const h2 = hashLaTeX('x^2 + y^2')
  assert.equal(h1, h2)
  assert.match(h1, /^[0-9a-f]{64}$/)
})

test('hashLaTeX differs for different formulas', () => {
  assert.notEqual(hashLaTeX('x^2'), hashLaTeX('x^3'))
})

test('extractSymbols finds Greek letters', () => {
  const syms = extractSymbols('\\alpha + \\beta = \\gamma')
  assert.ok(syms.includes('\\alpha'))
  assert.ok(syms.includes('\\beta'))
  assert.ok(syms.includes('\\gamma'))
})

test('extractSymbols finds \\sum and \\int', () => {
  const syms = extractSymbols('\\sum_{i=0}^n \\int_0^1')
  assert.ok(syms.includes('\\sum'))
  assert.ok(syms.includes('\\int'))
})

test('hasUnclosedDisplayFormula detects odd $$ count', () => {
  assert.equal(hasUnclosedDisplayFormula('$$x + y'), true)
  assert.equal(hasUnclosedDisplayFormula('$$x + y$$'), false)
})

test('formula_hash matches between extraction and manual hash', () => {
  const md = '$$E = mc^2$$'
  const fs = extractFormulas(md)
  const norm = normalizeLaTeX('E = mc^2')
  assert.equal(fs[0].formula_hash, hashLaTeX(norm))
})

test('ordinals are sequential', () => {
  const md = '$a$ then $b$ then $c$'
  const fs = extractFormulas(md)
  assert.deepEqual(fs.map(f => f.ordinal_in_chunk), [0, 1, 2])
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
