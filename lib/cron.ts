// lib/cron.ts — Scheduled background tasks for LavaNews

import cron from 'node-cron';
import { fetchAndClusterNews } from './news-fetcher';
import { pruneOldAndLowValue } from './pruner';
import { translatePendingArticles, ollamaHealthy } from './translator';

let started = false;
let activeFetch: Promise<void> | null = null;
let activeTranslate: Promise<void> | null = null;

async function runTranslate() {
  if (activeTranslate) return activeTranslate;
  activeTranslate = (async () => {
    if (!(await ollamaHealthy())) {
      console.warn('[translator] Ollama not reachable or model missing — skipping translation');
      return;
    }
    const r = await translatePendingArticles(200);
    if (r.translated + r.skipped + r.errors > 0) {
      console.log(`[translator] translated=${r.translated} skipped=${r.skipped} errors=${r.errors}`);
    }
  })()
    .catch(err => console.error('[translator] failed:', err))
    .finally(() => { activeTranslate = null; });
  return activeTranslate;
}

async function runFetch() {
  if (activeFetch) return activeFetch;
  activeFetch = fetchAndClusterNews()
    .then(result => {
      console.log(`[cron] News fetch completed: ${result.newArticles} articles, ${result.newEvents} events`);
      if (result.errors.length > 0) console.warn('[cron] Fetch errors:', result.errors);
      // Fire-and-forget translation pass; runs on CPU and can take minutes.
      void runTranslate();
    })
    .catch(err => console.error('[cron] News fetch failed:', err))
    .finally(() => { activeFetch = null; });
  return activeFetch;
}

export function startCronJobs() {
  if (started) return;
  started = true;

  // Fetch news every hour
  cron.schedule('0 * * * *', async () => {
    console.log(`[cron] Fetching news at ${new Date().toISOString()}`);
    await runFetch();
  });

  // Background translation pass every 20 minutes to catch anything
  // that the post-fetch pass missed (e.g. Ollama warming up).
  cron.schedule('*/20 * * * *', async () => {
    await runTranslate();
  });

  // Prune old/low-value events daily at 3am
  cron.schedule('0 3 * * *', async () => {
    console.log(`[cron] Running prune at ${new Date().toISOString()}`);
    try {
      await pruneOldAndLowValue();
      console.log('[cron] Prune completed');
    } catch (err) {
      console.error('[cron] Prune failed:', err);
    }
  });

  // Initial fetch on startup
  console.log('[cron] Running initial news fetch on startup');
  void runFetch();

  console.log('[cron] Cron jobs registered');
}
