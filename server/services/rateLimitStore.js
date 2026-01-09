import IORedis from "ioredis";

class RateLimitError extends Error {
  constructor({ action, identifier, max, windowMs }) {
    super(`Rate limit exceeded for ${action}`);
    this.status = 429;
    this.code = "RATE_LIMIT_EXCEEDED";
    this.identifier = identifier;
    this.action = action;
    this.max = max;
    this.windowMs = windowMs;
  }
}

const redisUrl = process.env.RATE_LIMIT_REDIS_URL;
const redisClient = redisUrl ? new IORedis(redisUrl) : null;
const limitState = new Map();

const getKey = (action, identifier) => `${action}:${identifier || "global"}`;

const enforceRateLimitInMemory = ({ action, identifier, max, windowMs }) => {
  if (!identifier) return;
  const key = getKey(action, identifier);
  const now = Date.now();
  const existing = limitState.get(key);
  if (!existing || existing.expiresAt <= now) {
    limitState.set(key, { count: 1, expiresAt: now + windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > max) {
    throw new RateLimitError({ action, identifier, max, windowMs });
  }
};

const enforceRateLimitRedis = async ({ action, identifier, max, windowMs }) => {
  if (!identifier || !redisClient) return;
  const key = getKey(action, identifier);
  const multi = redisClient.multi();
  multi.incr(key);
  multi.pexpire(key, windowMs);
  const results = await multi.exec();
  const count = Number(results?.[0]?.[1] ?? 0);
  if (count > max) {
    throw new RateLimitError({ action, identifier, max, windowMs });
  }
};

export const resetRateLimitStore = async () => {
  limitState.clear();
  if (redisClient) {
    await redisClient.flushdb();
  }
};

export const enforceRateLimit = async (options) => {
  if (redisClient) {
    await enforceRateLimitRedis(options);
  } else {
    enforceRateLimitInMemory(options);
  }
};

export class RateLimiter {
  constructor({ action, max, windowMs }) {
    this.action = action;
    this.max = max;
    this.windowMs = windowMs;
  }

  async track(identifier) {
    await enforceRateLimit({
      action: this.action,
      identifier,
      max: this.max,
      windowMs: this.windowMs,
    });
  }
}

export { RateLimitError };
