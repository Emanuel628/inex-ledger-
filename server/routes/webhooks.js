import express from "express";
import { handleStripeWebhook } from "../controllers/webhookController.js";

const router = express.Router();

router.post("/stripe", handleStripeWebhook);

export default router;
