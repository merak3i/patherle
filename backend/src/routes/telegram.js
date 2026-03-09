import { Router } from 'express';
import { ragQuery } from '../services/rag.js';
import { speechToText } from '../services/hf.js';
import supabase from '../config/supabase.js';

const router = Router();

// ─── Helper: send a message via a tenant's bot token ─────────────────────────
async function sendTelegramMessage(botToken, chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
}

// ─── Helper: download a Telegram voice/audio file ────────────────────────────
async function downloadTelegramFile(botToken, fileId) {
  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const info = await infoRes.json();
  const filePath = info.result?.file_path;
  if (!filePath) throw new Error('Could not get file path from Telegram');

  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return buffer;
}

/**
 * POST /webhook/telegram/:tenantId
 * Receives Telegram Bot updates for a specific tenant.
 * Each tenant registers this URL as their bot webhook.
 */
router.post('/:tenantId', async (req, res) => {
  // Respond 200 immediately — Telegram will retry if we don't
  res.sendStatus(200);

  const startTime = Date.now();

  try {
    const { tenantId } = req.params;
    const update = req.body;

    // Support both message and channel_post
    const message = update.message || update.channel_post;
    if (!message) return;

    const chatId = message.chat.id;
    const messageType = message.voice ? 'voice' : message.audio ? 'audio' : message.text ? 'text' : null;
    if (!messageType) return;

    // Fetch tenant + bot token
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, company_name, telegram_bot_token')
      .eq('id', tenantId)
      .single();

    if (error || !tenant?.telegram_bot_token) {
      console.warn(`Telegram: no tenant or bot token for id=${tenantId}`);
      return;
    }

    const botToken = tenant.telegram_bot_token;
    let queryText;
    let language;

    if (messageType === 'text') {
      queryText = message.text;
    } else if (messageType === 'voice' || messageType === 'audio') {
      const fileId = (message.voice || message.audio).file_id;
      const audioBuffer = await downloadTelegramFile(botToken, fileId);
      const sttResult = await speechToText(audioBuffer);
      queryText = sttResult.text;
      language = sttResult.language;
    }

    if (!queryText?.trim()) {
      await sendTelegramMessage(botToken, chatId, 'I can only process text and voice messages. Please try again.');
      return;
    }

    // Run RAG
    const result = await ragQuery(queryText, tenantId, language);
    await sendTelegramMessage(botToken, chatId, result.answer || "I couldn't find an answer. Please try again.");

    // Fire-and-forget analytics
    supabase.from('queries').insert({
      tenant_id: tenantId,
      query_text: queryText,
      language: result.language || language || 'en',
      source: 'telegram',
      response_ms: Date.now() - startTime,
    }).then(() => {}).catch(() => {});

  } catch (err) {
    console.error('Telegram webhook error:', err.message);
  }
});

/**
 * POST /webhook/telegram/:tenantId/register
 * Registers this server's URL as the webhook for the tenant's Telegram bot.
 * Call this once after saving the bot token.
 * Body: { webhookBaseUrl } — optional, defaults to BACKEND_URL env
 */
router.post('/:tenantId/register', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { webhookBaseUrl } = req.body;

    const { data: tenant } = await supabase
      .from('tenants')
      .select('telegram_bot_token')
      .eq('id', tenantId)
      .single();

    if (!tenant?.telegram_bot_token) {
      return res.status(400).json({ error: 'No Telegram bot token saved for this tenant' });
    }

    const base = webhookBaseUrl || process.env.BACKEND_URL || 'https://your-backend.com';
    const webhookUrl = `${base}/webhook/telegram/${tenantId}`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${tenant.telegram_bot_token}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'channel_post'] }),
      }
    );
    const tgData = await tgRes.json();

    if (tgData.ok) {
      res.json({ success: true, webhook_url: webhookUrl, telegram: tgData });
    } else {
      res.status(400).json({ error: tgData.description, telegram: tgData });
    }
  } catch (err) {
    console.error('Telegram register webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
