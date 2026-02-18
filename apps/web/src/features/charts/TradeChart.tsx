import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, ColorType } from 'lightweight-charts';
import { fetchCandles, fetchOverlays } from '../../api/client';
import type { TradeDetail } from '../../api/client';
import { CHART_TIMEFRAMES, type ChartTimeframe } from './DayChart';

/** lightweight-charts 时间轴为 UTC 秒数 */
type UTCTimestamp = number;

type Props = {
  trade: TradeDetail;
};

const ONE_HOUR = 60 * 60 * 1000;

export default function TradeChart({ trade }: Props) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1h');

  const range = useMemo(() => {
    const entry = new Date(trade.entryTime).getTime();
    const exit = trade.exitTime ? new Date(trade.exitTime).getTime() : entry + ONE_HOUR * 12;
    return {
      from: entry - ONE_HOUR * 24,
      to: exit + ONE_HOUR * 24,
    };
  }, [trade.entryTime, trade.exitTime]);

  const candlesQuery = useQuery({
    queryKey: ['candles', trade.symbol, range.from, timeframe],
    queryFn: () => fetchCandles(trade.symbol, timeframe, range.from),
  });

  const overlaysQuery = useQuery({
    queryKey: ['overlays', trade.exchangeAccountId, trade.symbol, trade.entryTime],
    queryFn: () =>
      fetchOverlays(
        trade.exchangeAccountId ?? '',
        trade.symbol,
        new Date(range.from).toISOString(),
        new Date(range.to).toISOString(),
      ),
  });

  useEffect(() => {
    if (!chartRef.current || !candlesQuery.data) return;

    const chart = createChart(chartRef.current, {
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1115' },
        textColor: '#c7d0d9',
      },
      grid: {
        horzLines: { color: '#1b2026' },
        vertLines: { color: '#1b2026' },
      },
      rightPriceScale: { borderColor: '#1b2026' },
      timeScale: { borderColor: '#1b2026' },
    });

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

    const overlays = overlaysQuery.data ?? [];
    const markers = overlays
      .flatMap((overlay) => [
      {
        time: toTimestamp(overlay.entryTime),
        position: overlay.side === 'LONG' ? 'belowBar' : 'aboveBar',
        color: overlay.side === 'LONG' ? '#2ecc71' : '#e74c3c',
        shape: 'arrowUp',
        text: `Entry ${overlay.entryPrice.toFixed(2)}`,
      },
      ...(overlay.exitTime && overlay.exitPrice != null
        ? [
            {
              time: toTimestamp(overlay.exitTime),
              position: overlay.side === 'LONG' ? 'aboveBar' : 'belowBar',
              color: overlay.side === 'LONG' ? '#2ecc71' : '#e74c3c',
              shape: 'arrowDown',
              text: `Exit ${overlay.exitPrice.toFixed(2)}`,
            },
          ]
        : []),
      ...overlay.executions.map((execution) => ({
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

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: chartRef.current?.clientWidth ?? 600 });
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candlesQuery.data, overlaysQuery.data, trade.symbol, timeframe]);

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
                onClick={() => setTimeframe(tf)}
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
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
        <span className="chart-timeframe-current">当前：{timeframe}</span>
      </div>
      <div className="chart" ref={chartRef} />
    </div>
  );
}

function toTimestamp(time: string) {
  return Math.floor(new Date(time).getTime() / 1000) as UTCTimestamp;
}
