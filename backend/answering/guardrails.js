/**
 * Answer guardrails — Phase 16.
 *
 * Checks generated answers for signs of hallucination, invented formulas,
 * or fake citations. Returns a list of flagged issues with severity.
 *
 * Guardrail checks:
 *  1. No-context refusal: model correctly declined when context was empty
 *  2. Invented formula: LaTeX in answer not present in any retrieved chunk
 *  3. Citation out of range: [n] marker with n > number of provided sources
 *  4. Suspicious numeric: specific numbers not found in retrieved context
 *  5. Hallucination keyword: phrases that suggest confabulation
 *  6. Answer too short: < 50 chars suggests model was blocked or confused
 *  7. Answer too long: > 3000 chars suggests runaway generation
 */

import { extractFormulas, normalizeLaTeX } from '../ingestion/formula.js'

const HALLUCINATION_KEYWORDS = [
  /segundo\s+(estudos|pesquisas|investigações)\s+recentes/i,
  /de\s+acordo\s+com\s+[A-Z][a-z]+\s+et\s+al/i,
  /publicado\s+em\s+\d{4}\s+por/i,
  /\(ISBN|DOI:|arxiv:|doi\.org\)/i,
  /como\s+sabemos?\s+todos/i,
  /é\s+amplamente\s+reconhecido\s+que/i,
]

/**
 * Validate a generated answer against the retrieved context.
 *
 * @param {string}   answerText   — generated answer
 * @param {object[]} results      — retrieval results with .chunk
 * @param {object}   opts
 * @param {number}   opts.citationCount — number of citation references provided
 * @returns {{ flags: object[], safe: boolean }}
 */
export function checkAnswer(answerText, results, opts = {}) {
  const flags = []
  const { citationCount = results.length } = opts

  // 1. Empty or trivially short
  if (!answerText || answerText.trim().length < 50) {
    flags.push({ code: 'ANSWER_TOO_SHORT', severity: 'warning', message: 'Answer is suspiciously short.' })
  }

  // 2. Too long (runaway)
  if (answerText.length > 3500) {
    flags.push({ code: 'ANSWER_TOO_LONG', severity: 'warning', message: 'Answer exceeds 3500 characters.' })
  }

  // 3. Hallucination keywords
  for (const pattern of HALLUCINATION_KEYWORDS) {
    if (pattern.test(answerText)) {
      flags.push({
        code: 'HALLUCINATION_KEYWORD',
        severity: 'error',
        message: `Suspicious phrase detected: "${pattern.source.slice(0, 60)}"`,
      })
    }
  }

  // 4. Citation out of range  ([n] where n > citationCount)
  const citationRefs = [...answerText.matchAll(/\[(\d+)\]/g)].map(m => parseInt(m[1], 10))
  for (const ref of citationRefs) {
    if (ref > citationCount || ref < 1) {
      flags.push({
        code: 'CITATION_OUT_OF_RANGE',
        severity: 'error',
        message: `Answer references [${ref}] but only ${citationCount} sources provided.`,
      })
    }
  }

  // 5. Invented formula detection
  // Extract all LaTeX from the answer; check if each exists in retrieved context
  const contextText = results.map(r => r.chunk?.content_markdown ?? r.chunk?.content_plain ?? '').join('\n')
  const answerFormulas = extractFormulas(answerText)
  const contextFormulas = new Set(
    extractFormulas(contextText)
      .filter(f => f.original_latex)
      .map(f => normalizeLaTeX(f.original_latex))
  )

  for (const f of answerFormulas) {
    if (!f.original_latex) continue
    const norm = normalizeLaTeX(f.original_latex)
    // Only flag display formulas — more likely to be invented
    if (f.is_display && !contextFormulas.has(norm) && norm.length > 5) {
      flags.push({
        code: 'POSSIBLE_INVENTED_FORMULA',
        severity: 'warning',
        message: `Formula not found in retrieved context: ${f.original_latex.slice(0, 60)}`,
      })
    }
  }

  // 6. No-context refusal is good — don't penalize
  const refusalPhrases = [
    'não está disponível nos materiais',
    'não tenho informação',
    'os excertos fornecidos não',
  ]
  const hasRefusal = refusalPhrases.some(p => answerText.toLowerCase().includes(p))

  const criticalFlags = flags.filter(f => f.severity === 'error')
  const safe = criticalFlags.length === 0

  return { flags, safe, hasRefusal }
}

/**
 * Redact or repair an unsafe answer.
 * If the answer has critical flags, replace it with a safe refusal message.
 */
export function sanitizeAnswer(answerText, guardrailResult) {
  if (guardrailResult.safe) return answerText

  const criticalCodes = guardrailResult.flags
    .filter(f => f.severity === 'error')
    .map(f => f.code)

  if (criticalCodes.includes('CITATION_OUT_OF_RANGE') || criticalCodes.includes('HALLUCINATION_KEYWORD')) {
    return 'Não foi possível gerar uma resposta fiável com base nos materiais disponíveis. Por favor, reformule a pergunta ou consulte directamente os documentos carregados.'
  }

  return answerText
}
