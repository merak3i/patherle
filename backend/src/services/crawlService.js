/**
 * crawlService.js — Cloudflare Browser Rendering Crawler + Embedding Pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. initiateCrawl(tenantId, url, depth)   → starts CF crawl job, persists to DB
 *   2. pollCrawlJob(jobId)                   → checks CF job status
 *   3. processCrawlResult(tenantId, jobId)   → extracts markdown → chunks → embed → Pinecone
 *   4. crawlAndEmbed(tenantId, url, depth)   → full pipeline (initiate + poll + embed)
 *
 * @module services/crawlService
 */

import axios from 'axios';
import supabase from '../config/supabase.js';
import { chunkText } from './chunker.js';
import { generateEmbeddings } from './embeddings.js';
import { upsertVectors, deleteByFilename } from './vectorStore.js';

// ─── Cloudflare config ────────────────────────────────────────────────────────

const CF_API_TOKEN  = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_BASE       = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering`;

const CF_HEADERS = () => ({
  Authorization: `Bearer ${CF_API_TOKEN}`,
  'Content-Type': 'application/json',
});

// ─── Supabase job table helper ────────────────────────────────────────────────

/**
 * Insert a new crawl job record.
 * @param {string} tenantId
 * @param {string} url
 * @param {string|null} cfJobId - Cloudflare-assigned job ID (null until CF responds)
 * @param {'pending'|'processing'|'completed'|'failed'} status
 * @param {boolean} isRecurring
 * @returns {Promise<string>} DB record id
 */
async function createJobRecord(tenantId, url, cfJobId, status = 'pending', isRecurring = false) {
  const { data, error } = await supabase
    .from('tenant_crawl_jobs')
    .insert({ tenant_id: tenantId, url, cf_job_id: cfJobId, status, is_recurring: isRecurring })
    .select('id')
    .single();

  if (error) throw new Error(`[crawl] DB insert failed: ${error.message}`);
  return data.id;
}

/**
 * Update an existing crawl job record.
 * @param {string} dbId - DB row id
 * @param {Partial<{cf_job_id:string, status:string, completed_at:string, error:string}>} patch
 */
async function updateJobRecord(dbId, patch) {
  const { error } = await supabase.from('tenant_crawl_jobs').update(patch).eq('id', dbId);
  if (error) console.error(`[crawl] DB update failed: ${error.message}`);
}

// ─── Cloudflare API calls ─────────────────────────────────────────────────────

/**
 * Start a Cloudflare Browser Rendering crawl job.
 *
 * @param {string} url    - Target URL to crawl
 * @param {number} depth  - Link-follow depth (1 = page only, 2 = page + one level of links)
 * @returns {Promise<{jobId:string, status:string}>}
 */
export async function initiateCFCrawl(url, depth = 2) {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    throw new Error('[crawl] CF_API_TOKEN or CF_ACCOUNT_ID not set in environment');
  }

  const { data } = await axios.post(
    `${CF_BASE}/crawl`,
    { url, depth, output_format: 'markdown' },
    { headers: CF_HEADERS() },
  );

  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join(', ') || 'Unknown CF error';
    throw new Error(`[crawl] CF crawl initiation failed: ${msg}`);
  }

  return { jobId: data.result.job_id, status: data.result.status };
}

/**
 * Poll the status of a Cloudflare crawl job.
 *
 * @param {string} cfJobId
 * @returns {Promise<{status:string, pages?:Array<{url:string, markdown:string}>}>}
 */
export async function pollCFCrawlJob(cfJobId) {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    throw new Error('[crawl] CF_API_TOKEN or CF_ACCOUNT_ID not set in environment');
  }

  const { data } = await axios.get(
    `${CF_BASE}/crawl/${cfJobId}`,
    { headers: CF_HEADERS() },
  );

  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join(', ') || 'Unknown CF error';
    throw new Error(`[crawl] CF poll failed: ${msg}`);
  }

  return {
    status: data.result.status,          // 'pending' | 'processing' | 'completed' | 'failed'
    pages:  data.result.pages  ?? [],    // array of { url, markdown } when completed
    error:  data.result.error  ?? null,
  };
}

// ─── Embedding pipeline ───────────────────────────────────────────────────────

/**
 * Chunk, embed, and upsert crawled markdown pages into Pinecone.
 * Each page is chunked, its chunks embedded, then upserted with source metadata.
 *
 * @param {string} tenantId
 * @param {Array<{url:string, markdown:string}>} pages
 * @param {string} sourceLabel - Human-readable label (e.g. "website:https://…")
 */
export async function embedAndUpsertPages(tenantId, pages, sourceLabel) {
  // Step 1 — chunk all pages
  /** @type {Array<{text:string, url:string, chunkIdx:number}>} */
  const allChunks = [];

  for (const page of pages) {
    if (!page.markdown?.trim()) continue;
    const chunks = chunkText(page.markdown, 600, 80);
    chunks.forEach((text, i) => allChunks.push({ text, url: page.url, chunkIdx: i }));
  }

  if (allChunks.length === 0) {
    console.warn(`[crawl] No content to embed for tenant ${tenantId}`);
    return;
  }

  // Step 2 — delete old vectors for this source (idempotent re-crawl)
  await deleteByFilename(tenantId, sourceLabel).catch(() => {});

  // Step 3 — embed in batches
  const texts      = allChunks.map((c) => c.text);
  const embeddings = await generateEmbeddings(texts);

  // Step 4 — build Pinecone vectors
  const vectors = allChunks.map((chunk, i) => ({
    id:       `${tenantId}-crawl-${Buffer.from(chunk.url).toString('base64').slice(0, 20)}-${chunk.chunkIdx}`,
    values:   embeddings[i],
    metadata: {
      tenantId,
      filename:   sourceLabel,
      source_url: chunk.url,
      text:       chunk.text,
      crawled_at: new Date().toISOString(),
    },
  }));

  await upsertVectors(vectors);
  console.log(`[crawl] Upserted ${vectors.length} vectors for tenant ${tenantId}`);
}

// ─── Full pipeline ────────────────────────────────────────────────────────────

/**
 * Full synchronous crawl-and-embed pipeline with polling.
 * Fires CF crawl → polls until done → embeds into Pinecone.
 * Suitable for one-time setup (Tier 2) and cron (Tier 3).
 *
 * @param {string} tenantId
 * @param {string} url
 * @param {object} [opts]
 * @param {number}  [opts.depth=2]          - CF crawl depth
 * @param {boolean} [opts.isRecurring=false] - Tier 3 daily flag
 * @param {number}  [opts.maxPollMs=300000]  - Max polling duration (5 min)
 * @param {number}  [opts.pollIntervalMs=5000] - Poll interval (5 s)
 * @returns {Promise<{dbId:string, cfJobId:string, pagesEmbedded:number}>}
 */
export async function crawlAndEmbed(tenantId, url, opts = {}) {
  const {
    depth          = 2,
    isRecurring    = false,
    maxPollMs      = 300_000,
    pollIntervalMs = 5_000,
  } = opts;

  // 1. Create DB record (pending)
  const dbId = await createJobRecord(tenantId, url, null, 'pending', isRecurring);

  let cfJobId;
  try {
    // 2. Initiate CF crawl
    const { jobId } = await initiateCFCrawl(url, depth);
    cfJobId = jobId;
    await updateJobRecord(dbId, { cf_job_id: cfJobId, status: 'processing' });

    // 3. Poll until completed or timeout
    const deadline = Date.now() + maxPollMs;
    let result;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      result = await pollCFCrawlJob(cfJobId);

      if (result.status === 'completed') break;
      if (result.status === 'failed') {
        throw new Error(`CF job ${cfJobId} failed: ${result.error ?? 'unknown'}`);
      }
    }

    if (!result || result.status !== 'completed') {
      throw new Error(`CF job ${cfJobId} timed out after ${maxPollMs / 1000}s`);
    }

    // 4. Embed pages
    const sourceLabel = `website:${url}`;
    await embedAndUpsertPages(tenantId, result.pages, sourceLabel);

    await updateJobRecord(dbId, {
      status:       'completed',
      completed_at: new Date().toISOString(),
    });

    return { dbId, cfJobId, pagesEmbedded: result.pages.length };

  } catch (err) {
    await updateJobRecord(dbId, {
      status: 'failed',
      error:  err.message,
    });
    throw err;
  }
}
