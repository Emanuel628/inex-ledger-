import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import { encryptToken, decryptToken } from './services/encryptionService.js';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import securityRouter from './routes/securityRoutes.js';
import vaultRouter from './routes/vaultRoutes.js';
import webhooksRouter from './routes/webhooks.js';
import momentumRouter from './routes/momentumRoutes.js';
import setupSwagger from './swagger.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(
  express.json({
    verify: (req, res, buf) => {
      // Keep a raw copy for Stripe webhook verification
      req.rawBody = buf;
    },
  })
);

setupSwagger(app);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

app.post('/encrypt', (req, res) => {
  const { value } = req.body;
  if (!value) return res.status(400).json({ error: 'value is required' });
  const encrypted = encryptToken(value);
  res.json({ encrypted });
});

app.post('/decrypt', (req, res) => {
  const { value } = req.body;
  if (!value) return res.status(400).json({ error: 'value is required' });
  const decrypted = decryptToken(value);
  res.json({ decrypted });
});

app.use('/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/security', securityRouter);
app.use('/api/momentum', momentumRouter);
app.use('/api/vault', vaultRouter);
app.use('/webhooks', webhooksRouter);

app.use('/docs', express.static(path.join(process.cwd(), 'docs')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Luna API listening on port ${PORT}`);
});
