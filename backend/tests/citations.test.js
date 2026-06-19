/**
 * Tests for backend/answering/citations.js
 */

import assert from 'node:assert/strict'
import {
  buildInlineCitation,
  buildStructuredCitation,
  formatBibliography,
} from '../answering/citations.js'

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

// ── buildInlineCitation ───────────────────────────────────────────────────────

test('full provenance produces complete citation string', () => {
  const prov = {
    document_title: 'Álgebra Linear',
    chapter_no: 2,
    chapter_title: 'Espaços Vectoriais',
    section_title: 'Definição Formal',
    page_start: 14,
    page_end: 15,
  }
  const result = buildInlineCitation(prov, 1)
  assert.ok(result.includes('[1]'))
  assert.ok(result.includes('Álgebra Linear'))
  assert.ok(result.includes('Cap. 2'))
  assert.ok(result.includes('pp. 14–15'))
  assert.ok(result.includes('§ Definição Formal'))
})

test('single page shows "p." not "pp."', () => {
  const prov = { document_title: 'Cálculo', page_start: 7, page_end: 7 }
  const result = buildInlineCitation(prov, 3)
  assert.ok(result.includes('p. 7'))
  assert.ok(!result.includes('pp.'))
})

test('chapter without title shows "Cap. N"', () => {
  const prov = { document_title: 'Física', chapter_no: 5 }
  const result = buildInlineCitation(prov, 2)
  assert.ok(result.includes('Cap. 5'))
})

test('empty provenance returns just label', () => {
  const result = buildInlineCitation({}, 4)
  assert.equal(result, '[4]')
})

test('chapter with title shows "Cap. N: Title"', () => {
  const prov = { chapter_no: 1, chapter_title: 'Introdução' }
  const result = buildInlineCitation(prov, 1)
  assert.ok(result.includes('Cap. 1: Introdução'))
})

// ── buildStructuredCitation ───────────────────────────────────────────────────

test('buildStructuredCitation returns all expected fields', () => {
  const result = {
    chunk_id: 'abc-123',
    chunk_type: 'definition',
    score: 0.85,
    provenance: {
      document_title: 'Análise Matemática',
      chapter_no: 3,
      section_title: 'Limites',
      page_start: 22,
    },
  }
  const citation = buildStructuredCitation(result, 1)
  assert.equal(citation.index, 1)
  assert.equal(citation.chunk_id, 'abc-123')
  assert.equal(citation.chunk_type, 'definition')
  assert.equal(citation.score, 0.85)
  assert.ok(citation.inline_ref.includes('[1]'))
  assert.ok(citation.inline_ref.includes('Análise Matemática'))
})

test('buildStructuredCitation handles missing provenance gracefully', () => {
  const result = { chunk_id: 'xyz', chunk_type: 'body', score: 0.5, provenance: undefined }
  const citation = buildStructuredCitation(result, 2)
  assert.equal(citation.chunk_id, 'xyz')
  assert.equal(citation.document_title, null)
  assert.equal(citation.inline_ref, '[2]')
})

// ── formatBibliography ────────────────────────────────────────────────────────

test('formatBibliography returns empty string for no citations', () => {
  assert.equal(formatBibliography([]), '')
})

test('formatBibliography includes all inline refs', () => {
  const citations = [
    { inline_ref: '[1] Álgebra Linear, Cap. 1, p. 5' },
    { inline_ref: '[2] Cálculo, Cap. 2, pp. 10–12' },
  ]
  const bib = formatBibliography(citations)
  assert.ok(bib.includes('[1] Álgebra Linear'))
  assert.ok(bib.includes('[2] Cálculo'))
  assert.ok(bib.includes('Fontes:'))
})

test('formatBibliography starts with blank line and separator', () => {
  const citations = [{ inline_ref: '[1] Test' }]
  const bib = formatBibliography(citations)
  assert.ok(bib.startsWith('\n'))
  assert.ok(bib.includes('---'))
})

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
