/**
 * webhookAuth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-grade webhook signature validation middleware.
 *
 * WhatsApp Cloud API
 *   Meta signs every POST payload with HMAC-SHA256 using the App Secret and
 *   sends the result in the `X-Hub-Signature-256: sha256=<hex>` header.
 *   Reference: https://developers.facebook.com/docs/messenger-platform/webhooks#validate-payloads
 *
 * Telegram Bot API
 *   When registering a webhook with `secret_token`, Telegram sends that value
 *   verbatim in the `X-Telegram-Bot-Api-Secret-Token` header on every update.
 *   Reference: https://core.telegram.org/bots/api#setwebhook
 *
 * Both validators use `crypto.timingSafeEqual` to prevent timing attacks.
 * Both validators are no-ops when the corresponding env var is absent, so
 * development works without credentials (log a warning instead).
 *
 * @module middleware/webhookAuth
 */

import crypto from 'crypto';

// ─── WhatsApp HMAC-SHA256 Signature Verification ─────────────────────────────

/**
 * Express middleware that validates the `X-Hub-Signature-256` header sent by
 * Meta on every WhatsApp Cloud API webhook POST.
 *
 * IMPORTANT: `req.rawBody` must be populated before this middleware runs.
 * Use the `express.json({ verify })` approach in index.js (see below).
 *
 * Rejects with 403 if:
 *   - WHATSAPP_APP_SECRET is set but the header is missing
 *   - The signature does not match
 *
 * @type {import('express').RequestHandler}
 */
export function verifyWhatsAppSignature(req, res, next) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    // Not configured — skip. Log a warning in production.
    if (process.env.NODE_ENV === 'production') {
      console.warn('[webhookAuth] WHATSAPP_APP_SECRET not set — signature verification is DISABLED');
    }
    return next();
  }

  const sigHeader = req.headers['x-hub-signature-256'];
  if (!sigHeader || !sigHeader.startsWith('sha256=')) {
    console.warn('[webhookAuth] Missing or malformed X-Hub-Signature-256 header');
    return res.sendStatus(403);
  }

  if (!req.rawBody) {
    console.error('[webhookAuth] req.rawBody is undefined — ensure express.json verify hook is configured');
    return res.sendStatus(500);
  }

  const received = Buffer.from(sigHeader.slice(7), 'hex'); // strip 'sha256='
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest();

  // timingSafeEqual requires same-length buffers
  if (received.length !== expected.length) {
    return res.sendStatus(403);
  }

  if (!crypto.timingSafeEqual(received, expected)) {
    console.warn('[webhookAuth] WhatsApp signature mismatch — possible spoofed request');
    return res.sendStatus(403);
  }

  next();
}

// ─── Telegram Secret Token Verification ──────────────────────────────────────

/**
 * Express middleware that validates the `X-Telegram-Bot-Api-Secret-Token`
 * header sent by Telegram when a webhook is registered with a secret_token.
 *
 * Rejects with 403 if:
 *   - TELEGRAM_SECRET_TOKEN is set but the header is missing or mismatched
 *
 * @type {import('express').RequestHandler}
 */
export function verifyTelegramSecret(req, res, next) {
  const secret = process.env.TELEGRAM_SECRET_TOKEN;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[webhookAuth] TELEGRAM_SECRET_TOKEN not set — secret verification is DISABLED');
    }
    return next();
  }

  const provided = req.headers['x-telegram-bot-api-secret-token'];
  if (!provided) {
    console.warn('[webhookAuth] Missing X-Telegram-Bot-Api-Secret-Token header');
    return res.sendStatus(403);
  }

  // Use timingSafeEqual to prevent timing attacks
  const a = Buffer.from(provided,  'utf8');
  const b = Buffer.from(secret,    'utf8');

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn('[webhookAuth] Telegram secret token mismatch');
    return res.sendStatus(403);
  }

  next();
}

// ─── Web Chat API-Key Verification ───────────────────────────────────────────

/**
 * Express middleware that validates the `X-Api-Key` or `Authorization: Bearer`
 * header for the React web chat endpoint.
 *
 * @type {import('express').RequestHandler}
 */
export function verifyWebApiKey(req, res, next) {
  const apiKey = process.env.WEB_CHAT_API_KEY;

  if (!apiKey) return next(); // Not required if unset

  const provided =
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!provided) {
    return res.status(401).json({ error: 'API key required' });
  }

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(apiKey,   'utf8');

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
}
