import mammoth from 'mammoth'

const PARSER_NAME = 'mammoth'
const PARSER_VERSION = '1.8.0'

/**
 * Parse a DOCX buffer into the internal document structure.
 */
export async function parseDocx(buffer) {
  const { value: html, messages } = await mammoth.convertToHtml({ buffer })
  const markdown = htmlToMarkdown(html)

  return {
    markdown,
    pageMap: [],   // DOCX doesn't expose page numbers via mammoth
    page_count: null,
    metadata: { mammoth_messages: messages.map(m => ({ type: m.type, message: m.message })) },
    parser_name: PARSER_NAME,
    parser_version: PARSER_VERSION,
    ocr_used: false,
    formula_extraction_used: true,
  }
}

/**
 * Convert HTML (from mammoth) to simplified markdown.
 * Handles headings, bold, italic, lists, paragraphs, tables.
 */
function htmlToMarkdown(html) {
  return html
    // Headings
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${stripTags(c)}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `## ${stripTags(c)}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `### ${stripTags(c)}\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `#### ${stripTags(c)}\n`)
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, c) => `##### ${stripTags(c)}\n`)
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, c) => `###### ${stripTags(c)}\n`)
    // Bold / italic
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    // Lists
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `- ${stripTags(c)}\n`)
    // Table (basic)
    .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, c) => convertTable(c))
    // Paragraphs
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `${stripTags(c)}\n\n`)
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').trim()
}

function convertTable(tableHtml) {
  const rows = []
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
    const cells = []
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let cellMatch
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]).replace(/\|/g, '\\|'))
    }
    rows.push('| ' + cells.join(' | ') + ' |')
  }
  if (rows.length > 1) {
    rows.splice(1, 0, '| ' + rows[0].split('|').slice(1, -1).map(() => '---').join(' | ') + ' |')
  }
  return rows.join('\n') + '\n\n'
}
