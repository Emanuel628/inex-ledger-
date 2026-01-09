import express from "express";
import { ensureAuth } from "../middleware/auth.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";
import { momentumLimiter } from "../middleware/rateLimiter.js";
import { rollMomentum } from "../controllers/momentumController.js";

const router = express.Router();

router.use(ensureAuth);
router.use(requireVerifiedEmail);

router.post("/roll", momentumLimiter, rollMomentum);

export default router;
