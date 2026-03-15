/**
 * cron.js — Scheduled sync endpoint for Tier 3 tenants
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/cron/sync-catalogs
 *
 * Called by an external cron scheduler (Vercel Cron, Railway cron, etc.)
 * on a daily schedule.  Finds all Tier 3 tenants with registered crawl URLs
 * and re-triggers the full crawl → embed pipeline for each.
 *
 * Security: protected by CRON_SECRET header to prevent public invocation.
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';
import { enqueueTask } from '../services/queue.js';
import { crawlAndEmbed } from '../services/crawlService.js';

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

function verifyCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[cron] CRON_SECRET is not set — endpoint is unprotected!');
    return next();
  }
  const provided = req.headers['x-cron-secret'] ?? req.query.secret;
  if (provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── GET /api/cron/sync-catalogs ─────────────────────────────────────────────

router.get('/sync-catalogs', verifyCronSecret, async (_req, res) => {
  // 1. Find all Tier 3 tenants (plan_tier = 3) with at least one recurring crawl job
  const { data: tenants, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, company_name')
    .eq('plan_tier', 3);

  if (tenantErr) {
    return res.status(500).json({ error: tenantErr.message });
  }

  if (!tenants?.length) {
    return res.json({ message: 'No Tier 3 tenants found', queued: 0 });
  }

  const tenantIds = tenants.map((t) => t.id);

  // 2. Fetch the most recent registered URL per tenant (is_recurring = true)
  const { data: jobs, error: jobErr } = await supabase
    .from('tenant_crawl_jobs')
    .select('tenant_id, url')
    .in('tenant_id', tenantIds)
    .eq('is_recurring', true)
    .order('created_at', { ascending: false });

  if (jobErr) {
    return res.status(500).json({ error: jobErr.message });
  }

  // Deduplicate — keep only the latest registered URL per tenant
  /** @type {Map<string, string>} tenantId → url */
  const latestUrl = new Map();
  for (const job of jobs ?? []) {
    if (!latestUrl.has(job.tenant_id)) {
      latestUrl.set(job.tenant_id, job.url);
    }
  }

  // 3. Queue crawl for each tenant
  let queued = 0;
  for (const [tenantId, url] of latestUrl.entries()) {
    enqueueTask(
      () => crawlAndEmbed(tenantId, url, { depth: 3, isRecurring: true }),
      `cron-crawl:${tenantId}`,
    );
    queued++;
  }

  console.log(`[cron] sync-catalogs: queued ${queued} crawl jobs`);

  res.json({
    message:      `Queued ${queued} Tier 3 crawl sync jobs`,
    queued,
    tenant_count: tenants.length,
  });
});

export default router;
