import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import knowledgeRoutes from './backend/routes/knowledge.js'
import { publicAnalyticsRoutes, adminMetricsRoutes } from './backend/routes/analytics.js'
import ingestionV2Routes from './backend/routes/ingestion_v2.js'
import retrievalRoutes from './backend/routes/retrieval.js'
import answeringRoutes from './backend/routes/answering.js'
import feedbackRoutes from './backend/routes/feedback.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '50mb' }))

// Subdomain routing: admin.keposlearn.com → /admin
app.use((req, _res, next) => {
  const host = req.headers.host || ''
  if (host.startsWith('admin.') && !req.path.startsWith('/admin')) {
    req.url = '/admin' + (req.url === '/' ? '' : req.url)
  }
  next()
})

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
function buildSystemInstruction(textMaterial) {
  const base = `Tu és um tutor de estudo dedicado e paciente. O teu único objetivo
é ajudar o aluno a compreender a matéria fornecida nos documentos/resumos.

REGRAS RÍGIDAS:
1. Responde EXCLUSIVAMENTE com base no material fornecido (documentos, resumos, imagens de apontamentos).
2. Se a pergunta não puder ser respondida com o material, recusa educadamente.
3. Não inventes factos, datas, fórmulas ou exemplos que não estejam no material.
4. Sê claro, didático e encorajador.
5. Responde sempre em português de Portugal.`

  if (!textMaterial) return base
  return `${base}\n\n=================== APONTAMENTOS ===================\n${textMaterial}\n====================================================`
}

function toGeminiHistory(messages) {
  return messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
}

const tutorModel = genai.getGenerativeModel({
  model: 'gemini-flash-lite-latest',
  systemInstruction: buildSystemInstruction(),
})

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

// Resolves a cadeira by name so the frontend chatbot can find the right knowledge base.
// Used by TutorIA to connect frontend subject IDs to Supabase cadeira UUIDs.
app.get('/api/cadeiras/lookup', async (req, res) => {
  const { nome, curso } = req.query
  if (!nome) return res.status(400).json({ error: 'nome em falta.' })
  const { data, error } = await supabase
    .from('cadeiras')
    .select('id, nome, curso_id, cursos(nome)')
    .ilike('nome', `%${nome}%`)
    .limit(5)
  if (error) return res.status(500).json({ error: error.message })
  if (!data?.length) return res.status(404).json({ error: 'Cadeira não encontrada.' })
  const match = curso
    ? data.find(c => c.cursos?.nome?.toLowerCase().includes(curso.toLowerCase())) ?? data[0]
    : data[0]
  res.json(match)
})

// ── Public analytics event tracking ──────────────────────────────────────────
app.use('/api', publicAnalyticsRoutes(supabase))

app.post('/api/chat', async (req, res) => {
  const { cadeira_id, history = [], question } = req.body
  if (!cadeira_id) return res.status(400).json({ error: 'cadeira_id em falta.' })
  if (!question?.trim()) return res.status(400).json({ error: 'Pergunta vazia.' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Track chat event asynchronously (don't block the stream)
  supabase.from('eventos').insert({ tipo: 'chat_message_sent', cadeira_id, timestamp: new Date().toISOString() }).then(() => {})

  try {
    const { data: cadeira, error: cErr } = await supabase
      .from('cadeiras')
      .select('conteudo, ficheiros')
      .eq('id', cadeira_id)
      .single()
    if (cErr || !cadeira) throw new Error('Cadeira não encontrada.')

    // Descarregar ficheiros e converter para inline data
    const ficheiros = cadeira.ficheiros || []
    const fileParts = []
    for (const f of ficheiros) {
      try {
        const resp = await fetch(f.url)
        const buf  = Buffer.from(await resp.arrayBuffer())
        fileParts.push({ inlineData: { mimeType: f.tipo, data: buf.toString('base64') } })
      } catch { /* ignorar ficheiro se falhar o download */ }
    }

    let model, questionParts
    if (fileParts.length > 0) {
      // Modo multimodal: Gemini lê os ficheiros diretamente
      model = tutorModel
      questionParts = [...fileParts, { text: question }]
    } else {
      // Fallback para cadeiras antigas com conteudo em texto
      model = genai.getGenerativeModel({
        model: 'gemini-flash-lite-latest',
        systemInstruction: buildSystemInstruction(cadeira.conteudo || '(sem material disponível)'),
      })
      questionParts = question
    }

    const chat   = model.startChat({ history: toGeminiHistory(history) })
    const result = await chat.sendMessageStream(questionParts)
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

// ── Admin: upload de imagem (faculdades/cursos) ───────────────────────────────
app.post('/admin/api/upload', requireAdmin, async (req, res) => {
  const { base64, filename, mimeType } = req.body
  if (!base64) return res.status(400).json({ error: 'Ficheiro em falta.' })
  const buffer   = Buffer.from(base64, 'base64')
  const path     = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { data, error } = await supabaseAdmin.storage.from('imagens').upload(path, buffer, { contentType: mimeType, upsert: true })
  if (error) return res.status(500).json({ error: error.message })
  const { data: urlData } = supabaseAdmin.storage.from('imagens').getPublicUrl(data.path)
  res.json({ url: urlData.publicUrl })
})

// ── Admin: upload de resumo (PDFs e imagens para cadeiras) ───────────────────
app.post('/admin/api/upload-resumo', requireAdmin, async (req, res) => {
  const { base64, filename, mimeType } = req.body
  if (!base64) return res.status(400).json({ error: 'Ficheiro em falta.' })
  const buffer   = Buffer.from(base64, 'base64')
  const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { data, error } = await supabaseAdmin.storage.from('resumos').upload(safeName, buffer, { contentType: mimeType, upsert: true })
  if (error) return res.status(500).json({ error: error.message })
  const { data: urlData } = supabaseAdmin.storage.from('resumos').getPublicUrl(data.path)
  res.json({ url: urlData.publicUrl, nome: filename, tipo: mimeType, tamanho: buffer.length })
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
  res.json({ ok: true })
})

// ── Admin: cadeiras CRUD ──────────────────────────────────────────────────────
app.get('/admin/api/cadeiras', requireAdmin, async (req, res) => {
  let q = supabaseAdmin.from('cadeiras').select('id, nome, conteudo, ficheiros, curso_id').order('nome')
  if (req.query.curso_id) q = q.eq('curso_id', req.query.curso_id)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/admin/api/cadeiras', requireAdmin, async (req, res) => {
  const { curso_id, nome, ficheiros = [] } = req.body
  const { data, error } = await supabaseAdmin.from('cadeiras').insert({ curso_id, nome, ficheiros }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.put('/admin/api/cadeiras/:id', requireAdmin, async (req, res) => {
  const { curso_id, nome, ficheiros } = req.body

  // Apagar do Storage os ficheiros que foram removidos
  if (ficheiros !== undefined) {
    const { data: old } = await supabaseAdmin.from('cadeiras').select('ficheiros').eq('id', req.params.id).single()
    if (old?.ficheiros?.length) {
      const keptUrls = new Set((ficheiros || []).map(f => f.url))
      const toRemove = old.ficheiros
        .filter(f => !keptUrls.has(f.url))
        .map(f => { const p = f.url.split('/resumos/'); return p.length > 1 ? p[1] : null })
        .filter(Boolean)
      if (toRemove.length) await supabaseAdmin.storage.from('resumos').remove(toRemove)
    }
  }

  const update = { curso_id, nome, ...(ficheiros !== undefined && { ficheiros }) }
  const { data, error } = await supabaseAdmin.from('cadeiras').update(update).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.delete('/admin/api/cadeiras/:id', requireAdmin, async (req, res) => {
  // Apagar ficheiros do Storage antes de apagar a cadeira
  const { data: cadeira } = await supabaseAdmin.from('cadeiras').select('ficheiros').eq('id', req.params.id).single()
  if (cadeira?.ficheiros?.length) {
    const paths = cadeira.ficheiros
      .map(f => { const p = f.url.split('/resumos/'); return p.length > 1 ? p[1] : null })
      .filter(Boolean)
    if (paths.length) await supabaseAdmin.storage.from('resumos').remove(paths)
  }
  const { error } = await supabaseAdmin.from('cadeiras').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── Knowledge ingestion (admin) ───────────────────────────────────────────────
app.use('/admin/api/knowledge', requireAdmin, knowledgeRoutes({ supabaseAdmin, genai }))

// ── Knowledge Graph v2: ingestion (admin) + retrieval + answering ─────────────
app.use('/admin/api/v2', requireAdmin, ingestionV2Routes({ supabaseAdmin, genai }))
app.use('/api/v2', retrievalRoutes({ supabase, supabaseAdmin }))
app.use('/api/v2', answeringRoutes({ supabase, supabaseAdmin, genai }))
app.use('/api/v2', feedbackRoutes({ supabase, supabaseAdmin }))
// Admin-only answer logs
app.use('/admin/api/v2', requireAdmin, answeringRoutes({ supabase, supabaseAdmin, genai }))

// ── Metrics dashboard (admin) ─────────────────────────────────────────────────
app.use('/admin/api/metrics', requireAdmin, adminMetricsRoutes(supabaseAdmin))

// ── Fallback SPA ──────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'aulaiq', 'dist', 'index.html')))

// ── Arrancar (apenas local; na Vercel é serverless) ───────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT ?? 3000
  app.listen(PORT, () => console.log(`\n📚 Tutor: http://localhost:${PORT}\n🔧 Admin: http://localhost:${PORT}/admin\n`))
}

export default app
