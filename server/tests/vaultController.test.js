import crypto from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import pool from "../db.js";
import { uploadVaultBackup, getLatestVaultBackup } from "../controllers/vaultController.js";

vi.mock("../db.js", () => ({
  default: {
    query: vi.fn(),
  },
}));

vi.mock("../services/securityLogger.js", () => ({
  logSecurityEvent: vi.fn(),
}));

const makeResponse = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

describe("vault backup controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("backup-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects missing envelope payload", async () => {
    const req = { body: {}, user: { id: "user-1" } };
    const res = makeResponse();
    await uploadVaultBackup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: "INVALID_PAYLOAD",
      message: "Vault envelope is required.",
    });
  });

  it("rejects invalid envelope structure", async () => {
    const req = {
      body: { envelope: { foo: "bar" } },
      user: { id: "user-1" },
    };
    const res = makeResponse();
    await uploadVaultBackup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: "INVALID_VAULT_ENVELOPE",
      message: "Vault envelope is missing required fields.",
    });
  });

  it("saves envelope and returns backupId", async () => {
    pool.query.mockResolvedValue({});
    const req = {
      body: {
        envelope: {
          v: 1,
          alg: "A256GCM",
          kdf: "argon2id",
          salt_b64: "AA",
          iv_b64: "BB",
          ct_b64: "CC",
        },
      },
      user: { id: "user-1" },
      originalUrl: "/api/vault/backup/upload",
    };
    const res = makeResponse();
    await uploadVaultBackup(req, res);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO vault_backups"),
      expect.arrayContaining(["backup-id", "user-1", expect.any(Object)])
    );
    expect(res.json).toHaveBeenCalledWith({ status: "ok", backupId: "backup-id" });
  });

  it("returns not found when there is no backup", async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const req = { user: { id: "user-1" } };
    const res = makeResponse();
    await getLatestVaultBackup(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      code: "BACKUP_NOT_FOUND",
      message: "No vault backup exists.",
    });
  });

  it("returns latest envelope when stored", async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          envelope: {
            v: 1,
            alg: "A256GCM",
            kdf: "argon2id",
            salt_b64: "AA",
            iv_b64: "BB",
            ct_b64: "CC",
          },
        },
      ],
    });
    const req = { user: { id: "user-1" }, originalUrl: "/api/vault/backup/latest" };
    const res = makeResponse();
    await getLatestVaultBackup(req, res);
    expect(res.json).toHaveBeenCalledWith({
      envelope: {
        v: 1,
        alg: "A256GCM",
        kdf: "argon2id",
        salt_b64: "AA",
        iv_b64: "BB",
        ct_b64: "CC",
      },
    });
  });
});
