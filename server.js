import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'
import { parseDocument, mimeToKind } from './backend/ingestion/parsers/index.js'
import knowledgeRoutes from './backend/routes/knowledge.js'
import { publicAnalyticsRoutes, adminMetricsRoutes } from './backend/routes/analytics.js'
import ingestionV2Routes from './backend/routes/ingestion_v2.js'
import retrievalRoutes from './backend/routes/retrieval.js'
import answeringRoutes from './backend/routes/answering.js'
import feedbackRoutes from './backend/routes/feedback.js'
import chatV2Routes from './backend/routes/chat_v2.js'
import gamificationRoutes from './backend/routes/gamification.js'
import teamRoutes from './backend/routes/team.js'
import { getCourseIdForCadeira } from './backend/services/course_link.js'
import { requireUser } from './backend/middleware/auth.js'

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
  const { curso_id, year } = req.query
  if (!curso_id) return res.status(400).json({ error: 'curso_id em falta.' })
  let q = supabase.from('cadeiras')
    .select('id, nome, year, year_label, semester, semester_label, is_optional, optional_group')
    .eq('curso_id', curso_id).order('semester').order('nome')
  if (year) q = q.eq('year', year)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Real chapters for a cadeira, sourced from its linked v2 course's ingested
// material. Read-only — never creates a course link, so a cadeira with
// nothing ingested yet gets an honest empty result instead of a fake one.
app.get('/api/cadeiras/:id/chapters', async (req, res) => {
  const courseId = await getCourseIdForCadeira(req.params.id, supabaseAdmin)
  if (!courseId) return res.json({ chapters: [], has_material: false })

  const { data: docs } = await supabaseAdmin.from('documents').select('id').eq('course_id', courseId)
  if (!docs?.length) return res.json({ chapters: [], has_material: false })

  const { data: versions } = await supabaseAdmin.from('document_versions')
    .select('id').in('document_id', docs.map(d => d.id)).eq('is_active', true)
  if (!versions?.length) return res.json({ chapters: [], has_material: false })

  const { data: chapters, error } = await supabaseAdmin.from('chapters')
    .select('id, chapter_no, title, summary')
    .in('document_version_id', versions.map(v => v.id))
    .order('chapter_no')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ chapters: chapters ?? [], has_material: (chapters?.length ?? 0) > 0 })
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

// ── Admin: extrair texto de um ficheiro carregado (PDF/DOCX/TXT) ─────────────
app.post('/admin/api/extract-text', requireAdmin, async (req, res) => {
  const { base64, mimeType, filename } = req.body
  if (!base64) return res.status(400).json({ error: 'Ficheiro em falta.' })

  const sourceKind = mimeToKind(mimeType, filename)
  if (!sourceKind) return res.status(400).json({ error: `Tipo de ficheiro não suportado: ${filename}` })

  let buffer
  try { buffer = Buffer.from(base64, 'base64') }
  catch { return res.status(400).json({ error: 'base64 inválido.' }) }

  try {
    const result = await parseDocument(buffer, sourceKind)
    res.json({ text: result.markdown })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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
  let q = supabaseAdmin.from('cadeiras')
    .select('id, nome, conteudo, ficheiros, curso_id, year, year_label, semester, semester_label, is_optional, optional_group')
    .order('nome')
  if (req.query.curso_id) q = q.eq('curso_id', req.query.curso_id)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/admin/api/cadeiras', requireAdmin, async (req, res) => {
  const { curso_id, nome, ficheiros = [], year, year_label, semester, semester_label, is_optional, optional_group } = req.body
  const { data, error } = await supabaseAdmin.from('cadeiras')
    .insert({ curso_id, nome, ficheiros, year, year_label, semester, semester_label, is_optional, optional_group })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.put('/admin/api/cadeiras/:id', requireAdmin, async (req, res) => {
  const { curso_id, nome, ficheiros, year, year_label, semester, semester_label, is_optional, optional_group } = req.body

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

  const update = {
    curso_id, nome,
    ...(ficheiros !== undefined && { ficheiros }),
    ...(year !== undefined && { year }),
    ...(year_label !== undefined && { year_label }),
    ...(semester !== undefined && { semester }),
    ...(semester_label !== undefined && { semester_label }),
    ...(is_optional !== undefined && { is_optional }),
    ...(optional_group !== undefined && { optional_group }),
  }
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
app.use('/api/v2', chatV2Routes({ supabase, supabaseAdmin, genai }))
// Admin-only answer logs
app.use('/admin/api/v2', requireAdmin, answeringRoutes({ supabase, supabaseAdmin, genai }))

// ── Metrics dashboard (admin) ─────────────────────────────────────────────────
app.use('/admin/api/metrics', requireAdmin, adminMetricsRoutes(supabaseAdmin))

// ── Gamification (buddies/XP/quiz) — server-validated, requires real auth ────
app.use('/api/gamification', requireUser(supabase), gamificationRoutes({ supabase, supabaseAdmin, genai }))

// ── Team plan — mixed auth: the invitation-lookup route is public (an
// invitee needs to see "you've been invited" before logging in), every
// other route requires a verified session (enforced inside teamRoutes).
app.use('/api/team', teamRoutes({ supabase, supabaseAdmin }))

// ── Fallback SPA ──────────────────────────────────────────────────────────────
// Only unmatched *page* routes fall back to index.html. Requests for missing
// static assets (e.g. a JS chunk from a previous deploy that a stale cached
// index.html still references) must 404 instead of getting HTML back —
// otherwise the browser rejects it with a MIME-type error and the page stays blank.
app.get('*', (req, res) => {
  if (req.path.startsWith('/assets/') || /\.[a-zA-Z0-9]+$/.test(req.path)) {
    return res.status(404).end()
  }
  res.setHeader('Cache-Control', 'no-store')
  res.sendFile(join(__dirname, 'aulaiq', 'dist', 'index.html'))
})

// ── Arrancar (apenas local; na Vercel é serverless) ───────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT ?? 3000
  app.listen(PORT, () => console.log(`\n📚 Tutor: http://localhost:${PORT}\n🔧 Admin: http://localhost:${PORT}/admin\n`))
}

export default app
