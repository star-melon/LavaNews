// lib/pruner.ts — Remove old and low-value event groups

import { prisma } from './db';
import { computeScore } from './scoring';

// Minimum score threshold for inclusion
const MIN_SCORE = 20;

// Max age in days for event retention (3 months ≈ 90 days)
const MAX_AGE_DAYS = 90;

export async function pruneOldAndLowValue(): Promise<{ prunedOld: number; prunedLowScore: number }> {
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  // Prune old events (Cascade handles articles + timeline)
  const oldGroups = await prisma.eventGroup.findMany({
    where: { firstSeen: { lt: cutoff } },
    select: { id: true },
  });
  const oldIds = oldGroups.map(g => g.id);

  if (oldIds.length > 0) {
    await prisma.eventGroup.deleteMany({ where: { id: { in: oldIds } } });
  }

  // Prune low-score events — only load IDs + article counts, not full relations
  const allGroups = await prisma.eventGroup.findMany({
    select: {
      id: true,
      articles: {
        select: { channelId: true, channel: { select: { tier: true } } },
      },
    },
  });

  const lowScoreIds: string[] = [];
  for (const group of allGroups) {
    const channels = group.articles
      .map(a => a.channel)
      .filter((c): c is { tier: number } => c !== null);
    if (computeScore(channels) < MIN_SCORE) {
      lowScoreIds.push(group.id);
    }
  }

  if (lowScoreIds.length > 0) {
    await prisma.eventGroup.deleteMany({ where: { id: { in: lowScoreIds } } });
  }

  return { prunedOld: oldIds.length, prunedLowScore: lowScoreIds.length };
}

// Lightweight: only prune low-score events (call after each fetch)
export async function pruneLowScore(): Promise<number> {
  const groups = await prisma.eventGroup.findMany({
    select: {
      id: true,
      articles: {
        select: { channelId: true, channel: { select: { tier: true } } },
      },
    },
  });

  const lowScoreIds: string[] = [];
  for (const group of groups) {
    const channels = group.articles
      .map(a => a.channel)
      .filter((c): c is { tier: number } => c !== null);
    if (computeScore(channels) < MIN_SCORE) {
      lowScoreIds.push(group.id);
    }
  }

  if (lowScoreIds.length > 0) {
    await prisma.eventGroup.deleteMany({ where: { id: { in: lowScoreIds } } });
  }

  return lowScoreIds.length;
}
