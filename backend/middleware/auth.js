/**
 * Verifies a Supabase session JWT server-side so gamification routes can
 * trust `req.userId` instead of a client-supplied field. Every `user_id` in
 * this codebase was previously untrusted client input — this is the first
 * route-level check against the real Supabase Auth session.
 */
export function requireUser(supabase) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Autenticação necessária.' })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return res.status(401).json({ error: 'Sessão inválida.' })

    req.userId = data.user.id
    next()
  }
}
