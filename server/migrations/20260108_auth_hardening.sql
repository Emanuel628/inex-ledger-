ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mfa_totp_secret TEXT,
ADD COLUMN IF NOT EXISTS mfa_totp_pending_secret TEXT,
ADD COLUMN IF NOT EXISTS mfa_recovery_codes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mfa_session_token_hash TEXT,
ADD COLUMN IF NOT EXISTS mfa_session_token_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  rotated_from TEXT,
  rotated_to TEXT
);
