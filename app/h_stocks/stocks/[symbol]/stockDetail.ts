// Server: fetch detailed stock data using Yahoo Finance

interface YahooChartResult {
    chart: {
        result: [{
            timestamp: number[];
            indicators: {
                quote: [{
                    open: number[];
                    high: number[];
                    low: number[];
                    close: number[];
                    volume: number[];
                }];
            };
        }];
        error: null | { code: string; description: string };
    };
}

export async function fetchStockCandles(
    symbol: string,
    resolution: 'D' | '1' | '5' | '15' | '30' | '60' = 'D',
    days: number = 30
) {
    try {
        // Use Yahoo Finance API (free, no API key needed)
        const range = days <= 30 ? '1mo' : '1y';
        const interval = resolution === 'D' ? '1d' : '1h';

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
        const res = await fetch(url, {
            next: { revalidate: 300 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!res.ok) {
            console.error(`Failed to fetch candles for ${symbol}: ${res.status}`);
            return null;
        }

        const data: YahooChartResult = await res.json();

        if (data.chart.error || !data.chart.result?.[0]) {
            console.error(`Yahoo Finance error for ${symbol}`);
            return null;
        }

        const result = data.chart.result[0];
        const quote = result.indicators.quote[0];

        // Convert to Finnhub-compatible format
        return {
            c: quote.close.filter((v): v is number => v !== null),
            h: quote.high.filter((v): v is number => v !== null),
            l: quote.low.filter((v): v is number => v !== null),
            o: quote.open.filter((v): v is number => v !== null),
            v: quote.volume.filter((v): v is number => v !== null),
            t: result.timestamp,
            s: 'ok'
        };
    } catch (error) {
        console.error(`Error fetching candles for ${symbol}:`, error);
        return null;
    }
}