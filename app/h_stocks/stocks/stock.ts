// Server: fetch stock data from Finnhub
import type { StockQuote, StockProfile } from "../types";

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) throw new Error("Missing FINNHUB_API_KEY in environment");

    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`;
    const res = await fetch(url, { next: { revalidate: 60 } }); // Cache for 1 minute

    if (!res.ok) {
        console.error(`Failed to fetch quote for ${symbol}: ${res.status}`);
        return null;
    }

    return await res.json();
}

export async function fetchStockProfile(symbol: string): Promise<StockProfile | null> {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) throw new Error("Missing FINNHUB_API_KEY in environment");

    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${key}`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour

    if (!res.ok) {
        console.error(`Failed to fetch profile for ${symbol}: ${res.status}`);
        return null;
    }

    return await res.json();
}

export async function fetchMultipleStocks(symbols: string[]) {
    const stocksData = await Promise.all(
        symbols.map(async (symbol) => {
            const [quote, profile] = await Promise.all([
                fetchStockQuote(symbol),
                fetchStockProfile(symbol)
            ]);

            return {
                symbol,
                quote,
                profile
            };
        })
    );

    return stocksData.filter(stock => stock.quote !== null);
}

// Popular stocks to monitor
export const DEFAULT_STOCKS = [
    'AAPL',  // Apple
    'MSFT',  // Microsoft
    'GOOGL', // Google
    'AMZN',  // Amazon
    'TSLA',  // Tesla
    'NVDA',  // NVIDIA
    'META',  // Meta
    'NFLX',  // Netflix
    'JPM',   // JPMorgan Chase
    'V',     // Visa
    'JNJ',   // Johnson & Johnson
    'WMT',   // Walmart
    'PG',    // Procter & Gamble
    'MA',    // Mastercard
    'DIS',   // Disney
    'PYPL',  // PayPal
    'INTC',  // Intel
    'VZ',    // Verizon
    'CSCO',  // Cisco
    'PFE',   // Pfizer
];
