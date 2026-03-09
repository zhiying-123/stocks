-- CreateTable
CREATE TABLE "PolymarketHolding" (
    "holding_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "market_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "avg_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketHolding_pkey" PRIMARY KEY ("holding_id")
);

-- CreateTable
CREATE TABLE "PolymarketTransaction" (
    "transaction_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "market_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketTransaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateIndex
CREATE INDEX "PolymarketHolding_u_id_idx" ON "PolymarketHolding"("u_id");

-- CreateIndex
CREATE INDEX "PolymarketHolding_market_id_idx" ON "PolymarketHolding"("market_id");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketHolding_u_id_market_id_outcome_key" ON "PolymarketHolding"("u_id", "market_id", "outcome");

-- CreateIndex
CREATE INDEX "PolymarketTransaction_u_id_idx" ON "PolymarketTransaction"("u_id");

-- CreateIndex
CREATE INDEX "PolymarketTransaction_market_id_idx" ON "PolymarketTransaction"("market_id");

-- CreateIndex
CREATE INDEX "PolymarketTransaction_transaction_date_idx" ON "PolymarketTransaction"("transaction_date");
