import { generateQueryEmbedding } from './embeddings.js';
import { queryVectors } from './vectorStore.js';
import { chatCompletion, detectLanguage } from './hf.js';

/**
 * Run the full RAG pipeline:
 * 1. Embed the user's query
 * 2. Retrieve top-3 relevant chunks from Pinecone (filtered by tenant)
 * 3. Build a prompt with context
 * 4. Generate response via Sarvam-m
 *
 * @param {string} query - User's question
 * @param {string} tenantId - Tenant ID for context filtering
 * @param {string} [language] - Language code (auto-detected if not provided)
 * @returns {Promise<{ answer: string, language: string, sources: Object[] }>}
 */
export async function ragQuery(query, tenantId, language) {
  // Detect language if not provided
  const detectedLang = language || detectLanguage(query);

  // Step 1: Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query);

  // Step 2: Retrieve top-3 relevant chunks from Pinecone
  const matches = await queryVectors(queryEmbedding, tenantId, 3);

  if (matches.length === 0) {
    return {
      answer:
        detectedLang === 'hi-IN'
          ? 'मुझे इस प्रश्न का उत्तर देने के लिए कोई प्रासंगिक जानकारी नहीं मिली।'
          : detectedLang === 'kn-IN'
            ? 'ಈ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಲು ಯಾವುದೇ ಸಂಬಂಧಿತ ಮಾಹಿತಿ ಕಂಡುಬಂದಿಲ್ಲ.'
            : 'I could not find any relevant information to answer this question.',
      language: detectedLang,
      sources: [],
    };
  }

  // Step 3: Build context from retrieved chunks
  const contextChunks = matches.map((m, i) => {
    const meta = m.metadata;
    return `[Source ${i + 1} - ${meta.filename}]:\n${meta.text}`;
  });
  const context = contextChunks.join('\n\n');

  // Step 4: Build system prompt
  const systemPrompt = `You are a helpful multilingual assistant. Answer the user's question based ONLY on the provided context. If the context doesn't contain enough information to answer, say so clearly.

Respond in the same language the user asked in (Hindi, Kannada, or English).

Context:
${context}`;

  // Step 5: Generate response
  const answer = await chatCompletion(systemPrompt, query);

  return {
    answer,
    language: detectedLang,
    sources: matches.map((m) => ({
      filename: m.metadata.filename,
      chunkIndex: m.metadata.chunkIndex,
      score: m.score,
    })),
  };
}
