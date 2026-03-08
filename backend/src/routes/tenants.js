import { Router } from 'express';
import supabase from '../config/supabase.js';

const router = Router();

// GET all tenants
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET tenant by ID
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Tenant not found' });
  res.json(data);
});

// POST create tenant
router.post('/', async (req, res) => {
  const { company_name, industry, whatsapp_number } = req.body;

  if (!company_name) {
    return res.status(400).json({ error: 'company_name is required' });
  }

  const { data, error } = await supabase
    .from('tenants')
    .insert({ company_name, industry, whatsapp_number })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE tenant
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Tenant deleted' });
});

export default router;
