import fs from 'fs';
import { parse } from 'csv-parse/sync';

/**
 * Extract text content from a CSV file.
 * Each row is joined into a single text line; all rows combined.
 * @param {string} filePath - Path to the CSV file
 * @returns {string} Extracted text
 */
export function extractTextFromCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Convert each row into a readable text line
  const lines = records.map((row) => {
    return Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  });

  return lines.join('\n');
}
