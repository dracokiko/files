import express from 'express'

// Public routes — event ingestion (no admin auth required)
export function publicAnalyticsRoutes(supabase) {
  const router = express.Router()

  // POST /api/events — called from the frontend to track any event
  router.post('/events', async (req, res) => {
    const {
      tipo, user_id, anonymous_id,
      cadeira_id, curso_id, faculdade_id, plano,
      page_url, referrer, utm_source, utm_medium, utm_campaign,
      metadata,
    } = req.body
    if (!tipo) return res.status(400).json({ error: 'tipo em falta.' })

    const { error } = await supabase.from('eventos').insert({
      tipo, user_id, anonymous_id,
      cadeira_id, curso_id, faculdade_id, plano,
      page_url, referrer, utm_source, utm_medium, utm_campaign,
      metadata, timestamp: new Date().toISOString(),
    })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  return router
}

// Admin routes — metrics queries (mount behind requireAdmin in server.js)
export function adminMetricsRoutes(supabaseAdmin) {
  const router = express.Router()

  // GET /admin/api/metrics/overview — aggregate counts for the dashboard header
  router.get('/overview', async (req, res) => {
    const [matResult, chatCountResult, evtCountResult] = await Promise.all([
      supabaseAdmin.from('materiais').select('status'),
      supabaseAdmin.from('eventos').select('id', { count: 'exact', head: true }).eq('tipo', 'chat_message_sent'),
      supabaseAdmin.from('eventos').select('id', { count: 'exact', head: true }),
    ])

    const mats = matResult.data || []
    res.json({
      materiais_total: mats.length,
      materiais_processados: mats.filter(m => m.status === 'completed').length,
      materiais_pendentes: mats.filter(m => m.status === 'processing' || m.status === 'pending').length,
      materiais_erro: mats.filter(m => m.status === 'failed').length,
      chat_mensagens: chatCountResult.count || 0,
      eventos_total: evtCountResult.count || 0,
    })
  })

  // GET /admin/api/metrics/chat — top cadeiras ranked by number of chat messages
  router.get('/chat', async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('eventos')
      .select('cadeira_id, cadeiras(nome)')
      .eq('tipo', 'chat_message_sent')
      .limit(2000)
    if (error) return res.status(500).json({ error: error.message })

    const counts = {}
    for (const evt of data || []) {
      const key = evt.cadeira_id || '_unknown'
      if (!counts[key]) {
        counts[key] = { cadeira_id: key, nome: evt.cadeiras?.nome || '(sem cadeira)', mensagens: 0 }
      }
      counts[key].mensagens++
    }
    res.json(Object.values(counts).sort((a, b) => b.mensagens - a.mensagens).slice(0, 20))
  })

  // GET /admin/api/metrics/events — paginated recent event log
  router.get('/events', async (req, res) => {
    const { limit = 50, tipo } = req.query
    let q = supabaseAdmin
      .from('eventos')
      .select('id, tipo, timestamp, cadeiras(nome), plano, utm_source, utm_campaign, metadata')
      .order('timestamp', { ascending: false })
      .limit(Number(limit))
    if (tipo) q = q.eq('tipo', tipo)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json(data || [])
  })

  return router
}
