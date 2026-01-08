import crypto from "crypto";
import pool from "../db.js";

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "demo-user";

const getUserIdFromRequest = (req) => {
  return (
    req.headers["x-user-id"] ||
    req.headers["x-luna-user"] ||
    req.query.userId ||
    req.body?.userId ||
    DEFAULT_USER_ID
  );
};

const toBuffer = (value) => {
  if (!value) return Buffer.from("");
  return Buffer.from(String(value));
};

const safeEquals = (left, right) => {
  const leftBuf = toBuffer(left);
  const rightBuf = toBuffer(right);
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

export const ensureAuth = async (req, res, next) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Missing user identifier" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, email, subscription_status, stripe_customer_id, ecosystem_level, momentum_streak FROM users WHERE id = $1",
      [userId]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = rows[0];
    if (!safeEquals(userId, user.id)) {
      return res.status(401).json({ error: "User identifier mismatch" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      subscriptionStatus: (user.subscription_status || "FREE").toUpperCase(),
      stripeCustomerId: user.stripe_customer_id,
      ecosystemLevel: Number(user.ecosystem_level) || 1,
      momentumStreak: Number(user.momentum_streak) || 0,
    };
    next();
  } catch (error) {
    console.error("Auth middleware failed", error);
    res.status(500).json({ error: "Unable to verify identity" });
  }
};
