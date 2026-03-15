import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

import tenantRoutes    from './routes/tenants.js';
import uploadRoutes    from './routes/upload.js';
import documentRoutes  from './routes/documents.js';
import queryRoutes     from './routes/query.js';
import analyticsRoutes from './routes/analytics.js';
import paymentRoutes   from './routes/payments.js';
import whatsappRoutes  from './routes/whatsapp.js';
import telegramRoutes  from './routes/telegram.js';
import chatRoutes      from './routes/chat.js';
import crawlRoutes     from './routes/crawl.js';
import cronRoutes      from './routes/cron.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = join(__dirname, '..', 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());

/**
 * Parse JSON bodies AND stash the raw buffer on req.rawBody.
 * The WhatsApp HMAC-SHA256 signature check in webhookAuth.js needs the
 * original bytes (any re-serialisation changes the signature).
 */
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: true }));

// ─── Routes ────────────────────────────────────────────────────────────────────

// REST API
app.use('/api/tenants',   tenantRoutes);
app.use('/api/upload',    uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/query',     queryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/chat',         chatRoutes);     // ← React web chatbot
app.use('/api/tenant/crawl', crawlRoutes);   // ← Tier 2/3 website auto-sync
app.use('/api/cron',         cronRoutes);    // ← Tier 3 daily sync (called by cron scheduler)

// Webhooks
app.use('/webhook',          whatsappRoutes);   // GET + POST /webhook
app.use('/webhook/telegram', telegramRoutes);   // POST /webhook/telegram/:tenantId

// ─── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
