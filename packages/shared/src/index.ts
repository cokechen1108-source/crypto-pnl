export type ChartOverlay = {
  tradeId: string;
  side: 'LONG' | 'SHORT';
  entryTime: string;
  entryPrice: number;
  exitTime?: string | null;
  exitPrice?: number | null;
  size: number;
  realizedPnl: number;
  markers: Array<{
    time: string;
    price: number;
    type: 'entry' | 'exit';
    side: 'LONG' | 'SHORT';
    size: number;
  }>;
  segments: Array<{
    fromTime: string;
    fromPrice: number;
    toTime: string;
    toPrice: number;
  }>;
  executions: Array<{
    time: string;
    price: number;
    side: 'BUY' | 'SELL';
    amount: number;
  }>;
  legs: Array<{
    side: 'LONG' | 'SHORT';
    size: number;
    entryTime: string;
    exitTime: string;
    entryPrice: number;
    exitPrice: number;
    realizedPnl: number;
  }>;
};
