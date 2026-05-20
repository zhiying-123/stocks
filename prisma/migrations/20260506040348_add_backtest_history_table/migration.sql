-- CreateTable
CREATE TABLE "BacktestHistory" (
    "id" SERIAL NOT NULL,
    "market_id" TEXT NOT NULL,
    "clob_token_id" TEXT,
    "market_name" TEXT NOT NULL,
    "group_name" TEXT,
    "net_pnl" DOUBLE PRECISION NOT NULL,
    "return_pct" DOUBLE PRECISION NOT NULL,
    "trades_count" INTEGER NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "initial_cash" DOUBLE PRECISION NOT NULL,
    "final_equity" DOUBLE PRECISION NOT NULL,
    "vs_buy_hold" DOUBLE PRECISION NOT NULL,
    "max_drawdown" DOUBLE PRECISION NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BacktestHistory_market_id_idx" ON "BacktestHistory"("market_id");

-- CreateIndex
CREATE INDEX "BacktestHistory_executed_at_idx" ON "BacktestHistory"("executed_at");

-- CreateIndex
CREATE INDEX "BacktestHistory_created_at_idx" ON "BacktestHistory"("created_at");
