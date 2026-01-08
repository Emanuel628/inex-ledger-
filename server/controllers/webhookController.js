import crypto from "crypto";
import Stripe from "stripe";
import pool from "../db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2023-08-16" });
let processedEventsInitialized = false;

const ensureProcessedEventsTable = async () => {
  if (processedEventsInitialized) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS processed_events (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  );
  processedEventsInitialized = true;
};

const isEventProcessed = async (eventId) => {
  const { rows } = await pool.query("SELECT id FROM processed_events WHERE id = $1", [eventId]);
  if (!rows.length) return false;
  const existingId = rows[0].id;
  const idBuffer = Buffer.from(existingId);
  const eventBuffer = Buffer.from(eventId);
  if (idBuffer.length !== eventBuffer.length) return false;
  return crypto.timingSafeEqual(idBuffer, eventBuffer);
};

const markEventProcessed = async (eventId) => {
  await pool.query("INSERT INTO processed_events (id) VALUES ($1) ON CONFLICT DO NOTHING", [eventId]);
};

const upgradeUserToPro = async (userId) => {
  await pool.query("UPDATE users SET subscription_status = $1 WHERE id = $2", ["PRO", userId]);
};

const downgradeByCustomer = async (stripeCustomerId) => {
  await pool.query("UPDATE users SET subscription_status = $1 WHERE stripe_customer_id = $2", [
    "FREE",
    stripeCustomerId,
  ]);
};

export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing Stripe signature");
  }

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (err) {
    console.error("Stripe webhook verification failed:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const eventId = event.id;
  if (!eventId) {
    return res.status(400).send("Missing event identifier");
  }

  await ensureProcessedEventsTable();
  if (await isEventProcessed(eventId)) {
    return res.json({ received: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const blindUUID = session?.metadata?.luna_user_id;
        if (blindUUID) {
          await upgradeUserToPro(blindUUID);
          console.log(`[Billing] User ${blindUUID} upgraded to PRO (idempotent guard in place).`);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const customerId = event.data.object?.customer;
        if (customerId) {
          await downgradeByCustomer(customerId);
          console.log(`[Billing] Stripe customer ${customerId} dropped to FREE due to subscription deleted.`);
        }
        break;
      }
      case "invoice.payment_failed": {
        const customerId = event.data.object?.customer;
        console.warn(
          `[Billing] Payment failed for Stripe customer ${customerId}. Alerting security team.`
        );
        break;
      }
      default:
        console.debug(`[Stripe] Unhandled webhook event ${event.type}`);
    }
    await markEventProcessed(eventId);
  } catch (error) {
    console.error("Stripe webhook handling failed:", error);
    return res.status(500).send("Failed to handle webhook");
  }

  res.json({ received: true });
};
