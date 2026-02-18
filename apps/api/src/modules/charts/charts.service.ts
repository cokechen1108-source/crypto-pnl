import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChartsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverlays(
    accountId: string,
    symbol: string,
    from?: Date,
    to?: Date,
  ) {
    const rangeFilter =
      from || to
        ? {
            OR: [
              {
                entryTime: { lte: to ?? undefined },
                exitTime: { gte: from ?? undefined },
              },
              {
                entryTime: { gte: from ?? undefined, lte: to ?? undefined },
                exitTime: null,
              },
            ],
          }
        : {};

    const trades = await this.prisma.trade.findMany({
      where: {
        exchangeAccountId: accountId,
        symbol,
        ...rangeFilter,
      },
      include: {
        executions: { orderBy: { timestamp: 'asc' } },
        legs: { orderBy: { entryTime: 'asc' } },
      },
      orderBy: { entryTime: 'asc' },
    });

    return trades.map((trade) => ({
      tradeId: trade.id,
      side: trade.side,
      entryTime: trade.entryTime,
      entryPrice: trade.entryPrice.toNumber(),
      exitTime: trade.exitTime,
      exitPrice: trade.exitPrice ? trade.exitPrice.toNumber() : null,
      size: trade.size.toNumber(),
      realizedPnl: trade.realizedPnl.toNumber(),
      markers: [
        {
          time: trade.entryTime,
          price: trade.entryPrice.toNumber(),
          type: 'entry',
          side: trade.side,
          size: trade.size.toNumber(),
        },
        ...(trade.exitTime && trade.exitPrice
          ? [
              {
                time: trade.exitTime,
                price: trade.exitPrice.toNumber(),
                type: 'exit',
                side: trade.side,
                size: trade.size.toNumber(),
              },
            ]
          : []),
      ],
      segments:
        trade.exitTime && trade.exitPrice
          ? [
              {
                fromTime: trade.entryTime,
                fromPrice: trade.entryPrice.toNumber(),
                toTime: trade.exitTime,
                toPrice: trade.exitPrice.toNumber(),
              },
            ]
          : [],
      executions: trade.executions.map((execution) => ({
        time: execution.timestamp,
        price: execution.price.toNumber(),
        side: execution.side,
        amount: execution.amount.toNumber(),
      })),
      legs: trade.legs.map((leg) => ({
        side: leg.side,
        size: leg.size.toNumber(),
        entryTime: leg.entryTime,
        exitTime: leg.exitTime,
        entryPrice: leg.entryPrice.toNumber(),
        exitPrice: leg.exitPrice?.toNumber() ?? null,
        realizedPnl: leg.realizedPnl.toNumber(),
      })),
    }));
  }
}
