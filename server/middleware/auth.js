import jwt from "jsonwebtoken";
import pool from "../db.js";
import { ACCESS_TOKEN_SECRET } from "../auth/session.js";

const unauthorized = (res, detail = "Missing authentication token") =>
  res.status(401).json({ code: "NOT_AUTHENTICATED", message: detail });

const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  subscriptionStatus: (row.subscription_status || "FREE").toUpperCase(),
  stripeCustomerId: row.stripe_customer_id,
  ecosystemLevel: Number(row.ecosystem_level) || 1,
  momentumStreak: Number(row.momentum_streak) || 0,
  emailVerified: Boolean(row.email_verified),
  mfaEnabled: Boolean(row.mfa_enabled),
  mfa_verified_at: row.mfa_verified_at,
  vaultSalt: row.vault_salt_b64,
  vaultKdf: row.vault_kdf,
});

const extractToken = (req) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return req.cookies?.["__Host-luna_session"] || null;
};

export const ensureAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return unauthorized(res);
  }
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    const { rows } = await pool.query(
      "SELECT id, email, subscription_status, stripe_customer_id, ecosystem_level, momentum_streak, email_verified, mfa_enabled, mfa_verified_at, vault_salt_b64, vault_kdf FROM users WHERE id = $1",
      [payload.sub]
    );
    if (!rows.length) {
      return unauthorized(res, "User not found");
    }
    req.user = mapUser(rows[0]);
    next();
  } catch (error) {
    console.error("Authentication failure:", error?.message || error);
    return res.status(401).json({ code: "INVALID_AUTH_TOKEN", message: "Unable to verify credentials" });
  }
};
