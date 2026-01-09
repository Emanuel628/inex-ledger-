ALTER TABLE users
  ADD COLUMN IF NOT EXISTS vault_salt_b64 TEXT,
  ADD COLUMN IF NOT EXISTS vault_kdf TEXT NOT NULL DEFAULT 'argon2id';

CREATE INDEX IF NOT EXISTS idx_users_vault_kdf ON users (vault_kdf);

CREATE TABLE IF NOT EXISTS vault_backups (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  envelope JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_backups_user_id ON vault_backups (user_id);
