// lib/cluster.ts — TF-IDF event clustering for LavaNews

import { prisma } from './db';

// Category priority (higher = more specific).
// Used when a new article joins an existing event and we need to decide
// whether its category should replace the event's current category.
const CATEGORY_PRIORITY: Record<string, number> = {
  '综合': 0,
  '科技': 1,
  '公司': 2,
  '市场': 3,
  '宏观': 4,
  '地缘': 5,
  '能源': 6,
  'AI':   7,
};

function shouldUpgrade(existing: string, incoming: string): boolean {
  const a = CATEGORY_PRIORITY[existing] ?? 0;
  const b = CATEGORY_PRIORITY[incoming] ?? 0;
  return b > a;
}

// Chinese tokenizer: split into Chinese chars, English words, numbers
function tokenize(s: string): string[] {
  const tokens: string[] = [];
  const re = /[\u4e00-\u9fff]|[A-Za-z0-9%\.]+|\s+|[^\s]/g;
  let m;
  while ((m = re.exec(s)) !== null) tokens.push(m[0]);
  return tokens.filter(t => t.trim().length > 0);
}

// Compute TF-IDF vectors for a batch of texts
function computeTfIdf(texts: string[]): number[][] {
  const tokenized = texts.map(tokenize);
  const vocab = new Map<string, number>();
  const docFreq = new Map<string, number>();

  for (const tokens of tokenized) {
    const seen = new Set<string>();
    for (const t of tokens) {
      if (!vocab.has(t)) vocab.set(t, vocab.size);
      if (!seen.has(t)) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
        seen.add(t);
      }
    }
  }

  const N = texts.length;
  const dim = vocab.size;
  const vectors: number[][] = [];

  for (const tokens of tokenized) {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

    const vec = new Array(dim).fill(0);
    for (const [word, count] of tf) {
      const idx = vocab.get(word)!;
      const df = docFreq.get(word) || 1;
      vec[idx] = (count / tokens.length) * Math.log(N / df);
    }
    vectors.push(vec);
  }

  return vectors;
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// For short headlines: use token overlap coefficient instead of cosine
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;

  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap++;
  }

  // Short text scaling: boost overlap for short titles
  const minSize = Math.min(ta.size, tb.size);
  const raw = overlap / minSize;
  const shortBoost = minSize < 10 ? 1.3 : 1;
  return Math.min(1, raw * shortBoost);
}

interface ExistingEvent {
  id: string;
  title: string;
}

export async function findOrCreateGroup(title: string, category?: string): Promise<string> {
  const allEvents = await prisma.eventGroup.findMany({
    select: { id: true, representativeTitle: true, category: true },
    orderBy: { lastUpdated: 'desc' },
    take: 200,
  });

  if (allEvents.length === 0) {
    const group = await prisma.eventGroup.create({
      data: { representativeTitle: title, ...(category ? { category } : {}) },
    });
    return group.id;
  }

  // Try token overlap first for short headlines
  const scores = allEvents.map(ev => ({
    id: ev.id,
    score: tokenOverlap(title, ev.representativeTitle),
  }));

  const best = scores.reduce((a, b) => (a.score > b.score ? a : b));

  if (best.score >= 0.4) {
    if (category) {
      const existing = allEvents.find(e => e.id === best.id);
      if (existing && shouldUpgrade(existing.category, category)) {
        await prisma.eventGroup.update({ where: { id: best.id }, data: { category } });
      }
    }
    return best.id;
  }

  // Fallback to TF-IDF cosine similarity
  const texts = [title, ...allEvents.map(e => e.representativeTitle)];
  const vectors = computeTfIdf(texts);
  const queryVec = vectors[0];

  let bestCosine = 0;
  let bestId = '';
  for (let i = 1; i < vectors.length; i++) {
    const sim = cosineSimilarity(queryVec, vectors[i]);
    if (sim > bestCosine) {
      bestCosine = sim;
      bestId = allEvents[i - 1].id;
    }
  }

  if (bestCosine >= 0.3) {
    if (category) {
      const existing = allEvents.find(e => e.id === bestId);
      if (existing && shouldUpgrade(existing.category, category)) {
        await prisma.eventGroup.update({ where: { id: bestId }, data: { category } });
      }
    }
    return bestId;
  }

  // Create new event
  const group = await prisma.eventGroup.create({
    data: { representativeTitle: title, ...(category ? { category } : {}) },
  });
  return group.id;
}
