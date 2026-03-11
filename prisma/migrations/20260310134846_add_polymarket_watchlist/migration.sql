-- CreateTable
CREATE TABLE "PolymarketWatchlist" (
    "watchlist_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "market_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketWatchlist_pkey" PRIMARY KEY ("watchlist_id")
);

-- CreateIndex
CREATE INDEX "PolymarketWatchlist_u_id_idx" ON "PolymarketWatchlist"("u_id");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketWatchlist_u_id_market_id_key" ON "PolymarketWatchlist"("u_id", "market_id");
