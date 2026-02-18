-- CreateTable
CREATE TABLE "ExchangeAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeAccountId" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "encryptedPassphrase" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiKey_exchangeAccountId_fkey" FOREIGN KEY ("exchangeAccountId") REFERENCES "ExchangeAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeAccountId" TEXT NOT NULL,
    "exchangeTradeId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "fee" DECIMAL,
    "feeCurrency" TEXT,
    "realizedPnl" DECIMAL,
    "orderId" TEXT,
    "tradeTimestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawTrade_exchangeAccountId_fkey" FOREIGN KEY ("exchangeAccountId") REFERENCES "ExchangeAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeAccountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "size" DECIMAL NOT NULL,
    "entryPrice" DECIMAL NOT NULL,
    "unrealizedPnl" DECIMAL,
    "leverage" DECIMAL,
    "marginMode" TEXT,
    "updatedTimestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawPosition_exchangeAccountId_fkey" FOREIGN KEY ("exchangeAccountId") REFERENCES "ExchangeAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawFunding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeAccountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "fundingRate" DECIMAL,
    "fundingFee" DECIMAL NOT NULL,
    "fundingTimestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawFunding_exchangeAccountId_fkey" FOREIGN KEY ("exchangeAccountId") REFERENCES "ExchangeAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeAccountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "fee" DECIMAL NOT NULL,
    "feeCurrency" TEXT NOT NULL,
    "feeTimestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawFee_exchangeAccountId_fkey" FOREIGN KEY ("exchangeAccountId") REFERENCES "ExchangeAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeAccountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entryTime" DATETIME NOT NULL,
    "exitTime" DATETIME,
    "entryPrice" DECIMAL NOT NULL,
    "exitPrice" DECIMAL,
    "size" DECIMAL NOT NULL,
    "realizedPnl" DECIMAL NOT NULL,
    "feeTotal" DECIMAL NOT NULL,
    "fundingTotal" DECIMAL NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trade_exchangeAccountId_fkey" FOREIGN KEY ("exchangeAccountId") REFERENCES "ExchangeAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "rawTradeId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "fee" DECIMAL,
    "feeCurrency" TEXT,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeExecution_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeExecution_rawTradeId_fkey" FOREIGN KEY ("rawTradeId") REFERENCES "RawTrade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeLeg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "size" DECIMAL NOT NULL,
    "entryPrice" DECIMAL NOT NULL,
    "exitPrice" DECIMAL,
    "entryTime" DATETIME NOT NULL,
    "exitTime" DATETIME,
    "realizedPnl" DECIMAL NOT NULL,
    "feeTotal" DECIMAL NOT NULL,
    "fundingTotal" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeLeg_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyPnl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeAccountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "realizedPnl" DECIMAL NOT NULL,
    "feeTotal" DECIMAL NOT NULL,
    "fundingTotal" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyPnl_exchangeAccountId_fkey" FOREIGN KEY ("exchangeAccountId") REFERENCES "ExchangeAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyPnl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeAccountId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "realizedPnl" DECIMAL NOT NULL,
    "feeTotal" DECIMAL NOT NULL,
    "fundingTotal" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyPnl_exchangeAccountId_fkey" FOREIGN KEY ("exchangeAccountId") REFERENCES "ExchangeAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExchangeAccount_userId_exchange_idx" ON "ExchangeAccount"("userId", "exchange");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_exchangeAccountId_key" ON "ApiKey"("exchangeAccountId");

-- CreateIndex
CREATE INDEX "RawTrade_exchangeAccountId_tradeTimestamp_idx" ON "RawTrade"("exchangeAccountId", "tradeTimestamp");

-- CreateIndex
CREATE INDEX "RawTrade_symbol_tradeTimestamp_idx" ON "RawTrade"("symbol", "tradeTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "RawTrade_exchangeAccountId_exchangeTradeId_key" ON "RawTrade"("exchangeAccountId", "exchangeTradeId");

-- CreateIndex
CREATE INDEX "RawPosition_exchangeAccountId_updatedTimestamp_idx" ON "RawPosition"("exchangeAccountId", "updatedTimestamp");

-- CreateIndex
CREATE INDEX "RawFunding_exchangeAccountId_fundingTimestamp_idx" ON "RawFunding"("exchangeAccountId", "fundingTimestamp");

-- CreateIndex
CREATE INDEX "RawFee_exchangeAccountId_feeTimestamp_idx" ON "RawFee"("exchangeAccountId", "feeTimestamp");

-- CreateIndex
CREATE INDEX "Trade_exchangeAccountId_entryTime_idx" ON "Trade"("exchangeAccountId", "entryTime");

-- CreateIndex
CREATE INDEX "Trade_symbol_entryTime_idx" ON "Trade"("symbol", "entryTime");

-- CreateIndex
CREATE INDEX "TradeExecution_tradeId_timestamp_idx" ON "TradeExecution"("tradeId", "timestamp");

-- CreateIndex
CREATE INDEX "TradeLeg_tradeId_entryTime_idx" ON "TradeLeg"("tradeId", "entryTime");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPnl_exchangeAccountId_date_key" ON "DailyPnl"("exchangeAccountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPnl_exchangeAccountId_month_key" ON "MonthlyPnl"("exchangeAccountId", "month");
