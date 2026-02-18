import { Controller, Get, Query } from '@nestjs/common';
import { ChartsService } from './charts.service';

@Controller('charts')
export class ChartsController {
  constructor(private readonly service: ChartsService) {}

  @Get('overlays')
  async overlays(
    @Query('accountId') accountId: string,
    @Query('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getOverlays(
      accountId,
      symbol,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
