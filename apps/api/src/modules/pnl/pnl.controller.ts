import { Controller, Get, Query } from '@nestjs/common';
import { PnlService } from './pnl.service';

@Controller('pnl')
export class PnlController {
  constructor(private readonly service: PnlService) {}

  @Get('total')
  async total(@Query('accountId') accountId: string) {
    return this.service.getTotalPnl(accountId);
  }

  @Get('daily')
  async daily(
    @Query('accountId') accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getDailyPnl(
      accountId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('activity-days')
  async activityDays(@Query('accountId') accountId: string) {
    return this.service.getTradeActivityDays(accountId);
  }

  @Get('monthly')
  async monthly(
    @Query('accountId') accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getMonthlyPnl(
      accountId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
