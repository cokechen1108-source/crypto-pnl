import { Controller, Post, Query } from '@nestjs/common';
import { TradeNormalizationService } from './trade-normalization.service';

@Controller('normalization')
export class TradeNormalizationController {
  constructor(private readonly service: TradeNormalizationService) {}

  @Post('rebuild')
  async rebuild(
    @Query('accountId') accountId: string,
    @Query('symbol') symbol?: string,
  ) {
    return this.service.rebuildAccountTrades(accountId, symbol);
  }
}
