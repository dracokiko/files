/**
 * Prompt builder for answer generation — Phase 15.
 *
 * Builds a Gemini system+user prompt from retrieved chunks.
 * Handles:
 *  - Per-intent instruction prefix
 *  - LaTeX passthrough (formulas quoted verbatim)
 *  - Citation markers injected as [n] after each context block
 *  - Token budget management (truncate if needed)
 */

const MAX_CONTEXT_CHARS = 12000   // ~3k tokens of context
const MAX_ANSWER_TOKENS = 600

const INTENT_INSTRUCTIONS = {
  definition: 'Dê uma definição clara e precisa baseada nos materiais de estudo fornecidos. Se houver uma definição formal, cite-a primeiro. Seja conciso.',
  formula:    'Apresente a(s) fórmula(s) relevante(s) usando LaTeX (entre $...$). Explique o significado de cada variável. Mencione as condições de aplicação.',
  exercise:   'Resolva passo a passo. Identifique os dados, escolha o método, aplique-o e interprete o resultado. Use LaTeX para expressões matemáticas.',
  summary:    'Elabore um resumo estruturado dos pontos principais. Use marcadores ou secções numeradas se ajudar a clareza.',
  comparison: 'Compare sistematicamente os conceitos. Liste semelhanças e diferenças claras. Uma tabela pode ser útil se houver múltiplos atributos.',
  table:      'Apresente os dados/valores tabelados de forma clara. Se os dados originais estiverem em tabela, preserve a estrutura.',
  default:    'Responda de forma clara e fundamentada nos materiais fornecidos. Use LaTeX para fórmulas matemáticas.',
}

const SYSTEM_PROMPT = `Você é um tutor académico especializado. Responde em Português Europeu.

Regras obrigatórias:
- Baseie a resposta APENAS nos excertos fornecidos entre as tags <contexto>.
- Se a informação não estiver nos excertos, diga "Esta informação não está disponível nos materiais carregados." — não invente.
- Preserve fórmulas LaTeX exactamente como aparecem nos excertos (entre $...$ ou $$...$$).
- Não invente fórmulas, valores numéricos, ou referências bibliográficas.
- Ao citar um excerto, use a referência entre parêntesis retos: [1], [2], etc.
- Responda de forma estruturada e académica, adequada a estudantes universitários.`

/**
 * Build the full prompt payload for Gemini.
 *
 * @param {string}   query       — original user query
 * @param {object[]} results     — reranked retrieval results (with .chunk and .provenance)
 * @param {object}   parsed      — from parseQuery
 * @param {object[]} citations   — from buildStructuredCitation
 * @returns {{ systemPrompt: string, userPrompt: string, contextCharCount: number }}
 */
export function buildPrompt(query, results, parsed, citations) {
  const intent = parsed.intent ?? 'default'
  const intentInstruction = INTENT_INSTRUCTIONS[intent] ?? INTENT_INSTRUCTIONS.default

  // Build context blocks
  let contextParts = []
  let totalChars = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const chunk = result.chunk ?? {}
    const label = `[${i + 1}]`
    const headingPath = (chunk.heading_path ?? []).join(' > ')
    const content = chunk.content_markdown ?? chunk.content_plain ?? ''

    if (totalChars + content.length > MAX_CONTEXT_CHARS) break

    const block = [
      `<excerto ${label}>`,
      headingPath ? `Secção: ${headingPath}` : null,
      content,
      `</excerto>`,
    ].filter(Boolean).join('\n')

    contextParts.push(block)
    totalChars += block.length
  }

  const contextBlock = `<contexto>\n${contextParts.join('\n\n')}\n</contexto>`

  const userPrompt = [
    `Instrução específica: ${intentInstruction}`,
    '',
    contextBlock,
    '',
    `Pergunta: ${query}`,
  ].join('\n')

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    contextCharCount: totalChars,
    intentInstruction,
  }
}

export const MAX_ANSWER_TOKENS_EXPORT = MAX_ANSWER_TOKENS
