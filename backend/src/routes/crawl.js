/**
 * crawl.js — Tenant website crawl endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/tenant/crawl           → initiate crawl (Tier 2 one-time / Tier 3)
 * GET  /api/tenant/crawl/:jobId    → poll crawl job status from DB
 * GET  /api/tenant/crawl           → list all crawl jobs for a tenant
 *
 * Tier enforcement:
 *   Tier 1 (plan_tier = 1) → 403 — upgrade required
 *   Tier 2 (plan_tier = 2) → one-time crawl, depth 2
 *   Tier 3 (plan_tier = 3) → recurring allowed, depth 3
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';
import { initiateCFCrawl } from '../services/crawlService.js';
import { enqueueTask } from '../services/queue.js';
import { crawlAndEmbed } from '../services/crawlService.js';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch tenant row and assert ownership via JWT sub (tenantId param for now).
 * Replace with real auth middleware when tenant auth is wired up.
 */
async function getTenant(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, plan_tier, company_name')
    .eq('id', tenantId)
    .single();

  if (error || !data) throw { status: 404, message: 'Tenant not found' };
  return data;
}

// ─── POST /api/tenant/crawl ───────────────────────────────────────────────────

/**
 * Initiate a crawl job for a tenant's website.
 *
 * Body: { tenant_id: string, url: string }
 *
 * - Tier 1 → 403
 * - Tier 2 → depth 2, fire-and-forget (async via queue), responds with job info
 * - Tier 3 → depth 3, fire-and-forget
 */
router.post('/', async (req, res) => {
  const { tenant_id, url } = req.body ?? {};

  if (!tenant_id || !url) {
    return res.status(400).json({ error: 'tenant_id and url are required' });
  }

  // Basic URL validation
  let parsed;
  try { parsed = new URL(url); } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'URL must be http or https' });
  }

  let tenant;
  try {
    tenant = await getTenant(tenant_id);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }

  const tier = tenant.plan_tier ?? 1;

  if (tier < 2) {
    return res.status(403).json({
      error: 'Website Auto-Sync requires Growth (Tier 2) or Enterprise (Tier 3). Please upgrade.',
    });
  }

  const depth       = tier >= 3 ? 3 : 2;
  const isRecurring = tier >= 3;

  // Respond immediately — crawl runs async in the background
  res.status(202).json({
    message:      'Crawl job queued. The AI will absorb your website in the background.',
    tenant_id,
    url,
    depth,
    is_recurring: isRecurring,
  });

  enqueueTask(
    () => crawlAndEmbed(tenant_id, url, { depth, isRecurring }),
    `crawl:${tenant_id}:${url}`,
  );
});

// ─── GET /api/tenant/crawl/:cfJobId ──────────────────────────────────────────

/**
 * Poll the DB status of a specific crawl job.
 * Query param: tenant_id (for ownership check)
 */
router.get('/:cfJobId', async (req, res) => {
  const { cfJobId } = req.params;
  const { tenant_id } = req.query;

  if (!tenant_id) return res.status(400).json({ error: 'tenant_id query param required' });

  const { data, error } = await supabase
    .from('tenant_crawl_jobs')
    .select('id, url, status, cf_job_id, is_recurring, created_at, completed_at, error')
    .eq('cf_job_id', cfJobId)
    .eq('tenant_id', tenant_id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Job not found' });

  res.json({ job: data });
});

// ─── GET /api/tenant/crawl ────────────────────────────────────────────────────

/**
 * List all crawl jobs for a tenant.
 * Query param: tenant_id
 */
router.get('/', async (req, res) => {
  const { tenant_id } = req.query;
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id query param required' });

  const { data, error } = await supabase
    .from('tenant_crawl_jobs')
    .select('id, url, status, cf_job_id, is_recurring, created_at, completed_at, error')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ jobs: data });
});

export default router;
