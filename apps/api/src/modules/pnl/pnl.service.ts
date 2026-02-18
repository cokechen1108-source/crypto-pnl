import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PnlService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyPnl(accountId: string, from?: Date, to?: Date) {
    // exitTime 在 SQLite 中为 Unix 毫秒数，比较时用数值
    const fromMs = from?.getTime();
    const toMs = to?.getTime();
    const where = Prisma.sql`
      where "exchangeAccountId" = ${accountId}
      ${fromMs != null ? Prisma.sql`and "exitTime" >= ${fromMs}` : Prisma.empty}
      ${toMs != null ? Prisma.sql`and "exitTime" <= ${toMs}` : Prisma.empty}
    `;

    // Prisma/SQLite 将 DateTime 存为 Unix 毫秒数，需用 datetime(exitTime/1000,'unixepoch') 再取日期
    const dateExpr = Prisma.sql`strftime('%Y-%m-%d', datetime("exitTime" / 1000, 'unixepoch', 'localtime'))`;
    const rows = await this.prisma.$queryRaw<
      {
        date: string;
        realizedPnl: Prisma.Decimal;
        feeTotal: Prisma.Decimal;
        fundingTotal: Prisma.Decimal;
      }[]
    >(Prisma.sql`
      select
        ${dateExpr} as date,
        sum("realizedPnl") as "realizedPnl",
        sum("feeTotal") as "feeTotal",
        sum("fundingTotal") as "fundingTotal"
      from "Trade"
      ${where}
      and "status" = 'CLOSED'
      and "exitTime" is not null
      group by ${dateExpr}
      order by date asc
    `);

    return rows.map((row) => ({
      date: row.date,
      realizedPnl: new Prisma.Decimal(row.realizedPnl).toNumber(),
      feeTotal: new Prisma.Decimal(row.feeTotal).toNumber(),
      fundingTotal: new Prisma.Decimal(row.fundingTotal).toNumber(),
    }));
  }

  async getMonthlyPnl(accountId: string, from?: Date, to?: Date) {
    const fromMs = from?.getTime();
    const toMs = to?.getTime();
    const where = Prisma.sql`
      where "exchangeAccountId" = ${accountId}
      ${fromMs != null ? Prisma.sql`and "exitTime" >= ${fromMs}` : Prisma.empty}
      ${toMs != null ? Prisma.sql`and "exitTime" <= ${toMs}` : Prisma.empty}
    `;

    // Prisma/SQLite 将 DateTime 存为 Unix 毫秒数，需先转成 datetime 再按月初分组
    const monthExpr = Prisma.sql`strftime('%Y-%m-01', datetime("exitTime" / 1000, 'unixepoch', 'localtime'))`;
    const rows = await this.prisma.$queryRaw<
      {
        month: string;
        realizedPnl: Prisma.Decimal;
        feeTotal: Prisma.Decimal;
        fundingTotal: Prisma.Decimal;
      }[]
    >(Prisma.sql`
      select
        ${monthExpr} as month,
        sum("realizedPnl") as "realizedPnl",
        sum("feeTotal") as "feeTotal",
        sum("fundingTotal") as "fundingTotal"
      from "Trade"
      ${where}
      and "status" = 'CLOSED'
      and "exitTime" is not null
      group by strftime('%Y-%m', datetime("exitTime" / 1000, 'unixepoch', 'localtime'))
      order by month asc
    `);

    return rows.map((row) => ({
      month: row.month,
      realizedPnl: new Prisma.Decimal(row.realizedPnl).toNumber(),
      feeTotal: new Prisma.Decimal(row.feeTotal).toNumber(),
      fundingTotal: new Prisma.Decimal(row.fundingTotal).toNumber(),
    }));
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
