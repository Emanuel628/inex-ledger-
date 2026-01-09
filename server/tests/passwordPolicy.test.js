import crypto from "crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fetch from "node-fetch";
import { validatePassword } from "../security/passwordPolicy.js";

vi.mock("node-fetch");
const mockedFetch = vi.mocked(fetch, true);

describe("password policy", () => {
  beforeEach(() => {
    mockedFetch.mockResolvedValue({
      ok: true,
      text: async () => "",
    });
  });

  afterEach(() => {
    mockedFetch.mockReset();
  });

  it("rejects passwords that are too short", async () => {
    const result = await validatePassword("short");
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.code === "PASSWORD_TOO_SHORT")).toBe(true);
  });

  it("rejects passwords that do not meet complexity", async () => {
    const result = await validatePassword("aaaaaaaaaaaa");
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.code === "PASSWORD_TOO_SIMPLE")).toBe(true);
  });

  it("rejects common passwords from the blacklist", async () => {
    const result = await validatePassword("123456");
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.code === "PASSWORD_IN_COMMON_LIST")).toBe(true);
  });

  it("flags breached passwords when HIBP reports matches", async () => {
    const safe = "UniqueStorm!2";
    const digest = crypto.createHash("sha1").update(safe).digest("hex").toUpperCase();
    const prefix = digest.slice(0, 5);
    const suffix = digest.slice(5);
    mockedFetch.mockResolvedValue({
      ok: true,
      text: async () => `${suffix}:15\nOTHER:1`,
    });

    const result = await validatePassword(safe);
    expect(result.ok).toBe(false);
    expect(result.hibp.status).toBe("breached");
    expect(result.reasons.some((reason) => reason.code === "PASSWORD_BREACHED")).toBe(true);
  });

  it("warns but allows password when HIBP is unreachable in dev", async () => {
    mockedFetch.mockRejectedValue(new Error("network"));
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    try {
      const result = await validatePassword("ValidHeads#1");
      expect(result.ok).toBe(true);
      expect(result.hibp.status).toBe("unreachable");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
