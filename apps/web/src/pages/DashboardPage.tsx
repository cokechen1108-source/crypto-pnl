import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDailyPnlSafe,
  fetchTradeActivityDays,
  fetchTotalPnl,
  fetchTrades,
  fetchTradesByDate,
  listAccounts,
  type Trade,
} from '../api/client';
import PnlCalendar from '../features/pnl/PnlCalendar';
import TradeList from '../features/trades/TradeList';
import ConnectExchange from '../features/accounts/ConnectExchange';
import DayChart from '../features/charts/DayChart';
import TradeReviewNotes from '../features/charts/TradeReviewNotes';
import { format } from 'date-fns';

const ALL_SYMBOLS = '';

export default function DashboardPage() {
  const [accountId, setAccountId] = useState('');
  /** 交易对筛选：空表示全部，否则按交易对筛选 */
  const [symbol, setSymbol] = useState(ALL_SYMBOLS);
  /** 日历选中的日期 yyyy-MM-dd，用于显示当日交易与 K 线叠加 */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  /** 当日 K 线面板内选中的交易对 */
  const [dayChartSymbol, setDayChartSymbol] = useState('');
  /** 当日成交列表中选中的交易 id，用于 K 线只显示该笔入场/出场 */
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  /** 当日 K 线周期 */
  const [dayChartTimeframe, setDayChartTimeframe] = useState<
    '15m' | '1h' | '4h' | '1d'
  >('15m');
  const [tradesPage, setTradesPage] = useState(1);
  const [tradesPageSize, setTradesPageSize] = useState(100);
  const [loadedTrades, setLoadedTrades] = useState<Trade[]>([]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      try {
        const data = await listAccounts('default-user');
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });
  const accounts = Array.isArray(accountsQuery.data)
    ? accountsQuery.data.filter((acc) => acc.isActive)
    : [];
  const effectiveAccountId = accountId || (accounts[0]?.id ?? '');

  const tradesQuery = useQuery({
    queryKey: ['trades', effectiveAccountId, symbol, tradesPage, tradesPageSize],
    queryFn: () =>
      fetchTrades(
        effectiveAccountId,
        symbol === ALL_SYMBOLS ? undefined : symbol,
        undefined,
        tradesPage,
        tradesPageSize,
      ),
    enabled: Boolean(effectiveAccountId),
  });

  const dailyPnlQuery = useQuery({
    queryKey: ['dailyPnl', effectiveAccountId],
    queryFn: () => fetchDailyPnlSafe(effectiveAccountId),
    enabled: Boolean(effectiveAccountId),
  });

  const activityDaysQuery = useQuery({
    queryKey: ['activityDays', effectiveAccountId],
    queryFn: () => fetchTradeActivityDays(effectiveAccountId),
    enabled: Boolean(effectiveAccountId),
  });

  const totalPnlQuery = useQuery({
    queryKey: ['totalPnl', effectiveAccountId],
    queryFn: () => fetchTotalPnl(effectiveAccountId),
    enabled: Boolean(effectiveAccountId),
  });

  const dayTradesQuery = useQuery({
    queryKey: ['tradesByDate', effectiveAccountId, selectedDate],
    queryFn: () => fetchTradesByDate(effectiveAccountId, selectedDate ?? ''),
    enabled: Boolean(effectiveAccountId && selectedDate),
  });

  const totalPnl = totalPnlQuery.data?.totalRealizedPnl ?? 0;
  const tradesTotal = tradesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(tradesTotal / tradesPageSize));
  const hasMoreTrades = loadedTrades.length < tradesTotal;

  const dayTrades = dayTradesQuery.data?.items ?? [];
  const daySymbols = useMemo(() => {
    const set = new Set(dayTrades.map((t) => t.symbol));
    return Array.from(set);
  }, [dayTrades]);
  const chartSymbol = daySymbols.includes(dayChartSymbol)
    ? dayChartSymbol
    : daySymbols[0] ?? '';

  const handleSelectDayTrade = (trade: { id: string; symbol: string }) => {
    setSelectedTradeId(trade.id);
    setDayChartSymbol(trade.symbol);
  };

  const effectiveSelectedTradeId = useMemo(() => {
    if (!selectedDate || dayTrades.length === 0) return null;
    if (selectedTradeId && dayTrades.some((t) => t.id === selectedTradeId))
      return selectedTradeId;
    return dayTrades[0]?.id ?? null;
  }, [selectedDate, dayTrades, selectedTradeId]);

  useEffect(() => {
    setTradesPage(1);
    setLoadedTrades([]);
  }, [effectiveAccountId, symbol, tradesPageSize]);

  useEffect(() => {
    if (tradesPage > totalPages) {
      setTradesPage(totalPages);
    }
  }, [tradesPage, totalPages]);

  useEffect(() => {
    const items = tradesQuery.data?.items ?? [];
    setLoadedTrades((prev) => {
      if (tradesPage === 1) return items;
      const map = new Map(prev.map((t) => [t.id, t]));
      for (const item of items) map.set(item.id, item);
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime(),
      );
    });
  }, [tradesQuery.data, tradesPage]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMoreTrades) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first.isIntersecting) return;
        if (tradesQuery.isFetching) return;
        setTradesPage((p) => (p < totalPages ? p + 1 : p));
      },
      { root: null, rootMargin: '180px', threshold: 0.01 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreTrades, tradesQuery.isFetching, totalPages]);

  useEffect(() => {
    if (!selectedDate) {
      setSelectedTradeId(null);
      setDayChartSymbol('');
      return;
    }
    if (dayTrades.length === 0) return;
    const first = dayTrades[0];
    const valid = selectedTradeId && dayTrades.some((t) => t.id === selectedTradeId);
    if (!valid) {
      setSelectedTradeId(first.id);
      setDayChartSymbol(first.symbol);
    }
  }, [selectedDate, dayTrades]);

  return (
    <div className="dashboard">
      <ConnectExchange />
      <section className="filters">
        <div>
          <label>当前账户</label>
          <select
            value={effectiveAccountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="form-select"
          >
            {accounts.length === 0 && (
              <option value="">请先连接交易所 API</option>
            )}
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.exchange})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>交易对</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="form-select"
          >
            <option value={ALL_SYMBOLS}>全部</option>
            <option value="BTC/USDT">BTC/USDT</option>
            <option value="ETH/USDT">ETH/USDT</option>
            <option value="ETH/USDT:USDT">ETH/USDT:USDT</option>
            <option value="BTC/USDT:USDT">BTC/USDT:USDT</option>
          </select>
        </div>
        <div className="stat">
          <span>累计已实现PnL</span>
          <strong>{totalPnl.toFixed(2)}</strong>
        </div>
      </section>
      <div className="dashboard-grid">
        <div className="dashboard-row">
          <section className="panel panel--calendar">
            <h2>日历PnL</h2>
            <PnlCalendar
              loading={dailyPnlQuery.isLoading || activityDaysQuery.isLoading}
              rows={dailyPnlQuery.data ?? []}
              activityDates={activityDaysQuery.data ?? []}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
            />
          </section>
          <section className="panel panel--trades">
            <h2>交易列表</h2>
            <p className="panel-subtitle">
              按时间倒序（最新在前） · 共 {tradesTotal} 笔 · 第 {tradesPage}/{totalPages} 页
            </p>
            <TradeList
              loading={tradesQuery.isLoading}
              trades={loadedTrades}
            />
            <div className="trade-pagination">
              <div className="trade-pagination-left">
                <label>每页</label>
                <select
                  value={tradesPageSize}
                  onChange={(e) => setTradesPageSize(Number(e.target.value))}
                  className="form-select"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              <div className="trade-pagination-right">
                <span className="trade-pagination-info">
                  已加载 {loadedTrades.length} / {tradesTotal}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setTradesPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!hasMoreTrades || tradesQuery.isFetching}
                >
                  {tradesQuery.isFetching ? '加载中…' : hasMoreTrades ? '加载更多' : '已加载全部'}
                </button>
              </div>
            </div>
            <div ref={loadMoreRef} className="trade-load-sentinel" />
          </section>
        </div>
        {selectedDate && (
          <section className="panel panel--day">
            <h2>
              当日交易（{format(new Date(selectedDate + 'T12:00:00'), 'yyyy年M月d日')}）
              <button
                type="button"
                className="btn-close-day"
                onClick={() => setSelectedDate(null)}
                aria-label="关闭"
              >
                ×
              </button>
            </h2>
            {dayTradesQuery.isLoading ? (
              <div className="empty">加载中...</div>
            ) : dayTrades.length === 0 ? (
              <div className="empty">该日无交易记录</div>
            ) : (
              <>
                <div className="day-summary">
                  <span>共 {dayTrades.length} 笔</span>
                  <span>币种：{daySymbols.join('、')}</span>
                </div>
                {daySymbols.length > 0 && chartSymbol && (
                  <div className="day-chart-section">
                    <div className="chart-toolbar">
                      <label>K线交易对</label>
                      <select
                        value={chartSymbol}
                        onChange={(e) => {
                          const sym = e.target.value;
                          setDayChartSymbol(sym);
                          const firstForSymbol = dayTrades.find((t) => t.symbol === sym);
                          if (firstForSymbol) setSelectedTradeId(firstForSymbol.id);
                        }}
                        className="form-select"
                      >
                        {daySymbols.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="day-chart-row">
                      <div className="day-chart-main">
                        <DayChart
                          accountId={effectiveAccountId}
                          symbol={chartSymbol}
                          dateStr={selectedDate}
                          timeframe={dayChartTimeframe}
                          onTimeframeChange={setDayChartTimeframe}
                          selectedTradeId={effectiveSelectedTradeId}
                        />
                      </div>
                      <TradeReviewNotes
                        accountId={effectiveAccountId}
                        dateStr={selectedDate}
                        symbol={chartSymbol}
                      />
                    </div>
                  </div>
                )}
                <div className="day-trades-list">
                  <h3>当日成交列表（点击选中以在 K 线中显示）</h3>
                  <TradeList
                    trades={dayTrades}
                    loading={false}
                    selectedTradeId={effectiveSelectedTradeId}
                    onSelectTrade={handleSelectDayTrade}
                  />
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
