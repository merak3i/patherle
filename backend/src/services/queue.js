/**
 * queue.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bounded in-process async task queue for LLM/RAG processing.
 *
 * WHY: WhatsApp and Telegram require an HTTP 200 response within ~5 s or they
 * will retry the webhook, flooding the pipeline with duplicate messages.
 * Solution: respond 200 immediately, then enqueue the LLM work here.
 *
 * DESIGN:
 *   - MAX_CONCURRENT slots run in parallel (default 10)
 *   - Each task has a TASK_TIMEOUT_MS deadline (default 120 s)
 *   - The queue is unbounded in depth but bounded in concurrency
 *   - Errors are caught per-task and do NOT crash the process
 *   - Metrics (queue depth, active count) are exposed for health checks
 *
 * @module services/queue
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_CONCURRENT  = Number(process.env.QUEUE_MAX_CONCURRENT)  || 10;
const TASK_TIMEOUT_MS = Number(process.env.QUEUE_TASK_TIMEOUT_MS) || 120_000; // 2 min
const LOG_QUEUE_STATS = process.env.NODE_ENV !== 'test';

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {Array<{ fn: Function, label: string, enqueuedAt: number }>} */
let pending = [];
let active  = 0;
let totalEnqueued  = 0;
let totalCompleted = 0;
let totalFailed    = 0;
let totalTimedOut  = 0;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enqueue an async task for fire-and-forget execution.
 * The returned Promise resolves/rejects when the task completes, but callers
 * processing webhooks should NOT await it — they should respond 200 first.
 *
 * @param {() => Promise<void>} fn     - Async task to execute
 * @param {string}              [label] - Human-readable label for logging
 * @returns {Promise<void>}
 *
 * @example
 * // In your webhook handler — do NOT await this:
 * res.sendStatus(200);
 * enqueueTask(() => processMessage(normalized), 'wa:+919876543210').catch(() => {});
 */
export function enqueueTask(fn, label = 'task') {
  totalEnqueued++;
  const enqueuedAt = Date.now();

  return new Promise((resolve, reject) => {
    pending.push({ fn, label, enqueuedAt, resolve, reject });

    if (LOG_QUEUE_STATS && pending.length % 10 === 0) {
      console.log(`[queue] depth=${pending.length} active=${active}`);
    }

    _drain();
  });
}

/**
 * Current queue health snapshot — useful for /health endpoints.
 * @returns {{ pending: number, active: number, completed: number, failed: number, timedOut: number }}
 */
export function queueStats() {
  return {
    pending:   pending.length,
    active,
    completed: totalCompleted,
    failed:    totalFailed,
    timedOut:  totalTimedOut,
  };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _drain() {
  while (active < MAX_CONCURRENT && pending.length > 0) {
    const task = pending.shift();
    active++;

    const taskStart = Date.now();
    const waitMs    = taskStart - task.enqueuedAt;

    if (waitMs > 5_000) {
      console.warn(`[queue] "${task.label}" waited ${waitMs}ms before starting`);
    }

    // Per-task timeout
    let timedOut = false;
    const timer  = setTimeout(() => {
      timedOut = true;
      totalTimedOut++;
      console.error(`[queue] "${task.label}" timed out after ${TASK_TIMEOUT_MS}ms`);
      task.reject(new Error(`Task "${task.label}" timed out`));
      active--;
      _drain();
    }, TASK_TIMEOUT_MS);

    Promise.resolve()
      .then(() => task.fn())
      .then(result => {
        if (timedOut) return;
        clearTimeout(timer);
        totalCompleted++;
        const durationMs = Date.now() - taskStart;
        console.log(`[queue] "${task.label}" completed in ${durationMs}ms`);
        task.resolve(result);
      })
      .catch(err => {
        if (timedOut) return;
        clearTimeout(timer);
        totalFailed++;
        console.error(`[queue] "${task.label}" failed:`, err.message);
        task.reject(err);
      })
      .finally(() => {
        if (!timedOut) {
          active--;
          _drain();
        }
      });
  }
}
