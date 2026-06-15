import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '20mb' }))
app.use(express.static(join(__dirname, 'aulaiq', 'dist')))

// ── Variáveis de ambiente ─────────────────────────────────────────────────────
const { GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD } = process.env
const missing = ['GEMINI_API_KEY','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_PASSWORD']
  .filter(k => !process.env[k])
if (missing.length) { console.error(`Falta no .env: ${missing.join(', ')}`); process.exit(1) }

// ── Clientes ──────────────────────────────────────────────────────────────────
const genai         = new GoogleGenerativeAI(GEMINI_API_KEY)
const supabase      = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── Middleware de admin ───────────────────────────────────────────────────────
function getAdminCookie(req) {
  const entry = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('admin_session='))
  return entry ? decodeURIComponent(entry.slice('admin_session='.length)) : ''
}

function requireAdmin(req, res, next) {
  if (getAdminCookie(req) !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }
  next()
}

// ── Gemini ────────────────────────────────────────────────────────────────────
function buildSystemInstruction(material) {
  return `Tu és um tutor de estudo dedicado e paciente. O teu único objetivo
é ajudar o aluno a compreender a matéria que se encontra nos APONTAMENTOS abaixo.

=================== APONTAMENTOS ===================
${material}
====================================================

REGRAS RÍGIDAS:
1. Responde EXCLUSIVAMENTE com base nos APONTAMENTOS acima.
2. Se a pergunta não puder ser respondida com os APONTAMENTOS, recusa educadamente.
3. Não inventes factos, datas, fórmulas ou exemplos que não estejam nos APONTAMENTOS.
4. Sê claro, didático e encorajador.
5. Responde sempre em português de Portugal.`
}

function toGeminiHistory(messages) {
  return messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
}

const modelCache = new Map()

async function getModel(cadeiraId) {
  if (modelCache.has(cadeiraId)) return modelCache.get(cadeiraId)
  const { data, error } = await supabase.from('cadeiras').select('conteudo').eq('id', cadeiraId).single()
  if (error || !data) throw new Error('Cadeira não encontrada.')
  const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: buildSystemInstruction(data.conteudo) })
  modelCache.set(cadeiraId, model)
  return model
}

// ── Rotas do aluno ────────────────────────────────────────────────────────────
app.get('/api/faculdades', async (_req, res) => {
  const { data, error } = await supabase.from('faculdades').select('id, nome, imagem_url').order('nome')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.get('/api/cursos', async (req, res) => {
  const { faculdade_id } = req.query
  if (!faculdade_id) return res.status(400).json({ error: 'faculdade_id em falta.' })
  const { data, error } = await supabase.from('cursos').select('id, nome, imagem_url').eq('faculdade_id', faculdade_id).order('nome')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.get('/api/cadeiras', async (req, res) => {
  const { curso_id } = req.query
  if (!curso_id) return res.status(400).json({ error: 'curso_id em falta.' })
  const { data, error } = await supabase.from('cadeiras').select('id, nome').eq('curso_id', curso_id).order('nome')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/api/chat', async (req, res) => {
  const { cadeira_id, history = [], question } = req.body
  if (!cadeira_id) return res.status(400).json({ error: 'cadeira_id em falta.' })
  if (!question?.trim()) return res.status(400).json({ error: 'Pergunta vazia.' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const model  = await getModel(cadeira_id)
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

// ── Admin: página ─────────────────────────────────────────────────────────────
app.get('/admin', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.sendFile(join(__dirname, 'aulaiq', 'dist', 'admin.html'))
})

// ── Admin: login / logout ─────────────────────────────────────────────────────
app.post('/admin/api/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Password incorreta.' })
  const secure = process.env.VERCEL ? '; Secure' : ''
  res.setHeader('Set-Cookie', `admin_session=${encodeURIComponent(ADMIN_PASSWORD)}; HttpOnly; SameSite=Strict; Path=/admin${secure}`)
  res.json({ ok: true })
})

app.post('/admin/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0')
  res.json({ ok: true })
})

// ── Admin: upload de imagem ───────────────────────────────────────────────────
app.post('/admin/api/upload', requireAdmin, async (req, res) => {
  const { base64, filename, mimeType } = req.body
  if (!base64) return res.status(400).json({ error: 'Ficheiro em falta.' })
  const buffer = Buffer.from(base64, 'base64')
  const path   = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { data, error } = await supabaseAdmin.storage.from('imagens').upload(path, buffer, { contentType: mimeType, upsert: true })
  if (error) return res.status(500).json({ error: error.message })
  const { data: urlData } = supabaseAdmin.storage.from('imagens').getPublicUrl(data.path)
  res.json({ url: urlData.publicUrl })
})

// ── Admin: faculdades CRUD ────────────────────────────────────────────────────
app.get('/admin/api/faculdades', requireAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('faculdades').select('*').order('nome')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/admin/api/faculdades', requireAdmin, async (req, res) => {
  const { nome, imagem_url } = req.body
  const { data, error } = await supabaseAdmin.from('faculdades').insert({ nome, imagem_url }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.put('/admin/api/faculdades/:id', requireAdmin, async (req, res) => {
  const { nome, imagem_url } = req.body
  const { data, error } = await supabaseAdmin.from('faculdades').update({ nome, imagem_url }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.delete('/admin/api/faculdades/:id', requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('faculdades').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  modelCache.clear()
  res.json({ ok: true })
})

// ── Admin: cursos CRUD ────────────────────────────────────────────────────────
app.get('/admin/api/cursos', requireAdmin, async (req, res) => {
  let q = supabaseAdmin.from('cursos').select('id, nome, imagem_url, faculdade_id').order('nome')
  if (req.query.faculdade_id) q = q.eq('faculdade_id', req.query.faculdade_id)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/admin/api/cursos', requireAdmin, async (req, res) => {
  const { faculdade_id, nome, imagem_url } = req.body
  const { data, error } = await supabaseAdmin.from('cursos').insert({ faculdade_id, nome, imagem_url }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.put('/admin/api/cursos/:id', requireAdmin, async (req, res) => {
  const { faculdade_id, nome, imagem_url } = req.body
  const { data, error } = await supabaseAdmin.from('cursos').update({ faculdade_id, nome, imagem_url }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.delete('/admin/api/cursos/:id', requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('cursos').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  modelCache.clear()
  res.json({ ok: true })
})

// ── Admin: cadeiras CRUD ──────────────────────────────────────────────────────
app.get('/admin/api/cadeiras', requireAdmin, async (req, res) => {
  let q = supabaseAdmin.from('cadeiras').select('id, nome, conteudo, curso_id').order('nome')
  if (req.query.curso_id) q = q.eq('curso_id', req.query.curso_id)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/admin/api/cadeiras', requireAdmin, async (req, res) => {
  const { curso_id, nome, conteudo } = req.body
  const { data, error } = await supabaseAdmin.from('cadeiras').insert({ curso_id, nome, conteudo }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.put('/admin/api/cadeiras/:id', requireAdmin, async (req, res) => {
  const { curso_id, nome, conteudo } = req.body
  const { data, error } = await supabaseAdmin.from('cadeiras').update({ curso_id, nome, conteudo }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  modelCache.delete(req.params.id)
  res.json(data)
})

app.delete('/admin/api/cadeiras/:id', requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('cadeiras').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  modelCache.delete(req.params.id)
  res.json({ ok: true })
})

// ── Fallback SPA ──────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'aulaiq', 'dist', 'index.html')))

// ── Arrancar (apenas local; na Vercel é serverless) ───────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT ?? 3000
  app.listen(PORT, () => console.log(`\n📚 Tutor: http://localhost:${PORT}\n🔧 Admin: http://localhost:${PORT}/admin\n`))
}

export default app
