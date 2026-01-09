import crypto from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRUSTED_DEVICE_COOKIE } from "../config/securityConstants.js";

vi.mock("../db.js", () => ({
  default: {
    query: vi.fn(),
  },
}));

vi.mock("../auth/session.js", () => ({
  issueAccessToken: vi.fn(() => ({ token: "access-token", expiresIn: 1800 })),
  issueRefreshToken: vi.fn(() => Promise.resolve({ token: "refresh-token", id: "refresh-id" })),
  rotateRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

vi.mock("../services/encryptionService.js", () => ({
  encryptToken: vi.fn((value) => `encrypted:${value}`),
  decryptToken: vi.fn((value) => (typeof value === "string" ? value.replace("encrypted:", "") : "")),
}));

vi.mock("otplib", () => ({
  authenticator: {
    generateSecret: vi.fn(() => "SECRET"),
    keyuri: vi.fn(() => "otpauth://example"),
    check: vi.fn((code, secret) => code === "123456" && secret === "SECRET"),
  },
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve("qr-code")),
  },
}));

import pool from "../db.js";
import { enrollMfa, confirmMfa, verifyMfa, stepUpMfa } from "../controllers/authController.js";

const makeResponse = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(),
    cookie: vi.fn(),
  };
  return res;
};

describe("MFA controllers", () => {
  let consoleInfoSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it("enrolls a TOTP secret", async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const req = { user: { id: "user-1", email: "test@luna.app" } };
    const res = makeResponse();
    await enrollMfa(req, res);
    expect(res.json).toHaveBeenCalledWith({
      state: "pending",
      otpAuthUrl: "otpauth://example",
      qrCode: "qr-code",
    });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("mfa_totp_pending_secret"),
      expect.any(Array)
    );
  });

  it("confirms MFA enrollment and issues recovery codes", async () => {
    pool.query.mockImplementation((sql) => {
      if (sql.startsWith("SELECT mfa_totp_pending_secret")) {
        return Promise.resolve({ rows: [{ mfa_totp_pending_secret: "encrypted:SECRET" }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const req = { user: { id: "user-1" }, body: { code: "123456" } };
    const res = makeResponse();
    await confirmMfa(req, res);
    expect(res.json).toHaveBeenCalledWith({
      status: "ok",
      recoveryCodes: expect.any(Array),
    });
    expect(res.cookie).toHaveBeenCalledWith(TRUSTED_DEVICE_COOKIE, expect.any(String), expect.any(Object));
  });

  it("verifies MFA code and issues tokens", async () => {
    const sessionToken = "session-token";
    const hashedSession = crypto.createHash("sha256").update(sessionToken).digest("hex");
    pool.query.mockImplementation((sql) => {
      if (sql.startsWith("SELECT * FROM users")) {
        return Promise.resolve({
          rows: [
            {
              id: "user-1",
              email: "test@luna.app",
              subscription_status: "FREE",
              ecosystem_level: 1,
              momentum_streak: 0,
              email_verified: true,
              mfa_enabled: true,
              mfa_totp_secret: "encrypted:SECRET",
              mfa_session_token_hash: hashedSession,
              mfa_session_token_expires_at: new Date(Date.now() + 10000).toISOString(),
              mfa_recovery_codes: [],
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const req = { body: { mfaSessionToken: sessionToken, code: "123456" } };
    const res = makeResponse();
    await verifyMfa(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "access-token",
        expiresIn: 1800,
        mfaRequired: false,
        refreshToken: "refresh-token",
        identity: expect.any(Object),
        vaultSalt: undefined,
        vaultKdf: "argon2id",
      })
    );
    expect(res.cookie).toHaveBeenCalledWith("__Host-luna_session", "refresh-token", expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith(TRUSTED_DEVICE_COOKIE, expect.any(String), expect.any(Object));
  });

  it("allows MFA step-up and sets trusted device cookie", async () => {
    pool.query.mockImplementation((sql) => {
      if (sql.startsWith("SELECT mfa_totp_secret")) {
        return Promise.resolve({
          rows: [{ mfa_totp_secret: "encrypted:SECRET", mfa_recovery_codes: [] }],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const req = { user: { id: "user-1", mfaEnabled: true }, body: { code: "123456" } };
    const res = makeResponse();
    await stepUpMfa(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "ok" }));
    expect(res.cookie).toHaveBeenCalledWith(TRUSTED_DEVICE_COOKIE, expect.any(String), expect.any(Object));
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("mfa_verified_at"),
      expect.arrayContaining(["user-1"])
    );
  });
});
