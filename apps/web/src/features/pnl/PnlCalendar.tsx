import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import type { PnlRow } from '../../api/client';

/** 日历格内短格式：控制字符数≤6，避免溢出 */
function formatPnlShort(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  const abs = Math.abs(value);
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}万`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  if (abs >= 100) return `${sign}${Math.round(abs)}`; /* 100–999 显示整数，最多 4 字符 */
  return `${sign}${abs.toFixed(2)}`; /* 0–99.99 最多 6 字符 */
}

type Props = {
  rows: PnlRow[];
  activityDates?: string[];
  loading?: boolean;
  /** 点击某天时回调，参数为 yyyy-MM-dd；若该天无数据仍会回调 */
  onSelectDate?: (dateStr: string) => void;
  /** 当前选中的日期 yyyy-MM-dd，用于高亮 */
  selectedDate?: string | null;
};

export default function PnlCalendar({
  rows,
  activityDates = [],
  loading,
  onSelectDate,
  selectedDate,
}: Props) {
  const allDateKeys = useMemo(() => {
    const keys = new Set<string>(activityDates);
    for (const row of rows) {
      const raw = row.date ?? row.month ?? '';
      if (!raw) continue;
      keys.add(raw.slice(0, 10));
    }
    return Array.from(keys).sort();
  }, [rows, activityDates]);
  const latestDateKey = allDateKeys[allDateKeys.length - 1] ?? null;
  const [viewMonth, setViewMonth] = useState(() =>
    latestDateKey ? new Date(`${latestDateKey}T12:00:00`) : new Date(),
  );
  const initializedByDataRef = useRef(false);

  useEffect(() => {
    if (!latestDateKey || initializedByDataRef.current) return;
    initializedByDataRef.current = true;
    setViewMonth(new Date(`${latestDateKey}T12:00:00`));
  }, [latestDateKey]);

  const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const pnlMap = new Map<string, PnlRow>();
  const activitySet = new Set(activityDates);
  for (const row of rows) {
    const raw = row.date ?? row.month ?? '';
    if (!raw) continue;
    const d = raw.length <= 10 ? new Date(`${raw.slice(0, 10)}T12:00:00`) : new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    pnlMap.set(format(d, 'yyyy-MM-dd'), row);
  }
  const monthPrefix = format(viewMonth, 'yyyy-MM');
  const monthHasActivity = allDateKeys.some((d) => d.startsWith(monthPrefix));

  if (loading) {
    return <div className="empty">加载中...</div>;
  }

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button type="button" onClick={() => setViewMonth((m) => subMonths(m, 1))}>
          上一月
        </button>
        <span className="calendar-title">{format(viewMonth, 'yyyy年M月')}</span>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))}>
          下一月
        </button>
      </div>
      {!monthHasActivity && latestDateKey && (
        <p className="calendar-empty-hint">
          当前月份无交易。最近交易日：{latestDateKey}
          {' · '}
          <button
            type="button"
            onClick={() => setViewMonth(new Date(`${latestDateKey}T12:00:00`))}
            className="btn btn-sm"
          >
            跳转
          </button>
        </p>
      )}
      <div className="calendar-header">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const row = pnlMap.get(key);
          const pnl = row?.realizedPnl ?? 0;
          const isPositive = pnl >= 0;
          const hasPnl = row != null;
          const hasActivity = activitySet.has(key);
          const hasData = hasPnl || hasActivity;
          const isSelected = selectedDate === key;
          return (
            <button
              key={key}
              type="button"
              className={`calendar-cell ${hasData ? 'calendar-cell--has-data' : ''} ${isSelected ? 'calendar-cell--selected' : ''}`}
              onClick={() => onSelectDate?.(key)}
              title={
                hasData
                  ? hasPnl
                    ? `当日 PnL ${pnl.toFixed(2)}，点击查看交易与K线`
                    : '当日有交易活动，点击查看交易与K线'
                  : undefined
              }
            >
              <span className="date">{format(day, 'd')}</span>
              <span className={isPositive ? 'pnl positive' : 'pnl negative'} aria-label={isPositive ? '盈利' : '亏损'}>
                {hasPnl ? formatPnlShort(pnl) : hasActivity ? '·' : formatPnlShort(0)}
              </span>
            </button>
          );
        })}
      </div>
      {rows.length === 0 && activityDates.length === 0 && (
        <p className="calendar-empty-hint">暂无已平仓记录的日 PnL，请先执行同步。</p>
      )}
    </div>
  );
}
