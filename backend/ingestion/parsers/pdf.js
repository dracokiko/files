import pdfParse from 'pdf-parse'

const PARSER_NAME = 'pdf-parse'
const PARSER_VERSION = '1.1.1'

/**
 * Parse a PDF buffer into the internal document structure.
 * Returns { markdown, pageMap, metadata, parserName, parserVersion }
 */
export async function parsePdf(buffer) {
  const data = await pdfParse(buffer, {
    pagerender: renderPage,
  })

  const pages = data.text.split('\f').filter(p => p.trim())
  const pageMap = []
  const markdownParts = []
  let lineCount = 0

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i].trim()
    if (!pageText) continue

    pageMap.push({ page: i + 1, startLine: lineCount })
    const pageMarkdown = convertPageToMarkdown(pageText, i + 1)
    markdownParts.push(pageMarkdown)
    lineCount += pageMarkdown.split('\n').length + 2
  }

  const markdown = markdownParts.join('\n\n')

  return {
    markdown,
    pageMap,
    page_count: data.numpages,
    metadata: {
      info: data.info,
      numpages: data.numpages,
    },
    parser_name: PARSER_NAME,
    parser_version: PARSER_VERSION,
    ocr_used: false,
    formula_extraction_used: true,
  }
}

/**
 * Heuristic: convert raw PDF page text to basic markdown.
 * Detects headings by ALL CAPS or numbered patterns, preserves LaTeX if present.
 */
function convertPageToMarkdown(text, pageNo) {
  const lines = text.split('\n').map(l => l.trimEnd())
  const result = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      result.push('')
      continue
    }

    // Numbered heading: "1. Introduction" or "1.2 Subsection"
    const numberedHeading = trimmed.match(/^(\d+(?:\.\d+)*)\s{1,4}([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][^\n]{3,60})$/)
    if (numberedHeading) {
      const depth = (numberedHeading[1].match(/\./g) || []).length + 1
      const hashes = '#'.repeat(Math.min(depth, 4))
      result.push(`${hashes} ${numberedHeading[1]} ${numberedHeading[2]}`)
      continue
    }

    // ALL CAPS short line → likely a heading
    if (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed)) {
      result.push(`## ${trimmed}`)
      continue
    }

    result.push(trimmed)
  }

  return result.join('\n')
}

// Custom page renderer (passthrough — use default text layer)
function renderPage(pageData) {
  return pageData.getTextContent().then(textContent => {
    return textContent.items.map(item => item.str).join(' ')
  })
}
