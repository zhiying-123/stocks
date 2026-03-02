// API Route: Export Transaction Report
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userCookie = cookieStore.get("user")?.value;
        const user = userCookie ? JSON.parse(userCookie) : null;

        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'csv'; // csv or json
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const type = searchParams.get('type'); // BUY, SELL, or null for all

        // Build query
        const where: any = { u_id: user.id };

        if (startDate || endDate) {
            where.transaction_date = {};
            if (startDate) {
                where.transaction_date.gte = new Date(startDate);
            }
            if (endDate) {
                where.transaction_date.lte = new Date(endDate);
            }
        }

        if (type && (type === 'BUY' || type === 'SELL')) {
            where.transaction_type = type;
        }

        // Fetch all transactions
        const transactions = await prisma.stockTransaction.findMany({
            where,
            orderBy: { transaction_date: 'desc' },
        });

        // Get user info
        const userInfo = await prisma.user.findUnique({
            where: { u_id: user.id },
            select: { name: true, email: true },
        });

        // Export as CSV
        if (format === 'csv') {
            const csvHeaders = [
                'Date',
                'Time',
                'Symbol',
                'Type',
                'Quantity',
                'Price per Share',
                'Total Amount',
                'Currency',
            ];

            const csvRows = transactions.map((tx) => {
                const date = new Date(tx.transaction_date);

                // Use ISO date format (YYYY-MM-DD) - Excel recognizes this perfectly
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const formattedDate = `${year}-${month}-${day}`; // YYYY-MM-DD

                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const formattedTime = `${hours}:${minutes}`; // HH:MM

                return [
                    formattedDate,
                    formattedTime,
                    tx.symbol,
                    tx.transaction_type,
                    tx.quantity.toString(),
                    Number(tx.price).toFixed(2),
                    Number(tx.total_amount).toFixed(2),
                    tx.currency,
                ];
            });

            // Smart field escaping - wrap in quotes only if needed (contains comma, quote, or newline)
            const escapeField = (field: string, isDateOrNumber: boolean = false) => {
                // Don't wrap dates and numbers to allow Excel auto-format
                if (isDateOrNumber && !/[,"\n\r]/.test(field)) {
                    return field;
                }
                // Wrap other fields in quotes if they contain special characters
                if (/[,"\n\r]/.test(field)) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            };

            const csvContent = [
                csvHeaders.join(','), // Headers without quotes
                ...csvRows.map(row =>
                    row.map((field, index) => {
                        // First two columns are date and time
                        const isDateOrNumber = index <= 1 || index >= 4; // date, time, quantity, prices
                        return escapeField(field, isDateOrNumber);
                    }).join(',')
                ),
            ].join('\r\n'); // Use Windows line endings for better Excel compatibility

            // Add BOM for Excel UTF-8 recognition
            const BOM = '\uFEFF';
            const csvWithBOM = BOM + csvContent;

            return new NextResponse(csvWithBOM, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.csv"`,
                },
            });
        }

        // Export as JSON
        if (format === 'json') {
            const jsonData = {
                exportDate: new Date().toISOString(),
                user: {
                    name: userInfo?.name,
                    email: userInfo?.email,
                },
                filters: {
                    startDate: startDate || 'all',
                    endDate: endDate || 'all',
                    type: type || 'all',
                },
                totalTransactions: transactions.length,
                transactions: transactions.map((tx) => ({
                    date: tx.transaction_date.toISOString(),
                    symbol: tx.symbol,
                    type: tx.transaction_type,
                    quantity: tx.quantity,
                    pricePerShare: Number(tx.price),
                    totalAmount: Number(tx.total_amount),
                    currency: tx.currency,
                })),
                summary: {
                    totalBuyTransactions: transactions.filter(tx => tx.transaction_type === 'BUY').length,
                    totalSellTransactions: transactions.filter(tx => tx.transaction_type === 'SELL').length,
                    totalAmountBought: transactions
                        .filter(tx => tx.transaction_type === 'BUY')
                        .reduce((sum, tx) => sum + Number(tx.total_amount), 0),
                    totalAmountSold: transactions
                        .filter(tx => tx.transaction_type === 'SELL')
                        .reduce((sum, tx) => sum + Number(tx.total_amount), 0),
                },
            };

            return new NextResponse(JSON.stringify(jsonData, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.json"`,
                },
            });
        }

        return NextResponse.json({ error: 'Invalid format' }, { status: 400 });

    } catch (error) {
        console.error('[EXPORT ERROR]:', error);
        return NextResponse.json(
            { error: 'Failed to export report' },
            { status: 500 }
        );
    }
}
