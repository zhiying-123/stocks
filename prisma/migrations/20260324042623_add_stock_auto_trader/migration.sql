-- CreateTable
CREATE TABLE "StockAutoTrader" (
    "auto_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "target_price" DOUBLE PRECISION,
    "moving_average_days" INTEGER,
    "quantity" INTEGER NOT NULL,
    "notify_channels" TEXT NOT NULL DEFAULT 'EMAIL,DISCORD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_checked_price" DOUBLE PRECISION,
    "last_trigger_value" DOUBLE PRECISION,
    "executed_at" TIMESTAMP(3),
    "triggered_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAutoTrader_pkey" PRIMARY KEY ("auto_id")
);

-- CreateIndex
CREATE INDEX "StockAutoTrader_u_id_idx" ON "StockAutoTrader"("u_id");

-- CreateIndex
CREATE INDEX "StockAutoTrader_symbol_idx" ON "StockAutoTrader"("symbol");

-- CreateIndex
CREATE INDEX "StockAutoTrader_is_active_idx" ON "StockAutoTrader"("is_active");

-- CreateIndex
CREATE INDEX "StockAutoTrader_created_at_idx" ON "StockAutoTrader"("created_at");
