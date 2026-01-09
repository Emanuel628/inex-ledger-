import express from "express";
import { ensureAuth } from "../middleware/auth.js";
import { requireRecentMFA } from "../middleware/requireRecentMFA.js";
import {
  loginLimiter,
  signupLimiter,
  passwordResetLimiter,
  passwordResetConfirmLimiter,
  emailVerifyLimiter,
  mfaVerifyLimiter,
} from "../middleware/rateLimiter.js";
import {
  signUp,
  login,
  refreshSession,
  logout,
  changePassword,
  requestPasswordReset,
  confirmPasswordReset,
  requestEmailVerification,
  confirmEmailVerification,
  enrollMfa,
  confirmMfa,
  verifyMfa,
  regenerateRecoveryCodes,
  stepUpMfa,
  disableMfa,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signupLimiter, signUp);
router.post("/login", loginLimiter, login);
router.post("/refresh", refreshSession);
router.post("/logout", ensureAuth, logout);
router.post("/password/change", ensureAuth, requireRecentMFA(), changePassword);
router.post("/password-reset/request", passwordResetLimiter, requestPasswordReset);
router.post("/password-reset/confirm", passwordResetConfirmLimiter, confirmPasswordReset);
router.post("/email/verify/request", emailVerifyLimiter, requestEmailVerification);
router.post("/email/verify/resend", emailVerifyLimiter, requestEmailVerification);
router.post("/email/verify/confirm", confirmEmailVerification);
router.post("/mfa/totp/enroll", ensureAuth, enrollMfa);
router.post("/mfa/totp/confirm", ensureAuth, confirmMfa);
router.post("/mfa/totp/verify", mfaVerifyLimiter, verifyMfa);
router.post("/mfa/recovery/regenerate", ensureAuth, requireRecentMFA(), regenerateRecoveryCodes);
router.post("/mfa/step-up", ensureAuth, stepUpMfa);
router.post("/mfa/disable", ensureAuth, requireRecentMFA(), disableMfa);

// TODO: gate /auth/change-email when implemented in the future.

export default router;
