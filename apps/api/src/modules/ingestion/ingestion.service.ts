import { Injectable } from '@nestjs/common';
import ccxt from 'ccxt';
import { randomUUID } from 'crypto';
import { ExchangeAccountsService } from '../exchange-accounts/exchange-accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ExchangeName, ExecutionSide, Prisma } from '@prisma/client';
import { TradeNormalizationService } from '../trade-normalization/trade-normalization.service';

type SyncResult = {
  tradesInserted: number;
  positionsInserted: number;
  fundingInserted: number;
  tradesCreated: number;
};

type SyncJobStatus = 'queued' | 'running' | 'success' | 'error';

type SyncJob = {
  jobId: string;
  accountId: string;
  exchange: ExchangeName;
  status: SyncJobStatus;
  progress: number;
  phase: string;
  message?: string;
  totalSymbols?: number;
  completedSymbols?: number;
  startedAt: string;
  endedAt?: string;
  result?: SyncResult;
  error?: string;
};

@Injectable()
export class IngestionService {
  private readonly syncJobs = new Map<string, SyncJob>();

  constructor(
    private readonly accounts: ExchangeAccountsService,
    private readonly prisma: PrismaService,
    private readonly tradeNormalization: TradeNormalizationService,
  ) {}

  private getDefaultSyncSinceMs(): number {
    // Default to a long history window to avoid "missing old trades".
    return Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;
  }

  private async getSuggestedSyncSinceMs(accountId: string, explicitSince?: number): Promise<number> {
    if (explicitSince != null) return explicitSince;
    const latestRaw = await this.prisma.rawTrade.findFirst({
      where: { exchangeAccountId: accountId },
      orderBy: { tradeTimestamp: 'desc' },
      select: { tradeTimestamp: true },
    });
    if (latestRaw?.tradeTimestamp) {
      // Incremental mode: backfill 3 days to handle delayed fills / corrections.
      return latestRaw.tradeTimestamp.getTime() - 3 * 24 * 60 * 60 * 1000;
    }
    return this.getDefaultSyncSinceMs();
  }

  private updateSyncJob(jobId: string, patch: Partial<SyncJob>) {
    const current = this.syncJobs.get(jobId);
    if (!current) return;
    this.syncJobs.set(jobId, { ...current, ...patch });
  }

  private createSyncJob(accountId: string, exchange: ExchangeName): SyncJob {
    const job: SyncJob = {
      jobId: randomUUID(),
      accountId,
      exchange,
      status: 'queued',
      progress: 0,
      phase: 'queued',
      startedAt: new Date().toISOString(),
    };
    this.syncJobs.set(job.jobId, job);
    return job;
  }

  getSyncJob(jobId: string): SyncJob {
    const job = this.syncJobs.get(jobId);
    if (!job) {
      throw new Error('Sync job not found');
    }
    return job;
  }

  async startBybitSyncJob(accountId: string, since?: number): Promise<{ jobId: string }> {
    return this.startSyncJob(accountId, ExchangeName.BYBIT, since);
  }

  async startBinanceSyncJob(accountId: string, since?: number): Promise<{ jobId: string }> {
    return this.startSyncJob(accountId, ExchangeName.BINANCE, since);
  }

  private async startSyncJob(
    accountId: string,
    exchange: ExchangeName,
    since?: number,
  ): Promise<{ jobId: string }> {
    const job = this.createSyncJob(accountId, exchange);
    void this.runSyncJob(job.jobId, accountId, since);
    return { jobId: job.jobId };
  }

  private async runSyncJob(jobId: string, accountId: string, since?: number) {
    try {
      this.updateSyncJob(jobId, {
        status: 'running',
        progress: 1,
        phase: 'initializing',
        message: '正在初始化同步任务',
      });
      const result = await this.syncAndRebuildAccount(accountId, since, (progressPatch) => {
        const safeProgress =
          progressPatch.progress != null
            ? Math.max(0, Math.min(100, Math.round(progressPatch.progress)))
            : undefined;
        this.updateSyncJob(jobId, {
          ...progressPatch,
          ...(safeProgress != null ? { progress: safeProgress } : {}),
        });
      });
      this.updateSyncJob(jobId, {
        status: 'success',
        progress: 100,
        phase: 'done',
        message:
          (result.tradesInserted ?? 0) === 0 && (result.tradesCreated ?? 0) === 0
            ? '同步完成，但未获取到成交数据。请检查交易所权限、账户类型（USDM/现货）或时间范围。'
            : '同步完成',
        result,
        endedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = this.getErrorMessage(err);
      this.updateSyncJob(jobId, {
        status: 'error',
        phase: 'error',
        progress: 100,
        error: message,
        message,
        endedAt: new Date().toISOString(),
      });
    }
  }

  private async getExchange(accountId: string): Promise<any> {
    const credentials = await this.accounts.getCredentials(accountId);
    const common = {
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase ?? undefined,
      enableRateLimit: true,
    };
    if (credentials.exchange === ExchangeName.BYBIT) {
      return new ccxt.bybit({
        ...common,
        options: { defaultType: 'swap' },
      });
    }
    if (credentials.exchange === ExchangeName.BINANCE) {
      const httpsProxy =
        process.env.BINANCE_HTTPS_PROXY ??
        process.env.HTTPS_PROXY ??
        process.env.https_proxy ??
        undefined;
      const exchange = new ccxt.binanceusdm({
        ...common,
        httpsProxy,
        timeout: 15000,
        options: {
          adjustForTimeDifference: true,
          recvWindow: 10000,
        },
      });
      const publicUrl = process.env.BINANCE_FAPI_PUBLIC_URL?.trim();
      const privateUrl = process.env.BINANCE_FAPI_PRIVATE_URL?.trim();
      if (publicUrl) {
        exchange.urls.api.fapiPublic = publicUrl;
      }
      if (privateUrl) {
        exchange.urls.api.fapiPrivate = privateUrl;
      }
      return exchange;
    }
    throw new Error(`Unsupported exchange: ${credentials.exchange}`);
  }

  /** 从 ccxt/网络异常中提取可读错误信息 */
  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes('code":-1022') || msg.includes('"code":-1022') || msg.includes('code=-1022')) {
        return '币安签名无效（-1022）。请检查 API Key/Secret 是否一一对应、是否包含首尾空格、是否开启合约读取权限，以及是否设置了 IP 白名单。';
      }
      if (
        msg.includes('fapi.binance.com') &&
        (msg.includes('exchangeInfo') || msg.includes('fetch failed'))
      ) {
        return '无法连接币安合约接口（fapi.binance.com）。请检查本机网络/代理/VPN；如当前网络屏蔽 Binance，可在 API .env 配置 BINANCE_FAPI_PUBLIC_URL、BINANCE_FAPI_PRIVATE_URL 或 BINANCE_HTTPS_PROXY 后重试。';
      }
      const ax = (err as any).response;
      const body = ax?.body;
      if (typeof body === 'string' && body.length < 300) return `${msg} (${body})`;
      if (body?.msg) return `${msg} | ${body.msg}`;
      if (body?.message) return `${msg} | ${body.message}`;
      return msg;
    }
    return String(err);
  }

  /** 验证 API 是否可用（只读：拉取余额或最近一笔成交） */
  async testConnection(accountId: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const exchange = await this.getExchange(accountId);
      if (exchange.has.fetchBalance) {
        await exchange.fetchBalance();
      } else if (exchange.has.fetchMyTrades) {
        await exchange.fetchMyTrades(undefined, undefined, 1);
      } else {
        return { ok: false, message: 'Exchange does not support balance or trades.' };
      }
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, message: this.getErrorMessage(err) };
    }
  }

  async syncBybitAccount(accountId: string, since?: number): Promise<SyncResult> {
    return this.syncAndRebuildAccount(accountId, since);
  }

  async syncBinanceAccount(accountId: string, since?: number): Promise<SyncResult> {
    return this.syncAndRebuildAccount(accountId, since);
  }

  private async syncAndRebuildAccount(
    accountId: string,
    since?: number,
    onProgress?: (patch: Partial<SyncJob>) => void,
  ): Promise<SyncResult> {
    const syncResult = await this.syncAccount(accountId, since, onProgress);
    onProgress?.({ phase: 'rebuilding', progress: 99, message: '同步完成，正在重建交易' });
    const rebuilt = await this.tradeNormalization.rebuildAccountTrades(accountId);
    return {
      ...syncResult,
      tradesCreated: rebuilt.tradesCreated,
    };
  }

  private async syncAccount(
    accountId: string,
    since?: number,
    onProgress?: (patch: Partial<SyncJob>) => void,
  ): Promise<SyncResult> {
    onProgress?.({ phase: 'loading_credentials', progress: 3, message: '正在加载账户凭证' });
    const exchange = await this.getExchange(accountId);
    let trades: any[] = [];
    const effectiveSinceMs = await this.getSuggestedSyncSinceMs(accountId, since);
    const isBinance =
      exchange.id === 'binance' ||
      exchange.id === 'binanceusdm' ||
      String(exchange.id ?? '').startsWith('binance');
    if (isBinance) {
      onProgress?.({ phase: 'loading_markets', progress: 8, message: '正在加载 Binance 市场信息' });
      await exchange.loadMarkets();
      // Binance USDM: fetch all futures/swap markets, then page by symbol.
      let symbols = Object.keys(exchange.markets).filter(
        (s) => exchange.markets[s]?.type === 'future' || exchange.markets[s]?.type === 'swap',
      );
      if (symbols.length === 0) {
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'BTC/USDT', 'ETH/USDT'].filter((s) =>
          Object.prototype.hasOwnProperty.call(exchange.markets ?? {}, s),
        );
      }
      // 优先拉取 ETH/BTC 永续，确保常见交易对在前
      const priority = ['ETH/USDT:USDT', 'BTC/USDT:USDT', 'ETH/USDT', 'BTC/USDT'];
      const rest = symbols.filter((s) => !priority.includes(s));
      symbols = [...priority.filter((s) => symbols.includes(s)), ...rest];
      // Binance 不传时间时默认只返回最近 7 天，传 6 个月前作为 since 拉取更久历史
      const sinceMs = effectiveSinceMs;
      const maxPagesPerSymbol = 30;
      const fetchLimit = 1000;
      let lastError: string | null = null;
      onProgress?.({
        phase: 'fetching_trades',
        progress: 10,
        totalSymbols: symbols.length,
        completedSymbols: 0,
        message: `开始拉取成交，交易对数量：${symbols.length}`,
      });
      const totalSymbols = Math.max(1, symbols.length);
      const fetchProgressStart = 10;
      const fetchProgressEnd = 84;
      const nowMs = Date.now();
      const windowMs = 7 * 24 * 60 * 60 * 1000;
      for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
        const symbol = symbols[symbolIndex];
        try {
          // Binance futures userTrades often needs <= 7d query windows.
          let windowStart = sinceMs;
          while (windowStart <= nowMs) {
            const windowEnd = Math.min(windowStart + windowMs - 1, nowMs);
            let cursor = windowStart;
            let page = 0;
            while (page < maxPagesPerSymbol) {
              const list = await exchange.fetchMyTrades(symbol, cursor, fetchLimit, {
                endTime: windowEnd,
              });
              if (!Array.isArray(list) || list.length === 0) break;
              trades = trades.concat(list);

              const lastTs = list.reduce(
                (acc, item) => Math.max(acc, Number(item?.timestamp ?? 0)),
                0,
              );
              if (!Number.isFinite(lastTs) || lastTs <= 0) break;

              page += 1;
              if (list.length < fetchLimit || lastTs >= windowEnd) break;
              cursor = lastTs + 1;
              await new Promise((r) => setTimeout(r, 80));
            }
            windowStart = windowEnd + 1;
            await new Promise((r) => setTimeout(r, 40));
          }
          const completedSymbols = symbolIndex + 1;
          const ratio = completedSymbols / totalSymbols;
          const progress = fetchProgressStart + (fetchProgressEnd - fetchProgressStart) * ratio;
          onProgress?.({
            phase: 'fetching_trades',
            progress,
            totalSymbols,
            completedSymbols,
            message: `正在拉取成交：${completedSymbols}/${totalSymbols} (${symbol})`,
          });
          await new Promise((r) => setTimeout(r, 60));
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          // 某交易对无权限或无成交时跳过
          const completedSymbols = symbolIndex + 1;
          const ratio = completedSymbols / totalSymbols;
          const progress = fetchProgressStart + (fetchProgressEnd - fetchProgressStart) * ratio;
          onProgress?.({
            phase: 'fetching_trades',
            progress,
            totalSymbols,
            completedSymbols,
            message: `部分交易对拉取失败，已跳过：${symbol}`,
          });
        }
      }
      if (trades.length === 0 && lastError) {
        throw new Error(`Binance 拉取成交为空，最后错误: ${lastError}`);
      }
      trades.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    } else {
      onProgress?.({ phase: 'fetching_trades', progress: 30, message: '正在分页拉取成交数据' });
      const pageLimit = 200;
      const maxPages = 80;
      let cursor = effectiveSinceMs;
      let page = 0;
      while (page < maxPages) {
        const list = await exchange.fetchMyTrades(undefined, cursor, pageLimit);
        if (!Array.isArray(list) || list.length === 0) break;
        trades = trades.concat(list);
        const lastTs = list.reduce(
          (acc, item) => Math.max(acc, Number(item?.timestamp ?? 0)),
          0,
        );
        if (!Number.isFinite(lastTs) || lastTs <= 0) break;
        page += 1;
        const progress = 30 + Math.min(40, Math.round((page / maxPages) * 40));
        onProgress?.({
          phase: 'fetching_trades',
          progress,
          message: `正在拉取成交：第 ${page} 页（每页最多 ${pageLimit}）`,
        });
        if (list.length < pageLimit) break;
        cursor = lastTs + 1;
        await new Promise((r) => setTimeout(r, 80));
      }
      onProgress?.({ phase: 'fetching_trades', progress: 72, message: '成交数据拉取完成' });
    }
    onProgress?.({ phase: 'normalizing', progress: 86, message: '正在去重并写入成交数据' });
    const existingIds = new Set<string>();
    (
      await this.prisma.rawTrade.findMany({
        where: { exchangeAccountId: accountId },
        select: { exchangeTradeId: true, symbol: true },
      })
    ).forEach((r) => {
      existingIds.add(String(r.exchangeTradeId));
      existingIds.add(`${String(r.symbol)}:${String(r.exchangeTradeId)}`);
    });
    const tradeRows = trades
      .map((trade: any) => {
        const symbol = String(trade.symbol ?? '');
        const rawTradeId = String(
          trade.id ?? `${trade.order ?? 'na'}-${trade.timestamp ?? Date.now()}`,
        );
        // Binance trade id may repeat across symbols; use composite id to avoid collisions.
        const exchangeTradeId = symbol ? `${symbol}:${rawTradeId}` : rawTradeId;
        if (existingIds.has(exchangeTradeId) || existingIds.has(rawTradeId)) return null;
        const price = Number(trade.price);
        const amount = Number(trade.amount);
        if (!Number.isFinite(price) || !Number.isFinite(amount)) return null;
        const ts = trade.timestamp ?? Date.now();
        const tradeTimestamp = new Date(typeof ts === 'number' ? ts : Number(ts));
        if (Number.isNaN(tradeTimestamp.getTime())) return null;
        existingIds.add(exchangeTradeId);
        existingIds.add(rawTradeId);
        return {
          exchangeAccountId: accountId,
          exchangeTradeId,
          symbol,
          marketType: String(trade.type ?? 'unknown'),
          side: (trade.side === 'buy' ? 'BUY' : 'SELL') as ExecutionSide,
          price,
          amount,
          fee: trade.fee?.cost != null ? Number(trade.fee.cost) : null,
          feeCurrency: trade.fee?.currency ?? null,
          realizedPnl:
            trade.info?.closedPnl != null
              ? Number(trade.info.closedPnl)
              : trade.info?.realizedPnl != null
                ? Number(trade.info.realizedPnl)
                : null,
          orderId: trade.order ?? null,
          tradeTimestamp,
        };
      })
      .filter((r: unknown): r is NonNullable<typeof r> => r !== null);
    const tradeInsert =
      tradeRows.length > 0
        ? await this.prisma.rawTrade.createMany({ data: tradeRows as Prisma.RawTradeCreateManyInput[] })
        : { count: 0 };
    onProgress?.({ phase: 'positions', progress: 92, message: '正在同步持仓信息' });

    let positionsInserted = 0;
    if (exchange.has?.fetchPositions) {
      try {
        const positions = await exchange.fetchPositions();
        const positionRows = positions
          .map((position: any) => {
            const size = Number(position.contracts ?? position.info?.size ?? position.amount ?? 0);
            const entryPrice = Number(position.entryPrice ?? position.info?.entryPrice ?? 0);
            const ts = position.timestamp ?? Date.now();
            const updatedTimestamp = new Date(typeof ts === 'number' ? ts : Number(ts));
            if (!Number.isFinite(size) || !Number.isFinite(entryPrice) || Number.isNaN(updatedTimestamp.getTime()))
              return null;
            return {
              exchangeAccountId: accountId,
              symbol: String(position.symbol ?? ''),
              side: position.side === 'long' ? 'LONG' : 'SHORT',
              size,
              entryPrice,
              unrealizedPnl: position.unrealizedPnl != null ? Number(position.unrealizedPnl) : null,
              leverage: position.leverage != null ? Number(position.leverage) : null,
              marginMode: position.marginMode ?? null,
              updatedTimestamp,
            };
          })
          .filter((r: unknown): r is NonNullable<typeof r> => r !== null);
        if (positionRows.length > 0) {
          const positionInsert = await this.prisma.rawPosition.createMany({ data: positionRows });
          positionsInserted = positionInsert.count;
        }
      } catch (e) {
        // 部分交易所不支持或拉取持仓失败，不影响成交同步
      }
    }

    let fundingInserted = 0;
    if (exchange.has?.fetchFundingHistory) {
      try {
        onProgress?.({ phase: 'funding', progress: 96, message: '正在同步资金费信息' });
        const funding = await exchange.fetchFundingHistory(undefined, effectiveSinceMs);
        const fundingRows = funding
          .map((item: any) => {
            const amount = Number(item.amount ?? 0);
            const ts = item.timestamp ?? Date.now();
            const fundingTimestamp = new Date(typeof ts === 'number' ? ts : Number(ts));
            if (!Number.isFinite(amount) || Number.isNaN(fundingTimestamp.getTime())) return null;
            return {
              exchangeAccountId: accountId,
              symbol: String(item.symbol ?? ''),
              fundingRate: item.rate != null ? Number(item.rate) : null,
              fundingFee: amount,
              fundingTimestamp,
            };
          })
          .filter((r: unknown): r is NonNullable<typeof r> => r !== null);
        if (fundingRows.length > 0) {
          const fundingInsert = await this.prisma.rawFunding.createMany({ data: fundingRows });
          fundingInserted = fundingInsert.count;
        }
      } catch (e) {
        // 资金费历史拉取失败不影响成交同步
      }
    }

    onProgress?.({ phase: 'finishing', progress: 99, message: '正在完成收尾处理' });

    return {
      tradesInserted: tradeInsert.count,
      positionsInserted,
      fundingInserted,
      tradesCreated: 0,
    };
  }
}
