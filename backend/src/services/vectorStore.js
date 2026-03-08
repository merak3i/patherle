import pinecone from '../config/pinecone.js';
import dotenv from 'dotenv';

dotenv.config();

const INDEX_NAME = 'knowledge-base';

/**
 * Get (or create) the Pinecone index.
 * The index must have 1024 dimensions for BGE-m3 embeddings.
 */
async function getIndex() {
  return pinecone.index(INDEX_NAME);
}

/**
 * Upsert embedding vectors into Pinecone with metadata.
 * @param {Object[]} vectors - Array of { id, values, metadata }
 */
export async function upsertVectors(vectors) {
  const index = await getIndex();

  // Pinecone accepts max 100 vectors per upsert
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
  }
}

/**
 * Query Pinecone for similar vectors, filtered by tenantId.
 * @param {number[]} embedding - Query vector (1024-dim)
 * @param {string} tenantId - Tenant ID to filter by
 * @param {number} topK - Number of results (default 3)
 * @returns {Promise<Object[]>} Matching results with metadata
 */
export async function queryVectors(embedding, tenantId, topK = 3) {
  const index = await getIndex();

  const result = await index.query({
    vector: embedding,
    topK,
    filter: { tenantId: { $eq: tenantId } },
    includeMetadata: true,
  });

  return result.matches || [];
}

/**
 * Delete all vectors for a specific tenant + filename.
 * Used for knowledge refresh (re-uploading same file).
 * @param {string} tenantId
 * @param {string} filename
 */
export async function deleteByFilename(tenantId, filename) {
  const index = await getIndex();

  // Query for matching vector IDs first
  // Use a zero vector to get all, filtered by metadata
  const dummyVector = new Array(1024).fill(0);
  const results = await index.query({
    vector: dummyVector,
    topK: 10000,
    filter: {
      tenantId: { $eq: tenantId },
      filename: { $eq: filename },
    },
    includeMetadata: false,
  });

  if (results.matches && results.matches.length > 0) {
    const ids = results.matches.map((m) => m.id);
    // Delete in batches of 1000
    for (let i = 0; i < ids.length; i += 1000) {
      await index.deleteMany(ids.slice(i, i + 1000));
    }
  }
}
