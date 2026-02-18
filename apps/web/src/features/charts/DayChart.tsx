import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, ColorType } from 'lightweight-charts';
import { fetchCandles, fetchOverlays } from '../../api/client';

/** lightweight-charts 时间轴为 UTC 秒数 */
type UTCTimestamp = number;

/** 进场/出场前后各展示的 K 线根数 */
const BARS_AROUND_TRADES = 100;

/** K 线周期选项（与交易所/CCXT 常用一致） */
export const CHART_TIMEFRAMES = ['15m', '1h', '4h', '1d'] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

const BAR_SPACING_DEFAULT = 6;
const BAR_SPACING_MIN = 2;
const BAR_SPACING_MAX = 24;
const BAR_SPACING_STEP = 2;

type Props = {
  accountId: string;
  symbol: string;
  /** 日期 yyyy-MM-dd */
  dateStr: string;
  /** K 线周期 */
  timeframe?: ChartTimeframe;
  onTimeframeChange?: (tf: ChartTimeframe) => void;
  /** 只显示该笔交易的入场/出场；未选则不显示任何标记 */
  selectedTradeId?: string | null;
};

const ONE_HOUR = 60 * 60 * 1000;

/** 各周期单根 K 线的毫秒数，用于拉取「入场前 100 根」所需的时间范围 */
function getBarMs(tf: ChartTimeframe): number {
  switch (tf) {
    case '15m':
      return 15 * 60 * 1000;
    case '1h':
      return ONE_HOUR;
    case '4h':
      return 4 * ONE_HOUR;
    case '1d':
      return 24 * ONE_HOUR;
    default:
      return ONE_HOUR;
  }
}

export default function DayChart({
  accountId,
  symbol,
  dateStr,
  timeframe = '15m',
  onTimeframeChange,
  selectedTradeId,
}: Props) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<ReturnType<typeof createChart> | null>(null);
  const barSpacingRef = useRef(BAR_SPACING_DEFAULT);

  const range = useMemo(() => {
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`).getTime();
    const barMs = getBarMs(timeframe);
    const lookbackMs = BARS_AROUND_TRADES * barMs;
    const oneDay = 24 * ONE_HOUR;
    return {
      from: dayStart - oneDay * 2 - lookbackMs,
      to: dayEnd + ONE_HOUR * 2,
    };
  }, [dateStr, timeframe]);

  const candlesQuery = useQuery({
    queryKey: ['candles', symbol, dateStr, timeframe],
    queryFn: () => fetchCandles(symbol, timeframe, range.from),
    enabled: Boolean(accountId && symbol && dateStr),
  });

  const overlaysQuery = useQuery({
    queryKey: ['overlays', accountId, symbol, dateStr],
    queryFn: () =>
      fetchOverlays(
        accountId,
        symbol,
        new Date(range.from).toISOString(),
        new Date(range.to).toISOString(),
      ),
    enabled: Boolean(accountId && symbol && dateStr),
  });

  useEffect(() => {
    if (!chartRef.current || !candlesQuery.data) return;

    barSpacingRef.current = BAR_SPACING_DEFAULT;
    const chart = createChart(chartRef.current, {
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1115' },
        textColor: '#c7d0d9',
      },
      grid: {
        horzLines: { color: '#1b2026' },
        vertLines: { color: '#1b2026' },
      },
      rightPriceScale: { borderColor: '#1b2026' },
      timeScale: { borderColor: '#1b2026', barSpacing: BAR_SPACING_DEFAULT },
    });
    chartInstanceRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#2ecc71',
      downColor: '#e74c3c',
      borderVisible: false,
      wickUpColor: '#2ecc71',
      wickDownColor: '#e74c3c',
    });

    const candleData = candlesQuery.data
      .map((candle) => ({
        time: candle.time / 1000,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))
      .sort((a, b) => a.time - b.time);
    candleSeries.setData(candleData as Parameters<typeof candleSeries.setData>[0]);

    const allOverlays = overlaysQuery.data ?? [];
    const overlays = selectedTradeId
      ? allOverlays.filter((o) => o.tradeId === selectedTradeId)
      : [];
    const markers = overlays
      .flatMap((overlay) => [
      {
        time: toTimestamp(overlay.entryTime),
        position: overlay.side === 'LONG' ? 'belowBar' : 'aboveBar',
        color: overlay.side === 'LONG' ? '#2ecc71' : '#e74c3c',
        shape: 'arrowUp',
        text: `入场 ${overlay.entryPrice.toFixed(2)}`,
      },
      ...(overlay.exitTime && overlay.exitPrice != null
        ? [
            {
              time: toTimestamp(overlay.exitTime),
              position: overlay.side === 'LONG' ? 'aboveBar' : 'belowBar',
              color: overlay.side === 'LONG' ? '#2ecc71' : '#e74c3c',
              shape: 'arrowDown',
              text: `出场 ${overlay.exitPrice.toFixed(2)}`,
            },
          ]
        : []),
      ...(overlay.executions ?? []).map((execution) => ({
        time: toTimestamp(execution.time),
        position: execution.side === 'BUY' ? 'belowBar' : 'aboveBar',
        color: execution.side === 'BUY' ? '#45c1ff' : '#ffb347',
        shape: 'circle',
        text: `${execution.side} ${execution.amount.toFixed(4)}`,
      })),
    ])
      .sort((a, b) => a.time - b.time);
    candleSeries.setMarkers(markers as Parameters<typeof candleSeries.setMarkers>[0]);

    overlays.forEach((overlay) => {
      if (!overlay.exitTime || overlay.exitPrice == null) return;
      const line = chart.addLineSeries({
        color: overlay.side === 'LONG' ? '#2ecc71' : '#e74c3c',
        lineWidth: 2,
      });
      const lineData = [
        { time: toTimestamp(overlay.entryTime), value: overlay.entryPrice },
        { time: toTimestamp(overlay.exitTime), value: overlay.exitPrice },
      ];
      line.setData(lineData as Parameters<typeof line.setData>[0]);
    });

    // 有交易时：定位到进场/出场区间，并展示前后各 BARS_AROUND_TRADES 根 K 线
    const tradeTimesSec = overlays.flatMap((o) => {
      const entry = toTimestamp(o.entryTime);
      const exit = o.exitTime ? toTimestamp(o.exitTime) : null;
      const exec = (o.executions ?? []).map((e) => toTimestamp(e.time));
      return [entry, ...(exit != null ? [exit] : []), ...exec];
    });
    if (tradeTimesSec.length > 0 && candleData.length > 0) {
      const minT = Math.min(...tradeTimesSec);
      const maxT = Math.max(...tradeTimesSec);
      // 最后一个 time <= minT 的 K 线索引（进场所在或之前的 bar）
      const idxFirst = candleData.findIndex((c) => c.time > minT);
      const firstBarIndex =
        idxFirst <= 0 ? (idxFirst === 0 ? 0 : candleData.length - 1) : idxFirst - 1;
      // 第一个 time >= maxT 的 K 线索引（出场所在或之后的 bar）
      const idxLast = candleData.findIndex((c) => c.time >= maxT);
      const lastBarIndex =
        idxLast < 0 ? candleData.length - 1 : idxLast;
      const fromIndex = Math.max(0, firstBarIndex - BARS_AROUND_TRADES);
      const toIndex = Math.min(
        candleData.length - 1,
        lastBarIndex + BARS_AROUND_TRADES,
      );
      requestAnimationFrame(() => {
        try {
          chart.timeScale().setVisibleLogicalRange({ from: fromIndex, to: toIndex });
        } catch {
          // 忽略范围设置失败（如数据未就绪）
        }
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: chartRef.current?.clientWidth ?? 600 });
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      chartInstanceRef.current = null;
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candlesQuery.data, overlaysQuery.data, symbol, selectedTradeId]);

  const handleZoomIn = useCallback(() => {
    barSpacingRef.current = Math.min(
      barSpacingRef.current + BAR_SPACING_STEP,
      BAR_SPACING_MAX,
    );
    chartInstanceRef.current?.timeScale().applyOptions({
      barSpacing: barSpacingRef.current,
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    barSpacingRef.current = Math.max(
      barSpacingRef.current - BAR_SPACING_STEP,
      BAR_SPACING_MIN,
    );
    chartInstanceRef.current?.timeScale().applyOptions({
      barSpacing: barSpacingRef.current,
    });
  }, []);

  const handleFitContent = useCallback(() => {
    chartInstanceRef.current?.timeScale().fitContent();
    barSpacingRef.current = BAR_SPACING_DEFAULT;
  }, []);

  if (candlesQuery.isLoading) {
    return (
      <div className="chart-wrapper">
        <div className="chart-toolbar">
          <span className="chart-timeframe-label">周期</span>
          <div className="chart-timeframes">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                className={timeframe === tf ? 'is-active' : ''}
                onClick={() => onTimeframeChange?.(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        <span className="chart-timeframe-current">当前：{timeframe}</span>
      </div>
      <div className="empty">加载K线中...</div>
    </div>
  );
  }

  return (
    <div className="chart-wrapper">
      <div className="chart-toolbar">
        <span className="chart-timeframe-label">周期</span>
        <div className="chart-timeframes">
          {CHART_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              className={timeframe === tf ? 'is-active' : ''}
              onClick={() => onTimeframeChange?.(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
        <span className="chart-timeframe-current">当前：{timeframe}</span>
        <span className="chart-zoom-sep" aria-hidden>|</span>
        <div className="chart-zoom-btns">
          <button type="button" onClick={handleZoomIn} title="放大">＋</button>
          <button type="button" onClick={handleZoomOut} title="缩小">－</button>
          <button type="button" onClick={handleFitContent} title="适应全部">适应</button>
        </div>
      </div>
      <div className="chart" ref={chartRef} />
    </div>
  );
}

function toTimestamp(time: string) {
  return Math.floor(new Date(time).getTime() / 1000) as UTCTimestamp;
}
