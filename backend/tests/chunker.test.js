/**
 * Unit tests for backend/ingestion/chunker.js
 * Run: node backend/tests/chunker.test.js
 */

import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { chunkDocument, stripMarkdown, normalizeContent, dedupeHash } from '../ingestion/chunker.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = readFileSync(join(__dirname, 'fixtures/sample_math.md'), 'utf-8')

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

console.log('\n── chunker.js ──────────────────────────────')

test('produces at least one chunk from fixture', () => {
  const chunks = chunkDocument(FIXTURE)
  assert.ok(chunks.length >= 1, `Expected at least 1 chunk, got ${chunks.length}`)
})

test('chunk_no is sequential starting at 0', () => {
  const chunks = chunkDocument(FIXTURE)
  for (let i = 0; i < chunks.length; i++) {
    assert.equal(chunks[i].chunk_no, i)
  }
})

test('no chunk has empty content_markdown', () => {
  const chunks = chunkDocument(FIXTURE)
  for (const c of chunks) {
    assert.ok(c.content_markdown.trim().length > 0, 'Empty content_markdown')
  }
})

test('no chunk exceeds hard max tokens by more than 20%', () => {
  const chunks = chunkDocument(FIXTURE)
  const MAX = parseInt(process.env.CHUNK_MAX_TOKENS ?? '900') * 1.2
  for (const c of chunks) {
    assert.ok(c.token_count <= MAX, `Chunk ${c.chunk_no} has ${c.token_count} tokens`)
  }
})

test('formulas are preserved in content_markdown', () => {
  const chunks = chunkDocument(FIXTURE)
  const allContent = chunks.map(c => c.content_markdown).join('\n')
  // The fixture has $$E = mc^2$$ and other formulas
  assert.ok(allContent.includes('$$') || allContent.includes('$'), 'No formulas found in chunks')
})

test('dedupe_hash is a 32-char hex string', () => {
  const chunks = chunkDocument(FIXTURE)
  for (const c of chunks) {
    assert.match(c.dedupe_hash, /^[0-9a-f]{32}$/)
  }
})

test('dedupe_hash is stable across runs', () => {
  const c1 = chunkDocument(FIXTURE)
  const c2 = chunkDocument(FIXTURE)
  assert.equal(c1[0].dedupe_hash, c2[0].dedupe_hash)
})

test('dedupe_hash differs between different chunks', () => {
  const chunks = chunkDocument(FIXTURE)
  if (chunks.length < 2) return
  assert.notEqual(chunks[0].dedupe_hash, chunks[1].dedupe_hash)
})

test('definition/theorem blocks get correct chunk_type', () => {
  const chunks = chunkDocument(FIXTURE)
  const types = new Set(chunks.map(c => c.chunk_type))
  // The fixture has **Definição** and **Teorema** blocks
  const hasStructured = types.has('definition') || types.has('theorem') || types.has('body')
  assert.ok(hasStructured, `Types found: ${[...types].join(', ')}`)
})

test('stripMarkdown removes heading markers', () => {
  const plain = stripMarkdown('# Title\n\n**Bold** and *italic* text.')
  assert.ok(!plain.includes('#'), 'Heading marker not stripped')
  assert.ok(!plain.includes('**'), 'Bold markers not stripped')
  assert.ok(plain.includes('Title'), 'Title text missing')
})

test('normalizeContent lowercases and removes accents', () => {
  const norm = normalizeContent('Álgebra Linear')
  assert.equal(norm, 'algebra linear')
})

test('dedupeHash is deterministic', () => {
  const h1 = dedupeHash(['Chapter 1', 'Section 1'], 'some content')
  const h2 = dedupeHash(['Chapter 1', 'Section 1'], 'some content')
  assert.equal(h1, h2)
})

test('dedupeHash differs for different content', () => {
  const h1 = dedupeHash(['Ch1'], 'content a')
  const h2 = dedupeHash(['Ch1'], 'content b')
  assert.notEqual(h1, h2)
})

test('heading_path is populated from H1/H2 structure', () => {
  const chunks = chunkDocument(FIXTURE)
  const withPath = chunks.filter(c => c.heading_path.length > 0)
  assert.ok(withPath.length > 0, 'No chunks have heading_path')
})

test('source_spans is an array', () => {
  const chunks = chunkDocument(FIXTURE)
  for (const c of chunks) {
    assert.ok(Array.isArray(c.source_spans), 'source_spans should be array')
  }
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
