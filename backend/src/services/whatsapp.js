import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

/**
 * Send a text message via WhatsApp Cloud API.
 * @param {string} to - Recipient phone number (with country code, no +)
 * @param {string} text - Message text
 */
export async function sendMessage(to, text) {
  await axios.post(
    `${GRAPH_API}/${PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Download media (voice notes, images) from WhatsApp.
 * @param {string} mediaId - WhatsApp media ID
 * @returns {Promise<Buffer>} Media file as buffer
 */
export async function downloadMedia(mediaId) {
  // Step 1: Get the media URL
  const urlResponse = await axios.get(`${GRAPH_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const mediaUrl = urlResponse.data.url;

  // Step 2: Download the actual file
  const fileResponse = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    responseType: 'arraybuffer',
  });

  return Buffer.from(fileResponse.data);
}
