import { Router } from 'express';
import dotenv from 'dotenv';
import { sendMessage, downloadMedia } from '../services/whatsapp.js';
import { speechToText } from '../services/hf.js';
import { ragQuery } from '../services/rag.js';
import supabase from '../config/supabase.js';

dotenv.config();

const router = Router();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

/**
 * GET /webhook - WhatsApp webhook verification.
 * Meta sends a GET request to verify your webhook URL.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

/**
 * POST /webhook - Incoming WhatsApp messages.
 * Handles text and audio messages through the RAG pipeline.
 */
router.post('/', async (req, res) => {
  // Always respond 200 quickly to avoid Meta retries
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (!message) return; // Not a message event (could be status update)

    const from = message.from; // Sender's phone number
    const messageType = message.type;

    console.log(`Incoming ${messageType} message from ${from}`);

    // Look up tenant by WhatsApp number
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('whatsapp_number', from)
      .single();

    if (!tenant) {
      await sendMessage(from, 'Sorry, your number is not registered with any tenant. Please contact support.');
      return;
    }

    let queryText;
    let language;

    if (messageType === 'text') {
      queryText = message.text.body;
    } else if (messageType === 'audio') {
      // Download voice note and convert to text
      const audioBuffer = await downloadMedia(message.audio.id);
      const sttResult = await speechToText(audioBuffer);
      queryText = sttResult.text;
      language = sttResult.language;
      console.log(`STT result: "${queryText}" (${language})`);
    } else {
      await sendMessage(from, 'I can only process text and voice messages.');
      return;
    }

    if (!queryText || queryText.trim().length === 0) {
      await sendMessage(from, 'I could not understand your message. Please try again.');
      return;
    }

    // Run RAG pipeline
    const result = await ragQuery(queryText, tenant.id, language);

    // Send response back via WhatsApp
    await sendMessage(from, result.answer);
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
});

export default router;
