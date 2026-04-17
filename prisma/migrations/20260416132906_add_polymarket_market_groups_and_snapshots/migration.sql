-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'member';

-- CreateTable
CREATE TABLE "PolymarketMarketGroup" (
    "group_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "source_url" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'KEYWORD',
    "match_keywords" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by_u_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketMarketGroup_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "PolymarketGroupedMarket" (
    "grouped_market_id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "market_id" TEXT NOT NULL,
    "clob_token_id" TEXT,
    "question" TEXT NOT NULL,
    "event_title" TEXT,
    "event_slug" TEXT,
    "category" TEXT,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketGroupedMarket_pkey" PRIMARY KEY ("grouped_market_id")
);

-- CreateTable
CREATE TABLE "PolymarketGroupedMarketSnapshot" (
    "snapshot_id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "market_id" TEXT NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yes_price" DOUBLE PRECISION,
    "no_price" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "end_date_iso" TIMESTAMP(3),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "question" TEXT,
    "category" TEXT,
    "trade_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PolymarketGroupedMarketSnapshot_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketMarketGroup_slug_key" ON "PolymarketMarketGroup"("slug");

-- CreateIndex
CREATE INDEX "PolymarketMarketGroup_is_system_idx" ON "PolymarketMarketGroup"("is_system");

-- CreateIndex
CREATE INDEX "PolymarketMarketGroup_created_by_u_id_idx" ON "PolymarketMarketGroup"("created_by_u_id");

-- CreateIndex
CREATE INDEX "PolymarketGroupedMarket_group_id_idx" ON "PolymarketGroupedMarket"("group_id");

-- CreateIndex
CREATE INDEX "PolymarketGroupedMarket_market_id_idx" ON "PolymarketGroupedMarket"("market_id");

-- CreateIndex
CREATE INDEX "PolymarketGroupedMarket_is_closed_idx" ON "PolymarketGroupedMarket"("is_closed");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketGroupedMarket_group_id_market_id_key" ON "PolymarketGroupedMarket"("group_id", "market_id");

-- CreateIndex
CREATE INDEX "PolymarketGroupedMarketSnapshot_group_id_idx" ON "PolymarketGroupedMarketSnapshot"("group_id");

-- CreateIndex
CREATE INDEX "PolymarketGroupedMarketSnapshot_market_id_idx" ON "PolymarketGroupedMarketSnapshot"("market_id");

-- CreateIndex
CREATE INDEX "PolymarketGroupedMarketSnapshot_collected_at_idx" ON "PolymarketGroupedMarketSnapshot"("collected_at");

-- AddForeignKey
ALTER TABLE "PolymarketGroupedMarket" ADD CONSTRAINT "PolymarketGroupedMarket_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "PolymarketMarketGroup"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketGroupedMarketSnapshot" ADD CONSTRAINT "PolymarketGroupedMarketSnapshot_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "PolymarketMarketGroup"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;
