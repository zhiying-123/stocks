-- CreateTable
CREATE TABLE "PolymarketComment" (
    "comment_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "market_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentiment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketComment_pkey" PRIMARY KEY ("comment_id")
);

-- CreateIndex
CREATE INDEX "PolymarketComment_market_id_idx" ON "PolymarketComment"("market_id");

-- CreateIndex
CREATE INDEX "PolymarketComment_u_id_idx" ON "PolymarketComment"("u_id");
