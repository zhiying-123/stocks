-- AlterTable
ALTER TABLE "PolymarketPriceAlert" ADD COLUMN     "alert_tag" TEXT,
ADD COLUMN     "auto_buy_budget" DOUBLE PRECISION,
ADD COLUMN     "auto_buy_cooldown_m" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "auto_buy_last_error" TEXT,
ADD COLUMN     "auto_buy_next_retry_at" TIMESTAMP(3),
ADD COLUMN     "auto_buy_retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "auto_buy_retry_max" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parent_alert_id" INTEGER,
ADD COLUMN     "sl_target_percent" DOUBLE PRECISION,
ADD COLUMN     "tp_target_percent" DOUBLE PRECISION;
