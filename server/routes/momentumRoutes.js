import express from "express";
import { ensureAuth } from "../middleware/auth.js";
import { momentumLimiter } from "../middleware/rateLimiter.js";
import { rollMomentum } from "../controllers/momentumController.js";

const router = express.Router();

router.post("/roll", ensureAuth, momentumLimiter, rollMomentum);

export default router;
