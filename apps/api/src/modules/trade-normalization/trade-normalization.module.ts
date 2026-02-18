import { Module } from '@nestjs/common';
import { TradeNormalizationController } from './trade-normalization.controller';
import { TradeNormalizationService } from './trade-normalization.service';

@Module({
  controllers: [TradeNormalizationController],
  providers: [TradeNormalizationService],
  exports: [TradeNormalizationService],
})
export class TradeNormalizationModule {}
