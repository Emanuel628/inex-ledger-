ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_required_for_sensitive BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_mfa_verified_at ON users (mfa_verified_at);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  label TEXT,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_user_device ON trusted_devices (user_id, device_hash);
