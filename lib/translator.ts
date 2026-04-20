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
        options: { temperature: 0.1, top_p: 0.9, num_predict: 512 },
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

  // Hallucination-resistant prompt:
  // - few-shot demonstrates preservation of proper nouns
  // - explicit rule against substituting/adding named entities
  // - instruction to keep untranslatable names in Latin script
  const prompt = `你是严格忠于原文的新闻翻译。把每条英文标题或摘要翻译成简洁中文。

【铁律】
1. 禁止改写、替换、增加或删除任何专有名词（人名、国家、城市、公司、机构、产品、球队、政府部门）。原文写的是什么就是什么。
2. 译名不确定时，保留英文原文，不要臆造中文。
3. 原文没说的内容一律不加。禁止补充背景、国籍、地点。
4. 只输出译文，保持编号列表格式，不解释，不重复英文原文。

【示例】
输入：
1. Real Madrid vs Alaves: La Liga preview
2. The NSA is using Anthropic's Mythos model
3. Rumen Radev's party wins Bulgarian election
输出：
1. Real Madrid 对阵 Alaves：西甲赛前预览
2. NSA 正在使用 Anthropic 的 Mythos 模型
3. Rumen Radev 的政党赢得保加利亚大选

【现在翻译】
输入：
${numbered}
输出：
`;
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
