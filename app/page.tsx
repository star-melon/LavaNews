// app/page.tsx — LavaNews Terminal Layout
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { EventStory, Channel, ScoreMeta } from '@/lib/types';
import { computeScoreMeta } from '@/lib/scoring';

interface ApiResponse {
  stories: (EventStory & { meta: ScoreMeta })[];
  categories: string[];
}

// Local date formatter — avoids UTC timezone issues (L7)
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- Shared Components ---
function ChannelChip({ channel, size = '' }: { channel: Channel; size?: string }) {
  const letter = channel.name.slice(0, 1);
  return (
    <span
      className={`ch-chip ${size}`}
      style={{ background: channel.hue }}
      title={`${channel.name} (T${channel.tier})`}
    >
      {letter}
    </span>
  );
}

function ChannelCloud({ channels, max = 10, size = '' }: { channels: Channel[]; max?: number; size?: string }) {
  const shown = channels.slice(0, max);
  const extra = channels.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {shown.map(ch => (
        <ChannelChip key={ch.id} channel={ch} size={size} />
      ))}
      {extra > 0 && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>+{extra}</span>
      )}
    </div>
  );
}

function ScoreBar({ meta }: { meta: ScoreMeta }) {
  const total = meta.total || 1;
  const clWidth = Math.round((meta.t1 * 3) / ((meta.t1 * 3 + (total - meta.t1) * 1.5) || 1) * meta.score);
  return (
    <div className="score-bar">
      <div className="track">
        <div className="fill" style={{ width: `${meta.score}%`, opacity: 0.85 }} />
        <div className="fill claret" style={{ width: `${clWidth}%` }} />
      </div>
      <span className="num">{meta.score}</span>
    </div>
  );
}

// --- Top Bar ---
function TopBar({
  storyCount,
  lastSync,
  onSync,
}: {
  storyCount: number;
  lastSync: string;
  onSync: () => void;
}) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 20px', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>
        <span style={{ color: 'var(--claret)' }}>Lava</span>News
      </div>
      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.18em', paddingLeft: 10, borderLeft: '1px solid var(--rule)' }}>
        TERMINAL · V.2
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <span>24 渠道</span><span>·</span>
        <span><span style={{ color: 'var(--claret)' }}>●</span> LIVE · {lastSync}</span><span>·</span>
        <span>{toLocalDate(new Date())}</span>
      </div>
      <button
        onClick={onSync}
        style={{ fontFamily: 'var(--sans)', fontSize: 11, padding: '5px 12px', border: '1px solid var(--rule)', color: 'var(--claret)', cursor: 'pointer' }}
      >
        同步
      </button>
    </header>
  );
}

const SORTS = [
  { k: 'value', label: '价值分数' },
  { k: 'velocity', label: '上升速度' },
  { k: 'time', label: '最新更新' },
];

// --- Sub Bar (categories + sort) ---
function SubBar({
  categories,
  selectedCategory,
  onCategoryChange,
  sort,
  onSortChange,
  dateStart,
  dateEnd,
  onDateChange,
  minScore,
  onMinScoreChange,
}: {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  sort: string;
  onSortChange: (s: string) => void;
  dateStart: string;
  dateEnd: string;
  onDateChange: (field: 'start' | 'end', value: string) => void;
  minScore: number;
  onMinScoreChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 20px', borderBottom: '1px solid var(--rule)', fontFamily: 'var(--sans)', fontSize: 11 }}>
      <span className="kicker" style={{ fontSize: 10 }}>板块</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => onCategoryChange(c)}
            style={{
              padding: '3px 10px', fontSize: 11,
              background: selectedCategory === c ? 'var(--ink)' : 'transparent',
              color: selectedCategory === c ? 'var(--paper)' : 'var(--ink-2)',
              border: `1px solid ${selectedCategory === c ? 'var(--ink)' : 'var(--rule)'}`,
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 6px' }} />
      <span className="kicker" style={{ fontSize: 10 }}>排序</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {SORTS.map(s => (
          <button
            key={s.k}
            onClick={() => onSortChange(s.k)}
            style={{
              padding: '3px 10px', fontSize: 11,
              color: sort === s.k ? 'var(--claret)' : 'var(--ink-3)',
              fontWeight: sort === s.k ? 600 : 400,
              borderBottom: sort === s.k ? '1px solid var(--claret)' : '1px solid transparent',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 6px' }} />
      <span className="kicker" style={{ fontSize: 10 }}>日期</span>
      <input
        type="date"
        value={dateStart}
        onChange={e => onDateChange('start', e.target.value)}
        style={{
          fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 8px',
          background: 'transparent', color: 'var(--ink)',
          border: '1px solid var(--rule)',
        }}
      />
      <span style={{ color: 'var(--ink-3)' }}>至</span>
      <input
        type="date"
        value={dateEnd}
        onChange={e => onDateChange('end', e.target.value)}
        style={{
          fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 8px',
          background: 'transparent', color: 'var(--ink)',
          border: '1px solid var(--rule)',
        }}
      />
      <div style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 6px' }} />
      <span className="kicker" style={{ fontSize: 10 }}>最低分</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', width: 16, textAlign: 'right' }}>3</span>
        <input
          type="range"
          min={3}
          max={90}
          step={1}
          value={minScore}
          onChange={e => onMinScoreChange(+e.target.value)}
          style={{ flex: 1, accentColor: 'var(--claret)', cursor: 'pointer' }}
          aria-label="最低分阈值"
        />
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', width: 20 }}>90</span>
        <span
          className="mono"
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--claret)',
            minWidth: 36, textAlign: 'center',
            padding: '2px 6px', border: '1px solid var(--claret)',
          }}
        >
          {minScore}+
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--sans)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="tier-dot t1" /> T1 ×3
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="tier-dot t2" /> T2 ×2
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="tier-dot t3" /> T3 ×1
        </span>
      </div>
    </div>
  );
}

// --- Feed Pane (left list) ---
function FeedPane({
  stories,
  selectedId,
  onSelect,
}: {
  stories: (EventStory & { meta: ScoreMeta })[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="terminal-feed">
      <div style={{
        display: 'grid', gridTemplateColumns: '36px 1fr 80px', gap: 8,
        padding: '8px 14px', borderBottom: '1px solid var(--rule)',
        fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--ink-3)',
        position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 2,
      }}>
        <span>#</span><span>标题 / 渠道</span><span style={{ textAlign: 'right' }}>分数</span>
      </div>
      {stories.map((s, i) => {
        const selected = s.id === selectedId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 80px', gap: 8,
              padding: '14px 14px', width: '100%', textAlign: 'left',
              borderBottom: '1px solid var(--rule)',
              background: selected ? 'var(--paper-2)' : 'transparent',
              borderLeft: selected ? '3px solid var(--claret)' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <span className="mono" style={{ fontSize: 11, color: selected ? 'var(--claret)' : 'var(--ink-3)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{
                fontSize: 9, fontFamily: 'var(--sans)', padding: '1px 4px',
                border: '1px solid var(--rule)', color: 'var(--ink-3)',
              }}>
                {s.category}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <h4 style={{
                fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 14,
                lineHeight: 1.28, margin: '2px 0 6px', color: 'var(--ink)',
              }}>
                {s.title}
              </h4>
              <ChannelCloud channels={s.channels} max={9} size="xs" />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 5,
              }}>
                <span>{s.firstSeenDisplay}</span><span>·</span>
                <span>T1·<b style={{ color: 'var(--claret)' }}>{s.meta.t1}</b> T2·{s.meta.t2} T3·{s.meta.t3}</span><span>·</span>
                <span>Σ{s.meta.total}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500,
                color: 'var(--claret)', lineHeight: 1,
              }}>
                {s.meta.score}
              </span>
              <div style={{ width: 60 }}><ScoreBar meta={s.meta} /></div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// --- Timeline Playback ---
function TimelinePlayback({ story }: { story: EventStory & { meta: ScoreMeta } }) {
  const [step, setStep] = useState(story.timeline.length);
  const [playing, setPlaying] = useState(false);
  const tlen = story.timeline.length;
  const visible = story.timeline.slice(0, step);
  const visibleChannels = visible.map(e => e.channel);

  const runningScore = useMemo(() => computeScoreMeta(visibleChannels), [visibleChannels]);

  useEffect(() => {
    if (!playing) return;
    if (step >= tlen) { setPlaying(false); return; }
    const id = setTimeout(() => setStep(s => Math.min(tlen, s + 1)), 650);
    return () => clearTimeout(id);
  }, [playing, step, tlen]);

  return (
    <div style={{ padding: '24px 28px' }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, margin: '0 0 18px', fontWeight: 800 }}>{story.title}</h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 30,
        padding: '22px 24px', border: '1px solid var(--rule)', alignItems: 'center', marginBottom: 24,
      }}>
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>实时价值分数</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 72, lineHeight: 1, color: 'var(--claret)', fontWeight: 500 }}>
            {String(runningScore.score).padStart(2, '0')}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>/ 100</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="score-bar">
            <div className="track">
              <div className="fill" style={{ width: `${runningScore.score}%` }} />
            </div>
            <span className="num">{runningScore.score}</span>
          </div>
          <div style={{ display: 'flex', gap: 20, fontFamily: 'var(--mono)', fontSize: 12 }}>
            <span>T1·<b style={{ color: 'var(--claret)' }}>{runningScore.t1}</b></span>
            <span>T2·<b>{runningScore.t2}</b></span>
            <span>T3·<b style={{ color: 'var(--ink-3)' }}>{runningScore.t3}</b></span>
            <span>Σ·<b>{runningScore.total}</b>/{story.channels.length}</span>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            从首发至此刻，共 <b>{step}</b> 家渠道加入报道。
          </div>
        </div>
      </div>

      {/* Timeline visual */}
      <div style={{
        position: 'relative', padding: '36px 24px 28px',
        background: 'var(--paper-2)', border: '1px solid var(--paper-line)', marginBottom: 16,
      }}>
        <div style={{ height: 2, background: 'var(--rule)', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${tlen > 0 ? (step / tlen) * 100 : 0}%`,
            background: 'var(--claret)', transition: 'width 0.4s ease',
          }} />
          {story.timeline.map((e) => {
            const idx = story.timeline.indexOf(e);
            const pos = tlen <= 1 ? 50 : (idx / (tlen - 1)) * 100;
            const on = idx < step;
            return (
              <div key={e.id} style={{
                position: 'absolute', left: `${pos}%`, top: -20,
                transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', opacity: on ? 1 : 0.25, transition: 'opacity 0.4s',
              }}>
                <ChannelChip channel={e.channel} size="xs" />
                <div style={{ width: 1, height: 8, background: 'var(--ink-3)', marginTop: 3 }} />
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 3, whiteSpace: 'nowrap' }}>
                  {e.timeDisplay}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
        <button
          onClick={() => { if (step >= tlen) setStep(0); setPlaying(p => !p); }}
          style={{
            fontFamily: 'var(--sans)', fontSize: 12, padding: '8px 18px',
            background: playing ? 'var(--ink)' : 'var(--claret)', color: 'var(--paper)',
          }}
        >
          {playing ? '■ 暂停' : (step >= tlen ? '↺ 重新回放' : '▶ 继续')}
        </button>
        <button
          onClick={() => setStep(0)}
          style={{ fontFamily: 'var(--sans)', fontSize: 12, padding: '8px 12px', border: '1px solid var(--rule)' }}
        >⏮ 起点</button>
        <button
          onClick={() => setStep(tlen)}
          style={{ fontFamily: 'var(--sans)', fontSize: 12, padding: '8px 12px', border: '1px solid var(--rule)' }}
        >⏭ 终点</button>
        <input
          type="range" min={0} max={tlen} value={step}
          onChange={e => setStep(+e.target.value)}
          style={{ flex: 1 }}
        />
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 48, textAlign: 'right' }}>
          {step}/{tlen}
        </span>
      </div>

      {/* Log */}
      <div className="kicker" style={{ marginBottom: 12 }}>传播日志</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((ev, i) => {
          const cumulative = i + 1;
          const total = story.channels.length;
          const pct = Math.round((cumulative / total) * 100);
          return (
            <div key={ev.id} style={{
              display: 'grid', gridTemplateColumns: '52px 24px 1fr auto',
              gap: 10, alignItems: 'center', fontSize: 12,
            }}>
              <span className="mono" style={{ color: 'var(--ink-3)' }}>{ev.timeDisplay}</span>
              <ChannelChip channel={ev.channel} size="xs" />
              <div style={{ position: 'relative', height: 3, background: 'var(--bar-bg)' }}>
                <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`, background: 'var(--bar-fill)' }} />
              </div>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', minWidth: 32, textAlign: 'right' }}>
                {cumulative}/{total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Status Bar ---
function StatusBar({ stories, selected }: { stories: (EventStory & { meta: ScoreMeta })[]; selected: (EventStory & { meta: ScoreMeta }) | null }) {
  const totalCh = new Set(stories.flatMap(s => s.channels.map(c => c.id))).size;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18, padding: '7px 20px',
      borderTop: '1px solid var(--rule)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
    }}>
      <span><span style={{ color: 'var(--claret)' }}>●</span> 实时</span>
      <span>当前 {stories.length} 条故事</span><span>·</span>
      <span>覆盖 {totalCh} 家渠道</span><span>·</span>
      {selected && (
        <span>选中 <span style={{ color: 'var(--ink-2)', fontFamily: 'var(--sans)' }}>{selected.title.slice(0, 30)}...</span></span>
      )}
      <div style={{ flex: 1 }} />
      <span>VALUE = (T1·3 + T2·2 + T3·1) × 2.2 · cap 100</span>
    </div>
  );
}

// --- Main App ---
export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightPane, setRightPane] = useState('channels');
  const [category, setCategory] = useState('全部');
  const [sort, setSort] = useState('value');
  const [lastSync, setLastSync] = useState('—');
  const [syncing, setSyncing] = useState(false);

  // Date range defaults to last 3 months using local dates (L7)
  const today = new Date();
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const [dateStart, setDateStart] = useState(toLocalDate(threeMonthsAgo));
  const [dateEnd, setDateEnd] = useState(toLocalDate(today));
  const [minScore, setMinScore] = useState(20);

  // Fetch events from API with current filters (H4: added error handling)
  const fetchEvents = () => {
    const params = new URLSearchParams({
      limit: '500',
      minScore: String(minScore),
      startDate: dateStart,
      endDate: dateEnd,
    });
    fetch(`/api/events?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ApiResponse) => {
        setData(d);
        setLoading(false);
        if (d.stories.length > 0 && !selectedId) setSelectedId(d.stories[0].id);
        setLastSync(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      })
      .catch(err => {
        console.error('fetchEvents failed:', err);
        setLoading(false);
      });
  };

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Refetch when filters change
  useEffect(() => {
    if (!loading) fetchEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, dateStart, dateEnd, minScore]);

  // Manual sync (trigger fetch + RSS)
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/fetch', { method: 'POST' });
      const result = await res.json();
      if (result.newArticles > 0 || result.newEvents > 0) {
        console.log(`Synced: ${result.newArticles} new articles, ${result.newEvents} new events`);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      fetchEvents();
      setSyncing(false);
    }
  };

  const stories = useMemo(() => {
    if (!data) return [];
    let arr = [...data.stories];
    if (category !== '全部') arr = arr.filter(s => s.category === category);
    if (sort === 'value') arr.sort((a, b) => b.meta.score - a.meta.score);
    else if (sort === 'time') arr.sort((a, b) => a.updatedMin - b.updatedMin);
    else if (sort === 'velocity') arr.sort((a, b) => b.sourceCount - a.sourceCount);
    return arr;
  }, [data, category, sort]);

  const selected = useMemo(
    () => stories.find(s => s.id === selectedId) || stories[0] || null,
    [stories, selectedId]
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-3)',
      }}>
        Loading LavaNews...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-3)',
      }}>
        No data available. Run the seed script first.
      </div>
    );
  }

  return (
    <div className="terminal-layout">
      <TopBar storyCount={stories.length} lastSync={syncing ? '同步中...' : lastSync} onSync={handleSync} />
      <SubBar
        categories={data.categories}
        selectedCategory={category}
        onCategoryChange={setCategory}
        sort={sort}
        onSortChange={setSort}
        dateStart={dateStart}
        dateEnd={dateEnd}
        onDateChange={(field, v) => { if (field === 'start') setDateStart(v); else setDateEnd(v); }}
        minScore={minScore}
        onMinScoreChange={setMinScore}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', overflow: 'hidden' }}>
        {stories.length > 0 ? (
          <FeedPane
            stories={stories}
            selectedId={selected?.id || ''}
            onSelect={id => { setSelectedId(id); setRightPane('channels'); }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 14 }}>
            该板块暂无新闻
          </div>
        )}

        {selected ? (
          <div className="terminal-detail">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 0,
              borderBottom: '1px solid var(--rule)', position: 'sticky', top: 0,
              background: 'var(--paper)', zIndex: 2,
            }}>
              {[
                { k: 'channels', label: '详情 · 渠道矩阵' },
                { k: 'timeline', label: 'TIMELINE · 扩散回放' },
              ].map(t => (
                <button
                  key={t.k}
                  onClick={() => setRightPane(t.k)}
                  style={{
                    fontFamily: 'var(--sans)', fontSize: 11, letterSpacing: '0.1em',
                    textTransform: 'uppercase', padding: '12px 18px',
                    color: rightPane === t.k ? 'var(--claret)' : 'var(--ink-3)',
                    fontWeight: rightPane === t.k ? 700 : 500,
                    borderBottom: rightPane === t.k ? '2px solid var(--claret)' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Channels detail pane */}
            {rightPane === 'channels' && (
              <div style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className="kicker claret">{selected.category}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    首发 {selected.firstSeenDisplay} · {selected.updatedMin}分前
                  </span>
                </div>
                <h1 style={{
                  fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 34,
                  lineHeight: 1.12, letterSpacing: '-0.015em', margin: '0 0 14px',
                }}>
                  {selected.title}
                </h1>
                <p style={{
                  fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6,
                  color: 'var(--ink-2)', margin: '0 0 24px',
                }}>
                  {selected.summary}
                </p>

                {/* Score row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', border: '1px solid var(--rule)', marginBottom: 28 }}>
                  {[
                    { l: 'VALUE', v: selected.meta.score, sub: '/100', hi: true },
                    { l: 'T1 权威', v: selected.meta.t1, sub: '×3' },
                    { l: 'T2 主流', v: selected.meta.t2, sub: '×2' },
                    { l: 'T3 一般', v: selected.meta.t3, sub: '×1' },
                    { l: 'TOTAL', v: selected.meta.total, sub: '渠道' },
                    { l: 'FIRST SEEN', v: selected.firstSeenDisplay, sub: '' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding: '14px 16px', borderRight: i < 5 ? '1px solid var(--rule)' : 'none' }}>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: 0.4, color: 'var(--ink-3)', marginBottom: 6 }}>{x.l}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{
                          fontFamily: 'var(--mono)', fontSize: x.hi ? 30 : 22, fontWeight: 500,
                          color: x.hi ? 'var(--claret)' : 'var(--ink)', lineHeight: 1,
                        }}>{x.v}</span>
                        {x.sub && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{x.sub}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Channel matrix */}
                <div className="kicker" style={{ marginBottom: 12 }}>渠道矩阵 · {selected.channels.length} 家已报道</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 0, border: '1px solid var(--rule)' }}>
                  {selected.channels.map((ch, i) => {
                    const article = selected.articles.find(a => a.channel?.id === ch.id);
                    const ev = selected.timeline.find(e => e.channel.id === ch.id);
                    return (
                      <div key={ch.id} style={{
                        padding: '12px 14px', borderRight: (i % 3) < 2 ? '1px solid var(--rule)' : 'none',
                        borderBottom: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ChannelChip channel={ch} size="sq" />
                          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600 }}>{ch.name}</span>
                          <span className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                            T{ch.tier} · {ch.region === 'cn' ? 'CN' : 'INTL'}
                          </span>
                        </div>
                        {article ? (
                          <>
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 12.5, lineHeight: 1.4, color: 'var(--ink)' }}>{article.title}</div>
                            <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--ink-3)' }}>{article.summary.slice(0, 60)}...</div>
                          </>
                        ) : (
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>(标题未采集)</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{ev?.timeDisplay || '—'}</span>
                          <span className="mono" style={{ fontSize: 10, color: ch.tier === 1 ? 'var(--claret)' : 'var(--ink-3)' }}>
                            +{ch.tier === 1 ? 3 : ch.tier === 2 ? 2 : 1}分
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timeline pane */}
            {rightPane === 'timeline' && <TimelinePlayback story={selected} />}
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-3)', fontFamily: 'var(--serif)', fontSize: 14,
          }}>
            选择一条新闻查看详情
          </div>
        )}
      </div>
      <StatusBar stories={stories} selected={selected} />
    </div>
  );
}
