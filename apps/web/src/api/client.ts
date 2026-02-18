const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type Trade = {
  id: string;
  exchangeAccountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  status: string;
  entryTime: string;
  exitTime?: string | null;
  entryPrice: number;
  exitPrice?: number | null;
  size: number;
  realizedPnl: number;
  feeTotal: number;
  fundingTotal: number;
  durationSeconds?: number | null;
};

export type TradeDetail = Trade & {
  executions: Array<{
    id: string;
    side: 'BUY' | 'SELL';
    price: number;
    amount: number;
    fee?: number | null;
    feeCurrency?: string | null;
    timestamp: string;
  }>;
  legs: Array<{
    id: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    exitPrice: number;
    entryTime: string;
    exitTime: string;
    realizedPnl: number;
  }>;
};

export type PnlRow = {
  date?: string;
  month?: string;
  realizedPnl: number;
  feeTotal: number;
  fundingTotal: number;
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

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

export type ExchangeName = 'BYBIT' | 'BINANCE' | 'OKX';

export type ExchangeAccount = {
  id: string;
  userId: string;
  exchange: ExchangeName;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type SyncJob = {
  jobId: string;
  accountId: string;
  exchange: ExchangeName;
  status: 'queued' | 'running' | 'success' | 'error';
  progress: number;
  phase: string;
  message?: string;
  totalSymbols?: number;
  completedSymbols?: number;
  startedAt: string;
  endedAt?: string;
  result?: {
    tradesInserted: number;
    positionsInserted: number;
    fundingInserted: number;
    tradesCreated?: number;
  };
  error?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const text = await response.text();
    let msg = text || response.statusText || 'Request failed';
    try {
      const json = JSON.parse(text);
      if (typeof json.message === 'string') msg = json.message;
      else if (Array.isArray(json.message)) msg = json.message.join('; ');
    } catch {
      if (text.length > 200) msg = text.slice(0, 200) + '…';
    }
    throw new Error(msg);
  }
  return response.json();
}

export async function createAccount(body: {
  userId: string;
  exchange: ExchangeName;
  name: string;
  apiKey: string;
  apiSecret: string;
  apiPassphrase?: string;
}) {
  return request<ExchangeAccount>('/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listAccounts(userId?: string) {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return request<ExchangeAccount[]>(`/accounts${q}`);
}

export async function deleteAccount(accountId: string) {
  return request<ExchangeAccount>(`/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
}

export async function updateAccountStatus(accountId: string, isActive: boolean) {
  return request<ExchangeAccount>(`/accounts/${encodeURIComponent(accountId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function testConnection(accountId: string) {
  return request<{ ok: boolean; message?: string }>(
    `/ingestion/test?accountId=${encodeURIComponent(accountId)}`,
  );
}

export async function syncBybit(accountId: string, since?: number) {
  const params = new URLSearchParams({ accountId });
  if (since != null) params.set('since', String(since));
  return request<{
    tradesInserted: number;
    positionsInserted: number;
    fundingInserted: number;
    tradesCreated?: number;
  }>(
    `/ingestion/bybit/sync?${params.toString()}`,
    { method: 'POST' },
  );
}

export async function startSyncBybit(accountId: string, since?: number) {
  const params = new URLSearchParams({ accountId });
  if (since != null) params.set('since', String(since));
  return request<{ jobId: string }>(`/ingestion/bybit/sync/start?${params.toString()}`, {
    method: 'POST',
  });
}

export async function syncBinance(accountId: string, since?: number) {
  const params = new URLSearchParams({ accountId });
  if (since != null) params.set('since', String(since));
  return request<{
    tradesInserted: number;
    positionsInserted: number;
    fundingInserted: number;
    tradesCreated?: number;
  }>(
    `/ingestion/binance/sync?${params.toString()}`,
    { method: 'POST' },
  );
}

export async function startSyncBinance(accountId: string, since?: number) {
  const params = new URLSearchParams({ accountId });
  if (since != null) params.set('since', String(since));
  return request<{ jobId: string }>(`/ingestion/binance/sync/start?${params.toString()}`, {
    method: 'POST',
  });
}

export async function fetchSyncStatus(jobId: string) {
  return request<SyncJob>(`/ingestion/sync/status?jobId=${encodeURIComponent(jobId)}`);
}

/** 根据原始成交重建逻辑交易（通常由同步流程自动调用） */
export async function rebuildTrades(accountId: string, symbol?: string) {
  const params = new URLSearchParams({ accountId });
  if (symbol) params.set('symbol', symbol);
  return request<{ tradesCreated: number }>(
    `/normalization/rebuild?${params.toString()}`,
    { method: 'POST' },
  );
}

export async function fetchTrades(
  accountId: string,
  symbol?: string,
  date?: string,
  page = 1,
  pageSize = 200,
) {
  const params = new URLSearchParams({ accountId });
  if (symbol) params.set('symbol', symbol);
  if (date) params.set('date', date);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return request<{ items: Trade[]; total: number; page: number; pageSize: number }>(
    `/trades?${params.toString()}`,
  );
}

/** 按日期拉取当日有入场或出场的交易（用于日历点击） */
export async function fetchTradesByDate(accountId: string, date: string) {
  // 日内成交较多时，拉取更大页避免前端看到“当日缺单”
  return fetchTrades(accountId, undefined, date, 1, 1000);
}

export async function fetchTrade(tradeId: string) {
  return request<TradeDetail>(`/trades/${tradeId}`);
}

export async function fetchTotalPnl(accountId: string) {
  return request<{
    totalRealizedPnl: number;
    totalFee: number;
    totalFunding: number;
  }>(`/pnl/total?accountId=${accountId}`);
}

export async function fetchDailyPnl(accountId: string) {
  return request<PnlRow[]>(`/pnl/daily?accountId=${accountId}`);
}

export async function fetchTradeActivityDays(accountId: string) {
  return request<string[]>(`/pnl/activity-days?accountId=${encodeURIComponent(accountId)}`);
}

export async function fetchMonthlyPnl(accountId: string) {
  return request<PnlRow[]>(`/pnl/monthly?accountId=${accountId}`);
}

export async function fetchOverlays(
  accountId: string,
  symbol: string,
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams({ accountId, symbol });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request<ChartOverlay[]>(`/charts/overlays?${params.toString()}`);
}

export async function fetchCandles(
  symbol: string,
  timeframe = '1h',
  since?: number,
) {
  const params = new URLSearchParams({ symbol, timeframe });
  if (since) params.set('since', String(since));
  return request<Candle[]>(`/market/candles?${params.toString()}`);
}
