/**
 * Split text into chunks of ~500 characters with 50-character overlap.
 * Tries to break at sentence boundaries when possible.
 * @param {string} text - The full text to chunk
 * @param {number} chunkSize - Target chunk size (default 500)
 * @param {number} overlap - Overlap between chunks (default 50)
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, chunkSize = 500, overlap = 50) {
  if (!text || text.length === 0) return [];

  // Clean up whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    if (end >= cleaned.length) {
      // Last chunk — take everything remaining
      chunks.push(cleaned.slice(start).trim());
      break;
    }

    // Try to break at a sentence boundary (. ! ? followed by space)
    const segment = cleaned.slice(start, end);
    const lastSentenceEnd = Math.max(
      segment.lastIndexOf('. '),
      segment.lastIndexOf('! '),
      segment.lastIndexOf('? ')
    );

    if (lastSentenceEnd > chunkSize * 0.3) {
      // Found a good sentence break past 30% of the chunk
      end = start + lastSentenceEnd + 1;
    }

    chunks.push(cleaned.slice(start, end).trim());
    start = end - overlap;
  }

  return chunks;
}
