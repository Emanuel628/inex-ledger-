/* =========================================================
   Luna Business – Server Entry (V1 Routes Only)
   ========================================================= */

import express from "express";

import systemRoutes from "./routes/system.routes.js";
import authRoutes from "./routes/auth.routes.js";
import meRoutes from "./routes/me.routes.js";
import businessRoutes from "./routes/business.routes.js";
import accountsRoutes from "./routes/accounts.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import transactionsRoutes from "./routes/transactions.routes.js";
import receiptsRoutes from "./routes/receipts.routes.js";
import exportsRoutes from "./routes/exports.routes.js";

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

app.use(express.json());

// Mount routes
app.use(systemRoutes);
app.use(authRoutes);
app.use(meRoutes);
app.use(businessRoutes);
app.use(accountsRoutes);
app.use(categoriesRoutes);
app.use(transactionsRoutes);
app.use(receiptsRoutes);
app.use(exportsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Luna Business API running on port ${PORT}`);
});
