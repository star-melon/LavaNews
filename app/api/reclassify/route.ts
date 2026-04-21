// app/api/reclassify/route.ts — Retroactively apply the multi-category
// classifier to every existing EventGroup. Triggered manually after
// updating the keyword library so the DB catches up with new rules.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { classifyByTitle } from '@/lib/classifier';

export async function POST() {
  const events = await prisma.eventGroup.findMany({
    select: { id: true, representativeTitle: true, category: true },
  });

  const stats: Record<string, number> = {};
  let updated = 0;
  let unchanged = 0;

  for (const ev of events) {
    const predicted = classifyByTitle(ev.representativeTitle) ?? '综合';
    if (predicted === ev.category) {
      unchanged++;
      continue;
    }
    await prisma.eventGroup.update({
      where: { id: ev.id },
      data: { category: predicted },
    });
    updated++;
    stats[`${ev.category}->${predicted}`] = (stats[`${ev.category}->${predicted}`] || 0) + 1;
  }

  const finalCounts: Record<string, number> = {};
  for (const ev of events) {
    const predicted = classifyByTitle(ev.representativeTitle) ?? '综合';
    finalCounts[predicted] = (finalCounts[predicted] || 0) + 1;
  }

  return NextResponse.json({ total: events.length, updated, unchanged, transitions: stats, finalCounts });
}

// Accept GET for convenience from curl/browser — same behavior.
export async function GET() {
  return POST();
}
