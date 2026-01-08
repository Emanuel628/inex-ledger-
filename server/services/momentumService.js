import pool from "../db.js";

const normalizeStats = (stats = {}) => ({
  paycheckStreak: Number(stats.paycheckStreak) || 0,
  fortressBalance: Number(stats.fortressBalance) || 0,
  debtActive: Boolean(stats.debtActive),
  isPro: Boolean(stats.isPro),
  savingsRate: Number(stats.savingsRate) || 0,
});

const determineLevel = (stats) => {
  let level = 1;
  if (stats.paycheckStreak >= 1) level = 2;
  if (stats.fortressBalance >= 1000 || stats.debtActive) level = Math.max(level, 3);
  if (stats.isPro && stats.savingsRate > 0) level = 4;
  return level;
};

export const updateEcosystemMomentum = async (userId, vaultStats = {}) => {
  const normalized = normalizeStats(vaultStats);
  const hasPayload = Object.values(vaultStats).some((value) => value !== undefined && value !== null);
  if (!hasPayload) {
    return null;
  }

  const newLevel = determineLevel(normalized);

  const { rows } = await pool.query(
    "SELECT ecosystem_level, momentum_streak FROM users WHERE id = $1",
    [userId]
  );
  const current = rows[0];
  if (current) {
    const currentLevel = Number(current.ecosystem_level) || 1;
    const currentStreak = Number(current.momentum_streak) || 0;
    if (currentLevel === newLevel && currentStreak === normalized.paycheckStreak) {
      return {
        level: newLevel,
        momentumStreak: normalized.paycheckStreak,
      };
    }
  }

  await pool.query(
    "UPDATE users SET ecosystem_level = $1, momentum_streak = $2 WHERE id = $3",
    [newLevel, normalized.paycheckStreak, userId]
  );

  return {
    level: newLevel,
    momentumStreak: normalized.paycheckStreak,
  };
};
