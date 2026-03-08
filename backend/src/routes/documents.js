import { Router } from 'express';
import supabase from '../config/supabase.js';
import { deleteByFilename } from '../services/vectorStore.js';

const router = Router();

// GET documents for a tenant
router.get('/:tenantId', async (req, res) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('tenant_id', req.params.tenantId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE a document (also removes vectors from Pinecone)
router.delete('/:id', async (req, res) => {
  try {
    // Get document info first
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete vectors from Pinecone
    await deleteByFilename(doc.tenant_id, doc.filename);

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) return res.status(500).json({ error: deleteError.message });

    res.json({ message: 'Document and vectors deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
