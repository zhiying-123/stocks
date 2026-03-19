-- CreateTable
CREATE TABLE "PolymarketPriceAlert" (
    "alert_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "market_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'YES',
    "direction" TEXT NOT NULL,
    "target_price" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketPriceAlert_pkey" PRIMARY KEY ("alert_id")
);

-- CreateIndex
CREATE INDEX "PolymarketPriceAlert_u_id_idx" ON "PolymarketPriceAlert"("u_id");

-- CreateIndex
CREATE INDEX "PolymarketPriceAlert_market_id_idx" ON "PolymarketPriceAlert"("market_id");

-- CreateIndex
CREATE INDEX "PolymarketPriceAlert_is_active_idx" ON "PolymarketPriceAlert"("is_active");

-- CreateIndex
CREATE INDEX "PolymarketPriceAlert_created_at_idx" ON "PolymarketPriceAlert"("created_at");
