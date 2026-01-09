import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter, resetRateLimitStore } from "../services/rateLimitStore.js";

describe("rate limit store", () => {
  beforeEach(async () => {
    await resetRateLimitStore();
  });

  it("enforces per-identifier limits", async () => {
    const limiter = new RateLimiter({ action: "test", max: 1, windowMs: 100 });
    await limiter.track("user@example.com");
    await expect(limiter.track("user@example.com")).rejects.toThrow();
  });

  it("tracks unique identifiers independently", async () => {
    const limiter = new RateLimiter({ action: "test", max: 1, windowMs: 100 });
    await limiter.track("foo");
    await expect(limiter.track("foo")).rejects.toThrow();
    await expect(limiter.track("bar")).resolves.toBeUndefined();
  });
});
