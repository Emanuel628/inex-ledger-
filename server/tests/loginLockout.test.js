import { describe, it, expect, vi, beforeEach } from "vitest";
import pool from "../db.js";
import {
  recordFailedLogin,
  resetLoginAttempts,
  isAccountLocked,
} from "../middleware/loginLockout.js";

vi.mock("../db.js", () => ({
  default: {
    query: vi.fn(),
  },
}));

describe("login lockout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks after reaching the maximum failures", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          failed_login_attempts: 5,
          account_locked_until: new Date(Date.now() + 1000).toISOString(),
        },
      ],
    });
    const update = await recordFailedLogin("user-1", 4);
    expect(update.failed_login_attempts).toBe(5);
    expect(update.account_locked_until).toBeTruthy();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("account_locked_until"),
      expect.any(Array)
    );
  });

  it("resets the counters on success", async () => {
    await resetLoginAttempts("user-2");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("failed_login_attempts = 0"),
      expect.any(Array)
    );
  });

  it("detects locked accounts correctly", () => {
    const future = new Date(Date.now() + 1000).toISOString();
    expect(isAccountLocked({ account_locked_until: future })).toBe(true);
    expect(isAccountLocked({ account_locked_until: new Date(Date.now() - 1000).toISOString() })).toBe(false);
    expect(isAccountLocked({})).toBe(false);
  });
});
