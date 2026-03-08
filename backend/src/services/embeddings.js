import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HF_API_URL =
  'https://api-inference.huggingface.co/pipeline/feature-extraction/BAAI/bge-m3';

/**
 * Generate embeddings for an array of texts using HuggingFace BGE-m3.
 * Returns 1024-dimensional vectors.
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function generateEmbeddings(texts) {
  if (!process.env.HUGGINGFACE_API_KEY) {
    throw new Error('HUGGINGFACE_API_KEY not set in .env');
  }

  // HuggingFace has input limits; process in batches of 10
  const batchSize = 10;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await axios.post(
      HF_API_URL,
      { inputs: batch },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    // Response is array of embeddings, each being a 1024-dim array
    // Some models return nested arrays; handle both cases
    const embeddings = response.data.map((emb) => {
      if (Array.isArray(emb[0])) {
        // Token-level embeddings — mean pool to get sentence embedding
        const dim = emb[0].length;
        const pooled = new Array(dim).fill(0);
        for (const token of emb) {
          for (let d = 0; d < dim; d++) pooled[d] += token[d];
        }
        return pooled.map((v) => v / emb.length);
      }
      return emb;
    });

    allEmbeddings.push(...embeddings);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}

/**
 * Generate embedding for a single text query.
 * @param {string} text - Query text
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateQueryEmbedding(text) {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}
