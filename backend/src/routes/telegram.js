/**
 * telegram.js — /webhook/telegram
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /webhook/telegram/:tenantId          — Incoming Telegram Bot updates
 * POST /webhook/telegram/:tenantId/register — Register webhook with Telegram
 *
 * Architecture:
 *   1. Respond HTTP 200 immediately (prevents Telegram 1-min retry flood)
 *   2. Enqueue async RAG task via queue.js
 *   3. Per-tenant routing: tenantId in webhook URL
 *   4. Audio: download file from Telegram CDN → Whisper STT → RAG
 *   5. Outbound: per-tenant bot_token from DB
 */

import { Router }               from 'express';
import { ragQuery }             from '../services/rag.js';
import { speechToText }         from '../services/hf.js';
import { normalizeTelegram }    from '../utils/normalizer.js';
import { verifyTelegramSecret } from '../middleware/webhookAuth.js';
import { enqueueTask }          from '../services/queue.js';
import supabase                 from '../config/supabase.js';

const router = Router();

// ─── POST /webhook/telegram/:tenantId ─────────────────────────────────────────

router.post('/:tenantId', verifyTelegramSecret, (req, res) => {
  res.sendStatus(200); // ① Respond immediately

  const { tenantId } = req.params;
  const normalized = normalizeTelegram(req.body, tenantId);
  if (!normalized) return;

  const { text, message_type, audio_ref, meta } = normalized;

  enqueueTask(
    () => processTelegramMessage({ tenantId, chatId: meta.chat_id, text, message_type, audio_ref }),
    `tg:${tenantId}:${meta.chat_id}`,
  ).catch(err => console.error('[telegram] Enqueued task failed:', err.message));
});

// ─── Core processing pipeline ─────────────────────────────────────────────────

async function processTelegramMessage({ tenantId, chatId, text, message_type, audio_ref }) {
  const startTime = Date.now();

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, company_name, telegram_bot_token')
    .eq('id', tenantId)
    .single();

  if (error || !tenant?.telegram_bot_token) {
    console.warn(`[telegram] No tenant/token for tenantId=${tenantId}`);
    return;
  }

  const botToken = tenant.telegram_bot_token;

  if (!text && !audio_ref) {
    await sendTelegramMessage(botToken, chatId, 'I can only process text and voice messages. Please try again.');
    return;
  }

  let queryText = text;
  let language;

  if (message_type === 'audio' && audio_ref) {
    try {
      const audioBuffer = await downloadTelegramFile(botToken, audio_ref);
      const sttResult   = await speechToText(audioBuffer);
      queryText = sttResult.text;
      language  = sttResult.language;
      console.log(`[telegram] STT: "${queryText}" (${language})`);
    } catch (err) {
      console.error('[telegram] STT error:', err.message);
      await sendTelegramMessage(botToken, chatId, 'I could not process your voice message. Please try again or send a text.');
      return;
    }
  }

  if (!queryText?.trim()) {
    await sendTelegramMessage(botToken, chatId, 'I could not understand your message. Please try again.');
    return;
  }

  let result;
  try {
    result = await ragQuery(queryText, tenantId, language);
  } catch (err) {
    console.error('[telegram] RAG error:', err.message);
    await sendTelegramMessage(botToken, chatId, 'I am having trouble answering right now. Please try again in a moment.');
    return;
  }

  await sendTelegramMessage(botToken, chatId, result.answer || 'I could not find an answer. Please try rephrasing.');

  supabase.from('queries').insert({
    tenant_id:   tenantId,
    query_text:  queryText,
    language:    result.language || language || 'en-IN',
    source:      'telegram',
    response_ms: Date.now() - startTime,
  }).then(() => {}).catch(() => {});
}

// ─── POST /webhook/telegram/:tenantId/register ────────────────────────────────

router.post('/:tenantId/register', async (req, res) => {
  try {
    const { tenantId }       = req.params;
    const { webhookBaseUrl } = req.body;

    const { data: tenant } = await supabase
      .from('tenants')
      .select('telegram_bot_token')
      .eq('id', tenantId)
      .single();

    if (!tenant?.telegram_bot_token) {
      return res.status(400).json({ error: 'No Telegram bot token saved for this tenant' });
    }

    const base       = webhookBaseUrl || process.env.BACKEND_URL || 'https://your-backend.com';
    const webhookUrl = `${base}/webhook/telegram/${tenantId}`;

    const payload = {
      url:             webhookUrl,
      allowed_updates: ['message', 'channel_post'],
      max_connections: 40,
    };

    const secretToken = process.env.TELEGRAM_SECRET_TOKEN;
    if (secretToken) payload.secret_token = secretToken;

    const tgRes  = await fetch(
      `https://api.telegram.org/bot${tenant.telegram_bot_token}/setWebhook`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    const tgData = await tgRes.json();

    if (tgData.ok) {
      res.json({ success: true, webhook_url: webhookUrl, telegram: tgData });
    } else {
      res.status(400).json({ error: tgData.description, telegram: tgData });
    }
  } catch (err) {
    console.error('[telegram] Register webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendTelegramMessage(botToken, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('[telegram] sendMessage failed:', err.description);
    }
  } catch (err) {
    console.error('[telegram] sendMessage network error:', err.message);
  }
}

async function downloadTelegramFile(botToken, fileId) {
  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  if (!infoRes.ok) throw new Error(`getFile HTTP ${infoRes.status}`);
  const info     = await infoRes.json();
  const filePath = info.result?.file_path;
  if (!filePath) throw new Error('Telegram getFile returned no file_path');
  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!fileRes.ok) throw new Error(`File download HTTP ${fileRes.status}`);
  return Buffer.from(await fileRes.arrayBuffer());
}

export default router;
