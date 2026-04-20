// lib/types.ts — LavaNews types

export interface Channel {
  id: string;
  domain: string;
  name: string;
  tier: number;
  region: string;
  hue: string;
}

export interface TimelineEntry {
  id: string;
  timeDisplay: string;
  note: string;
  sortOrder: number;
  channel: Channel;
}

export interface ArticleVariant {
  title: string;
  lede: string;
  tone: string;
}

export interface EventStory {
  id: string;
  category: string;
  title: string;
  summary: string;
  firstSeenDisplay: string;
  updatedMin: number;
  sourceCount: number;
  articleCount: number;
  firstSeen: string;
  lastUpdated: string;
  channels: Channel[];
  timeline: TimelineEntry[];
  articles: {
    id: string;
    title: string;
    source: string;
    sourceName: string;
    url: string;
    summary: string;
    channel?: Channel | null;
  }[];
}

// Computed score: (T1*3 + T2*2 + T3*1) * 2.2, capped at 100
export interface ScoreMeta {
  score: number;
  raw: number;
  t1: number;
  t2: number;
  t3: number;
  total: number;
}
