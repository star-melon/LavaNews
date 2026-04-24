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

// Trailing source attributions that news aggregators (Google News, feed
// readers) glue onto headlines. They carry zero topical meaning but
// previously dominated the overlap score, e.g. two unrelated stories
// both ending "- Reuters" were credited for sharing that token.
const NOISE_SUFFIX_RE =
  /\s*[-|\u00b7\u2022]\s*(reuters|bloomberg|ft|financial times|cnn|bbc|wsj|wall street journal|ap|afp|nytimes|nyt|new york times|nikkei|cnbc|al jazeera|aljazeera|forbes|economist|guardian|the verge|techcrunch|engadget|ars technica|wired|google news|yahoo news|huffpost)\s*$/i;

// Noise English words that appear in almost every headline. Matching on
// these inflates overlap without signalling topical kinship.
const EN_STOPWORDS = new Set([
  'the','a','an','and','or','but','to','of','in','on','at','for','with','by',
  'from','as','is','are','was','were','be','been','being','has','have','had',
  'do','does','did','will','would','could','should','may','might','can','this',
  'that','these','those','it','its','he','she','they','them','their','his','her',
  'i','we','you','our','your','not','no','so','if','than','then','into','about',
  'over','under','between','after','before','up','down','out','off','just','also',
  's','re','ve','ll','d','t','m', // contractions split by apostrophe
  // News-report boilerplate verbs — appear in headlines without conveying
  // topical kinship. Filtering these cuts false matches on short headlines.
  'says','said','announces','announced','reports','reported','launches','launched',
  'unveils','unveiled','reveals','revealed','plans','set','sets','seeks','seeking',
  'new','latest','breaking','exclusive','update','updates','amid','ahead',
  'ahead','how','why','what','when','where','who','which',
]);

// Chinese tokenizer: split into Chinese chars + alphanumeric runs only.
// Punctuation and single ASCII chars are dropped so they can't masquerade
// as shared topical tokens between unrelated headlines.
function tokenize(s: string): string[] {
  const cleaned = s.replace(NOISE_SUFFIX_RE, '');
  const tokens: string[] = [];
  const re = /[\u4e00-\u9fff]|[A-Za-z0-9%\.]+/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const raw = m[0];
    // CJK char passes through unchanged
    if (/[\u4e00-\u9fff]/.test(raw)) { tokens.push(raw); continue; }
    const t = raw.toLowerCase();
    // Filter: single-char ASCII (a, i, 1, 2 \u2026) and stopwords
    if (t.length < 2) continue;
    if (EN_STOPWORDS.has(t)) continue;
    tokens.push(t);
  }
  return tokens;
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
