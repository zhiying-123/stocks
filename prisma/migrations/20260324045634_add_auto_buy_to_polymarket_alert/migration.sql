-- AlterTable
ALTER TABLE "PolymarketPriceAlert" ADD COLUMN     "auto_buy_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_buy_executed_at" TIMESTAMP(3),
ADD COLUMN     "auto_buy_quantity" DOUBLE PRECISION;
