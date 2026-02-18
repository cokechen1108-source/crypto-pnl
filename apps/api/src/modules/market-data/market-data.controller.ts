import { Controller, Get, Query } from '@nestjs/common';
import { MarketDataService } from './market-data.service';

@Controller('market')
export class MarketDataController {
  constructor(private readonly service: MarketDataService) {}

  @Get('candles')
  async candles(
    @Query('symbol') symbol: string,
    @Query('timeframe') timeframe = '1h',
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getCandles(
      symbol,
      timeframe,
      since ? Number(since) : undefined,
      limit ? Number(limit) : 500,
    );
  }
}
