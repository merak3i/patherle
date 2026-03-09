import { Router } from 'express';
import supabase from '../config/supabase.js';

const router = Router();

/**
 * GET /api/analytics/:tenantId
 * Returns query stats for the dashboard.
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from('queries')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Aggregate stats
    const total = rows.length;
    const avgLatency = total
      ? Math.round(rows.reduce((s, r) => s + (r.response_ms || 0), 0) / total)
      : 0;

    const byLanguage = rows.reduce((acc, r) => {
      acc[r.language] = (acc[r.language] || 0) + 1;
      return acc;
    }, {});

    const bySource = rows.reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {});

    // Daily counts for chart (last N days)
    const daily = {};
    rows.forEach(r => {
      const day = r.created_at.slice(0, 10);
      daily[day] = (daily[day] || 0) + 1;
    });

    // Top 5 queries
    const queryCounts = {};
    rows.forEach(r => {
      queryCounts[r.query_text] = (queryCounts[r.query_text] || 0) + 1;
    });
    const topQueries = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));

    res.json({ total, avgLatency, byLanguage, bySource, daily, topQueries, recent: rows.slice(0, 20) });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
