/**
 * whatsapp.js — WhatsApp Cloud API helpers
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides two modes of operation:
 *
 *   1. Per-tenant  (multi-tenant SaaS, preferred):
 *      sendMessageForTenant(to, text, token, phoneId)
 *      downloadMedia(mediaId, token)
 *
 *   2. Legacy single-tenant (env-var creds, kept for backwards compat):
 *      sendMessage(to, text)
 *
 * @module services/whatsapp
 */

import axios from 'axios';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// ─── Legacy single-tenant helpers (env-var credentials) ───────────────────────
// Kept for backward-compatibility. New code should prefer the *ForTenant variants.

const _DEFAULT_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const _DEFAULT_TOKEN    = process.env.WHATSAPP_TOKEN;

/**
 * Send a WhatsApp text message using global env-var credentials.
 * @deprecated  Use sendMessageForTenant for multi-tenant setups.
 * @param {string} to   - Recipient phone number (E.164 without '+')
 * @param {string} text - Message body
 */
export async function sendMessage(to, text) {
  return sendMessageForTenant(to, text, _DEFAULT_TOKEN, _DEFAULT_PHONE_ID);
}

// ─── Per-tenant helpers ────────────────────────────────────────────────────────

/**
 * Send a WhatsApp text message using per-tenant credentials from the DB.
 *
 * @param {string} to      - Recipient phone number (E.164 without '+')
 * @param {string} text    - Message body
 * @param {string} token   - Tenant's WhatsApp access token
 * @param {string} phoneId - Tenant's WhatsApp Business phone_number_id
 * @returns {Promise<void>}
 */
export async function sendMessageForTenant(to, text, token, phoneId) {
  if (!token || !phoneId) {
    throw new Error('[whatsapp] sendMessageForTenant: missing token or phoneId');
  }

  await axios.post(
    `${GRAPH_API}/${phoneId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
}

/**
 * Download a WhatsApp media file (voice note, image, etc.) using a per-tenant token.
 *
 * Two-step process required by the Graph API:
 *   1. GET /{media_id}       → resolves the temporary download URL
 *   2. GET {download_url}    → streams the binary content
 *
 * @param {string} mediaId - WhatsApp media ID from the incoming message
 * @param {string} token   - Tenant's WhatsApp access token (or falls back to env var)
 * @returns {Promise<Buffer>} Raw media bytes
 */
export async function downloadMedia(mediaId, token = _DEFAULT_TOKEN) {
  if (!token) {
    throw new Error('[whatsapp] downloadMedia: no token provided and WHATSAPP_TOKEN is unset');
  }

  // Step 1 — resolve the media URL
  const { data: meta } = await axios.get(`${GRAPH_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Step 2 — download the actual binary
  const { data } = await axios.get(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
  });

  return Buffer.from(data);
}
