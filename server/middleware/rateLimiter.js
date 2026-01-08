import rateLimit from "express-rate-limit";

const DEFAULT_WINDOW_MS = 60 * 1000;

export const loginLimiter = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  max: 6,
  message: { error: "Too many login attempts from this IP. Please wait a minute and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const purgeLimiter = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  max: 3,
  message: { error: "Nuclear delete is rate limited for your safety. Try again in one minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const momentumLimiter = rateLimit({
  windowMs: DEFAULT_WINDOW_MS * 2,
  max: 12,
  message: {
    error: "Momentum updates are rate limited. Try again in a few seconds.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
