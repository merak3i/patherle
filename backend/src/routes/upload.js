import { Router } from 'express';
import fs from 'fs';
import upload from '../middleware/multerConfig.js';
import { extractTextFromPDF } from '../services/pdfParser.js';
import { extractTextFromCSV } from '../services/csvParser.js';
import { chunkText } from '../services/chunker.js';
import { generateEmbeddings } from '../services/embeddings.js';
import { upsertVectors, deleteByFilename } from '../services/vectorStore.js';
import supabase from '../config/supabase.js';

const router = Router();

/**
 * POST /api/upload
 * Upload a PDF or CSV file for a tenant.
 * Body (multipart/form-data): file + tenantId
 *
 * Pipeline: upload → parse → chunk → embed → store in Pinecone + record in Supabase
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path: filePath, originalname, mimetype } = req.file;
    const fileType = mimetype === 'application/pdf' ? 'pdf' : 'csv';

    console.log(`Processing ${fileType} file: ${originalname} for tenant: ${tenantId}`);

    // Step 1: Extract text
    let text;
    if (fileType === 'pdf') {
      text = await extractTextFromPDF(filePath);
    } else {
      text = extractTextFromCSV(filePath);
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text content found in file' });
    }

    console.log(`Extracted ${text.length} characters`);

    // Step 2: Chunk text
    const chunks = chunkText(text);
    console.log(`Created ${chunks.length} chunks`);

    // Step 3: Generate embeddings via HuggingFace BGE-m3
    const embeddings = await generateEmbeddings(chunks);
    console.log(`Generated ${embeddings.length} embeddings`);

    // Step 4: Delete old vectors for same filename (knowledge refresh)
    await deleteByFilename(tenantId, originalname);

    // Step 5: Upsert to Pinecone
    const vectors = chunks.map((chunk, i) => ({
      id: `${tenantId}-${originalname}-${i}`,
      values: embeddings[i],
      metadata: {
        tenantId,
        filename: originalname,
        chunkIndex: i,
        text: chunk,
      },
    }));

    await upsertVectors(vectors);
    console.log(`Upserted ${vectors.length} vectors to Pinecone`);

    // Step 6: Record in Supabase (upsert to handle re-uploads)
    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .upsert(
        {
          tenant_id: tenantId,
          filename: originalname,
          file_type: fileType,
          chunk_count: chunks.length,
        },
        { onConflict: 'tenant_id,filename' }
      )
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError.message);
    }

    // Cleanup uploaded file
    fs.unlinkSync(filePath);

    res.status(201).json({
      message: 'File processed and indexed successfully',
      document: doc,
      stats: {
        characters: text.length,
        chunks: chunks.length,
        vectors: vectors.length,
      },
    });
  } catch (err) {
    console.error('Upload error:', err.message);
    // Cleanup file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
