import express from "express";
import { purgeUserData, recordExportVerification } from "../controllers/authController.js";
import { ensureAuth } from "../middleware/auth.js";
import { requirePro } from "../middleware/tierCheck.js";
import { loginLimiter, purgeLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/login", loginLimiter, (req, res) => {
  return res.status(501).json({
    error: "Login endpoint is not yet exposed. Client-side session management handles authentication.",
  });
});

/**
 * @swagger
 * /api/user/purge:
 *   delete:
 *     summary: The "Nuclear Option"
 *     description: Permanently executes an atomic SQL DELETE across every table tied to the authenticated user and nullifies their profile record.
 *     responses:
 *       200:
 *         description: All user data successfully purged.
 *       401:
 *         description: Missing authenticated user when attempting to purge.
 *       500:
 *         description: An error occurred while purging user data.
 */
router.delete("/purge", ensureAuth, purgeLimiter, purgeUserData);

/**
 * @swagger
 * /api/user/delete-everything:
 *   delete:
 *     summary: Alias for the Nuclear Delete.
 *     description: Same atomic wipe as /purge for teams that prefer the “delete everything” phrasing.
 *     responses:
 *       200:
 *         description: All user data successfully purged via delete-everything.
 */
router.delete("/delete-everything", ensureAuth, purgeLimiter, purgeUserData);

/**
 * @swagger
 * /api/user/subscription-status:
 *   get:
 *     summary: Fetch current upgrade status
 *     description: Returns the subscription status stored in the Identity silo.
 *     responses:
 *       200:
 *         description: Subscription status returned.
 *       401:
 *         description: Missing authenticated user.
 */
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
  });
});

router.post("/export-verification", ensureAuth, requirePro, recordExportVerification);

export default router;
