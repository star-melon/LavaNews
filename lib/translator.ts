// lib/translator.ts — Batch English→Chinese translation via LibreTranslate
// (Helsinki-NLP OPUS-MT-en-zh). A purpose-built NMT model that cannot
// hallucinate named entities the way a general LLM does.

import { prisma } from './db';

const TRANSLATE_URL = process.env.TRANSLATE_URL || 'http://translate:5000';
const CONCURRENCY = 4;

// Articles whose text is already Chinese don't need translation.
const HAS_CJK = /[\u4e00-\u9fff]/;

function needsTranslation(text: string): boolean {
  if (!text || text.trim().length < 2) return false;
  return !HAS_CJK.test(text);
}

interface LTResponse {
  translatedText: string | string[];
}

async function translateOne(text: string, timeoutMs = 30_000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${TRANSLATE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text.slice(0, 1800),
        source: 'en',
        target: 'zh',
        format: 'text',
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);
    const data = (await res.json()) as LTResponse;
    const out = Array.isArray(data.translatedText) ? data.translatedText[0] : data.translatedText;
    return (out || '').trim();
  } finally {
    clearTimeout(t);
  }
}

// Concurrent translation with a small pool — LibreTranslate is CPU-bound on
// 2 vCPU, so a pool size of 4 is a reasonable saturation point.
async function translatePool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const run = async () => {
    while (idx < items.length) {
      const my = idx++;
      try { await worker(items[my]); } catch { /* counted by caller */ }
    }
  };
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, run);
  await Promise.all(runners);
}

export interface TranslateResult {
  translated: number;
  skipped: number;
  errors: number;
}

/**
 * Translate all untranslated articles in DB. Run in background after fetch.
 * Safe to call concurrently only if limit is respected (we use a single
 * in-process lock at the fetcher level).
 */
export async function translatePendingArticles(maxArticles = 200): Promise<TranslateResult> {
  const result: TranslateResult = { translated: 0, skipped: 0, errors: 0 };

  const pending = await prisma.article.findMany({
    where: { titleZh: '' },
    orderBy: { publishedAt: 'desc' },
    take: maxArticles,
    select: { id: true, title: true, summary: true },
  });

  if (pending.length === 0) return result;

  const needTitle: { id: string; text: string; summary: string }[] = [];

  for (const a of pending) {
    if (!needsTranslation(a.title)) {
      // Chinese source — just copy across so the 中文 toggle picks it up.
      await prisma.article.update({
        where: { id: a.id },
        data: { titleZh: a.title, summaryZh: a.summary },
      });
      result.skipped++;
      continue;
    }
    needTitle.push({ id: a.id, text: a.title, summary: a.summary });
  }

  await translatePool(needTitle, async (item) => {
    try {
      const zhTitle = await translateOne(item.text);
      const zhSummary = item.summary && needsTranslation(item.summary)
        ? await translateOne(item.summary.slice(0, 1800))
        : item.summary; // already Chinese or empty

      if (!zhTitle) {
        result.errors++;
        return;
      }
      await prisma.article.update({
        where: { id: item.id },
        data: { titleZh: zhTitle, summaryZh: zhSummary || '' },
      });
      result.translated++;
    } catch (err) {
      console.error('[translator] item failed:', String(err).slice(0, 120));
      result.errors++;
    }
  });

  return result;
}

// Best-effort health check — returns true if LibreTranslate is reachable
// and an EN→ZH pair is loaded. LibreTranslate advertises Chinese as
// either "zh" or "zh-Hans" depending on version, so we accept either.
export async function translatorHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${TRANSLATE_URL}/languages`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const langs = (await res.json()) as { code: string; targets?: string[] }[];
    const en = langs.find(l => l.code === 'en');
    if (!en || !Array.isArray(en.targets)) return false;
    return en.targets.some(t => t === 'zh' || t.startsWith('zh'));
  } catch {
    return false;
  }
}
