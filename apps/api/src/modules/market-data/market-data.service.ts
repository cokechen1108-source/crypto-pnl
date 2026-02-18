import { Injectable } from '@nestjs/common';
import ccxt from 'ccxt';

@Injectable()
export class MarketDataService {
  private readonly exchange = new ccxt.bybit({
    enableRateLimit: true,
    options: { defaultType: 'swap' },
  });

  async getCandles(
    symbol: string,
    timeframe: string,
    since?: number,
    limit = 500,
  ) {
    const ohlcv = await this.exchange.fetchOHLCV(
      symbol,
      timeframe,
      since,
      limit,
    );
    return ohlcv.map((candle: any) => ({
      time: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
    }));
  }
}
