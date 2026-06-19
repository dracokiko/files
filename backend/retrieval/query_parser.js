/**
 * Query analysis for hybrid search.
 * Detects: quoted phrases, chapter refs, formula expressions, concept names.
 * Also classifies query intent to guide retrieval and answer generation.
 */

// ── Intent classification ─────────────────────────────────────────────────────

// Note: trailing \b is intentionally omitted where patterns end in Unicode
// characters (e.g. "é", "ão") because JS \b only recognises ASCII word chars.
// We rely on the leading \b or the literal pattern being specific enough.
const INTENT_PATTERNS = [
  // Definition intent: "what is X", "define X", "o que é X"
  { intent: 'definition', weight: { definition: 0.45, concept: 0.30, semantic: 0.20, lexical: 0.05 },
    patterns: [
      /\b(o que [eé]|what is|what are|define|significa)(?=\s|[?!,.]|$)/i,
      /\b(definição de|definir|conceito de|concept of|noção de)/i,
    ]
  },
  // Formula intent: "formula for X", "equação de X", explicit LaTeX
  { intent: 'formula', weight: { formula: 0.40, semantic: 0.25, lexical: 0.20, concept: 0.10, structure: 0.05 },
    patterns: [
      /\b(fórmula|formula|equação|equation|expressão|expression|calculate)\b/i,
      /\$|\\\(|\\\[|\\begin\{/,
    ]
  },
  // Exercise intent: "solve", "resolv", "exercício", "calculate step by step"
  { intent: 'exercise', weight: { semantic: 0.30, lexical: 0.25, concept: 0.20, formula: 0.15, structure: 0.10 },
    patterns: [
      /\b(resolve|solv[ae]|calcul[ae]|passo a passo|step.by.step|exemplo|example)\b/i,
      /\b(exercício|exercise|problema|problem|determine|find the)\b/i,
    ]
  },
  // Summary intent: "summarize", "resumo", "overview"
  { intent: 'summary', weight: { semantic: 0.50, lexical: 0.30, concept: 0.15, formula: 0.05 },
    patterns: [
      /\b(resumo|summary|overview|explica[r]?|explain)\b/i,
      /\bvisão geral\b/i,
    ]
  },
  // Comparison intent: "difference between", "diferença entre"
  { intent: 'comparison', weight: { semantic: 0.35, concept: 0.35, lexical: 0.20, formula: 0.05, structure: 0.05 },
    patterns: [
      /\b(diferença|difference|comparação|comparison|versus|vs\.?|contrast)\b/i,
      /\b(what('s| is) the (difference|comparison))\b/i,
    ]
  },
  // Table/data intent: "tabela", "values of", "constants"
  { intent: 'table', weight: { lexical: 0.40, semantic: 0.25, formula: 0.20, concept: 0.10, structure: 0.05 },
    patterns: [
      /\b(tabela|table|constante[s]?|constant[s]?|valor[es]?|value[s]?|propriedade[s]?|propert)\b/i,
    ]
  },
]

// Preferred chunk types per intent
export const INTENT_CHUNK_TYPES = {
  definition:  ['definition', 'theorem', 'body'],
  formula:     ['formula_only', 'definition', 'theorem', 'example'],
  exercise:    ['exercise', 'solution', 'example', 'formula_only'],
  summary:     ['summary', 'body', 'definition'],
  comparison:  ['definition', 'theorem', 'body'],
  table:       ['table', 'caption', 'body'],
  default:     ['body', 'definition', 'theorem', 'example', 'formula_only'],
}

/** Classify the primary intent of a query. */
export function classifyIntent(query) {
  const scores = {}
  for (const { intent, patterns } of INTENT_PATTERNS) {
    scores[intent] = patterns.filter(p => p.test(query)).length
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (sorted[0][1] === 0) return 'default'
  return sorted[0][0]
}

/** Parse a natural-language query and return structured hints. */
export function parseQuery(rawQuery) {
  const q = rawQuery.trim()

  const quotedPhrases = []
  const chapterRefs = []
  const formulaExprs = []
  let cleanQuery = q

  // Extract quoted phrases: "Teorema de Bayes"
  cleanQuery = cleanQuery.replace(/"([^"]+)"/g, (_, phrase) => {
    quotedPhrases.push(phrase)
    return phrase
  })

  // Detect chapter references: "capítulo 3", "chapter 2", "cap. 4", "secção 2.1"
  const chapterPattern = /(?:cap[ií]tulo|chapter|cap\.|sec[çc][aã]o|section)\s+(\d+(?:\.\d+)*)/gi
  let m
  while ((m = chapterPattern.exec(q)) !== null) {
    chapterRefs.push(m[1])
  }

  // Detect formula-like expressions: $...$, $$...$$, \(...\), or known LaTeX patterns
  const formulaPattern = /\$\$?([\s\S]+?)\$\$?|\\\(([^)]+)\\\)|\\\[([^\]]+)\\\]|\\[a-zA-Z]+(?:\{[^}]*\})?/g
  while ((m = formulaPattern.exec(q)) !== null) {
    const expr = (m[1] ?? m[2] ?? m[3] ?? m[0]).trim()
    if (expr) formulaExprs.push(expr)
  }

  // Classify intent
  const intent = classifyIntent(q)
  const intentConfig = INTENT_PATTERNS.find(p => p.intent === intent)

  // Start with intent-driven weights if found, otherwise defaults
  const weights = intentConfig ? { ...defaultWeights(), ...intentConfig.weight } : defaultWeights()

  // Override with explicit signal weights
  if (quotedPhrases.length > 0) {
    weights.lexical = Math.max(weights.lexical, 0.45)
    weights.semantic = Math.min(weights.semantic, 0.25)
  }
  if (formulaExprs.length > 0) {
    weights.formula = Math.max(weights.formula, 0.30)
    weights.lexical = Math.max(weights.lexical, 0.30)
    weights.semantic = Math.min(weights.semantic, 0.20)
    weights.concept  = Math.min(weights.concept,  0.10)
    weights.structure = 0.05
  }
  if (chapterRefs.length > 0) {
    weights.structure = Math.max(weights.structure, 0.20)
    weights.semantic  = Math.min(weights.semantic,  0.25)
  }

  // Normalize weights to sum to 1.0
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  for (const k of Object.keys(weights)) weights[k] = +(weights[k] / total).toFixed(4)

  const preferredChunkTypes = INTENT_CHUNK_TYPES[intent] ?? INTENT_CHUNK_TYPES.default

  return {
    raw: q,
    clean: cleanQuery.replace(/\s+/g, ' ').trim(),
    quotedPhrases,
    chapterRefs,
    formulaExprs,
    weights,
    intent,
    preferredChunkTypes,
    hasFormula: formulaExprs.length > 0,
    hasQuotedPhrase: quotedPhrases.length > 0,
    hasChapterRef: chapterRefs.length > 0,
  }
}

function defaultWeights() {
  return {
    semantic: 0.35,
    lexical: 0.30,
    concept: 0.20,
    formula: 0.10,
    structure: 0.05,
  }
}
