import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const app = express()
app.use(express.json())
app.use(express.static('public'))

const MODEL_NAME = 'gemini-1.5-flash'

// ── Validar variáveis de ambiente ─────────────────────────────────────────────
const { GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env

if (!GEMINI_API_KEY)    { console.error('Falta GEMINI_API_KEY no .env');    process.exit(1) }
if (!SUPABASE_URL)      { console.error('Falta SUPABASE_URL no .env');      process.exit(1) }
if (!SUPABASE_ANON_KEY) { console.error('Falta SUPABASE_ANON_KEY no .env'); process.exit(1) }

const genai    = new GoogleGenerativeAI(GEMINI_API_KEY)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Lógica do modelo ──────────────────────────────────────────────────────────
function buildSystemInstruction(material) {
  return `Tu és um tutor de estudo dedicado e paciente. O teu único objetivo
é ajudar o aluno a compreender a matéria que se encontra nos APONTAMENTOS abaixo.

=================== APONTAMENTOS ===================
${material}
====================================================

REGRAS RÍGIDAS QUE DEVES SEGUIR SEMPRE:

1. Responde EXCLUSIVAMENTE com base nos APONTAMENTOS acima. Nunca uses
   conhecimento externo, nem que tenhas a certeza da resposta.

2. Se a pergunta do aluno não puder ser respondida com a informação dos
   APONTAMENTOS, recusa educadamente. Diz algo como:
   "Essa informação não consta nos apontamentos que tenho. Posso ajudar-te
   com os temas abordados na matéria — queres reformular a pergunta?"

3. Não inventes factos, datas, fórmulas ou exemplos que não estejam nos APONTAMENTOS.

4. Sê claro, didático e encorajador. Quando útil, organiza a resposta em
   passos ou tópicos para facilitar o estudo.

5. Responde sempre em português de Portugal.`
}

function createModel(material) {
  return genai.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: buildSystemInstruction(material),
  })
}

function toGeminiHistory(messages) {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }))
}

// Cache de modelos por cadeira — evita ir ao Supabase em cada mensagem
const modelCache = new Map()

async function getModel(faculdade, cadeira) {
  const key = `${faculdade}::${cadeira}`
  if (modelCache.has(key)) return modelCache.get(key)

  const { data, error } = await supabase
    .from('subjects')
    .select('conteudo')
    .eq('faculdade', faculdade)
    .eq('cadeira', cadeira)
    .single()

  if (error || !data) throw new Error(`Cadeira "${cadeira}" não encontrada.`)

  const model = createModel(data.conteudo)
  modelCache.set(key, model)
  return model
}

// ── Rotas ─────────────────────────────────────────────────────────────────────

// Lista de faculdades disponíveis
app.get('/api/faculdades', async (_req, res) => {
  const { data, error } = await supabase
    .from('subjects')
    .select('faculdade')
    .order('faculdade')

  if (error) return res.status(500).json({ error: error.message })

  const faculdades = [...new Set(data.map(r => r.faculdade))]
  res.json(faculdades)
})

// Cadeiras de uma faculdade
app.get('/api/cadeiras', async (req, res) => {
  const { faculdade } = req.query
  if (!faculdade) return res.status(400).json({ error: 'Parâmetro faculdade em falta.' })

  const { data, error } = await supabase
    .from('subjects')
    .select('cadeira')
    .eq('faculdade', faculdade)
    .order('cadeira')

  if (error) return res.status(500).json({ error: error.message })

  res.json(data.map(r => r.cadeira))
})

// Chat com streaming (SSE)
app.post('/api/chat', async (req, res) => {
  const { faculdade, cadeira, history = [], question } = req.body

  if (!faculdade || !cadeira)
    return res.status(400).json({ error: 'faculdade e cadeira são obrigatórios.' })
  if (!question?.trim())
    return res.status(400).json({ error: 'Pergunta vazia.' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const model  = await getModel(faculdade, cadeira)
    const chat   = model.startChat({ history: toGeminiHistory(history) })
    const result = await chat.sendMessageStream(question)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

// ── Arrancar servidor ──────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => {
  console.log(`\n📚 Tutor de estudo em http://localhost:${PORT}\n`)
})
