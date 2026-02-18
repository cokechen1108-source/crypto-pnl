import { Injectable } from '@nestjs/common';
import { Prisma, TradeSide } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';

type RawExecution = {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: Prisma.Decimal;
  amount: Prisma.Decimal;
  fee: Prisma.Decimal | null;
  feeCurrency: string | null;
  tradeTimestamp: Date;
};

type Lot = {
  size: Decimal;
  price: Decimal;
  entryTime: Date;
};

type DraftTrade = {
  symbol: string;
  marketType: string;
  side: TradeSide;
  entryTime: Date;
  entryPrice: Decimal;
  size: Decimal;
  realizedPnl: Decimal;
  feeTotal: Decimal;
  fundingTotal: Decimal;
  exitTime?: Date;
  exitPrice?: Decimal;
  lots: Lot[];
  executions: RawExecution[];
  legs: DraftLeg[];
};

type DraftLeg = {
  side: TradeSide;
  size: Decimal;
  entryPrice: Decimal;
  exitPrice: Decimal;
  entryTime: Date;
  exitTime: Date;
  realizedPnl: Decimal;
  feeTotal: Decimal;
  fundingTotal: Decimal;
};

@Injectable()
export class TradeNormalizationService {
  constructor(private readonly prisma: PrismaService) {}

  async rebuildAccountTrades(accountId: string, symbol?: string) {
    const whereSymbol = symbol ? { symbol } : undefined;
    const rawTrades = await this.prisma.rawTrade.findMany({
      where: { exchangeAccountId: accountId, ...whereSymbol },
      orderBy: { tradeTimestamp: 'asc' },
    });

    const tradeWhere = {
      exchangeAccountId: accountId,
      ...(symbol ? { symbol } : {}),
    };

    await this.prisma.$transaction([
      this.prisma.tradeExecution.deleteMany({ where: { trade: tradeWhere } }),
      this.prisma.tradeLeg.deleteMany({ where: { trade: tradeWhere } }),
      this.prisma.trade.deleteMany({ where: tradeWhere }),
    ]);

    const tradesToCreate: DraftTrade[] = [];
    const grouped = new Map<string, typeof rawTrades>();
    for (const raw of rawTrades) {
      const existing = grouped.get(raw.symbol) ?? [];
      existing.push(raw);
      grouped.set(raw.symbol, existing);
    }

    for (const [, symbolTrades] of grouped) {
      let current: DraftTrade | null = null;
      for (const raw of symbolTrades) {
      const side = raw.side;
      const execPrice = new Decimal(raw.price.toString());
      const execAmount = new Decimal(raw.amount.toString());
      const fee = raw.fee ? new Decimal(raw.fee.toString()) : new Decimal(0);
      const feePerUnit = execAmount.eq(0) ? new Decimal(0) : fee.div(execAmount);

      const baseExec: RawExecution = {
        id: raw.id,
        symbol: raw.symbol,
        side,
        price: raw.price,
        amount: raw.amount,
        fee: raw.fee,
        feeCurrency: raw.feeCurrency,
        tradeTimestamp: raw.tradeTimestamp,
      };

        if (!current) {
        current = {
          symbol: raw.symbol,
          marketType: raw.marketType,
          side: side === 'BUY' ? 'LONG' : 'SHORT',
          entryTime: raw.tradeTimestamp,
          entryPrice: execPrice,
          size: execAmount,
          realizedPnl: new Decimal(0),
          feeTotal: fee,
          fundingTotal: new Decimal(0),
          lots: [{ size: execAmount, price: execPrice, entryTime: raw.tradeTimestamp }],
          executions: [
            buildExecutionSegment(baseExec, execAmount, fee),
          ],
          legs: [],
        };
          continue;
        }

      const incomingSide = side === 'BUY' ? 'LONG' : 'SHORT';

        if (incomingSide === current.side) {
        current.feeTotal = current.feeTotal.plus(fee);
        current.executions.push(
          buildExecutionSegment(baseExec, execAmount, fee),
        );
        current.lots.push({
          size: execAmount,
          price: execPrice,
          entryTime: raw.tradeTimestamp,
        });
        current.size = current.size.plus(execAmount);
        current.entryPrice = weightedAverageEntry(current.lots);
          continue;
        }

        let remaining = execAmount;
        while (remaining.gt(0) && current.lots.length > 0) {
        const lot = current.lots[0];
        const matched = Decimal.min(lot.size, remaining);
        const matchedFee = feePerUnit.mul(matched);

        const pnl =
          current.side === 'LONG'
            ? execPrice.minus(lot.price).mul(matched)
            : lot.price.minus(execPrice).mul(matched);

        current.realizedPnl = current.realizedPnl.plus(pnl);
        current.feeTotal = current.feeTotal.plus(matchedFee);
        current.size = current.size.minus(matched);

        current.executions.push(
          buildExecutionSegment(baseExec, matched, matchedFee),
        );

        current.legs.push({
          side: current.side,
          size: matched,
          entryPrice: lot.price,
          exitPrice: execPrice,
          entryTime: lot.entryTime,
          exitTime: raw.tradeTimestamp,
          realizedPnl: pnl,
          feeTotal: matchedFee,
          fundingTotal: new Decimal(0),
        });

        lot.size = lot.size.minus(matched);
        remaining = remaining.minus(matched);
        if (lot.size.eq(0)) {
          current.lots.shift();
        }
      }

        if (current.size.eq(0)) {
        current.exitTime = raw.tradeTimestamp;
        current.exitPrice = calculateExitPrice(current.legs);
        tradesToCreate.push(current);
        current = null;
        }

        if (remaining.gt(0)) {
        current = {
          symbol: raw.symbol,
          marketType: raw.marketType,
          side: incomingSide,
          entryTime: raw.tradeTimestamp,
          entryPrice: execPrice,
          size: remaining,
          realizedPnl: new Decimal(0),
          feeTotal: feePerUnit.mul(remaining),
          fundingTotal: new Decimal(0),
          lots: [{ size: remaining, price: execPrice, entryTime: raw.tradeTimestamp }],
          executions: [
            buildExecutionSegment(baseExec, remaining, feePerUnit.mul(remaining)),
          ],
          legs: [],
        };
        }
      }

      if (current) {
        tradesToCreate.push(current);
      }
    }

    for (const trade of tradesToCreate) {
      const tradeRecord = await this.prisma.trade.create({
        data: {
          exchangeAccountId: accountId,
          symbol: trade.symbol,
          marketType: trade.marketType,
          side: trade.side,
          status: trade.exitTime ? 'CLOSED' : 'OPEN',
          entryTime: trade.entryTime,
          exitTime: trade.exitTime ?? null,
          entryPrice: trade.entryPrice.toNumber(),
          exitPrice: trade.exitPrice ? trade.exitPrice.toNumber() : null,
          size: trade.size.toNumber(),
          realizedPnl: trade.realizedPnl.toNumber(),
          feeTotal: trade.feeTotal.toNumber(),
          fundingTotal: trade.fundingTotal.toNumber(),
          durationSeconds: trade.exitTime
            ? Math.max(
                0,
                Math.floor(
                  (trade.exitTime.getTime() - trade.entryTime.getTime()) / 1000,
                ),
              )
            : null,
          executions: {
            create: trade.executions.map((execution) => ({
              rawTradeId: execution.id,
              side: execution.side,
              price: execution.price,
              amount: execution.amount,
              fee: execution.fee,
              feeCurrency: execution.feeCurrency,
              timestamp: execution.tradeTimestamp,
            })),
          },
          legs: {
            create: trade.legs.map((leg) => ({
              side: leg.side,
              size: leg.size.toNumber(),
              entryPrice: leg.entryPrice.toNumber(),
              exitPrice: leg.exitPrice.toNumber(),
              entryTime: leg.entryTime,
              exitTime: leg.exitTime,
              realizedPnl: leg.realizedPnl.toNumber(),
              feeTotal: leg.feeTotal.toNumber(),
              fundingTotal: leg.fundingTotal.toNumber(),
            })),
          },
        },
      });

      if (trade.exitTime) {
        const funding = await this.prisma.rawFunding.findMany({
          where: {
            exchangeAccountId: accountId,
            symbol: trade.symbol,
            fundingTimestamp: {
              gte: trade.entryTime,
              lte: trade.exitTime,
            },
          },
        });
        const fundingTotal = funding.reduce(
          (acc, item) => acc.plus(new Decimal(item.fundingFee.toString())),
          new Decimal(0),
        );
        if (!fundingTotal.eq(0)) {
          await this.prisma.trade.update({
            where: { id: tradeRecord.id },
            data: { fundingTotal: fundingTotal.toNumber() },
          });
        }
      }
    }

    return { tradesCreated: tradesToCreate.length };
  }
}

function weightedAverageEntry(lots: Lot[]): Decimal {
  const totalSize = lots.reduce((acc, lot) => acc.plus(lot.size), new Decimal(0));
  if (totalSize.eq(0)) {
    return new Decimal(0);
  }
  const totalCost = lots.reduce(
    (acc, lot) => acc.plus(lot.price.mul(lot.size)),
    new Decimal(0),
  );
  return totalCost.div(totalSize);
}

function calculateExitPrice(legs: DraftLeg[]): Decimal | undefined {
  if (legs.length === 0) {
    return undefined;
  }
  const totalSize = legs.reduce((acc, leg) => acc.plus(leg.size), new Decimal(0));
  const totalValue = legs.reduce(
    (acc, leg) => acc.plus(leg.exitPrice.mul(leg.size)),
    new Decimal(0),
  );
  return totalValue.div(totalSize);
}

function buildExecutionSegment(
  base: RawExecution,
  amount: Decimal,
  fee: Decimal,
): RawExecution {
  return {
    ...base,
    amount: new Prisma.Decimal(amount.toString()),
    fee: fee.eq(0) ? null : new Prisma.Decimal(fee.toString()),
  };
}
