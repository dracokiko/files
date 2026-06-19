/**
 * Answer generator — Phase 15.
 *
 * Orchestrates: hybridSearch → rerank → buildPrompt → Gemini → guardrails → citations
 *
 * Usage:
 *   import { generateAnswer } from './generator.js'
 *   const answer = await generateAnswer({ query, courseId, supabase, genai })
 */

import { hybridSearch }            from '../retrieval/hybrid.js'
import { parseQuery }              from '../retrieval/query_parser.js'
import { rerank }                  from '../retrieval/reranker.js'
import { buildPrompt }             from './prompt_builder.js'
import { checkAnswer, sanitizeAnswer } from './guardrails.js'
import { buildStructuredCitation, formatBibliography } from './citations.js'

const ANSWER_MODEL = process.env.ANSWER_MODEL ?? 'gemini-1.5-flash'

/**
 * @param {object} opts
 * @param {string} opts.query
 * @param {string} opts.courseId
 * @param {string=} opts.documentId
 * @param {object} opts.supabase        — Supabase client (anon or service)
 * @param {object} opts.genai           — GoogleGenerativeAI instance
 * @param {number=} opts.topK           — final chunks to use (default 8)
 * @param {number=} opts.candidateK     — pre-rerank candidates (default 30)
 * @param {boolean=} opts.includeRaw    — include raw chunks in response
 * @param {string=} opts.userId
 * @param {string=} opts.tenantId
 * @returns {Promise<{
 *   answer: string,
 *   citations: object[],
 *   bibliography: string,
 *   guardrail_flags: object[],
 *   safe: boolean,
 *   latency_ms: number,
 *   retrieval_latency_ms: number,
 *   answer_latency_ms: number,
 *   zero_results: boolean,
 * }>}
 */
export async function generateAnswer(opts) {
  const {
    query,
    courseId,
    documentId,
    supabase,
    genai,
    topK = 8,
    candidateK = 30,
    includeRaw = false,
    userId,
    tenantId,
  } = opts

  if (!query?.trim()) throw new Error('query is required')
  if (!genai)         throw new Error('genai instance is required')

  const t0 = Date.now()

  // ── 1. Parse query ───────────────────────────────────────────────────────
  const parsed = parseQuery(query)

  // ── 2. Hybrid retrieval ───────────────────────────────────────────────────
  const t1 = Date.now()
  const candidates = await hybridSearch(query, {
    courseId,
    documentId,
    topK: candidateK,
    supabase,
    weights: parsed.weights,
  })
  const retrieval_latency_ms = Date.now() - t1
  const zero_results = candidates.length === 0

  // ── 3. Rerank ────────────────────────────────────────────────────────────
  const reranked = await rerank(candidates, parsed, { topK, supabase })

  // ── 4. Build citations ───────────────────────────────────────────────────
  const citations = reranked.map((r, i) => buildStructuredCitation(r, i + 1))

  // ── 5. Build prompt ──────────────────────────────────────────────────────
  const { systemPrompt, userPrompt } = buildPrompt(query, reranked, parsed, citations)

  // ── 6. Generate answer ───────────────────────────────────────────────────
  let answerText = ''
  const t2 = Date.now()

  if (zero_results) {
    answerText = 'Não foram encontrados materiais relevantes para responder a esta pergunta. Verifique se os documentos da cadeira foram carregados.'
  } else {
    try {
      const model = genai.getGenerativeModel({
        model: ANSWER_MODEL,
        systemInstruction: systemPrompt,
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.1,        // low temperature = less hallucination
          topP: 0.9,
          stopSequences: ['</contexto>'],
        },
      })
      const result = await model.generateContent(userPrompt)
      answerText = result.response.text() ?? ''
    } catch (err) {
      answerText = `Erro ao gerar resposta: ${err.message}`
    }
  }

  const answer_latency_ms = Date.now() - t2

  // ── 7. Guardrails ────────────────────────────────────────────────────────
  const guardrailResult = checkAnswer(answerText, reranked, { citationCount: citations.length })
  const finalAnswer = sanitizeAnswer(answerText, guardrailResult)

  // ── 8. Append bibliography ───────────────────────────────────────────────
  const bibliography = formatBibliography(citations)
  const answerWithBib = citations.length > 0
    ? finalAnswer + bibliography
    : finalAnswer

  return {
    answer: answerWithBib,
    answer_text: finalAnswer,
    citations,
    bibliography,
    guardrail_flags: guardrailResult.flags,
    safe: guardrailResult.safe,
    zero_results,
    latency_ms: Date.now() - t0,
    retrieval_latency_ms,
    answer_latency_ms,
    parsed_query: parsed,
    ...(includeRaw ? { raw_chunks: reranked } : {}),
  }
}

/**
 * Log answer to DB (non-blocking, best-effort).
 */
export async function logAnswer(result, opts, supabaseAdmin) {
  if (!supabaseAdmin) return
  try {
    const { data: log } = await supabaseAdmin.from('answer_logs').insert({
      query:              opts.query,
      answer_text:        result.answer_text,
      answer_model:       process.env.ANSWER_MODEL ?? 'gemini-1.5-flash',
      cited_chunk_ids:    result.citations.map(c => c.chunk_id),
      guardrail_flags:    result.guardrail_flags,
      latency_ms:         result.latency_ms,
      user_id:            opts.userId ?? null,
      subject_id:         opts.subjectId ?? null,
      tenant_id:          opts.tenantId ?? null,
    }).select('id').single()
    return log?.id
  } catch { /* non-critical */ }
}
