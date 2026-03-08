import { Router } from 'express';
import { ragQuery } from '../services/rag.js';

const router = Router();

/**
 * POST /api/query
 * Query the RAG pipeline for a tenant.
 * Body: { query, tenantId, language? }
 */
router.post('/', async (req, res) => {
  try {
    const { query, tenantId, language } = req.body;

    if (!query || !tenantId) {
      return res.status(400).json({ error: 'query and tenantId are required' });
    }

    const result = await ragQuery(query, tenantId, language);
    res.json(result);
  } catch (err) {
    console.error('Query error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
