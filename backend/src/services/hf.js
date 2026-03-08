/**
 * HuggingFace Inference API service
 *
 * Handles:
 *   - STT  : openai/whisper-large-v3
 *   - LLM  : meta-llama/Meta-Llama-3.1-8B-Instruct
 *   - TTS  : facebook/mms-tts-{hin|kan|eng}
 *
 * All calls include 503 retry logic with exponential backoff
 * (HF serverless inference cold-starts a model on first request).
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HF_BASE = 'https://api-inference.huggingface.co';
const API_KEY = process.env.HUGGINGFACE_API_KEY;

const authHeaders = () => ({
  Authorization: `Bearer ${API_KEY}`,
});

// ─── Retry helper ─────────────────────────────────────────────────────────────
/**
 * Call `fn` and retry on HuggingFace 503 "model loading" responses.
 * Uses the `estimated_time` from the HF response body when available.
 *
 * @param {() => Promise<any>} fn - Async function to call
 * @param {number} maxRetries
 */
async function withHFRetry(fn, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      const body   = err.response?.data;

      const isModelLoading =
        status === 503 ||
        (status === 500 && body?.error?.toLowerCase().includes('loading'));

      if (isModelLoading && attempt < maxRetries) {
        const waitMs = ((body?.estimated_time ?? Math.pow(2, attempt) * 5) * 1000);
        const waitSec = (waitMs / 1000).toFixed(1);
        console.log(`HF model loading (attempt ${attempt + 1}/${maxRetries}). Retrying in ${waitSec}s…`);
        await new Promise(r => setTimeout(r, Math.min(waitMs, 60_000)));
        continue;
      }

      // Propagate with a readable message
      const message = body?.error || err.message || 'HuggingFace API error';
      throw new Error(`HF [${status}] ${message}`);
    }
  }
}

// ─── LLM: chat completion ──────────────────────────────────────────────────────
const LLM_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct';

/**
 * Generate a chat response using Llama-3.1-8B-Instruct on HuggingFace.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
export async function chatCompletion(systemPrompt, userMessage) {
  const result = await withHFRetry(() =>
    axios.post(
      `${HF_BASE}/models/${LLM_MODEL}/v1/chat/completions`,
      {
        model: LLM_MODEL,
        messages: [
          { role: 'system',  content: systemPrompt },
          { role: 'user',    content: userMessage },
        ],
        max_tokens: 1024,
        temperature: 0.4,
      },
      {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        timeout: 60_000,
      }
    )
  );

  return result.data.choices[0].message.content.trim();
}

// ─── STT: Whisper large-v3 ────────────────────────────────────────────────────
const WHISPER_MODEL = 'openai/whisper-large-v3';

/**
 * Transcribe an audio buffer using Whisper large-v3.
 * Returns transcript + detected language code.
 * @param {Buffer} audioBuffer
 * @returns {Promise<{ text: string, language: string }>}
 */
export async function speechToText(audioBuffer) {
  const result = await withHFRetry(() =>
    axios.post(
      `${HF_BASE}/models/${WHISPER_MODEL}`,
      audioBuffer,
      {
        headers: {
          ...authHeaders(),
          'Content-Type': 'audio/ogg',
        },
        timeout: 60_000,
        // Ask HF to return language detection
        params: { return_timestamps: false },
      }
    )
  );

  const text     = result.data?.text?.trim() ?? '';
  const langCode = result.data?.chunks?.[0]?.language ?? null;

  // Map Whisper language codes to our codes
  const langMap = { hi: 'hi-IN', kn: 'kn-IN', en: 'en-IN' };
  const language = langCode ? (langMap[langCode] ?? 'en-IN') : detectLanguage(text);

  return { text, language };
}

// ─── TTS: Facebook MMS ────────────────────────────────────────────────────────
const TTS_MODELS = {
  'hi-IN': 'facebook/mms-tts-hin',
  'kn-IN': 'facebook/mms-tts-kan',
  'en-IN': 'facebook/mms-tts-eng',
};

/**
 * Synthesise speech from text using Facebook MMS-TTS.
 * Returns a WAV audio Buffer.
 * @param {string} text
 * @param {string} language - 'hi-IN' | 'kn-IN' | 'en-IN'
 * @returns {Promise<Buffer>}
 */
export async function textToSpeech(text, language = 'en-IN') {
  const model = TTS_MODELS[language] ?? TTS_MODELS['en-IN'];

  const result = await withHFRetry(() =>
    axios.post(
      `${HF_BASE}/models/${model}`,
      { inputs: text },
      {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
        timeout: 60_000,
      }
    )
  );

  return Buffer.from(result.data);
}

// ─── Language detection (local, no API cost) ──────────────────────────────────
/**
 * Detect language via Unicode character ranges.
 * @param {string} text
 * @returns {'hi-IN'|'kn-IN'|'en-IN'}
 */
export function detectLanguage(text) {
  const hi  = (text.match(/[\u0900-\u097F]/g) ?? []).length; // Devanagari
  const kn  = (text.match(/[\u0C80-\u0CFF]/g) ?? []).length; // Kannada
  const en  = (text.match(/[a-zA-Z]/g)        ?? []).length;
  const total = hi + kn + en;
  if (total === 0) return 'en-IN';
  if (hi / total > 0.3) return 'hi-IN';
  if (kn / total > 0.3) return 'kn-IN';
  return 'en-IN';
}
