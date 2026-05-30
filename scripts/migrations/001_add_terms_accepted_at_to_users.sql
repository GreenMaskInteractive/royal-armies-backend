-- NEXUS migration 001 — terms acceptance timestamp
-- Royal Armies production ledger uses `commanders` in db.json (lowdb).
-- Run scripts/migrate-terms-accepted-at.js for the JSON ledger.
--
-- When you migrate to a relational `users` table, apply:

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.terms_accepted_at IS
    'UTC timestamp when the commander accepted the active Terms of Service & Privacy Policy. NULL = must accept before joining an Age.';

-- Optional audit columns (mirrors current NEXUS ledger fields):
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32) NULL;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_terms_accepted_at ON users (terms_accepted_at);
