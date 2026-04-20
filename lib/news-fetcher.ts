// lib/news-fetcher.ts — LavaNews: RSS + optional GNews

import { prisma } from './db';
import { findOrCreateGroup } from './cluster';
import { pruneLowScore } from './pruner';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: ['content', 'content:encoded', 'dc:creator'],
  },
});

// RSS feed sources mapped to LavaNews channels
interface FeedInfo { domain: string; name: string; url: string }

const RSS_FEEDS: FeedInfo[] = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', domain: 'bbc.co.uk', name: 'BBC News' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', domain: 'nytimes.com', name: '纽约时报' },
  { url: 'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en', domain: 'reuters.com', name: '路透社' },
  { url: 'https://www.theguardian.com/world/rss', domain: 'theguardian.com', name: '卫报' },
  { url: 'https://www.nbcnews.com/feed', domain: 'nbcnews.com', name: 'NBC News' },
  { url: 'http://rss.cnn.com/rss/edition.rss', domain: 'cnn.com', name: 'CNN' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', domain: 'aljazeera.com', name: '半岛电视台' },
  { url: 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans', domain: 'news.google.com', name: 'Google 新闻' },
];

// Fallback: auto-register channels from RSS domains if not in DB
async function ensureChannel(domain: string, name: string) {
  let channel = await prisma.channel.findUnique({ where: { domain } });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        domain,
        name,
        tier: 2,
        region: domain.endsWith('.cn') || domain === 'news.google.com' ? 'cn' : 'intl',
        hue: '#4A4A4A',
      },
    });
  }
  return channel;
}

interface FetchResult {
  newArticles: number;
  newEvents: number;
  updatedEvents: number;
  errors: string[];
}

export async function fetchAndClusterNews(): Promise<FetchResult> {
  const result: FetchResult = { newArticles: 0, newEvents: 0, updatedEvents: 0, errors: [] };

  await fetchGNews(result);

  // Batch fetch existing URLs and articles to avoid N+1 (H2)
  const existingUrls = new Set(
    (await prisma.article.findMany({ select: { url: true } })).map(a => a.url)
  );

  // Track which channel already covered which group (avoid duplicate per-channel articles)
  const channelCovered = new Map<string, Set<string>>(); // groupId -> Set<channelId>

interface PendingArticle {
  item: any;
  feed: FeedInfo;
  channel: { id: string };
}

interface PendingGroup {
  title: string;
  items: PendingArticle[];
}

  // Group new articles by event group for batch creation
  const pendingGroups = new Map<string, PendingGroup>();

  for (const feed of RSS_FEEDS) {
    try {
      const channel = await ensureChannel(feed.domain, feed.name);
      const rssFeed = await parser.parseURL(feed.url);

      for (const item of rssFeed.items.slice(0, 10)) {
        if (!item.title || !item.link) continue;
        if (existingUrls.has(item.link)) continue;

        const groupId = await findOrCreateGroup(item.title);

        if (!channelCovered.has(groupId)) channelCovered.set(groupId, new Set());
        const covered = channelCovered.get(groupId)!;
        if (covered.has(channel.id)) continue;

        let group = pendingGroups.get(groupId);
        if (!group) {
          group = { title: item.title, items: [] };
          pendingGroups.set(groupId, group);
        }
        group.items.push({ item, feed, channel });
        covered.add(channel.id);
      }
    } catch (err) {
      result.errors.push(`RSS ${feed.domain}: ${String(err)}`);
    }
  }

  // Batch insert all new articles
  for (const [groupId, group] of pendingGroups) {
    for (const { item, feed, channel } of group.items) {
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
      const publishedAt = isNaN(pubDate.getTime()) ? new Date() : pubDate;

      await prisma.article.create({
        data: {
          title: item.title,
          url: item.link,
          source: feed.domain,
          sourceName: feed.name,
          summary: (item.contentSnippet || item.content || '').slice(0, 500),
          imageUrl: item.enclosure?.url || '',
          publishedAt,
          groupId,
          channelId: channel.id,
        },
      });

      result.newArticles++;

      // Create timeline event if first for this channel+group
      const firstForGroup = await prisma.timelineEvent.findFirst({
        where: { groupId, channelId: channel.id },
        orderBy: { sortOrder: 'desc' },
      });
      if (!firstForGroup) {
        const timelineCount = await prisma.timelineEvent.count({ where: { groupId } });
        await prisma.timelineEvent.create({
          data: {
            groupId,
            channelId: channel.id,
            timeDisplay: item.pubDate
              ? pubDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
              : '刚刚',
            note: `${feed.name} 报道`,
            sortOrder: timelineCount,
          },
        });
      }
    }
  }

  // Update event group metadata in a single transaction (H3)
  await updateEventMetadata();

  const pruned = await pruneLowScore();
  if (pruned > 0) console.log(`[news-fetcher] Pruned ${pruned} low-score events`);

  return result;
}

// Optional GNews API fetcher
async function fetchGNews(result: FetchResult) {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') return;

  try {
    const queries = ['news', 'world', 'technology', 'business', 'politics'];
    for (const q of queries) {
      const url = new URL('https://gnews.io/api/v4/top-headlines');
      url.searchParams.set('category', 'general');
      url.searchParams.set('lang', 'en');
      url.searchParams.set('max', '10');
      url.searchParams.set('apikey', apiKey);
      url.searchParams.set('q', q);

      const res = await fetch(url);
      if (!res.ok) {
        result.errors.push(`GNews ${q}: HTTP ${res.status} ${res.statusText}`);
        continue;
      }
      const data = await res.json();
      if (!data.articles) continue;

      for (const item of data.articles) {
        if (!item.title || !item.url) continue;

        const domain = (() => {
          try { return new URL(item.url).hostname; } catch { return 'unknown'; }
        })();
        const channel = await ensureChannel(domain, item.source?.name || domain);

        const pubDate = item.publishedAt ? new Date(item.publishedAt) : new Date();
        const publishedAt = isNaN(pubDate.getTime()) ? new Date() : pubDate;

        await prisma.article.create({
          data: {
            title: item.title,
            url: item.url,
            source: domain,
            sourceName: item.source?.name || domain,
            summary: (item.description || '').slice(0, 500),
            imageUrl: item.image || '',
            publishedAt,
            groupId: await findOrCreateGroup(item.title),
            channelId: channel.id,
          },
        });

        result.newArticles++;
        const existingArticle = await prisma.article.findFirst({
          where: { url: item.url },
          select: { groupId: true },
        });
        const articleCount = await prisma.article.count({
          where: { groupId: existingArticle?.groupId ?? undefined },
        });
        if (articleCount === 1) result.newEvents++;
        else result.updatedEvents++;
      }
    }
  } catch (err) {
    result.errors.push(`GNews: ${String(err)}`);
  }
}

async function updateEventMetadata() {
  const groups = await prisma.eventGroup.findMany({
    select: {
      id: true,
      articles: { select: { publishedAt: true } },
      timelineEvents: { orderBy: { sortOrder: 'asc' }, select: { timeDisplay: true } },
    },
  });

  const updates = groups.map(group => {
    const firstSeen = group.timelineEvents[0]?.timeDisplay || '';
    const firstArticleTime = group.articles.length > 0
      ? Math.min(...group.articles.map(a => a.publishedAt.getTime()))
      : Date.now();
    const updatedMin = Math.round((Date.now() - firstArticleTime) / 60000);

    return prisma.eventGroup.update({
      where: { id: group.id },
      data: {
        sourceCount: group.articles.length,
        articleCount: group.articles.length,
        firstSeenDisplay: firstSeen,
        updatedMin,
        lastUpdated: new Date(),
      },
    });
  });

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}
