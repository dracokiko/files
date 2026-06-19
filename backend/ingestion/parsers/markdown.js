const PARSER_NAME = 'markdown-native'
const PARSER_VERSION = '1.0.0'

/**
 * Parse raw Markdown or HTML text.
 * If HTML, converts to Markdown first.
 * This is the highest-fidelity path for documents that already have LaTeX.
 */
export async function parseMarkdown(text, sourceKind = 'markdown') {
  const markdown = sourceKind === 'html' ? htmlToMarkdown(text) : text
  const lines = markdown.split('\n')

  // Build a pageMap from explicit page-break comments: <!-- page: N -->
  const pageMap = []
  lines.forEach((line, i) => {
    const m = line.match(/<!--\s*page:\s*(\d+)\s*-->/)
    if (m) pageMap.push({ page: parseInt(m[1]), startLine: i })
  })

  return {
    markdown,
    pageMap,
    page_count: pageMap.length || null,
    metadata: {},
    parser_name: PARSER_NAME,
    parser_version: PARSER_VERSION,
    ocr_used: false,
    formula_extraction_used: true,
  }
}

function htmlToMarkdown(html) {
  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${strip(c)}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `## ${strip(c)}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `### ${strip(c)}\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `#### ${strip(c)}\n`)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `- ${strip(c)}\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `${strip(c)}\n\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function strip(html) {
  return html.replace(/<[^>]+>/g, '').trim()
}
