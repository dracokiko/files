import express from 'express'
import { prepareAnswerContext, logAnswer } from '../answering/generator.js'
import { checkAnswer } from '../answering/guardrails.js'
import { getOrCreateCourseIdForCadeira } from '../services/course_link.js'

const ANSWER_MODEL = process.env.ANSWER_MODEL ?? 'gemini-flash-lite-latest'

const GENERATION_CONFIG = {
  maxOutputTokens: 800,
  temperature: 0.1,
  topP: 0.9,
  stopSequences: ['</contexto>'],
}

/**
 * Real-time RAG chat for students, replacing the old raw-Gemini /api/chat.
 * Retrieves+ranks material for the cadeira, builds a grounded prompt, then
 * streams Gemini's own token stream live (SSE) so the UI keeps showing
 * tokens as they arrive. Guardrails run after the stream ends — on the full
 * text, for logging/flagging only, since tokens already on the wire can't
 * be retroactively edited.
 */
export default function chatV2Routes({ supabase, supabaseAdmin, genai }) {
  const router = express.Router()

  router.post('/chat/stream', async (req, res) => {
    const { cadeira_id, question, history = [] } = req.body
    if (!cadeira_id) return res.status(400).json({ error: 'cadeira_id em falta.' })
    if (!question?.trim()) return res.status(400).json({ error: 'Pergunta vazia.' })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    supabase.from('eventos').insert({ tipo: 'chat_message_sent', cadeira_id, timestamp: new Date().toISOString() }).then(() => {})

    try {
      const courseId = await getOrCreateCourseIdForCadeira(cadeira_id, supabaseAdmin)
      if (!courseId) throw new Error('Cadeira não encontrada.')

      const ctx = await prepareAnswerContext({ query: question, courseId, supabase: supabaseAdmin ?? supabase, history })

      if (ctx.zero_results) {
        res.write(`data: ${JSON.stringify({ text: ctx.fallbackText })}\n\n`)
        res.write(`data: ${JSON.stringify({ done: true, citations: [], bibliography: '', safe: true })}\n\n`)
        res.write('data: [DONE]\n\n')
        return res.end()
      }

      const model = genai.getGenerativeModel({
        model: ANSWER_MODEL,
        systemInstruction: ctx.systemPrompt,
        generationConfig: GENERATION_CONFIG,
      })
      const result = await model.generateContentStream(ctx.userPrompt)

      let full = ''
      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) {
          full += text
          res.write(`data: ${JSON.stringify({ text })}\n\n`)
        }
      }

      const guardrailResult = checkAnswer(full, ctx.reranked, { citationCount: ctx.citations.length })
      res.write(`data: ${JSON.stringify({ done: true, citations: ctx.citations, bibliography: ctx.bibliography, safe: guardrailResult.safe })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()

      logAnswer(
        { answer_text: full, citations: ctx.citations, guardrail_flags: guardrailResult.flags, latency_ms: 0 },
        { query: question, userId: null, subjectId: cadeira_id, tenantId: null },
        supabaseAdmin,
      ).catch(() => {})
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  })

  return router
}
