import StocksUI from "./stocksUI";
import { fetchMultipleStocks, DEFAULT_STOCKS } from "./stock";

export default async function StocksPage() {
    let stocksData = [] as any[];

    try {
        stocksData = await fetchMultipleStocks(DEFAULT_STOCKS);
    } catch (e) {
        console.error("Failed to load stocks data:", e);
        stocksData = [];
    }

    return <StocksUI stocks={stocksData} />;
}
