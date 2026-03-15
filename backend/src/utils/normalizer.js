/**
 * normalizer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified message normalization layer for Patherle's omnichannel webhook router.
 * Converts raw payloads from WhatsApp Cloud API, Telegram Bot API, and the
 * React Web Chat into a single NormalizedMessage shape consumed by all handlers.
 *
 * @module utils/normalizer
 */

// ─── JSDoc Typedefs (TypeScript-equivalent interfaces) ───────────────────────

/**
 * @typedef {'whatsapp'|'telegram'|'web'} Channel
 * @typedef {'text'|'audio'} MessageType
 * @typedef {'hi-IN'|'kn-IN'|'en-IN'} LanguageCode
 */

/**
 * @typedef {Object} NormalizedMessage
 * @property {Channel}           channel        - Originating channel
 * @property {string}            sender_id      - Sender identifier (WA phone / TG chat_id / web session_id)
 * @property {string|null}       tenant_id      - Resolved tenant UUID (null until DB lookup)
 * @property {MessageType}       message_type   - 'text' or 'audio'
 * @property {string|null}       text           - Text content (populated after STT for audio)
 * @property {string|null}       audio_ref      - Channel-specific audio reference (media_id / file_id)
 * @property {LanguageCode|null} language_hint  - Known language (Whisper output or caller hint)
 * @property {WhatsAppMeta|TelegramMeta|WebMeta} meta  - Channel-specific routing metadata
 * @property {Object}            _raw           - Original payload for debugging / audit
 */

/**
 * @typedef {Object} WhatsAppMeta
 * @property {string} phone_number_id  - Business phone ID → used for tenant routing
 * @property {string} from             - Sender's phone number
 * @property {string} wamid            - WhatsApp message ID for deduplication
 */

/**
 * @typedef {Object} TelegramMeta
 * @property {number} chat_id          - Telegram chat ID → used for sending reply
 * @property {number} update_id        - Update ID for deduplication
 * @property {string} tenant_id_param  - Tenant UUID from URL param
 */

/**
 * @typedef {Object} WebMeta
 * @property {string} session_id       - Client-provided session ID
 * @property {string} tenant_id        - Tenant UUID from request body
 */

// ─── WhatsApp Cloud API ───────────────────────────────────────────────────────

/**
 * Parse a WhatsApp Cloud API webhook payload into a NormalizedMessage.
 *
 * Handles:
 *   - Text messages
 *   - Audio / voice notes (message.type = 'audio')
 *   - Silently ignores status updates and unsupported types
 *
 * Tenant routing key: meta.phone_number_id → matches tenants.whatsapp_phone_id
 *
 * @param {Object} body - Raw req.body from the POST /webhook/whatsapp handler
 * @returns {NormalizedMessage|null}  null if the payload is not a processable message
 */
export function normalizeWhatsApp(body) {
  try {
    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null; // Status update or non-message event

    const phone_number_id = value.metadata?.phone_number_id ?? null;
    const from            = message.from;
    const wamid           = message.id;
    const type            = message.type; // 'text' | 'audio' | 'image' | …

    if (type !== 'text' && type !== 'audio') {
      // Unsupported type — caller should respond "I can only process text/voice"
      return {
        channel:       'whatsapp',
        sender_id:     from,
        tenant_id:     null,
        message_type:  'text',
        text:          null, // sentinel: null text + no audio_ref = unsupported
        audio_ref:     null,
        language_hint: null,
        meta:          { phone_number_id, from, wamid },
        _raw:          body,
      };
    }

    return {
      channel:       'whatsapp',
      sender_id:     from,
      tenant_id:     null,
      message_type:  type === 'audio' ? 'audio' : 'text',
      text:          type === 'text'  ? (message.text?.body ?? null) : null,
      audio_ref:     type === 'audio' ? (message.audio?.id  ?? null) : null,
      language_hint: null,
      meta:          { phone_number_id, from, wamid },
      _raw:          body,
    };
  } catch (err) {
    console.error('[normalizer] normalizeWhatsApp failed:', err.message);
    return null;
  }
}

// ─── Telegram Bot API ─────────────────────────────────────────────────────────

/**
 * Parse a Telegram Bot API Update into a NormalizedMessage.
 *
 * Handles:
 *   - message.text  → MessageType 'text'
 *   - message.voice → MessageType 'audio'
 *   - message.audio → MessageType 'audio'
 *   - channel_post  → same as message
 *
 * Tenant routing key: tenantId URL param (pre-resolved by caller)
 *
 * @param {Object} update   - Raw Telegram Update object
 * @param {string} tenantId - Tenant UUID from the webhook URL parameter
 * @returns {NormalizedMessage|null}
 */
export function normalizeTelegram(update, tenantId) {
  try {
    const message = update.message || update.channel_post;
    if (!message) return null;

    const chatId    = message.chat.id;
    const updateId  = update.update_id;
    const voiceFile = message.voice || message.audio;
    const isAudio   = !!voiceFile;

    return {
      channel:       'telegram',
      sender_id:     String(chatId),
      tenant_id:     tenantId,
      message_type:  isAudio ? 'audio' : 'text',
      text:          !isAudio ? (message.text ?? null) : null,
      audio_ref:     isAudio  ? (voiceFile.file_id ?? null) : null,
      language_hint: null,
      meta:          { chat_id: chatId, update_id: updateId, tenant_id_param: tenantId },
      _raw:          update,
    };
  } catch (err) {
    console.error('[normalizer] normalizeTelegram failed:', err.message);
    return null;
  }
}

// ─── React Web Chat ───────────────────────────────────────────────────────────

/**
 * Parse a React Web Chat POST body into a NormalizedMessage.
 *
 * Expected body shape:
 *   { message: string, tenantId: string, sessionId?: string, language?: string }
 *
 * @param {Object} body - Raw req.body from POST /api/chat/web
 * @returns {NormalizedMessage|null}  null if required fields are missing
 */
export function normalizeWeb(body) {
  try {
    const { message, tenantId, sessionId = 'anon', language = null } = body ?? {};

    if (!message || !tenantId) return null;

    return {
      channel:       'web',
      sender_id:     sessionId,
      tenant_id:     tenantId,
      message_type:  'text',
      text:          message,
      audio_ref:     null,
      language_hint: language,
      meta:          { session_id: sessionId, tenant_id: tenantId },
      _raw:          body,
    };
  } catch (err) {
    console.error('[normalizer] normalizeWeb failed:', err.message);
    return null;
  }
}
