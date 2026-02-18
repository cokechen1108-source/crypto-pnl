import { Module } from '@nestjs/common';
import { ExchangeAccountsModule } from '../exchange-accounts/exchange-accounts.module';
import { TradeNormalizationModule } from '../trade-normalization/trade-normalization.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [ExchangeAccountsModule, TradeNormalizationModule],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
