-- CreateTable
CREATE TABLE "PriceAlert" (
    "alert_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "target_price" DOUBLE PRECISION,
    "percentage_change" DOUBLE PRECISION,
    "reference_price" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_triggered" BOOLEAN NOT NULL DEFAULT false,
    "triggered_at" TIMESTAMP(3),
    "triggered_price" DOUBLE PRECISION,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("alert_id")
);

-- CreateIndex
CREATE INDEX "PriceAlert_u_id_idx" ON "PriceAlert"("u_id");

-- CreateIndex
CREATE INDEX "PriceAlert_symbol_idx" ON "PriceAlert"("symbol");

-- CreateIndex
CREATE INDEX "PriceAlert_is_active_is_triggered_idx" ON "PriceAlert"("is_active", "is_triggered");
