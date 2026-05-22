-- CreateTable
CREATE TABLE "BacktestSchedule" (
    "schedule_id" SERIAL NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'polymarket_daily_backtest',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_batch_size" INTEGER NOT NULL DEFAULT 10,
    "run_time" TEXT NOT NULL DEFAULT '15:00',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "last_run_date" TEXT,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestSchedule_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BacktestSchedule_key_key" ON "BacktestSchedule"("key");
