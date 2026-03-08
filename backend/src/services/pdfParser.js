import fs from 'fs';
import pdfParse from 'pdf-parse';

/**
 * Extract text content from a PDF file.
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text.trim();
}
