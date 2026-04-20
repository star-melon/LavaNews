// lib/translator.ts — Batch English→Chinese translation via local Ollama.

import { prisma } from './db';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL = process.env.TRANSLATE_MODEL || 'qwen2.5:1.5b-instruct-q4_K_M';
const BATCH_SIZE = 8;

// Articles whose text is already Chinese don't need translation.
const HAS_CJK = /[\u4e00-\u9fff]/;

function needsTranslation(text: string): boolean {
  if (!text || text.trim().length < 2) return false;
  return !HAS_CJK.test(text);
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

async function callOllama(prompt: string, timeoutMs = 90_000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 512 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = (await res.json()) as OllamaResponse;
    return data.response.trim();
  } finally {
    clearTimeout(t);
  }
}

// Parse numbered list output like "1. 译文\n2. 译文"
function parseNumberedOutput(raw: string, expected: number): string[] {
  const out: string[] = new Array(expected).fill('');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d+)[.、:：)\s]\s*(.+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < expected && !out[idx]) out[idx] = m[2].trim();
  }
  return out;
}

async function translateBatch(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const prompt = `你是一个中英新闻翻译助手。把以下英文新闻文本翻译成简洁自然的中文，保留专有名词（公司、产品、人名）原文。只输出译文，格式严格保持编号列表，不要解释、不要重复原文。

${numbered}`;
  const raw = await callOllama(prompt);
  return parseNumberedOutput(raw, texts.length);
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

  // Separate items that already look Chinese — mark as skipped by copying original.
  const needTitle: { id: string; text: string }[] = [];
  const needSummary: { id: string; text: string }[] = [];

  for (const a of pending) {
    if (!needsTranslation(a.title)) {
      await prisma.article.update({
        where: { id: a.id },
        data: { titleZh: a.title, summaryZh: a.summary },
      });
      result.skipped++;
      continue;
    }
    needTitle.push({ id: a.id, text: a.title });
    if (a.summary && needsTranslation(a.summary)) {
      needSummary.push({ id: a.id, text: a.summary.slice(0, 400) });
    }
  }

  // Translate titles in batches.
  for (let i = 0; i < needTitle.length; i += BATCH_SIZE) {
    const slice = needTitle.slice(i, i + BATCH_SIZE);
    try {
      const translations = await translateBatch(slice.map(s => s.text));
      for (let j = 0; j < slice.length; j++) {
        const zh = translations[j] || '';
        if (!zh) continue;
        await prisma.article.update({
          where: { id: slice[j].id },
          data: { titleZh: zh },
        });
        result.translated++;
      }
    } catch (err) {
      console.error('[translator] title batch failed:', String(err).slice(0, 120));
      result.errors += slice.length;
    }
  }

  // Translate summaries in batches (best-effort; skip on error).
  for (let i = 0; i < needSummary.length; i += BATCH_SIZE) {
    const slice = needSummary.slice(i, i + BATCH_SIZE);
    try {
      const translations = await translateBatch(slice.map(s => s.text));
      for (let j = 0; j < slice.length; j++) {
        const zh = translations[j] || '';
        if (!zh) continue;
        await prisma.article.update({
          where: { id: slice[j].id },
          data: { summaryZh: zh },
        });
      }
    } catch (err) {
      console.error('[translator] summary batch failed:', String(err).slice(0, 120));
    }
  }

  return result;
}

// Best-effort health check — returns true if Ollama is reachable and the model is loaded.
export async function ollamaHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.models) && data.models.some((m: { name: string }) => m.name.startsWith(MODEL.split(':')[0]));
  } catch {
    return false;
  }
}
