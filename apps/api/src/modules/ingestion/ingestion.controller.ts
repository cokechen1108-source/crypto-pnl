import { Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly service: IngestionService) {}

  @Get('test')
  async test(@Query('accountId') accountId: string) {
    return this.service.testConnection(accountId);
  }

  @Post('bybit/sync')
  async syncBybit(
    @Query('accountId') accountId: string,
    @Query('since') since?: string,
  ) {
    try {
      const sinceMs = since ? Number(since) : undefined;
      return await this.service.syncBybitAccount(accountId, sinceMs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        { message, statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bybit/sync/start')
  async startSyncBybit(
    @Query('accountId') accountId: string,
    @Query('since') since?: string,
  ) {
    try {
      const sinceMs = since ? Number(since) : undefined;
      return await this.service.startBybitSyncJob(accountId, sinceMs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        { message, statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('binance/sync')
  async syncBinance(
    @Query('accountId') accountId: string,
    @Query('since') since?: string,
  ) {
    try {
      const sinceMs = since ? Number(since) : undefined;
      return await this.service.syncBinanceAccount(accountId, sinceMs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        { message, statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('binance/sync/start')
  async startSyncBinance(
    @Query('accountId') accountId: string,
    @Query('since') since?: string,
  ) {
    try {
      const sinceMs = since ? Number(since) : undefined;
      return await this.service.startBinanceSyncJob(accountId, sinceMs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        { message, statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sync/status')
  async syncStatus(@Query('jobId') jobId: string) {
    return this.service.getSyncJob(jobId);
  }
}
