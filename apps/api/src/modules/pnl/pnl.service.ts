import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PnlService {
  constructor(private readonly prisma: PrismaService) {}

  private toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toLocalMonthKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  async getDailyPnl(accountId: string, from?: Date, to?: Date) {
    const trades = await this.prisma.trade.findMany({
      where: {
        exchangeAccountId: accountId,
        status: 'CLOSED',
        exitTime: {
          not: null,
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      select: {
        exitTime: true,
        realizedPnl: true,
        feeTotal: true,
        fundingTotal: true,
      },
      orderBy: { exitTime: 'asc' },
    });

    const map = new Map<
      string,
      { realizedPnl: number; feeTotal: number; fundingTotal: number }
    >();
    for (const t of trades) {
      if (!t.exitTime) continue;
      const key = this.toLocalDateKey(new Date(t.exitTime));
      const prev = map.get(key) ?? { realizedPnl: 0, feeTotal: 0, fundingTotal: 0 };
      map.set(key, {
        realizedPnl: prev.realizedPnl + Number(t.realizedPnl),
        feeTotal: prev.feeTotal + Number(t.feeTotal),
        fundingTotal: prev.fundingTotal + Number(t.fundingTotal),
      });
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, ...v }));
  }

  async getMonthlyPnl(accountId: string, from?: Date, to?: Date) {
    const trades = await this.prisma.trade.findMany({
      where: {
        exchangeAccountId: accountId,
        status: 'CLOSED',
        exitTime: {
          not: null,
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      select: {
        exitTime: true,
        realizedPnl: true,
        feeTotal: true,
        fundingTotal: true,
      },
      orderBy: { exitTime: 'asc' },
    });

    const map = new Map<
      string,
      { realizedPnl: number; feeTotal: number; fundingTotal: number }
    >();
    for (const t of trades) {
      if (!t.exitTime) continue;
      const key = this.toLocalMonthKey(new Date(t.exitTime));
      const prev = map.get(key) ?? { realizedPnl: 0, feeTotal: 0, fundingTotal: 0 };
      map.set(key, {
        realizedPnl: prev.realizedPnl + Number(t.realizedPnl),
        feeTotal: prev.feeTotal + Number(t.feeTotal),
        fundingTotal: prev.fundingTotal + Number(t.fundingTotal),
      });
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v }));
  }

  /** 账户下所有已平仓交易的累计已实现 PnL（用于仪表盘大数） */
  async getTotalPnl(accountId: string) {
    const row = await this.prisma.trade.aggregate({
      where: {
        exchangeAccountId: accountId,
        status: 'CLOSED',
        exitTime: { not: null },
      },
      _sum: { realizedPnl: true, feeTotal: true, fundingTotal: true },
    });
    return {
      totalRealizedPnl: Number(row._sum.realizedPnl ?? 0),
      totalFee: Number(row._sum.feeTotal ?? 0),
      totalFunding: Number(row._sum.fundingTotal ?? 0),
    };
  }

  async getTradeActivityDays(accountId: string) {
    const rows = await this.prisma.$queryRaw<{ date: string }[]>(Prisma.sql`
      select distinct date from (
        select strftime('%Y-%m-%d', datetime("entryTime" / 1000, 'unixepoch', 'localtime')) as date
        from "Trade"
        where "exchangeAccountId" = ${accountId}
          and "entryTime" is not null
        union
        select strftime('%Y-%m-%d', datetime("exitTime" / 1000, 'unixepoch', 'localtime')) as date
        from "Trade"
        where "exchangeAccountId" = ${accountId}
          and "exitTime" is not null
      )
      where date is not null
      order by date asc
    `);
    return rows.map((r) => r.date);
  }
}
