import express from 'express'
import { processarMaterial, buildKnowledgeContext } from '../helpers/ingestion.js'

// Factory: returns an Express router for knowledge ingestion.
// Mount at /admin/api/knowledge (already behind requireAdmin middleware in server.js).
export default function knowledgeRoutes({ supabaseAdmin, genai }) {
  const router = express.Router()

  // List materials — optional ?cadeira_id and ?status filters
  router.get('/', async (req, res) => {
    const { cadeira_id, status } = req.query
    let q = supabaseAdmin
      .from('materiais')
      .select('id, nome, modulo, ano_letivo, plano, status, erro, created_at, cadeira_id, cadeiras(nome)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (cadeira_id) q = q.eq('cadeira_id', cadeira_id)
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json(data || [])
  })

  // Get one material (includes full processado JSON)
  router.get('/:id', async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('materiais')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error || !data) return res.status(404).json({ error: 'Material não encontrado.' })
    res.json(data)
  })

  // Submit new material for AI processing.
  // Returns {id, status: 'processing'} immediately; processing runs in background.
  router.post('/process', async (req, res) => {
    const { cadeira_id, nome, modulo, ano_letivo, plano = 'free', texto } = req.body
    if (!cadeira_id) return res.status(400).json({ error: 'cadeira_id em falta.' })
    if (!texto?.trim()) return res.status(400).json({ error: 'Texto em falta.' })

    const { data: material, error: insertErr } = await supabaseAdmin
      .from('materiais')
      .insert({ cadeira_id, nome: nome || 'Material', modulo, ano_letivo, plano, status: 'processing', raw_texto: texto })
      .select()
      .single()
    if (insertErr) return res.status(500).json({ error: insertErr.message })

    res.json({ id: material.id, status: 'processing' })

    // Fire-and-forget — runs after response is sent
    _runProcessing({ material, cadeira_id, texto, supabaseAdmin, genai }).catch(() => {})
  })

  // Reprocess an existing material using its saved raw_texto
  router.post('/:id/reprocess', async (req, res) => {
    const { data: material, error } = await supabaseAdmin
      .from('materiais').select('*').eq('id', req.params.id).single()
    if (error || !material) return res.status(404).json({ error: 'Material não encontrado.' })
    if (!material.raw_texto) return res.status(400).json({ error: 'Texto original não disponível para reprocessamento.' })

    await supabaseAdmin.from('materiais').update({ status: 'processing', erro: null }).eq('id', req.params.id)
    res.json({ id: material.id, status: 'processing' })

    _runProcessing({ material, cadeira_id: material.cadeira_id, texto: material.raw_texto, supabaseAdmin, genai }).catch(() => {})
  })

  // Delete a material
  router.delete('/:id', async (req, res) => {
    const { error } = await supabaseAdmin.from('materiais').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  return router
}

// Runs the Gemini processing pipeline and updates the DB.
// Also appends the structured knowledge to cadeira.conteudo so the chatbot picks it up.
async function _runProcessing({ material, cadeira_id, texto, supabaseAdmin, genai }) {
  try {
    const { data: cadeira } = await supabaseAdmin
      .from('cadeiras')
      .select('nome, conteudo, cursos(nome, faculdades(nome))')
      .eq('id', cadeira_id)
      .single()

    const contexto = {
      cadeira: cadeira?.nome || '',
      curso: cadeira?.cursos?.nome || '',
      faculdade: cadeira?.cursos?.faculdades?.nome || '',
      modulo: material.modulo,
      ano_letivo: material.ano_letivo,
    }

    const processado = await processarMaterial({ texto, contexto, materialId: material.id, genai })

    // Build a structured text block from the AI output and append to cadeira.conteudo
    const knowledgeBlock = buildKnowledgeContext(processado, cadeira?.nome)
    const novoConteudo = cadeira?.conteudo
      ? `${cadeira.conteudo}\n\n${knowledgeBlock}`
      : knowledgeBlock

    await Promise.all([
      supabaseAdmin.from('cadeiras').update({ conteudo: novoConteudo }).eq('id', cadeira_id),
      supabaseAdmin.from('materiais').update({
        status: 'completed', processado, updated_at: new Date().toISOString(),
      }).eq('id', material.id),
    ])

  } catch (err) {
    await supabaseAdmin.from('materiais').update({
      status: 'failed', erro: err.message, updated_at: new Date().toISOString(),
    }).eq('id', material.id)
  }
}
