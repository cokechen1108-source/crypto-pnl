import { Controller, Get, Param, Query } from '@nestjs/common';
import { TradesService } from './trades.service';
import { TradeListQueryDto } from './dto/trade-list-query.dto';

@Controller('trades')
export class TradesController {
  constructor(private readonly service: TradesService) {}

  @Get()
  async list(@Query() query: TradeListQueryDto) {
    return this.service.listTrades(query);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.getTrade(id);
  }
}
