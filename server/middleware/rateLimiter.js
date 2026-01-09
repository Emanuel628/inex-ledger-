import rateLimit from "express-rate-limit";

const createIpLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
  });

export const loginLimiter = createIpLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: { code: "RATE_LIMIT_EXCEEDED", message: "Too many login attempts. Please wait a minute." },
});

export const signupLimiter = createIpLimiter({
  windowMs: 60 * 1000 * 5,
  max: 10,
  message: { code: "RATE_LIMIT_EXCEEDED", message: "Sign-ups are limited. Try again later." },
});

export const passwordResetLimiter = createIpLimiter({
  windowMs: 60 * 1000 * 3,
  max: 12,
  message: { code: "RATE_LIMIT_EXCEEDED", message: "Password reset attempts are limited. Please wait a moment." },
});

export const passwordResetConfirmLimiter = createIpLimiter({
  windowMs: 60 * 1000 * 3,
  max: 10,
  message: { code: "RATE_LIMIT_EXCEEDED", message: "Password reset confirmation attempts are limited." },
});

export const emailVerifyLimiter = createIpLimiter({
  windowMs: 60 * 1000 * 5,
  max: 8,
  message: { code: "RATE_LIMIT_EXCEEDED", message: "Email verification resends are rate limited." },
});

export const mfaVerifyLimiter = createIpLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: { code: "RATE_LIMIT_EXCEEDED", message: "MFA verification attempts are limited." },
});
