/**
 * Minimal SMTP mailer for transactional email the app sends itself (team
 * invitations). Password-reset email is handled separately by Supabase
 * Auth's own SMTP config (Dashboard → Authentication → SMTP Settings) —
 * this is for messages Supabase Auth has no concept of.
 *
 * Reuses the same Gmail App Password setup already documented for the
 * password-reset SMTP config: SMTP_USER=keposlearn@gmail.com, SMTP_PASS=
 * the Gmail App Password. If unset, sendMail() no-ops and logs a warning
 * instead of throwing, so invitation creation still succeeds — the admin
 * can "Reenviar" once SMTP is configured.
 */
import nodemailer from 'nodemailer'

let cachedTransport = null
let warned = false

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_USER || !SMTP_PASS) {
    if (!warned) {
      console.warn('[email] SMTP_USER/SMTP_PASS não configurados — emails não serão enviados.')
      warned = true
    }
    return null
  }
  if (cachedTransport) return cachedTransport
  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT) || 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return cachedTransport
}

/** @returns {Promise<boolean>} whether the email was actually sent */
export async function sendMail({ to, subject, html, text }) {
  const transport = getTransport()
  if (!transport) return false

  const fromName = process.env.SMTP_FROM_NAME || 'AulaIQ'
  const fromAddress = process.env.SMTP_USER

  try {
    await transport.sendMail({ from: `"${fromName}" <${fromAddress}>`, to, subject, html, text })
    return true
  } catch (err) {
    console.error('[email] Falha ao enviar email:', err.message)
    return false
  }
}

export function buildTeamInvitationEmail({ teamName, inviterName, inviteUrl }) {
  const subject = `${inviterName} convidou-te para a equipa "${teamName}" no AulaIQ`
  const text = `${inviterName} convidou-te para te juntares à equipa "${teamName}" no AulaIQ.\n\n` +
    `Aceita o convite aqui: ${inviteUrl}\n\nEste convite expira em 7 dias.`
  const html = `
    <p>${inviterName} convidou-te para te juntares à equipa <strong>${teamName}</strong> no AulaIQ.</p>
    <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;
       border-radius:10px;text-decoration:none;font-weight:600;">Aceitar convite</a></p>
    <p style="color:#6b7280;font-size:13px;">Este convite expira em 7 dias. Se não esperavas este email, ignora-o.</p>
  `
  return { subject, text, html }
}
