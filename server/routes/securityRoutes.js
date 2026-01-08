import express from "express";
import { ensureAuth } from "../middleware/auth.js";
import { requirePro } from "../middleware/tierCheck.js";
import {
  getRegistrationOptions,
  getAuthenticationOptions,
  verifyAuthentication,
  verifyRegistration,
} from "../controllers/webauthnController.js";

const router = express.Router();

router.post("/register-key/options", ensureAuth, requirePro, getRegistrationOptions);
router.post("/register-key/verify", ensureAuth, requirePro, verifyRegistration);
router.get("/authenticate/options", ensureAuth, requirePro, getAuthenticationOptions);
router.post("/authenticate/verify", ensureAuth, requirePro, verifyAuthentication);

router.get("/insights/deep-analysis", ensureAuth, requirePro, (req, res) => {
  res.json({
    status: "Fortress Inspected",
    message: "Deep insights require a Luna Pro membership and only see aggregated, anonymous metrics.",
  });
});

export default router;
