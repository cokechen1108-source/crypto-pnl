import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradeListQueryDto } from './dto/trade-list-query.dto';

@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTrades(query: TradeListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 200, 1000);

    let dateFilter = {};
    if (query.date) {
      // Use local day boundaries to match frontend date selection and calendar display.
      const dayStart = new Date(`${query.date}T00:00:00.000`);
      const dayEnd = new Date(`${query.date}T23:59:59.999`);
      dateFilter = {
        OR: [
          { entryTime: { gte: dayStart, lte: dayEnd } },
          { exitTime: { gte: dayStart, lte: dayEnd } },
        ],
      };
    }

    const where = {
      exchangeAccountId: query.accountId,
      ...(query.symbol ? { symbol: query.symbol } : {}),
      ...dateFilter,
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.trade.count({ where }),
      this.prisma.trade.findMany({
        where,
        orderBy: { entryTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: items.map((item) => mapTrade(item)),
    };
  }

  async getTrade(tradeId: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        legs: { orderBy: { entryTime: 'asc' } },
        executions: { orderBy: { timestamp: 'asc' } },
      },
    });
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }
    return {
      ...mapTrade(trade),
      executions: trade.executions.map((execution) => ({
        ...execution,
        price: execution.price.toNumber(),
        amount: execution.amount.toNumber(),
        fee: execution.fee ? execution.fee.toNumber() : null,
      })),
      legs: trade.legs.map((leg) => ({
        ...leg,
        size: leg.size.toNumber(),
        entryPrice: leg.entryPrice.toNumber(),
        exitPrice: leg.exitPrice?.toNumber() ?? null,
        realizedPnl: leg.realizedPnl.toNumber(),
        feeTotal: leg.feeTotal.toNumber(),
        fundingTotal: leg.fundingTotal.toNumber(),
      })),
    };
  }
}

function mapTrade(trade: any) {
  return {
    ...trade,
    entryPrice: trade.entryPrice.toNumber(),
    exitPrice: trade.exitPrice ? trade.exitPrice.toNumber() : null,
    size: trade.size.toNumber(),
    realizedPnl: trade.realizedPnl.toNumber(),
    feeTotal: trade.feeTotal.toNumber(),
    fundingTotal: trade.fundingTotal.toNumber(),
  };
}
