-- CreateTable
CREATE TABLE "WalletTransaction" (
    "transaction_id" SERIAL NOT NULL,
    "u_id" INTEGER NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "symbol" TEXT,
    "quantity" INTEGER,
    "price" DOUBLE PRECISION,
    "description" TEXT,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateIndex
CREATE INDEX "WalletTransaction_u_id_idx" ON "WalletTransaction"("u_id");

-- CreateIndex
CREATE INDEX "WalletTransaction_transaction_type_idx" ON "WalletTransaction"("transaction_type");

-- CreateIndex
CREATE INDEX "WalletTransaction_transaction_date_idx" ON "WalletTransaction"("transaction_date");
