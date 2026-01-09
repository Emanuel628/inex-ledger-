import crypto from "crypto";
import pool from "../db.js";
import { validVaultEnvelope } from "../security/vaultFormat.js";
import { logSecurityEvent } from "../services/securityLogger.js";

const ensureUserId = (req) => req.user?.id;

export const uploadVaultBackup = async (req, res) => {
  const userId = ensureUserId(req);
  if (!userId) {
    return res.status(401).json({ code: "NOT_AUTHENTICATED", message: "Missing user session." });
  }
  const envelope = req.body?.envelope;
  if (!envelope || typeof envelope !== "object") {
    return res.status(400).json({ code: "INVALID_PAYLOAD", message: "Vault envelope is required." });
  }
  if (!validVaultEnvelope(envelope)) {
    return res.status(400).json({ code: "INVALID_VAULT_ENVELOPE", message: "Vault envelope is missing required fields." });
  }
  const backupId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO vault_backups (id, user_id, envelope) VALUES ($1, $2, $3)",
    [backupId, userId, envelope]
  );
  logSecurityEvent("VAULT_BACKUP_UPLOAD", {
    userId,
    route: req.originalUrl || req.url,
    metadata: { backupId },
  });
  return res.json({ status: "ok", backupId });
};

export const getLatestVaultBackup = async (req, res) => {
  const userId = ensureUserId(req);
  if (!userId) {
    return res.status(401).json({ code: "NOT_AUTHENTICATED", message: "Missing user session." });
  }
  const { rows } = await pool.query(
    "SELECT envelope FROM vault_backups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const record = rows[0];
  if (!record) {
    return res.status(404).json({ code: "BACKUP_NOT_FOUND", message: "No vault backup exists." });
  }
  if (!validVaultEnvelope(record.envelope)) {
    logSecurityEvent("VAULT_BACKUP_INVALID", { userId, route: req.originalUrl || req.url });
    return res.status(500).json({ code: "BACKUP_INVALID", message: "Stored vault backup is corrupted." });
  }
  logSecurityEvent("VAULT_BACKUP_DOWNLOAD", {
    userId,
    route: req.originalUrl || req.url,
  });
  return res.json({ envelope: record.envelope });
};
