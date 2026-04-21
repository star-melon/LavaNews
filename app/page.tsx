// app/page.tsx — LavaNews Terminal Layout
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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

// Full first-seen timestamp (local): "2026-04-16 05:24"
function formatFirstSeen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Compact variant for dense list rows: "04-16 05:24"
function formatFirstSeenShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Humanize a "minutes ago" integer into the largest sensible unit.
function formatAgo(min: number): string {
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} 周前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

// --- Date range picker (Meta Ads style) ---
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function formatCN(s: string): string {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
// Monday-start offset (Mon=0, ..., Sun=6)
function mondayOffset(year: number, month: number): number {
  const js = new Date(year, month, 1).getDay();
  return (js + 6) % 7;
}
function monthGrid(year: number, month: number): (string | null)[] {
  const cells: (string | null)[] = [];
  const off = mondayOffset(year, month);
  const total = daysInMonth(year, month);
  for (let i = 0; i < off; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(toLocalDate(new Date(year, month, d)));
  while (cells.length < 42) cells.push(null);
  return cells;
}

type Preset = { key: string; label: string; compute: () => [string, string] };

function buildPresets(): Preset[] {
  const today = new Date();
  const todayStr = toLocalDate(today);
  const yesterday = addDays(today, -1);
  const dow = (today.getDay() + 6) % 7; // Mon=0
  const sow = addDays(today, -dow);
  const prevWeekEnd = addDays(sow, -1);
  const prevWeekStart = addDays(sow, -7);
  const som = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthEnd = addDays(som, -1);
  const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
  return [
    { key: 'today', label: '今天', compute: () => [todayStr, todayStr] },
    { key: 'yesterday', label: '昨天', compute: () => [toLocalDate(yesterday), toLocalDate(yesterday)] },
    { key: 'today_and_yesterday', label: '今天和昨天', compute: () => [toLocalDate(yesterday), todayStr] },
    { key: 'last_7', label: '过去 7 天', compute: () => [toLocalDate(addDays(today, -6)), todayStr] },
    { key: 'last_14', label: '过去 14 天', compute: () => [toLocalDate(addDays(today, -13)), todayStr] },
    { key: 'last_28', label: '过去 28 天', compute: () => [toLocalDate(addDays(today, -27)), todayStr] },
    { key: 'last_30', label: '过去 30 天', compute: () => [toLocalDate(addDays(today, -29)), todayStr] },
    { key: 'this_week', label: '本周', compute: () => [toLocalDate(sow), todayStr] },
    { key: 'last_week', label: '上周', compute: () => [toLocalDate(prevWeekStart), toLocalDate(prevWeekEnd)] },
    { key: 'this_month', label: '本月', compute: () => [toLocalDate(som), todayStr] },
    { key: 'last_month', label: '上个月', compute: () => [toLocalDate(prevMonthStart), toLocalDate(prevMonthEnd)] },
    { key: 'maximum', label: '最大日期范围', compute: () => [toLocalDate(addDays(today, -365)), todayStr] },
  ];
}
function matchPreset(start: string, end: string, presets: Preset[]): Preset | null {
  for (const p of presets) {
    const [s, e] = p.compute();
    if (s === start && e === end) return p;
  }
  return null;
}

function DateRangePicker({
  start, end, onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState(start);
  const [tempEnd, setTempEnd] = useState(end);
  const [selectingSecond, setSelectingSecond] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const presets = useMemo(() => buildPresets(), []);

  const initial = parseLocalDate(start || toLocalDate(new Date()));
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTempStart(start);
      setTempEnd(end);
      setSelectingSecond(false);
      setHover(null);
      const d = parseLocalDate(start || toLocalDate(new Date()));
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open, start, end]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activePreset = matchPreset(start, end, presets);
  const label = activePreset ? activePreset.label : '自定义';

  const handleDay = (s: string) => {
    if (!selectingSecond) {
      setTempStart(s); setTempEnd(s); setSelectingSecond(true);
    } else {
      if (s < tempStart) { setTempEnd(tempStart); setTempStart(s); }
      else setTempEnd(s);
      setSelectingSecond(false);
    }
  };
  const applyPreset = (p: Preset) => {
    const [s, e] = p.compute();
    setTempStart(s); setTempEnd(e); setSelectingSecond(false);
    const d = parseLocalDate(s);
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth());
  };
  const commit = () => { onChange(tempStart, tempEnd); setOpen(false); };
  const nextMonth = () => { const d = new Date(viewYear, viewMonth + 1, 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); };
  const prevMonth = () => { const d = new Date(viewYear, viewMonth - 1, 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); };

  const todayStr = toLocalDate(new Date());
  const previewStart = selectingSecond && hover ? (hover < tempStart ? hover : tempStart) : tempStart;
  const previewEnd = selectingSecond && hover ? (hover < tempStart ? tempStart : hover) : tempEnd;

  const renderMonth = (year: number, month: number) => {
    const cells = monthGrid(year, month);
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {month + 1} 月 {year}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 2 }}>
          {['一','二','三','四','五','六','日'].map(w => (
            <div key={w} style={{ textAlign: 'center', padding: '3px 0' }}>周{w}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((c, i) => {
            if (!c) return <div key={i} style={{ height: 28 }} />;
            const isFuture = c > todayStr;
            const isStart = c === previewStart;
            const isEnd = c === previewEnd;
            const inRange = !isFuture && c >= previewStart && c <= previewEnd;
            const endpoint = (isStart || isEnd) && !isFuture;
            return (
              <button
                key={i}
                onClick={() => { if (!isFuture) handleDay(c); }}
                onMouseEnter={() => { if (!isFuture) setHover(c); }}
                onMouseLeave={() => setHover(prev => (prev === c ? null : prev))}
                disabled={isFuture}
                style={{
                  height: 28,
                  fontSize: 12,
                  fontFamily: 'var(--mono)',
                  background: inRange && !endpoint ? 'rgba(153,15,61,0.12)' : 'transparent',
                  color: isFuture ? 'var(--ink-4)' : endpoint ? 'var(--paper)' : 'var(--ink)',
                  position: 'relative',
                  cursor: isFuture ? 'not-allowed' : 'pointer',
                  padding: 0,
                  border: 0,
                  opacity: isFuture ? 0.45 : 1,
                }}
              >
                {endpoint && (
                  <span style={{
                    position: 'absolute', inset: '1px 3px',
                    background: 'var(--claret)', borderRadius: 2, zIndex: 0,
                  }} />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>
                  {parseInt(c.split('-')[2], 10)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const nextViewYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextViewMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="drp-trigger"
        style={{
          fontFamily: 'var(--sans)', fontSize: 11, padding: '4px 10px',
          border: '1px solid var(--rule)', background: 'var(--paper)',
          color: 'var(--ink)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}:</span>
        <span className="mono" style={{ fontSize: 11 }}>
          {formatCN(start)} – {formatCN(end)}
        </span>
        <span style={{ color: 'var(--ink-3)', fontSize: 9 }}>▼</span>
      </button>

      {open && (
        <div
          className="drp-popover"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
            background: 'var(--paper)', border: '1px solid var(--rule)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            display: 'flex', minWidth: 620,
            fontFamily: 'var(--sans)',
          }}
        >
          <div
            className="drp-presets"
            style={{
              width: 150, borderRight: '1px solid var(--rule)',
              padding: 8, maxHeight: 360, overflowY: 'auto',
            }}
          >
            {presets.map(p => {
              const isActive = matchPreset(tempStart, tempEnd, [p]) !== null;
              return (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px', fontSize: 12,
                    color: isActive ? 'var(--claret)' : 'var(--ink)',
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? 'rgba(153,15,61,0.08)' : 'transparent',
                    cursor: 'pointer', border: 0, borderRadius: 2,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1, padding: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <button
                onClick={prevMonth}
                style={{ padding: '2px 8px', cursor: 'pointer', fontSize: 16, border: 0, background: 'transparent', color: 'var(--ink-2)' }}
                aria-label="上个月"
              >‹</button>
              <div style={{ flex: 1 }} />
              <button
                onClick={nextMonth}
                style={{ padding: '2px 8px', cursor: 'pointer', fontSize: 16, border: 0, background: 'transparent', color: 'var(--ink-2)' }}
                aria-label="下个月"
              >›</button>
            </div>
            <div className="drp-months" style={{ display: 'flex', gap: 18 }}>
              {renderMonth(viewYear, viewMonth)}
              {renderMonth(nextViewYear, nextViewMonth)}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--rule)',
            }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {formatCN(tempStart)} – {formatCN(tempEnd)}
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: '5px 14px', fontSize: 11, border: '1px solid var(--rule)',
                  background: 'transparent', cursor: 'pointer',
                }}
              >取消</button>
              <button
                onClick={commit}
                style={{
                  padding: '5px 14px', fontSize: 11,
                  border: '1px solid var(--claret)', background: 'var(--claret)',
                  color: 'var(--paper)', cursor: 'pointer',
                }}
              >更新</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink-3)' }}>
              时区：北京时间
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

type Lang = 'zh' | 'en';

// Display helpers — prefer Chinese translation when lang=zh, fall back to original.
function pickTitle(s: { title: string; titleZh: string }, lang: Lang): string {
  return lang === 'zh' && s.titleZh ? s.titleZh : s.title;
}
function pickSummary(s: { summary: string; summaryZh: string }, lang: Lang): string {
  return lang === 'zh' && s.summaryZh ? s.summaryZh : s.summary;
}

// --- Top Bar ---
function TopBar({
  storyCount,
  lastSync,
  onSync,
  lang,
  onLangToggle,
  syncing,
}: {
  storyCount: number;
  lastSync: string;
  onSync: () => void;
  lang: Lang;
  onLangToggle: () => void;
  syncing: boolean;
}) {
  return (
    <header className="top-bar" style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 20px', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>
        <span style={{ color: 'var(--claret)' }}>Lava</span>News
      </div>
      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.18em', paddingLeft: 10, borderLeft: '1px solid var(--rule)' }}>
        TERMINAL · V.2
      </span>
      <div style={{ flex: 1 }} />
      <div className="top-bar-status" style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <span>24 渠道</span><span>·</span>
        <span><span style={{ color: 'var(--claret)' }}>●</span> LIVE · {lastSync}</span><span>·</span>
        <span>{toLocalDate(new Date())}</span>
      </div>
      <button
        onClick={onLangToggle}
        title={lang === 'zh' ? '切换到原文' : '切换到中文翻译'}
        style={{
          fontFamily: 'var(--sans)', fontSize: 11, padding: '5px 12px',
          border: '1px solid var(--rule)',
          background: lang === 'zh' ? 'var(--claret)' : 'transparent',
          color: lang === 'zh' ? 'var(--paper)' : 'var(--ink-2)',
          cursor: 'pointer',
        }}
      >
        {lang === 'zh' ? '中文' : 'EN'}
      </button>
      <button
        onClick={onSync}
        disabled={syncing}
        style={{
          fontFamily: 'var(--sans)', fontSize: 11, padding: '5px 12px',
          border: '1px solid var(--rule)',
          color: syncing ? 'var(--ink-3)' : 'var(--claret)',
          cursor: syncing ? 'not-allowed' : 'pointer',
          opacity: syncing ? 0.7 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        {syncing && <span className="spinner" style={{ width: 11, height: 11, borderWidth: 1.5 }} />}
        {syncing ? '同步中' : '同步'}
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
  onDateChange: (start: string, end: string) => void;
  minScore: number;
  onMinScoreChange: (v: number) => void;
}) {
  return (
    <div className="sub-bar" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 20px', borderBottom: '1px solid var(--rule)', fontFamily: 'var(--sans)', fontSize: 11 }}>
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
      <div className="sub-divider" style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 6px' }} />
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
      <div className="sub-divider" style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 6px' }} />
      <span className="kicker" style={{ fontSize: 10 }}>日期</span>
      <DateRangePicker
        start={dateStart}
        end={dateEnd}
        onChange={onDateChange}
      />
      <div className="sub-divider" style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 6px' }} />
      <span className="kicker" style={{ fontSize: 10 }}>最低分</span>
      <div className="minscore-slider" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
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
      <div className="tier-legend" style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--sans)' }}>
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
  lang,
}: {
  stories: (EventStory & { meta: ScoreMeta })[];
  selectedId: string;
  onSelect: (id: string) => void;
  lang: Lang;
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
                {pickTitle(s, lang)}
              </h4>
              <ChannelCloud channels={s.channels} max={9} size="xs" />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 5,
              }}>
                <span>{formatFirstSeenShort(s.firstSeen)}</span><span>·</span>
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
function TimelinePlayback({ story, lang }: { story: EventStory & { meta: ScoreMeta }; lang: Lang }) {
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
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, margin: '0 0 18px', fontWeight: 800 }}>{pickTitle(story, lang)}</h2>
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
function StatusBar({ stories, selected, lang }: { stories: (EventStory & { meta: ScoreMeta })[]; selected: (EventStory & { meta: ScoreMeta }) | null; lang: Lang }) {
  const totalCh = new Set(stories.flatMap(s => s.channels.map(c => c.id))).size;
  return (
    <div className="status-bar" style={{
      display: 'flex', alignItems: 'center', gap: 18, padding: '7px 20px',
      borderTop: '1px solid var(--rule)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
    }}>
      <span><span style={{ color: 'var(--claret)' }}>●</span> 实时</span>
      <span>当前 {stories.length} 条故事</span><span>·</span>
      <span>覆盖 {totalCh} 家渠道</span><span>·</span>
      {selected && (
        <span>选中 <span style={{ color: 'var(--ink-2)', fontFamily: 'var(--sans)' }}>{pickTitle(selected, lang).slice(0, 30)}...</span></span>
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

  // Date range defaults to last 30 days using local dates (matches the
  // "过去 30 天" preset so the range picker opens with a named selection).
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const [dateStart, setDateStart] = useState(toLocalDate(thirtyDaysAgo));
  const [dateEnd, setDateEnd] = useState(toLocalDate(today));
  const [minScore, setMinScore] = useState(20);
  const [lang, setLang] = useState<Lang>('zh');

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

  // Initial load: read the DB. The backend cron already fetches RSS hourly,
  // so per-refresh full syncs are redundant. Users can still trigger a manual
  // sync via the 同步 button.
  useEffect(() => {
    fetchEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="loading-screen">
        <span className="spinner lg" />
        <span>LOADING LAVANEWS…</span>
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
      {syncing && <div className="sync-progress" aria-hidden="true" />}
      <TopBar
        storyCount={stories.length}
        lastSync={syncing ? '同步中...' : lastSync}
        onSync={handleSync}
        lang={lang}
        onLangToggle={() => setLang(l => (l === 'zh' ? 'en' : 'zh'))}
        syncing={syncing}
      />
      <SubBar
        categories={data.categories}
        selectedCategory={category}
        onCategoryChange={setCategory}
        sort={sort}
        onSortChange={setSort}
        dateStart={dateStart}
        dateEnd={dateEnd}
        onDateChange={(s, e) => { setDateStart(s); setDateEnd(e); }}
        minScore={minScore}
        onMinScoreChange={setMinScore}
      />
      <div className="main-split">
        {stories.length > 0 ? (
          <FeedPane
            stories={stories}
            selectedId={selected?.id || ''}
            onSelect={id => { setSelectedId(id); setRightPane('channels'); }}
            lang={lang}
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
              <div className="detail-pane" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className="kicker claret">{selected.category}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    首发 {formatFirstSeen(selected.firstSeen)} · {formatAgo(selected.updatedMin)}
                  </span>
                </div>
                <h1 className="detail-title" style={{
                  fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 34,
                  lineHeight: 1.12, letterSpacing: '-0.015em', margin: '0 0 14px',
                }}>
                  {pickTitle(selected, lang)}
                </h1>
                {lang === 'zh' && selected.titleZh && selected.titleZh !== selected.title && (
                  <div style={{
                    fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-3)',
                    marginTop: -10, marginBottom: 14,
                  }}>
                    原文：{selected.title}
                  </div>
                )}
                <p style={{
                  fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6,
                  color: 'var(--ink-2)', margin: '0 0 14px',
                  whiteSpace: 'pre-line',
                }}>
                  {pickSummary(selected, lang)}
                </p>
                {selected.articles[0]?.url && (
                  <div style={{ marginBottom: 24 }}>
                    <a
                      href={selected.articles[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--claret)',
                        textDecoration: 'none', borderBottom: '1px solid var(--claret)',
                        paddingBottom: 1,
                      }}
                    >
                      阅读原文 · {selected.articles[0].sourceName || selected.articles[0].source} ↗
                    </a>
                  </div>
                )}

                {/* Score row */}
                <div className="detail-score-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', border: '1px solid var(--rule)', marginBottom: 28 }}>
                  {[
                    { l: 'VALUE', v: selected.meta.score, sub: '/100', hi: true },
                    { l: 'T1 权威', v: selected.meta.t1, sub: '×3' },
                    { l: 'T2 主流', v: selected.meta.t2, sub: '×2' },
                    { l: 'T3 一般', v: selected.meta.t3, sub: '×1' },
                    { l: 'TOTAL', v: selected.meta.total, sub: '渠道' },
                    { l: 'FIRST SEEN', v: formatFirstSeenShort(selected.firstSeen), sub: '' },
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
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontFamily: 'var(--serif)', fontSize: 12.5, lineHeight: 1.4,
                                color: 'var(--ink)', textDecoration: 'none',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--claret)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink)')}
                              title="点击阅读原文"
                            >
                              {pickTitle(article, lang)}
                              <span className="mono" style={{ fontSize: 10, marginLeft: 4, color: 'var(--ink-3)' }}>↗</span>
                            </a>
                            <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                              {pickSummary(article, lang).slice(0, 180)}{pickSummary(article, lang).length > 180 ? '...' : ''}
                            </div>
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
            {rightPane === 'timeline' && <TimelinePlayback story={selected} lang={lang} />}
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
      <StatusBar stories={stories} selected={selected} lang={lang} />
    </div>
  );
}
