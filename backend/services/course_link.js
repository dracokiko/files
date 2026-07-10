/**
 * Resolves a v1 `cadeira_id` to its linked v2 `courses.id`.
 *
 * v2 ingestion/retrieval/answering is keyed on `courses.id`, which carries an
 * optional `cadeira_id` FK back to the v1 `cadeiras` table. Nothing creates
 * that link automatically except this module.
 */

// Read-only — never creates a row. Use anywhere an honest "no material yet"
// response is correct (e.g. listing chapters, generating a quiz).
export async function getCourseIdForCadeira(cadeiraId, supabase) {
  if (!cadeiraId) return null
  const { data } = await supabase.from('courses').select('id').eq('cadeira_id', cadeiraId).maybeSingle()
  return data?.id ?? null
}

// Lazily creates a `courses` row linked to this cadeira if none exists yet.
// Use ONLY from the chat endpoint: this turns "cadeira not wired to v2 yet"
// into a graceful zero-results answer instead of a hard error, with no
// manual admin step required first.
export async function getOrCreateCourseIdForCadeira(cadeiraId, supabaseAdmin) {
  const existing = await getCourseIdForCadeira(cadeiraId, supabaseAdmin)
  if (existing) return existing

  const { data: cadeira, error: cErr } = await supabaseAdmin
    .from('cadeiras').select('id, nome').eq('id', cadeiraId).single()
  if (cErr || !cadeira) return null

  const { data: created, error } = await supabaseAdmin
    .from('courses')
    .insert({ code: `cadeira-${cadeiraId}`, title: cadeira.nome, lang_code: 'pt-PT', cadeira_id: cadeiraId })
    .select('id').single()
  if (error) {
    // Race with a concurrent request that just created it — look it up again.
    return getCourseIdForCadeira(cadeiraId, supabaseAdmin)
  }
  return created.id
}
