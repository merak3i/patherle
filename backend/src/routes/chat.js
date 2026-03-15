/**
 * chat.js — POST /api/chat/web
 * ─────────────────────────────────────────────────────────────────────────────
 * REST endpoint for the React web chatbot.
 *
 * Request body:
 *   { message: string, tenantId: string, sessionId?: string, language?: string }
 *
 * Response:
 *   { answer: string, language: string, sources: Object[], session_id: string }
 *
 * Security:
 *   Optional WEB_CHAT_API_KEY env var gates access (via verifyWebApiKey middleware).
 *   Tenant existence is validated before RAG to prevent info-leakage on bad IDs.
 *
 * @module routes/chat
 */

import { Router }         from 'express';
import { ragQuery }       from '../services/rag.js';
import { normalizeWeb }   from '../utils/normalizer.js';
import { verifyWebApiKey } from '../middleware/webhookAuth.js';
import supabase           from '../config/supabase.js';

const router = Router();

// ─── Rate-limit state (simple in-process token bucket per session) ────────────
/** @type {Map<string, { count: number, windowStart: number }>} */
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_RPM   = Number(process.env.WEB_CHAT_RPM) || 30;

function checkRateLimit(sessionId) {
  const now    = Date.now();
  const bucket = rateLimitMap.get(sessionId);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(sessionId, { count: 1, windowStart: now });
    return true; // OK
  }

  bucket.count++;
  if (bucket.count > RATE_LIMIT_MAX_RPM) return false; // Blocked
  return true; // OK
}

// Purge stale buckets every 5 minutes to prevent unbounded growth
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [key, val] of rateLimitMap.entries()) {
    if (val.windowStart < cutoff) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/chat/web
 *
 * Synchronous: waits for RAG + LLM response before replying.
 * (Unlike WA/TG webhooks which fire-and-forget, the web client expects
 * a direct response in the same HTTP call.)
 */
router.post('/', verifyWebApiKey, async (req, res) => {
  const startTime = Date.now();

  // ── Normalize & validate ──
  const normalized = normalizeWeb(req.body);
  if (!normalized) {
    return res.status(400).json({
      error: 'Invalid request. Required: { message: string, tenantId: string }',
    });
  }

  const { text, tenant_id, sender_id, language_hint } = normalized;

  // ── Rate limiting ──
  if (!checkRateLimit(sender_id)) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retry_after_ms: RATE_LIMIT_WINDOW_MS,
    });
  }

  // ── Validate tenant exists ──
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, company_name')
    .eq('id', tenant_id)
    .single();

  if (tenantErr || !tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  try {
    // ── RAG pipeline ──
    const result      = await ragQuery(text, tenant_id, language_hint);
    const response_ms = Date.now() - startTime;

    // ── Response ──
    res.json({
      answer:     result.answer,
      language:   result.language,
      sources:    result.sources,
      session_id: sender_id,
    });

    // ── Fire-and-forget analytics ──
    supabase.from('queries').insert({
      tenant_id,
      query_text:  text,
      language:    result.language || language_hint || 'en-IN',
      source:      'web',
      response_ms,
    }).then(() => {}).catch(() => {});

  } catch (err) {
    console.error('[chat/web] RAG error:', err.message);

    // Don't expose internal errors to the client
    if (!res.headersSent) {
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
});

export default router;
