import express from "express";
import { purgeUserData, recordExportVerification } from "../controllers/authController.js";
import { ensureAuth } from "../middleware/auth.js";
import { requirePro } from "../middleware/tierCheck.js";
import { purgeLimiter } from "../middleware/rateLimiter.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";
import { requireRecentMFA } from "../middleware/requireRecentMFA.js";
const router = express.Router();

router.delete("/purge", ensureAuth, purgeLimiter, purgeUserData);
router.delete("/delete-everything", ensureAuth, purgeLimiter, purgeUserData);

router.get("/subscription-status", ensureAuth, (req, res) => {
  res.json({
    status: req.user.subscriptionStatus,
    tier: req.user.subscriptionStatus === "PRO" ? "Fortress" : "Standard",
    ecosystemLevel: req.user.ecosystemLevel,
    ecosystem_level: req.user.ecosystemLevel,
    momentumStreak: req.user.momentumStreak,
    momentum_streak: req.user.momentumStreak,
  });
});

router.get("/identity", ensureAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    subscriptionStatus: req.user.subscriptionStatus,
    stripeCustomerId: req.user.stripeCustomerId,
    ecosystemLevel: req.user.ecosystemLevel,
    ecosystem_level: req.user.ecosystemLevel,
    momentumStreak: req.user.momentumStreak,
    momentum_streak: req.user.momentumStreak,
    vaultSalt: req.user.vaultSalt,
    vaultKdf: req.user.vaultKdf,
  });
});

router.post(
  "/export-verification",
  ensureAuth,
  requireVerifiedEmail,
  requireRecentMFA(),
  requirePro,
  recordExportVerification
);

// TODO: apply requireVerifiedEmail + requireRecentMFA to /api/user/export/pdf and /api/user/export/csv when they exist.

export default router;
