import { Module } from '@nestjs/common';
import { ExchangeAccountsController } from './exchange-accounts.controller';
import { ExchangeAccountsService } from './exchange-accounts.service';

@Module({
  controllers: [ExchangeAccountsController],
  providers: [ExchangeAccountsService],
  exports: [ExchangeAccountsService],
})
export class ExchangeAccountsModule {}
