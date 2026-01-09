import crypto from "crypto";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import pool from "../db.js";
import { rotateRefreshToken } from "../auth/session.js";

vi.mock("../db.js", () => ({
  default: {
    query: vi.fn(),
  },
}));

const rawToken = "token123";
const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

describe("refresh rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pool.query.mockImplementation((sql) => {
      if (sql.startsWith("SELECT * FROM refresh_tokens")) {
        return Promise.resolve({
          rows: [
            {
              id: "old-id",
              user_id: "user-1",
              token_hash: hashedToken,
              expires_at: new Date(Date.now() + 10000).toISOString(),
              revoked_at: null,
            },
          ],
        });
      }
      if (sql.startsWith("INSERT INTO refresh_tokens")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.startsWith("UPDATE refresh_tokens")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new-id");
    vi.spyOn(crypto, "randomBytes").mockReturnValue(Buffer.from("abcd", "hex"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rotates tokens and revokes the previous entry", async () => {
    const rotated = await rotateRefreshToken(`old-id.${rawToken}`);
    expect(rotated).toBeTruthy();
    expect(rotated?.token).toContain("new-id");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE refresh_tokens"),
      expect.arrayContaining([expect.any(String), expect.any(String), "old-id"])
    );
  });

  it("revokes all sessions when a refresh token is reused", async () => {
    const reusedToken = `old-id.${rawToken}`;
    const hashedSession = crypto.createHash("sha256").update(rawToken).digest("hex");
    pool.query.mockImplementation((sql) => {
      if (sql.startsWith("SELECT * FROM refresh_tokens")) {
        return Promise.resolve({
          rows: [
            {
              id: "old-id",
              user_id: "user-1",
              token_hash: hashedSession,
              expires_at: new Date(Date.now() + 10000).toISOString(),
              revoked_at: null,
              rotated_to: "already-used",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(rotateRefreshToken(reusedToken)).rejects.toThrow("REFRESH_TOKEN_REUSED");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SET revoked_at = NOW()"),
      expect.arrayContaining(["user-1"])
    );
  });
});
