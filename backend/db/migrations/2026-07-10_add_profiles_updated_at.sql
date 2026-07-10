-- profiles_schema.sql already defines an `updated_at` column and a
-- `profiles_updated_at` trigger that writes to it, but the column was
-- never actually created on the live table — every UPDATE to `profiles`
-- (including the Stripe webhook flipping `plan` after a successful
-- payment, and create-checkout saving `stripe_customer_id`) was failing
-- silently with: record "new" has no field "updated_at".
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
