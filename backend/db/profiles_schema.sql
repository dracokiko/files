-- ============================================================
-- AulaIQ — Tabela de perfis de utilizadores
-- Colar no Supabase: Dashboard → SQL Editor → New Query → Run
-- As passwords são geridas pelo Supabase Auth (bcrypt hash automático)
-- ============================================================

-- Tabela de perfis (ligada ao auth.users do Supabase)
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  email            TEXT         NOT NULL,
  institution      TEXT         NOT NULL,
  institution_id   TEXT         NOT NULL,
  course           TEXT         NOT NULL,
  course_id        TEXT         NOT NULL,
  year             INTEGER      NOT NULL,
  year_label       TEXT         NOT NULL,
  plan             TEXT         NOT NULL DEFAULT 'free'
                                CHECK (plan IN ('free', 'trial', 'monthly', 'semester')),
  preferences      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_plan  ON profiles(plan);

-- ── Row Level Security (RLS) ─────────────────────────────────
-- Cada utilizador só vê e edita o seu próprio perfil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilizador vê o seu perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Utilizador atualiza o seu perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Utilizador insere o seu perfil"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── Trigger: atualiza updated_at automaticamente ─────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
