import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const API_KEY = process.env.SARVAM_API_KEY;

/**
 * Generate a chat response using Sarvam-m LLM.
 * @param {string} systemPrompt - System instructions
 * @param {string} userMessage - User query
 * @returns {Promise<string>} LLM response text
 */
export async function chatCompletion(systemPrompt, userMessage) {
  const response = await axios.post(
    `${SARVAM_BASE_URL}/v1/chat/completions`,
    {
      model: 'sarvam-m',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * Convert audio to text using Sarvam's saaras:v3 STT.
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{ text: string, language: string }>}
 */
export async function speechToText(audioBuffer, filename) {
  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: filename || 'audio.ogg',
    contentType: 'audio/ogg',
  });
  form.append('model', 'saaras:v3');
  form.append('mode', 'transcribe');

  const response = await axios.post(
    `${SARVAM_BASE_URL}/speech-to-text`,
    form,
    {
      headers: {
        'api-subscription-key': API_KEY,
        ...form.getHeaders(),
      },
      timeout: 30000,
    }
  );

  return {
    text: response.data.transcript,
    language: response.data.language_code || 'en-IN',
  };
}

/**
 * Translate text between languages.
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code (e.g., 'hi-IN', 'en-IN', 'kn-IN')
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
export async function translateText(text, sourceLang, targetLang) {
  if (sourceLang === targetLang) return text;

  const response = await axios.post(
    `${SARVAM_BASE_URL}/translate`,
    {
      input: text,
      source_language_code: sourceLang,
      target_language_code: targetLang,
    },
    {
      headers: {
        'api-subscription-key': API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return response.data.translated_text;
}

/**
 * Detect the language of input text.
 * Simple heuristic using character ranges for Hindi, Kannada, English.
 * @param {string} text
 * @returns {string} Language code: 'hi-IN', 'kn-IN', or 'en-IN'
 */
export function detectLanguage(text) {
  // Devanagari (Hindi): U+0900 to U+097F
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  // Kannada: U+0C80 to U+0CFF
  const kannadaChars = (text.match(/[\u0C80-\u0CFF]/g) || []).length;
  // ASCII/Latin (English)
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;

  const total = hindiChars + kannadaChars + englishChars;
  if (total === 0) return 'en-IN';

  if (hindiChars / total > 0.3) return 'hi-IN';
  if (kannadaChars / total > 0.3) return 'kn-IN';
  return 'en-IN';
}
