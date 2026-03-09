import { Router } from 'express';
import { ragQuery } from '../services/rag.js';
import supabase from '../config/supabase.js';

const router = Router();

/**
 * POST /api/query
 * Query the RAG pipeline for a tenant.
 * Body: { query, tenantId, language?, source? }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  try {
    const { query, tenantId, language, source = 'api' } = req.body;

    if (!query || !tenantId) {
      return res.status(400).json({ error: 'query and tenantId are required' });
    }

    const result = await ragQuery(query, tenantId, language);
    const response_ms = Date.now() - startTime;

    res.json(result);

    // Fire-and-forget analytics log
    supabase.from('queries').insert({
      tenant_id: tenantId,
      query_text: query,
      language: result.language || language || 'en',
      source,
      response_ms,
    }).then(() => {}).catch(() => {});

  } catch (err) {
    console.error('Query error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
