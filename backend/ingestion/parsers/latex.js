const PARSER_NAME = 'latex-native'
const PARSER_VERSION = '1.0.0'

/**
 * Parse a LaTeX source file into Markdown, preserving all math environments.
 * Targets academic documents (\documentclass, \section, \begin{...}).
 */
export async function parseLatex(text) {
  const markdown = convertLatexToMarkdown(text)
  return {
    markdown,
    pageMap: [],
    page_count: null,
    metadata: {},
    parser_name: PARSER_NAME,
    parser_version: PARSER_VERSION,
    ocr_used: false,
    formula_extraction_used: true,
  }
}

function convertLatexToMarkdown(tex) {
  let md = tex

  // Strip preamble (everything before \begin{document})
  const docStart = md.indexOf('\\begin{document}')
  if (docStart !== -1) md = md.slice(docStart + '\\begin{document}'.length)
  const docEnd = md.indexOf('\\end{document}')
  if (docEnd !== -1) md = md.slice(0, docEnd)

  // Comments
  md = md.replace(/%[^\n]*/g, '')

  // Section headings
  md = md
    .replace(/\\part\{([^}]+)\}/g, '# $1')
    .replace(/\\chapter\{([^}]+)\}/g, '# $1')
    .replace(/\\section\{([^}]+)\}/g, '## $1')
    .replace(/\\subsection\{([^}]+)\}/g, '### $1')
    .replace(/\\subsubsection\{([^}]+)\}/g, '#### $1')
    .replace(/\\paragraph\{([^}]+)\}/g, '##### $1')

  // Theorem-like environments → Markdown bold headers + body
  const ENVS = ['theorem','lemma','corollary','definition','proposition','remark','example','exercise','solution','proof']
  for (const env of ENVS) {
    const label = env.charAt(0).toUpperCase() + env.slice(1)
    md = md.replace(
      new RegExp(`\\\\begin\\{${env}\\}(?:\\[([^\\]]+)\\])?((?:[\\s\\S])*?)\\\\end\\{${env}\\}`, 'gi'),
      (_, title, body) => `**${label}${title ? ` (${title})` : ''}**\n\n${body.trim()}\n`
    )
  }

  // Display math: equation, align, etc. → $$ ... $$
  const MATH_ENVS = ['equation','align','gather','multline','eqnarray','aligned','cases','pmatrix','bmatrix','vmatrix']
  for (const env of MATH_ENVS) {
    md = md.replace(
      new RegExp(`\\\\begin\\{${env}\\*?\\}([\\s\\S]*?)\\\\end\\{${env}\\*?\\}`, 'g'),
      (_, body) => `$$\n${body.trim()}\n$$`
    )
  }

  // Itemize / enumerate
  md = md.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, body) =>
    body.replace(/\\item\s*/g, '- ').trim()
  )
  md = md.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, body) => {
    let n = 0
    return body.replace(/\\item\s*/g, () => `${++n}. `).trim()
  })

  // Text formatting
  md = md
    .replace(/\\textbf\{([^}]+)\}/g, '**$1**')
    .replace(/\\textit\{([^}]+)\}/g, '*$1*')
    .replace(/\\emph\{([^}]+)\}/g, '*$1*')
    .replace(/\\underline\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')

  // Inline math — already $...$ in LaTeX, keep as-is
  // \(...\) → $...$
  md = md.replace(/\\\(([^)]+?)\\\)/g, '$$$1$')
  // \[...\] → $$...$$
  md = md.replace(/\\\[([\s\S]+?)\\\]/g, '$$\n$1\n$$')

  // References / citations (strip)
  md = md
    .replace(/\\cite\{[^}]+\}/g, '')
    .replace(/\\ref\{[^}]+\}/g, '')
    .replace(/\\label\{[^}]+\}/g, '')

  // Common macros
  md = md
    .replace(/\\newline/g, '\n')
    .replace(/\\\\(?!\s*$)/gm, '\n')
    .replace(/\\noindent\s*/g, '')
    .replace(/\\medskip|\\bigskip|\\smallskip|\\vspace\{[^}]+\}/g, '\n')
    .replace(/\\newpage|\\clearpage/g, '\n\n---\n\n')

  // Remove remaining LaTeX commands with argument (unknown ones)
  md = md.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
  md = md.replace(/\\[a-zA-Z]+/g, '')

  // Cleanup
  md = md.replace(/\{|\}/g, '')
  md = md.replace(/\n{3,}/g, '\n\n').trim()

  return md
}
