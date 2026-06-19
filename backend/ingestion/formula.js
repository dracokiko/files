import { createHash } from 'crypto'

// ── Regex patterns ────────────────────────────────────────────────────────────
const DISPLAY_PATTERNS = [
  /\$\$([\s\S]+?)\$\$/g,
  /\\\[([\s\S]+?)\\\]/g,
  /\\begin\{(equation|align|gather|multline|eqnarray|aligned|cases)\*?\}([\s\S]+?)\\end\{\1\*?\}/g,
]

const INLINE_PATTERNS = [
  /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g,
  /\\\(([^)]+?)\\\)/g,
]

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract all formulas from markdown text.
 * Returns an array of formula records ready for DB insertion.
 */
export function extractFormulas(markdown) {
  const seen = new Set()   // track offsets already captured
  const raw = []

  for (const pattern of DISPLAY_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    let m
    while ((m = re.exec(markdown)) !== null) {
      if (seen.has(m.index)) continue
      seen.add(m.index)
      // Group 2 exists for \begin{env}...\end{env} patterns
      const latex = (m[2] ?? m[1] ?? '').trim()
      if (!latex) continue
      raw.push({ latex, is_display: true, confidence: 0.95, offset: m.index, full: m[0] })
    }
  }

  for (const pattern of INLINE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    let m
    while ((m = re.exec(markdown)) !== null) {
      if (seen.has(m.index)) continue
      seen.add(m.index)
      const latex = m[1].trim()
      if (!latex) continue
      raw.push({ latex, is_display: false, confidence: 0.88, offset: m.index, full: m[0] })
    }
  }

  raw.sort((a, b) => a.offset - b.offset)

  return raw.map((r, i) => {
    const normalized = normalizeLaTeX(r.latex)
    return {
      ordinal_in_chunk: i,
      original_latex: r.latex,
      normalized_latex: normalized,
      formula_hash: hashLaTeX(normalized),
      is_display: r.is_display,
      symbols: extractSymbols(r.latex),
      extraction_confidence: r.confidence,
      mathml: null,   // future: conversion via mathml-tools
      _offset: r.offset,
      _full_match: r.full,
    }
  })
}

/**
 * Normalize LaTeX for deduplication and fuzzy matching.
 * Strips purely presentational wrappers; does NOT do algebraic rewrites.
 */
export function normalizeLaTeX(latex) {
  return latex
    .replace(/\\left\s*/g, '')
    .replace(/\\right\s*/g, '')
    .replace(/\\bigl?\s*/g, '')
    .replace(/\\bigr?\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/,\s+/g, ', ')
    .trim()
}

/** SHA-256 of normalized LaTeX — stable across ingestion runs. */
export function hashLaTeX(normalized) {
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Extract a bag of mathematical symbols from a LaTeX string.
 * Intentionally conservative: only well-known symbols that carry semantic weight.
 */
export function extractSymbols(latex) {
  const symbols = new Set()

  const patterns = [
    // Greek letters
    /\\(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega)/g,
    /\\(Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega)/g,
    // Key operators
    /\\(sum|prod|int|oint|partial|nabla|infty|pm|mp|times|div|cdot|circ|oplus|otimes|wedge|vee|forall|exists|in|notin|subset|supset|cup|cap)/g,
    // Arrows / logic
    /\\(rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|leftrightarrow|mapsto|to)/g,
    // Standalone capital letters (matrix/set names)
    /\b([A-Z])\b(?![a-z])/g,
  ]

  for (const p of patterns) {
    const re = new RegExp(p.source, p.flags)
    let m
    while ((m = re.exec(latex)) !== null) {
      symbols.add(m[1] ? `\\${m[1]}` : m[0])
    }
  }

  return [...symbols]
}

/**
 * Check whether a text range contains an unclosed display formula.
 * Used by the chunker to avoid splitting mid-formula.
 */
export function hasUnclosedDisplayFormula(text) {
  const ddCount = (text.match(/\$\$/g) || []).length
  if (ddCount % 2 !== 0) return true
  const openBracket = (text.match(/\\\[/g) || []).length
  const closeBracket = (text.match(/\\\]/g) || []).length
  if (openBracket !== closeBracket) return true
  const envOpen = (text.match(/\\begin\{(equation|align|gather|multline|eqnarray|aligned|cases)\*?\}/g) || []).length
  const envClose = (text.match(/\\end\{(equation|align|gather|multline|eqnarray|aligned|cases)\*?\}/g) || []).length
  return envOpen !== envClose
}
