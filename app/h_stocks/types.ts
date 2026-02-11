// Shared types for H-Stocks Investment Platform

// ==================== Stock API Types ====================
export interface StockQuote {
    c: number;   // Current price
    h: number;   // High price of the day
    l: number;   // Low price of the day
    o: number;   // Open price of the day
    pc: number;  // Previous close price
    d: number;   // Change
    dp: number;  // Percent change
    t?: number;  // Timestamp
}

export interface StockProfile {
    name: string;
    ticker: string;
    exchange?: string;
    currency?: string;
    marketCapitalization?: number;
}

export interface Stock {
    symbol: string;
    quote: StockQuote | null;
    profile: StockProfile | null;
}

// ==================== Chart Types ====================
export interface CandleData {
    c: number[];  // Close prices
    h: number[];  // High prices
    l: number[];  // Low prices
    o: number[];  // Open prices
    t: number[];  // Timestamps
    v: number[];  // Volume
    s: string;    // Status
}

export interface ChartDataPoint {
    date: string;
    fullDate: string;
    close: number;
    open: number;
    high: number;
    low: number;
    volume: number;
    change: number;
    isUp: boolean;
}

export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';
export type SortBy = 'symbol' | 'price' | 'change' | 'percent';
export type SortOrder = 'asc' | 'desc';

// ==================== Portfolio Types ====================
export interface PortfolioSummary {
    totalValue: number;
    totalGainLoss: number;
    holdingsCount: number;
    cashBalance: number;
}

// ==================== Watchlist Types ====================
export interface WatchlistItem {
    symbol: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    open?: number | null;
    high?: number | null;
    low?: number | null;
    previousClose?: number | null;
    volume?: number | null;
    marketCap?: number | null;
    companyName?: string | null;
}

// ==================== Holdings Types ====================
export interface HoldingWithLive {
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number | null;
    change: number | null;
    changePercent: number | null;
}

// ==================== Transaction Types ====================
export interface TransactionRecord {
    id: number;
    symbol: string;
    type: string;
    quantity: number;
    price: number;
    totalAmount: number;
    date: string;
}
