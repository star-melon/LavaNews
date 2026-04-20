// lib/scoring.ts — Shared value score computation
// Formula: (T1*3 + T2*2 + T3*1) * 2.2, capped at 100

import type { ScoreMeta } from './types';

export type { ScoreMeta } from './types';

export interface ScoreableChannel {
  tier: number;
}

export function computeScore(channels: ScoreableChannel[]): number {
  let raw = 0;
  for (const c of channels) {
    if (c.tier === 1) raw += 3;
    else if (c.tier === 2) raw += 2;
    else if (c.tier === 3) raw += 1;
  }
  return Math.min(100, Math.round(raw * 2.2));
}

export function computeScoreMeta(channels: ScoreableChannel[]): ScoreMeta {
  let raw = 0, t1 = 0, t2 = 0, t3 = 0;
  for (const c of channels) {
    if (c.tier === 1) { raw += 3; t1++; }
    else if (c.tier === 2) { raw += 2; t2++; }
    else if (c.tier === 3) { raw += 1; t3++; }
  }
  return { score: Math.min(100, Math.round(raw * 2.2)), raw, t1, t2, t3, total: channels.length };
}
