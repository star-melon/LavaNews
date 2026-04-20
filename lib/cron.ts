// lib/cron.ts — Scheduled background tasks for LavaNews

import cron from 'node-cron';
import { fetchAndClusterNews } from './news-fetcher';
import { pruneOldAndLowValue } from './pruner';

let started = false;
let activeFetch: Promise<void> | null = null;

async function runFetch() {
  if (activeFetch) return activeFetch;
  activeFetch = fetchAndClusterNews()
    .then(result => {
      console.log(`[cron] News fetch completed: ${result.newArticles} articles, ${result.newEvents} events`);
      if (result.errors.length > 0) console.warn('[cron] Fetch errors:', result.errors);
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
