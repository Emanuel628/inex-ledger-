import pool from "../db.js";
import { LOGIN_MAX_FAILS, LOGIN_LOCK_MINUTES } from "../config/securityConstants.js";

const makeLockMessage = (unlockAt) => {
  const minutes = Math.ceil((unlockAt - Date.now()) / 60000);
  return {
    code: "ACCOUNT_LOCKED",
    message: `Too many failed attempts. Try again in ${minutes} minute(s).`,
  };
};

export const isAccountLocked = (user) => {
  if (!user) return false;
  if (!user.account_locked_until) return false;
  const lockedUntil = new Date(user.account_locked_until).getTime();
  if (Number.isNaN(lockedUntil)) return false;
  return lockedUntil > Date.now();
};

export const getLockInfo = (user) => {
  if (!isAccountLocked(user)) return null;
  return {
    locked: true,
    unlockAt: new Date(user.account_locked_until),
    reason: makeLockMessage(new Date(user.account_locked_until).getTime()),
  };
};

export const recordFailedLogin = async (userId, currentCount = 0) => {
  const nextCount = currentCount + 1;
  const updates = [nextCount];
  let lockUntil = null;
  if (nextCount >= LOGIN_MAX_FAILS) {
    lockUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
  }
  const query =
    lockUntil !== null
      ? "UPDATE users SET failed_login_attempts = $1, account_locked_until = $2 WHERE id = $3 RETURNING failed_login_attempts, account_locked_until"
      : "UPDATE users SET failed_login_attempts = $1 WHERE id = $2 RETURNING failed_login_attempts, account_locked_until";
  const params = lockUntil !== null ? [nextCount, lockUntil.toISOString(), userId] : [nextCount, userId];
  const { rows } = await pool.query(query, params);
  return rows[0];
};

export const resetLoginAttempts = async (userId) => {
  await pool.query(
    "UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1",
    [userId]
  );
};
