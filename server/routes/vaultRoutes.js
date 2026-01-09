import express from "express";
import { ensureAuth } from "../middleware/auth.js";
import { requireRecentMFA } from "../middleware/requireRecentMFA.js";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";
import { uploadVaultBackup, getLatestVaultBackup } from "../controllers/vaultController.js";

const router = express.Router();

router.use(ensureAuth);
router.use(requireVerifiedEmail);

router.post("/backup/upload", requireRecentMFA(), uploadVaultBackup);
router.get("/backup/latest", requireRecentMFA(), getLatestVaultBackup);

export default router;
