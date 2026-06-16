-- ============================================================
-- AulaIQ — Database schema additions
-- Run this in the Supabase SQL editor:
-- Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- Tracks uploaded materials and their AI-processed output per cadeira
CREATE TABLE IF NOT EXISTS materiais (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cadeira_id   UUID         REFERENCES cadeiras(id) ON DELETE CASCADE,
  nome         TEXT         NOT NULL DEFAULT 'Material',
  modulo       TEXT,                          -- chapter or module label
  ano_letivo   TEXT,                          -- e.g. '2024/2025'
  plano        TEXT         NOT NULL DEFAULT 'free' CHECK (plano IN ('free', 'medium', 'high')),
  tipo         TEXT,                          -- pdf | docx | txt | texto
  status       TEXT         NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  erro         TEXT,                          -- error message when status = 'failed'
  raw_texto    TEXT,                          -- original extracted text (kept for reprocessing)
  processado   JSONB,                         -- structured AI output (summary, QA, concepts…)
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Tracks analytics events from the platform (visits, chat, purchases, etc.)
CREATE TABLE IF NOT EXISTS eventos (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT         NOT NULL,        -- event type (see list below)
  user_id       TEXT,                         -- logged-in user identifier
  anonymous_id  TEXT,                         -- client-generated UUID for anonymous sessions
  timestamp     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  cadeira_id    UUID         REFERENCES cadeiras(id)   ON DELETE SET NULL,
  curso_id      UUID         REFERENCES cursos(id)     ON DELETE SET NULL,
  faculdade_id  UUID         REFERENCES faculdades(id) ON DELETE SET NULL,
  plano         TEXT,                         -- free | medium | high
  page_url      TEXT,
  referrer      TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  metadata      JSONB                         -- any extra key-value data
);

-- Indexes for common analytics query patterns
CREATE INDEX IF NOT EXISTS idx_eventos_tipo      ON eventos(tipo);
CREATE INDEX IF NOT EXISTS idx_eventos_timestamp ON eventos(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_cadeira   ON eventos(cadeira_id);
CREATE INDEX IF NOT EXISTS idx_materiais_cadeira ON materiais(cadeira_id);
CREATE INDEX IF NOT EXISTS idx_materiais_status  ON materiais(status);

-- ── Event type reference ─────────────────────────────────────────────────────
-- page_view              — any page visited
-- chatbot_opened         — user opened the tutor chat
-- chat_message_sent      — user sent a message to the chatbot
-- signup_started         — user opened the registration flow
-- signup_completed       — user completed registration
-- login                  — user logged in
-- logout                 — user logged out
-- checkout_started       — user started the payment flow
-- purchase_completed     — payment succeeded
-- payment_failed         — payment failed
-- subscription_started   — new subscription activated
-- subscription_renewed   — subscription auto-renewed
-- subscription_cancelled — subscription cancelled
-- plan_upgraded          — user moved to a higher plan
-- plan_downgraded        — user moved to a lower plan
-- material_uploaded      — admin uploaded a material
-- material_processed     — material finished AI processing
