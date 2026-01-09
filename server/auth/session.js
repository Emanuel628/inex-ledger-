import crypto from "crypto";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { SESSION_TTL_MINUTES, REFRESH_TTL_DAYS } from "../config/securityConstants.js";

export const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || "luna_jwt_secret";
const REFRESH_TOKEN_BYTES = 48;

const generateId = () => crypto.randomUUID();
const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
const buildRefreshToken = (id, raw) => `${id}.${raw}`;

export const issueAccessToken = (user) => {
  const payload = { sub: user.id, email: user.email };
  const expiresIn = `${SESSION_TTL_MINUTES}m`;
  const token = jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn });
  return { token, expiresIn: SESSION_TTL_MINUTES * 60 };
};

export const issueRefreshToken = async (userId, { parentId = null } = {}) => {
  const raw = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const hashed = hashToken(raw);
  const id = generateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, rotated_from) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, userId, hashed, expiresAt.toISOString(), now.toISOString(), parentId]
  );
  return {
    token: buildRefreshToken(id, raw),
    id,
    expiresAt,
  };
};

export const parseRefreshToken = (value) => {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  return { id: parts[0], raw: parts[1] };
};

export const verifyRefreshToken = async (value) => {
  const parsed = parseRefreshToken(value);
  if (!parsed) return null;
  const { rows } = await pool.query("SELECT * FROM refresh_tokens WHERE id = $1", [parsed.id]);
  const record = rows[0];
  if (!record) return null;
  if (record.revoked_at) return null;
  if (new Date(record.expires_at) < new Date()) return null;
  if (hashToken(parsed.raw) !== record.token_hash) return null;
  return record;
};

export const rotateRefreshToken = async (value) => {
  const parsed = parseRefreshToken(value);
  if (!parsed) {
    return null;
  }
  const { rows } = await pool.query("SELECT * FROM refresh_tokens WHERE id = $1", [parsed.id]);
  const record = rows[0];
  if (!record) {
    return null;
  }
  if (new Date(record.expires_at) < new Date()) {
    return null;
  }
  if (hashToken(parsed.raw) !== record.token_hash) {
    return null;
  }
  if (record.revoked_at || record.rotated_to) {
    await revokeAllSessions(record.user_id);
    throw new Error("REFRESH_TOKEN_REUSED");
  }
  const nextToken = await issueRefreshToken(record.user_id, { parentId: record.id });
  await pool.query("UPDATE refresh_tokens SET revoked_at = $1, rotated_to = $2 WHERE id = $3", [
    new Date().toISOString(),
    nextToken.id,
    record.id,
  ]);
  return nextToken;
};

export const revokeRefreshToken = async (value) => {
  const parsed = parseRefreshToken(value);
  if (!parsed) return;
  await pool.query("UPDATE refresh_tokens SET revoked_at = $1 WHERE id = $2", [
    new Date().toISOString(),
    parsed.id,
  ]);
};

export const revokeAllSessions = async (userId) => {
  await pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1", [userId]);
};
