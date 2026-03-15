/**
 * whatsapp.js — /webhook (WhatsApp Cloud API)
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /webhook  — Meta verification handshake (hub.challenge)
 * POST /webhook  — Incoming message ingestion + RAG pipeline
 *
 * Architecture:
 *   1. Respond HTTP 200 immediately (prevents Meta retries on slow LLM calls)
 *   2. Enqueue async task via queue.js for RAG + dispatch
 *   3. Per-tenant routing: look up by whatsapp_phone_id (NOT sender number)
 *   4. Audio: download media → Whisper STT → RAG
 *   5. Outbound: per-tenant token & phone_id from DB
 *
 * @module routes/whatsapp
 */

import { Router }                  from 'express';
import { sendMessageForTenant,
         downloadMedia }           from '../services/whatsapp.js';
import { speechToText }            from '../services/hf.js';
import { ragQuery }                from '../services/rag.js';
import { normalizeWhatsApp }       from '../utils/normalizer.js';
import { verifyWhatsAppSignature } from '../middleware/webhookAuth.js';
import { enqueueTask }             from '../services/queue.js';
import supabase                    from '../config/supabase.js';

const router = Router();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// ─── GET /webhook — Meta verification handshake ───────────────────────────────

router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[whatsapp] Webhook verified by Meta');
    return res.status(200).send(challenge);
  }

  console.warn('[whatsapp] Webhook verification failed — token mismatch');
  res.sendStatus(403);
});

// ─── POST /webhook — Incoming messages ────────────────────────────────────────

router.post('/', verifyWhatsAppSignature, (req, res) => {
  // ① Return 200 IMMEDIATELY — Meta retries if we don't respond within ~5 s
  res.sendStatus(200);

  // ② Normalize payload
  const normalized = normalizeWhatsApp(req.body);
  if (!normalized) return; // Ignore status updates, receipts, etc.

  const { text, message_type, audio_ref, meta } = normalized;
  const { phone_number_id, from, wamid } = meta;

  // Unsupported message type
  if (!text && !audio_ref) {
    enqueueTask(async () => {
      const tenant = await getTenantByPhoneId(phone_number_id);
      if (!tenant) return;
      await sendMessageForTenant(
        from,
        'I can only process text and voice messages. Please try again.',
        tenant.whatsapp_token,
        tenant.whatsapp_phone_id,
      );
    }, `wa:unsupported:${from}`).catch(() => {});
    return;
  }

  // ③ Enqueue the RAG pipeline — fire and forget
  enqueueTask(
    () => processWhatsAppMessage({ from, phone_number_id, text, message_type, audio_ref, wamid }),
    `wa:${from}`,
  ).catch(err => console.error('[whatsapp] Enqueued task failed:', err.message));
});

// ─── Core processing pipeline ─────────────────────────────────────────────────

/**
 * @param {{ from: string, phone_number_id: string, text: string|null,
 *           message_type: string, audio_ref: string|null, wamid: string }} params
 */
async function processWhatsAppMessage({ from, phone_number_id, text, message_type, audio_ref, wamid }) {
  const startTime = Date.now();

  // ── Tenant resolution (by business phone_number_id) ──
  const tenant = await getTenantByPhoneId(phone_number_id);
  if (!tenant) {
    console.warn(`[whatsapp] No tenant for phone_number_id=${phone_number_id}`);
    return;
  }

  let queryText  = text;
  let language;

  // ── Audio → STT ──
  if (message_type === 'audio' && audio_ref) {
    try {
      const audioBuffer = await downloadMedia(audio_ref, tenant.whatsapp_token);
      const sttResult   = await speechToText(audioBuffer);
      queryText = sttResult.text;
      language  = sttResult.language;
      console.log(`[whatsapp] STT: "${queryText}" (${language})`);
    } catch (err) {
      console.error('[whatsapp] STT error:', err.message);
      await sendMessageForTenant(
        from,
        'I could not process your voice message. Please try again or send a text.',
        tenant.whatsapp_token,
        tenant.whatsapp_phone_id,
      );
      return;
    }
  }

  if (!queryText?.trim()) {
    await sendMessageForTenant(
      from,
      'I could not understand your message. Please try again.',
      tenant.whatsapp_token,
      tenant.whatsapp_phone_id,
    );
    return;
  }

  // ── RAG pipeline ──
  let result;
  try {
    result = await ragQuery(queryText, tenant.id, language);
  } catch (err) {
    console.error('[whatsapp] RAG error:', err.message);
    await sendMessageForTenant(
      from,
      'I am having trouble answering right now. Please try again in a moment.',
      tenant.whatsapp_token,
      tenant.whatsapp_phone_id,
    );
    return;
  }

  // ── Outbound dispatch ──
  await sendMessageForTenant(
    from,
    result.answer,
    tenant.whatsapp_token,
    tenant.whatsapp_phone_id,
  );

  // ── Analytics ──
  supabase.from('queries').insert({
    tenant_id:   tenant.id,
    query_text:  queryText,
    language:    result.language || language || 'en-IN',
    source:      'whatsapp',
    response_ms: Date.now() - startTime,
  }).then(() => {}).catch(() => {});
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a tenant by the WhatsApp Business phone_number_id.
 * This is the correct multi-tenant routing key (not the sender's number).
 *
 * @param {string} phoneNumberId
 * @returns {Promise<Object|null>}
 */
async function getTenantByPhoneId(phoneNumberId) {
  if (!phoneNumberId) return null;
  const { data, error } = await supabase
    .from('tenants')
    .select('id, company_name, whatsapp_token, whatsapp_phone_id')
    .eq('whatsapp_phone_id', phoneNumberId)
    .single();
  if (error) {
    console.error('[whatsapp] Tenant lookup error:', error.message);
    return null;
  }
  return data;
}

export default router;
