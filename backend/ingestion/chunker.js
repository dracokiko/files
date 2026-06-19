import { createHash } from 'crypto'
import { hasUnclosedDisplayFormula } from './formula.js'

// ── Config ────────────────────────────────────────────────────────────────────
const TARGET_TOKENS = parseInt(process.env.CHUNK_TARGET_TOKENS ?? '700')
const MIN_TOKENS    = parseInt(process.env.CHUNK_MIN_TOKENS ?? '350')
const MAX_TOKENS    = parseInt(process.env.CHUNK_MAX_TOKENS ?? '900')
const OVERLAP_TOKENS = parseInt(process.env.CHUNK_OVERLAP_TOKENS ?? '120')

// ── Block type detection ──────────────────────────────────────────────────────
const BLOCK_TYPE_PATTERNS = [
  { pattern: /^\s*\*{1,2}(Definição|Definition|Def\.?)\s*[\d.:]*\*{0,2}/i,  type: 'definition' },
  { pattern: /^\s*\*{1,2}(Teorema|Theorem|Thm\.?)\s*[\d.:]*\*{0,2}/i,       type: 'theorem'    },
  { pattern: /^\s*\*{1,2}(Lema|Lemma)\s*[\d.:]*\*{0,2}/i,                   type: 'theorem'    },
  { pattern: /^\s*\*{1,2}(Corolário|Corollary|Cor\.?)\s*[\d.:]*\*{0,2}/i,   type: 'theorem'    },
  { pattern: /^\s*\*{1,2}(Demonstração|Proof|Prova)\s*[\d.:]*\*{0,2}/i,     type: 'proof'      },
  { pattern: /^\s*\*{1,2}(Exemplo|Example|Ex\.?)\s*[\d.:]*\*{0,2}/i,        type: 'example'    },
  { pattern: /^\s*\*{1,2}(Exercício|Exercise|Problema|Problem)\s*[\d.:]*\*{0,2}/i, type: 'exercise' },
  { pattern: /^\s*\*{1,2}(Solução|Solution|Resolução)\s*[\d.:]*\*{0,2}/i,   type: 'solution'   },
  { pattern: /^\s*\*{1,2}(Sumário|Resumo|Summary)\s*[\d.:]*\*{0,2}/i,       type: 'summary'    },
  { pattern: /^\s*\|.+\|/m,                                                   type: 'table'      },
  { pattern: /^\s*!\[/,                                                        type: 'caption'    },
  { pattern: /^\s*([-*+]|\d+\.) /,                                             type: 'list_item'  },
]

const STICKY_TYPES = new Set(['definition', 'theorem', 'proof', 'example', 'exercise', 'solution'])

// ── Token estimation (heuristic: ~4 chars/token for Portuguese/LaTeX mix) ────
function estimateTokens(text) {
  return Math.ceil(text.length / 3.8)
}

// ── Structural block parsing ──────────────────────────────────────────────────

/**
 * Parse markdown into structural blocks.
 * Each block: { type, level, text, heading, page }
 */
function parseBlocks(markdown, pageMap = []) {
  const lines = markdown.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: line,
        heading: headingMatch[2].trim(),
        page: _pageAt(i, pageMap),
      })
      i++
      continue
    }

    // Display formula block: $$...$$
    if (line.trimStart().startsWith('$$') || line.trimStart().startsWith('\\[') || line.trimStart().match(/^\\begin\{(equation|align|gather|multline|eqnarray|aligned|cases)\*?\}/)) {
      const start = i
      let buf = line
      i++
      // Collect until formula closes
      while (i < lines.length && hasUnclosedDisplayFormula(buf)) {
        buf += '\n' + lines[i]
        i++
      }
      blocks.push({ type: 'formula_only', level: 0, text: buf, heading: null, page: _pageAt(start, pageMap) })
      continue
    }

    // Table
    if (line.match(/^\s*\|.+\|/)) {
      const start = i
      let buf = line
      i++
      while (i < lines.length && lines[i].match(/^\s*\|/)) {
        buf += '\n' + lines[i]
        i++
      }
      blocks.push({ type: 'table', level: 0, text: buf, heading: null, page: _pageAt(start, pageMap) })
      continue
    }

    // Blank line — separator
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph / structured block
    const start = i
    let buf = line
    i++
    // Collect continuation lines (non-blank, non-heading)
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^#{1,6}\s/)) {
      buf += '\n' + lines[i]
      i++
    }

    const blockType = _detectBlockType(buf)
    blocks.push({ type: blockType, level: 0, text: buf, heading: null, page: _pageAt(start, pageMap) })
  }

  return blocks
}

function _detectBlockType(text) {
  for (const { pattern, type } of BLOCK_TYPE_PATTERNS) {
    if (pattern.test(text)) return type
  }
  return 'body'
}

function _pageAt(lineIndex, pageMap) {
  if (!pageMap.length) return null
  for (let j = pageMap.length - 1; j >= 0; j--) {
    if (lineIndex >= pageMap[j].startLine) return pageMap[j].page
  }
  return null
}

// ── Chapter/Section extraction ────────────────────────────────────────────────

export function extractStructure(blocks) {
  const chapters = []
  let currentChapter = null
  let currentSection = null
  let chapterNo = 0
  let sectionOrdinal = 0

  for (const block of blocks) {
    if (block.type !== 'heading') continue

    if (block.level === 1) {
      chapterNo++
      sectionOrdinal = 0
      currentChapter = {
        chapter_no: chapterNo,
        title: block.heading,
        page_start: block.page,
        page_end: block.page,
        sections: [],
      }
      chapters.push(currentChapter)
      currentSection = null
    } else if (block.level >= 2 && currentChapter) {
      sectionOrdinal++
      const headingPath = currentChapter
        ? [currentChapter.title, block.heading].filter(Boolean)
        : [block.heading]
      currentSection = {
        section_level: block.level,
        title: block.heading,
        heading_path: headingPath,
        ordinal_in_chapter: sectionOrdinal,
        page_start: block.page,
        page_end: block.page,
      }
      currentChapter.sections.push(currentSection)
    }
  }

  // If no H1 headings found, create a synthetic chapter
  if (chapters.length === 0) {
    chapters.push({
      chapter_no: 1,
      title: 'Documento',
      page_start: null,
      page_end: null,
      sections: [{ section_level: 1, title: 'Conteúdo', heading_path: ['Documento','Conteúdo'], ordinal_in_chapter: 1, page_start: null, page_end: null }],
    })
  }

  return chapters
}

// ── Chunking ──────────────────────────────────────────────────────────────────

/**
 * Main chunking function.
 * Takes markdown and optional pageMap, returns array of chunk records.
 */
export function chunkDocument(markdown, { pageMap = [], headingPath = [] } = {}) {
  const blocks = parseBlocks(markdown, pageMap)
  const chunks = []
  let chunkNo = 0
  let currentHeadingPath = [...headingPath]
  let pendingBlocks = []
  let pendingTokens = 0
  let pageStart = null
  let pageEnd = null

  function flush(forceType = null) {
    if (!pendingBlocks.length) return
    const content_markdown = pendingBlocks.map(b => b.text).join('\n\n')
    const content_plain = stripMarkdown(content_markdown)
    const content_norm = normalizeContent(content_plain)
    const token_count = estimateTokens(content_markdown)
    const chunk_type = forceType ?? dominantType(pendingBlocks)
    const page_s = pendingBlocks.find(b => b.page != null)?.page ?? null
    const page_e = [...pendingBlocks].reverse().find(b => b.page != null)?.page ?? null

    chunks.push({
      chunk_no: chunkNo++,
      chunk_type,
      heading_path: [...currentHeadingPath],
      content_markdown,
      content_plain,
      content_norm,
      token_count,
      char_count: content_markdown.length,
      page_start: page_s,
      page_end: page_e,
      dedupe_hash: dedupeHash(currentHeadingPath, content_norm),
      source_spans: pendingBlocks.map(b => ({ page: b.page, text_start: 0, text_length: b.text.length })),
      metadata: {},
    })
    pendingBlocks = []
    pendingTokens = 0
  }

  function addOverlap(lastBlocks) {
    // Add last N tokens of previous chunk as overlap context
    if (!lastBlocks.length) return
    let overlapTokens = 0
    const overlapBlocks = []
    for (let i = lastBlocks.length - 1; i >= 0; i--) {
      const t = estimateTokens(lastBlocks[i].text)
      if (overlapTokens + t > OVERLAP_TOKENS) break
      overlapBlocks.unshift(lastBlocks[i])
      overlapTokens += t
    }
    pendingBlocks = [...overlapBlocks]
    pendingTokens = overlapTokens
  }

  for (const block of blocks) {
    // Update heading path
    if (block.type === 'heading') {
      if (block.level === 1) {
        flush()
        currentHeadingPath = [block.heading]
      } else if (block.level === 2) {
        flush()
        currentHeadingPath = [currentHeadingPath[0] ?? '', block.heading].filter(Boolean)
      } else {
        flush()
        currentHeadingPath = [...currentHeadingPath.slice(0, block.level - 1), block.heading]
      }
      continue
    }

    const blockTokens = estimateTokens(block.text)

    // Sticky blocks (theorem, definition etc.) must never be split mid-block
    if (STICKY_TYPES.has(block.type)) {
      if (pendingTokens > 0 && pendingTokens + blockTokens > MAX_TOKENS) {
        const prev = [...pendingBlocks]
        flush()
        addOverlap(prev)
      }
      pendingBlocks.push(block)
      pendingTokens += blockTokens
      // If the sticky block alone exceeds MAX, flush immediately after adding
      if (pendingTokens >= MAX_TOKENS) {
        flush(block.type)
      }
      continue
    }

    // Normal block — accumulate until target reached
    if (pendingTokens + blockTokens > TARGET_TOKENS && pendingTokens >= MIN_TOKENS) {
      const prev = [...pendingBlocks]
      flush()
      addOverlap(prev)
    }

    pendingBlocks.push(block)
    pendingTokens += blockTokens

    // Hard cap
    if (pendingTokens >= MAX_TOKENS) {
      flush()
    }
  }

  flush()
  return chunks
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dominantType(blocks) {
  const typeCounts = {}
  for (const b of blocks) {
    if (b.type === 'body' || b.type === 'heading') continue
    typeCounts[b.type] = (typeCounts[b.type] ?? 0) + 1
  }
  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? 'body'
}

export function stripMarkdown(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/\*(.+?)\*/g, '$1')           // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')    // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
    .replace(/^\s*[-*+]\s+/gm, '')        // list markers
    .replace(/^\s*\d+\.\s+/gm, '')        // numbered lists
    .replace(/\|[^\n]+/g, ' ')            // table cells
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeContent(plain) {
  return plain
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // strip accents
    .replace(/[^\w\s$\\{}[\]]/g, ' ')    // keep math chars
    .replace(/\s+/g, ' ')
    .trim()
}

export function dedupeHash(headingPath, contentNorm) {
  const input = headingPath.join('|') + '||' + contentNorm
  return createHash('sha256').update(input).digest('hex').slice(0, 32)
}
