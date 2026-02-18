import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ExchangeAccountsModule } from './modules/exchange-accounts/exchange-accounts.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { TradeNormalizationModule } from './modules/trade-normalization/trade-normalization.module';
import { TradesModule } from './modules/trades/trades.module';
import { PnlModule } from './modules/pnl/pnl.module';
import { ChartsModule } from './modules/charts/charts.module';
import { SecurityModule } from './modules/security/security.module';
import { MarketDataModule } from './modules/market-data/market-data.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SecurityModule,
    ExchangeAccountsModule,
    IngestionModule,
    TradeNormalizationModule,
    TradesModule,
    PnlModule,
    ChartsModule,
    MarketDataModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
