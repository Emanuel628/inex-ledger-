-- Adds the Identity silo columns that cache the user's ecosystem momentum.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS ecosystem_level INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS momentum_streak INTEGER NOT NULL DEFAULT 0;
