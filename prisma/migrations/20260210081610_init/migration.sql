-- CreateTable
CREATE TABLE "User" (
    "u_id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "access_time" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("u_id")
);

-- CreateTable
CREATE TABLE "UserWallet" (
    "wallet_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "StockHolding" (
    "holding_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "avg_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockHolding_pkey" PRIMARY KEY ("holding_id")
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "transaction_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "StockWatchlist" (
    "watchlist_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockWatchlist_pkey" PRIMARY KEY ("watchlist_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_u_id_key" ON "UserWallet"("u_id");

-- CreateIndex
CREATE INDEX "UserWallet_u_id_idx" ON "UserWallet"("u_id");

-- CreateIndex
CREATE INDEX "StockHolding_u_id_idx" ON "StockHolding"("u_id");

-- CreateIndex
CREATE INDEX "StockHolding_symbol_idx" ON "StockHolding"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "StockHolding_u_id_symbol_key" ON "StockHolding"("u_id", "symbol");

-- CreateIndex
CREATE INDEX "StockTransaction_u_id_idx" ON "StockTransaction"("u_id");

-- CreateIndex
CREATE INDEX "StockTransaction_symbol_idx" ON "StockTransaction"("symbol");

-- CreateIndex
CREATE INDEX "StockTransaction_transaction_date_idx" ON "StockTransaction"("transaction_date");

-- CreateIndex
CREATE INDEX "StockWatchlist_u_id_idx" ON "StockWatchlist"("u_id");

-- CreateIndex
CREATE UNIQUE INDEX "StockWatchlist_u_id_symbol_key" ON "StockWatchlist"("u_id", "symbol");
