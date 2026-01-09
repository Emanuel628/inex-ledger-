import crypto from "crypto";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { validatePassword } from "../security/passwordPolicy.js";
import {
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllSessions,
} from "../auth/session.js";
import { RateLimiter } from "../services/rateLimitStore.js";
import { logSecurityEvent } from "../services/securityLogger.js";
import {
  recordFailedLogin,
  resetLoginAttempts,
  isAccountLocked,
  getLockInfo,
} from "../middleware/loginLockout.js";
import {
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
  REFRESH_TTL_DAYS,
  RESET_MAX_PER_HOUR,
  VERIFY_MAX_PER_HOUR,
  MFA_VERIFY_RATE_LIMIT_MAX,
  MFA_VERIFY_RATE_LIMIT_WINDOW_MS,
  TRUSTED_DEVICE_TTL_DAYS,
  TRUSTED_DEVICE_COOKIE,
  VAULT_SALT_BYTES,
  VAULT_KDF_DEFAULT,
} from "../config/securityConstants.js";
import { encryptToken, decryptToken } from "../services/encryptionService.js";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const REFRESH_COOKIE_NAME = "__Host-luna_session";
const MFA_SESSION_TTL_MINUTES = 5;
const TRUSTED_DEVICE_SECRET = process.env.TRUSTED_DEVICE_SECRET || "luna_trusted_device_secret";
const TRUSTED_DEVICE_TTL_MS = TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000;

const generateVaultSalt = () => crypto.randomBytes(VAULT_SALT_BYTES).toString("base64");

const ensureVaultSaltRecord = async (userRow) => {
  if (!userRow) {
    return { vaultSalt: null, vaultKdf: VAULT_KDF_DEFAULT };
  }
  const existingSalt = userRow.vault_salt_b64;
  const existingKdf = userRow.vault_kdf;
  const vaultSalt = existingSalt || generateVaultSalt();
  const vaultKdf = existingKdf || VAULT_KDF_DEFAULT;
  if (!existingSalt || !existingKdf) {
    await pool.query(
      "UPDATE users SET vault_salt_b64 = $1, vault_kdf = $2 WHERE id = $3",
      [vaultSalt, vaultKdf, userRow.id]
    );
  }
  return { vaultSalt, vaultKdf };
};

const passwordResetRequestLimiter = new RateLimiter({
  action: "password_reset_request",
  max: RESET_MAX_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
const passwordResetConfirmLimiter = new RateLimiter({
  action: "password_reset_confirm",
  max: RESET_MAX_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
const emailVerifyResendLimiter = new RateLimiter({
  action: "email_verify_resend",
  max: VERIFY_MAX_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
const mfaVerifyLimiter = new RateLimiter({
  action: "mfa_verify",
  max: MFA_VERIFY_RATE_LIMIT_MAX,
  windowMs: MFA_VERIFY_RATE_LIMIT_WINDOW_MS,
});

const normalizeEmail = (value) => (String(value || "").trim().toLowerCase());

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const setRefreshCookie = (res, token) => {
  const maxAgeMs = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeMs,
  });
};

const clearRefreshCookie = (res) => {
  res.cookie(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
};

const setTrustedDeviceCookie = (res, deviceId) => {
  res.cookie(TRUSTED_DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: TRUSTED_DEVICE_TTL_MS,
  });
};

const clearTrustedDeviceCookie = (res) => {
  res.cookie(TRUSTED_DEVICE_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
};

const getTrustedDeviceIdFromRequest = (req) => req.cookies?.[TRUSTED_DEVICE_COOKIE];

const hashTrustedDeviceId = (deviceId) =>
  crypto.createHmac("sha256", TRUSTED_DEVICE_SECRET).update(String(deviceId)).digest("hex");

const findTrustedDevice = async (userId, deviceHash) => {
  if (!userId || !deviceHash) return null;
  const { rows } = await pool.query(
    "SELECT id FROM trusted_devices WHERE user_id = $1 AND device_hash = $2 AND revoked_at IS NULL AND expires_at > NOW()",
    [userId, deviceHash]
  );
  return rows[0] || null;
};

const upsertTrustedDevice = async (userId, deviceId) => {
  if (!userId || !deviceId) return;
  const deviceHash = hashTrustedDeviceId(deviceId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);
  await pool.query(
    `
    INSERT INTO trusted_devices (id, user_id, device_hash, first_seen, last_seen, expires_at)
    VALUES ($1, $2, $3, $4, $4, $5)
    ON CONFLICT (user_id, device_hash)
    DO UPDATE SET last_seen = EXCLUDED.last_seen, expires_at = EXCLUDED.expires_at, revoked_at = NULL
  `,
    [crypto.randomUUID(), userId, deviceHash, now.toISOString(), expiresAt.toISOString()]
  );
};

const markMfaVerified = async (userId) => {
  if (!userId) return;
  await pool.query("UPDATE users SET mfa_verified_at = NOW() WHERE id = $1", [userId]);
};

const verifyMfaCode = async (userRow, code) => {
  if (!userRow || !code) return false;
  const secret = decryptToken(userRow.mfa_totp_secret);
  if (secret && authenticator.check(code, secret)) {
    return true;
  }
  const storedCodes = Array.isArray(userRow.mfa_recovery_codes) ? userRow.mfa_recovery_codes : [];
  if (storedCodes.length) {
    return await consumeRecoveryCode(userRow.id, storedCodes, code);
  }
  return false;
};

const buildAuthPayload = ({ accessToken, accessExpiresIn, refreshToken, userRow }) => ({
  accessToken,
  expiresIn: accessExpiresIn,
  mfaRequired: false,
  refreshToken,
  identity: {
    id: userRow.id,
    email: userRow.email,
    subscriptionStatus: userRow.subscription_status,
    ecosystem_level: Number(userRow.ecosystem_level) || 1,
    ecosystemLevel: Number(userRow.ecosystem_level) || 1,
    momentum_streak: Number(userRow.momentum_streak) || 0,
    momentumStreak: Number(userRow.momentum_streak) || 0,
    emailVerified: Boolean(userRow.email_verified),
    mfaEnabled: Boolean(userRow.mfa_enabled),
    mfaVerifiedAt: userRow.mfa_verified_at,
  },
  vaultSalt: userRow.vault_salt_b64,
  vaultKdf: userRow.vault_kdf || VAULT_KDF_DEFAULT,
});

const respondValidationFailure = (res, validatorResult) => {
  return res.status(422).json({
    code: "WEAK_PASSWORD",
    reasons: validatorResult.reasons.map((reason) => ({
      code: reason.code,
      message: reason.message,
    })),
    hibp: validatorResult.hibp,
  });
};

const findUserByEmail = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE lower(email) = $1",
    [normalized]
  );
  return rows[0] || null;
};

const generateRecoveryCodes = () =>
  Array.from({ length: 8 }, () => crypto.randomBytes(4).toString("hex").toUpperCase());

const persistRecoveryCodes = async (userId, codes) => {
  const hashedCodes = codes.map((code) => hashValue(code));
  await pool.query(
    "UPDATE users SET mfa_recovery_codes = $1 WHERE id = $2",
    [JSON.stringify(hashedCodes), userId]
  );
};

const consumeRecoveryCode = async (userId, storedCodes, code) => {
  const hashedInput = hashValue(code);
  const remaining = storedCodes.filter((item) => item !== hashedInput);
  if (remaining.length === storedCodes.length) {
    return false;
  }
  await pool.query("UPDATE users SET mfa_recovery_codes = $1 WHERE id = $2", [
    JSON.stringify(remaining),
    userId,
  ]);
  return true;
};

const generateMfaSessionToken = async (userId) => {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + MFA_SESSION_TTL_MINUTES * 60 * 1000);
  await pool.query(
    "UPDATE users SET mfa_session_token_hash = $1, mfa_session_token_expires_at = $2 WHERE id = $3",
    [hashValue(token), expiresAt.toISOString(), userId]
  );
  return { token, expiresAt };
};

const clearMfaSessionToken = async (userId) => {
  await pool.query(
    "UPDATE users SET mfa_session_token_hash = NULL, mfa_session_token_expires_at = NULL WHERE id = $1",
    [userId]
  );
};

const respondRateLimit = (res, error) => {
  return res.status(error.status || 429).json({
    code: error.code || "RATE_LIMIT_EXCEEDED",
    message: error.message || "Rate limit exceeded",
  });
};

export const signUp = async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "Email and password are required" });
  }
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ code: "EMAIL_TAKEN", message: "That email is already in use" });
  }
  const validator = await validatePassword(password);
  if (!validator.ok) {
    return respondValidationFailure(res, validator);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const userId = crypto.randomUUID();
  const token = crypto.randomBytes(20).toString("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  const vaultSalt = generateVaultSalt();
  const vaultKdf = VAULT_KDF_DEFAULT;
  await pool.query(
    "INSERT INTO users (id, email, password_hash, email_verification_token_hash, email_verification_token_expires_at, vault_salt_b64, vault_kdf) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [userId, normalizedEmail, passwordHash, hashValue(token), expiresAt.toISOString(), vaultSalt, vaultKdf]
  );
  console.info("Email verification token generated for", normalizedEmail);
  return res.status(201).json({
    status: "ok",
    message: "Account created. Verify your email to unlock vault features.",
    emailVerificationToken: process.env.NODE_ENV === "production" ? undefined : token,
  });
};

export const login = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || !password) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "Email and password are required" });
  }
  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(403).json({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
  }
  if (isAccountLocked(user)) {
    const info = getLockInfo(user);
    return res.status(423).json({ code: "ACCOUNT_LOCKED", message: info.reason.message });
  }
  const passwordMatch = await bcrypt.compare(password, user.password_hash || "");
  if (!passwordMatch) {
    const updated = await recordFailedLogin(user.id, Number(user.failed_login_attempts || 0));
    if (updated?.account_locked_until) {
      return res.status(423).json({ code: "ACCOUNT_LOCKED", message: "Account temporarily locked after too many failed attempts." });
    }
    return res.status(403).json({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
  }
  await resetLoginAttempts(user.id);
  const vaultMeta = await ensureVaultSaltRecord(user);
  user.vault_salt_b64 = vaultMeta.vaultSalt;
  user.vault_kdf = vaultMeta.vaultKdf;
  const route = req.originalUrl || req.url;
  const deviceId = getTrustedDeviceIdFromRequest(req);
  const deviceHash = deviceId ? hashTrustedDeviceId(deviceId) : null;
  const trustedDevice = await findTrustedDevice(user.id, deviceHash);
  if (user.mfa_enabled) {
    if (!trustedDevice) {
      logSecurityEvent("MFA_REQUIRED_TRIGGERED", {
        userId: user.id,
        route,
        metadata: { stage: "login" },
      });
      const session = await generateMfaSessionToken(user.id);
      return res.status(200).json({
        status: "MFA_REQUIRED",
        mfaRequired: true,
        mfaSessionToken: session.token,
        expiresAt: session.expiresAt,
      });
    }
    await markMfaVerified(user.id);
    await upsertTrustedDevice(user.id, deviceId);
    setTrustedDeviceCookie(res, deviceId);
  }
  const access = issueAccessToken(user);
  const refresh = await issueRefreshToken(user.id);
  setRefreshCookie(res, refresh.token);
  return res.json(buildAuthPayload({ accessToken: access.token, accessExpiresIn: access.expiresIn, refreshToken: refresh.token, userRow: user }));
};

export const refreshSession = async (req, res) => {
  try {
    const rawRefresh = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawRefresh) {
      return res.status(401).json({ code: "MISSING_REFRESH_TOKEN", message: "Refresh token missing" });
    }
    const rotated = await rotateRefreshToken(rawRefresh);
    if (!rotated) {
      return res.status(401).json({ code: "INVALID_REFRESH_TOKEN", message: "Unable to refresh session" });
    }
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [rotated.user_id]);
    const userRow = rows[0];
    if (!userRow) {
      return res.status(401).json({ code: "INVALID_REFRESH_TOKEN", message: "User not found" });
    }
    const vaultMeta = await ensureVaultSaltRecord(userRow);
    userRow.vault_salt_b64 = vaultMeta.vaultSalt;
    userRow.vault_kdf = vaultMeta.vaultKdf;
    const access = issueAccessToken(userRow);
    setRefreshCookie(res, rotated.token);
    return res.json(buildAuthPayload({ accessToken: access.token, accessExpiresIn: access.expiresIn, refreshToken: rotated.token, userRow }));
  } catch (error) {
    console.error("Refresh failed", error);
    if (error?.message === "REFRESH_TOKEN_REUSED") {
      return res.status(403).json({
        code: "REFRESH_TOKEN_REUSED",
        message: "Refresh token reuse detected; all sessions revoked.",
      });
    }
    return res.status(401).json({ code: "INVALID_REFRESH_TOKEN", message: "Unable to refresh session" });
  }
};

export const logout = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ code: "NOT_AUTHENTICATED", message: "Missing session" });
  }
  await revokeAllSessions(userId);
  clearRefreshCookie(res);
  return res.json({ status: "ok" });
};

export const changePassword = async (req, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body || {};
  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "Current and new password are required" });
  }
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  const stored = rows[0];
  if (!stored || !(await bcrypt.compare(currentPassword, stored.password_hash || ""))) {
    return res.status(403).json({ code: "INVALID_CREDENTIALS", message: "Current password is incorrect" });
  }
  const validator = await validatePassword(newPassword);
  if (!validator.ok) {
    return respondValidationFailure(res, validator);
  }
  const nextHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    "UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_token_expires_at = NULL WHERE id = $2",
    [nextHash, userId]
  );
  await resetLoginAttempts(userId);
  return res.json({ status: "ok" });
};

export const requestPasswordReset = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  try {
    await passwordResetRequestLimiter.track(email);
  } catch (error) {
    return respondRateLimit(res, error);
  }
  const user = await findUserByEmail(email);
  if (user) {
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await pool.query(
      "UPDATE users SET password_reset_token_hash = $1, password_reset_token_expires_at = $2 WHERE id = $3",
      [hashValue(token), expiresAt.toISOString(), user.id]
    );
    console.info("Password reset token generated for", email);
    return res.json({
      status: "ok",
      message: "If that email exists, a reset link will be sent.",
      token: process.env.NODE_ENV === "production" ? undefined : token,
    });
  }
  return res.json({
    status: "ok",
    message: "If that email exists, a reset link will be sent.",
  });
};

export const confirmPasswordReset = async (req, res) => {
  const token = req.body?.token;
  const password = req.body?.password;
  if (!token || !password) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "Token and new password are required" });
  }
  try {
    await passwordResetConfirmLimiter.track(token);
  } catch (error) {
    return respondRateLimit(res, error);
  }
  const hashed = hashValue(token);
  const { rows } = await pool.query(
    "SELECT id, password_reset_token_expires_at FROM users WHERE password_reset_token_hash = $1",
    [hashed]
  );
  const user = rows[0];
  if (!user) {
    return res.status(400).json({ code: "INVALID_TOKEN", message: "Invalid or expired reset token" });
  }
  if (new Date(user.password_reset_token_expires_at) < new Date()) {
    return res.status(400).json({ code: "TOKEN_EXPIRED", message: "Reset token has expired" });
  }
  const validator = await validatePassword(password);
  if (!validator.ok) {
    return respondValidationFailure(res, validator);
  }
  const nextHash = await bcrypt.hash(password, 12);
  await pool.query(
    "UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_token_expires_at = NULL WHERE id = $2",
    [nextHash, user.id]
  );
  await resetLoginAttempts(user.id);
  return res.json({ status: "ok" });
};

export const requestEmailVerification = async (req, res) => {
  const email = normalizeEmail(req.user?.email || req.body?.email);
  try {
    await emailVerifyResendLimiter.track(email);
  } catch (error) {
    return respondRateLimit(res, error);
  }
  if (!email) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "Email is required" });
  }
  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(200).json({
      status: "ok",
      message: "Verification request recorded.",
    });
  }
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await pool.query(
    "UPDATE users SET email_verification_token_hash = $1, email_verification_token_expires_at = $2 WHERE id = $3",
    [hashValue(token), expiresAt.toISOString(), user.id]
  );
  console.info("Resent email verification for", email);
  return res.json({
    status: "ok",
    message: "Verification email resent.",
    token: process.env.NODE_ENV === "production" ? undefined : token,
  });
};

export const confirmEmailVerification = async (req, res) => {
  const token = req.body?.token;
  if (!token) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "Token is required" });
  }
  const hashed = hashValue(token);
  const { rows } = await pool.query(
    "SELECT id, email_verification_token_expires_at FROM users WHERE email_verification_token_hash = $1",
    [hashed]
  );
  const user = rows[0];
  if (!user) {
    return res.status(400).json({ code: "INVALID_TOKEN", message: "Invalid verification token" });
  }
  if (new Date(user.email_verification_token_expires_at) < new Date()) {
    return res.status(400).json({ code: "TOKEN_EXPIRED", message: "Verification token expired" });
  }
  await pool.query(
    "UPDATE users SET email_verified = TRUE, email_verified_at = NOW(), email_verification_token_hash = NULL, email_verification_token_expires_at = NULL WHERE id = $1",
    [user.id]
  );
  return res.json({ status: "ok" });
};

export const enrollMfa = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ code: "NOT_AUTHENTICATED", message: "Missing session" });
  }
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(req.user.email, "Luna", secret);
  try {
    const qrCode = await QRCode.toDataURL(otpAuthUrl);
    await pool.query("UPDATE users SET mfa_totp_pending_secret = $1 WHERE id = $2", [
      encryptToken(secret),
      userId,
    ]);
    return res.json({ state: "pending", otpAuthUrl, qrCode });
  } catch (error) {
    console.error("Unable to generate MFA QR", error);
    return res.status(500).json({ code: "MFA_ENROLL_FAILED", message: "Unable to enroll MFA right now." });
  }
};

export const confirmMfa = async (req, res) => {
  const userId = req.user?.id;
  const code = req.body?.code;
  if (!userId || !code) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "MFA code is required" });
  }
  const { rows } = await pool.query(
    "SELECT mfa_totp_pending_secret FROM users WHERE id = $1",
    [userId]
  );
  const pending = rows[0];
  if (!pending?.mfa_totp_pending_secret) {
    return res.status(400).json({ code: "NO_MFA_SECRET", message: "No pending MFA enrollment found" });
  }
  const secret = decryptToken(pending.mfa_totp_pending_secret);
  if (!authenticator.check(code, secret)) {
    logSecurityEvent("MFA_STEPUP_FAIL", {
      userId,
      route: req.originalUrl || req.url,
      metadata: { phase: "confirm" },
    });
    return res.status(403).json({ code: "INVALID_CODE", message: "Code verification failed" });
  }
  const codes = generateRecoveryCodes();
  await pool.query(
    "UPDATE users SET mfa_enabled = TRUE, mfa_totp_secret = $1, mfa_totp_pending_secret = NULL WHERE id = $2",
    [encryptToken(secret), userId]
  );
  await persistRecoveryCodes(userId, codes);
  await markMfaVerified(userId);
  const deviceId = getTrustedDeviceIdFromRequest(req) || crypto.randomBytes(16).toString("hex");
  await upsertTrustedDevice(userId, deviceId);
  setTrustedDeviceCookie(res, deviceId);
  logSecurityEvent("MFA_STEPUP_SUCCESS", {
    userId,
    route: req.originalUrl || req.url,
    metadata: { phase: "confirm" },
  });
  return res.json({ status: "ok", recoveryCodes: codes });
};

export const verifyMfa = async (req, res) => {
  const { mfaSessionToken, code } = req.body || {};
  if (!mfaSessionToken || !code) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "Session token and code are required" });
  }
  try {
    await mfaVerifyLimiter.track(mfaSessionToken);
  } catch (error) {
    return respondRateLimit(res, error);
  }
  const hashedToken = hashValue(mfaSessionToken);
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE mfa_session_token_hash = $1",
    [hashedToken]
  );
  const user = rows[0];
  if (!user) {
    return res.status(403).json({ code: "INVALID_SESSION", message: "MFA session invalid" });
  }
  if (user.mfa_session_token_expires_at && new Date(user.mfa_session_token_expires_at) < new Date()) {
    return res.status(403).json({ code: "SESSION_EXPIRED", message: "MFA session has expired" });
  }
  const route = req.originalUrl || req.url;
  const accepted = await verifyMfaCode(user, code);
  if (!accepted) {
    logSecurityEvent("MFA_STEPUP_FAIL", {
      userId: user.id,
      route,
      metadata: { phase: "login" },
    });
    return res.status(403).json({ code: "INVALID_CODE", message: "Invalid MFA code" });
  }
  await clearMfaSessionToken(user.id);
  await resetLoginAttempts(user.id);
  await markMfaVerified(user.id);
  const deviceId = getTrustedDeviceIdFromRequest(req) || crypto.randomBytes(16).toString("hex");
  await upsertTrustedDevice(user.id, deviceId);
  setTrustedDeviceCookie(res, deviceId);
  logSecurityEvent("MFA_STEPUP_SUCCESS", {
    userId: user.id,
    route,
    metadata: { phase: "login" },
  });
  const access = issueAccessToken(user);
  const refresh = await issueRefreshToken(user.id);
  setRefreshCookie(res, refresh.token);
  return res.json(buildAuthPayload({ accessToken: access.token, accessExpiresIn: access.expiresIn, refreshToken: refresh.token, userRow: user }));
};

export const stepUpMfa = async (req, res) => {
  const userId = req.user?.id;
  const code = req.body?.code;
  const route = req.originalUrl || req.url;
  if (!userId) {
    return res.status(401).json({ code: "NOT_AUTHENTICATED", message: "Missing session" });
  }
  if (!req.user?.mfaEnabled) {
    return res.status(403).json({ code: "MFA_NOT_ENABLED", message: "Enable MFA to perform this action." });
  }
  if (!code) {
    return res.status(400).json({ code: "MISSING_FIELDS", message: "MFA code is required" });
  }
  const { rows } = await pool.query("SELECT mfa_totp_secret, mfa_recovery_codes FROM users WHERE id = $1", [
    userId,
  ]);
  const userRow = rows[0];
  if (!userRow) {
    return res.status(401).json({ code: "INVALID_USER", message: "Unable to verify session" });
  }
  const accepted = await verifyMfaCode({ ...userRow, id: userId }, code);
  if (!accepted) {
    logSecurityEvent("MFA_STEPUP_FAIL", {
      userId,
      route,
      metadata: { phase: "step-up" },
    });
    return res.status(403).json({ code: "INVALID_CODE", message: "Invalid MFA code" });
  }
  await markMfaVerified(userId);
  const deviceId = getTrustedDeviceIdFromRequest(req) || crypto.randomBytes(16).toString("hex");
  await upsertTrustedDevice(userId, deviceId);
  setTrustedDeviceCookie(res, deviceId);
  logSecurityEvent("MFA_STEPUP_SUCCESS", {
    userId,
    route,
    metadata: { phase: "step-up" },
  });
  return res.json({ status: "ok", mfaVerifiedAt: new Date().toISOString() });
};

export const regenerateRecoveryCodes = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ code: "NOT_AUTHENTICATED", message: "Missing session" });
  }
  const { rows } = await pool.query(
    "SELECT mfa_enabled FROM users WHERE id = $1",
    [userId]
  );
  if (!rows[0]?.mfa_enabled) {
    return res.status(400).json({ code: "MFA_DISABLED", message: "MFA is not enabled" });
  }
  const codes = generateRecoveryCodes();
  await persistRecoveryCodes(userId, codes);
  return res.json({ status: "ok", recoveryCodes: codes });
};

export const disableMfa = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ code: "NOT_AUTHENTICATED", message: "Missing session" });
  }
  await pool.query(
    `UPDATE users SET mfa_enabled = FALSE, mfa_totp_secret = NULL, mfa_totp_pending_secret = NULL, mfa_recovery_codes = '[]'::jsonb, mfa_verified_at = NULL WHERE id = $1`,
    [userId]
  );
  await pool.query("UPDATE trusted_devices SET revoked_at = NOW() WHERE user_id = $1", [userId]);
  clearTrustedDeviceCookie(res);
  logSecurityEvent("MFA_DISABLED", {
    userId,
    route: req.originalUrl || req.url,
  });
  return res.json({ status: "ok" });
};

export const purgeUserData = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ status: "error", message: "Missing authenticated user" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM plaid_items WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM user_snapshots WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM user_snapshots_history WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM transactions WHERE user_id = $1", [userId]);

    await client.query(
      "UPDATE users SET email = NULL, profile_data = '{}', updated_at = NOW() WHERE id = $1",
      [userId]
    );

    await client.query("COMMIT");
    return res.json({ status: "ok", message: "User data purged" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error purging user data", error);
    return res.status(500).json({ status: "error", message: "Purge failed" });
  } finally {
    client.release();
  }
};

export const recordExportVerification = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ status: "error", message: "Missing authenticated user" });
  }
  const { format, exportId, hash, statement, confirmedAt } = req.body || {};
  if (!format || !exportId || !hash || !statement || !confirmedAt) {
    return res
      .status(400)
      .json({ status: "error", message: "Missing export verification payload details." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT profile_data FROM users WHERE id = $1 FOR UPDATE", [
      userId,
    ]);
    const rawData = rows[0]?.profile_data;
    let profileData = {};
    if (rawData) {
      try {
        profileData = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      } catch {
        profileData = {};
      }
    }
    const history = Array.isArray(profileData.exportVerifications) ? profileData.exportVerifications : [];
    const nextEntry = {
      format: String(format).toUpperCase(),
      exportId,
      hash,
      statement,
      confirmedAt,
      recordedAt: new Date().toISOString(),
    };
    const nextHistory = [nextEntry, ...history].slice(0, 20);
    const nextProfileData = { ...profileData, exportVerifications: nextHistory };
    await client.query(
      "UPDATE users SET profile_data = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(nextProfileData), userId]
    );
    await client.query("COMMIT");
    return res.json({ status: "ok", exportVerifications: nextHistory });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to record export verification", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to record export verification acknowledgement.",
    });
  } finally {
    client.release();
  }
};
