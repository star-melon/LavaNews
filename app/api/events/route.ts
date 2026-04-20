// app/api/events/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { EventStory, Channel, TimelineEntry, ScoreMeta } from '@/lib/types';
import { computeScoreMeta, computeScore } from '@/lib/scoring';

const VALID_CATEGORIES = new Set(['宏观', '科技', '地缘', '市场', '能源', '公司', '综合']);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
  const minScore = Math.min(Math.max(parseInt(searchParams.get('minScore') || '20'), 0), 100);

  // Validate category
  const rawCategory = searchParams.get('category') || undefined;
  const category = rawCategory && VALID_CATEGORIES.has(rawCategory) ? rawCategory : undefined;

  // Validate and build date filter (M10)
  const dateFilter: Record<string, Date> = {};
  const rawStart = searchParams.get('startDate');
  const rawEnd = searchParams.get('endDate');
  if (rawStart) {
    const d = new Date(rawStart);
    if (!isNaN(d.getTime())) dateFilter.gte = d;
  }
  if (rawEnd) {
    const d = new Date(rawEnd);
    if (!isNaN(d.getTime())) dateFilter.lte = new Date(d.setHours(23, 59, 59, 999));
  }

  const hasDateFilter = Object.keys(dateFilter).length > 0;

  // Fetch more than limit to account for post-score filtering (M1)
  const fetchLimit = limit * 3;

  const groups = await prisma.eventGroup.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(hasDateFilter ? { firstSeen: dateFilter } : {}),
    },
    orderBy: [{ sourceCount: 'desc' }, { lastUpdated: 'desc' }],
    take: fetchLimit,
    include: {
      articles: {
        include: { channel: true },
        orderBy: { publishedAt: 'desc' },
      },
      timelineEvents: {
        include: { channel: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  const stories: (EventStory & { meta: ScoreMeta })[] = groups.map((group) => {
    const channels = group.articles
      .map(a => a.channel)
      .filter((c): c is Channel => c !== null);

    const uniqueChannels = [...new Map(channels.map(c => [c.id, c])).values()];

    const timeline: TimelineEntry[] = group.timelineEvents
      .filter(e => e.channel !== null)
      .map(e => ({
        id: e.id,
        timeDisplay: e.timeDisplay,
        note: e.note,
        sortOrder: e.sortOrder,
        channel: e.channel!,
      }));

    const articles = group.articles.map(a => ({
      id: a.id,
      title: a.title,
      source: a.source,
      sourceName: a.sourceName,
      url: a.url,
      summary: a.summary,
      channel: a.channel,
    }));

    return {
      id: group.id,
      category: group.category,
      title: group.representativeTitle,
      summary: articles[0]?.summary || '',
      firstSeenDisplay: group.firstSeenDisplay,
      updatedMin: group.updatedMin,
      sourceCount: group.sourceCount,
      articleCount: group.articleCount,
      firstSeen: group.firstSeen.toISOString(),
      lastUpdated: group.lastUpdated.toISOString(),
      channels: uniqueChannels,
      timeline,
      articles,
      meta: computeScoreMeta(uniqueChannels),
    };
  });

  // Sort by score first, then filter by minScore
  stories.sort((a, b) => b.meta.score - a.meta.score);
  const filtered = stories.filter(s => s.meta.score >= minScore);

  // Trim to requested limit after filtering
  const trimmed = filtered.slice(0, limit);

  const allCategories = [...new Set(trimmed.map(s => s.category))];

  return NextResponse.json({
    stories: trimmed,
    categories: ['全部', ...allCategories],
  });
}
