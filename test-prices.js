// Test to see actual Polymarket prices
async function testPrices() {
    console.log("🔍 Fetching real Polymarket prices...\n");

    try {
        const response = await fetch("https://gamma-api.polymarket.com/events?limit=20&offset=0&closed=false");
        const data = await response.json();

        console.log(`✅ Found ${data.length} markets\n`);
        console.log("=".repeat(80));

        data.forEach((event, idx) => {
            if (event.markets && event.markets[0]) {
                const market = event.markets[0];
                const prices = market.outcomePrices || [];

                console.log(`\n${idx + 1}. ${event.title}`);
                console.log(`   Markets in event: ${event.markets.length}`);
                console.log(`   Raw outcomePrices:`, prices);
                console.log(`   Volume: $${(event.volume / 1000).toFixed(0)}K`);

                // Try parsing
                if (prices.length >= 2) {
                    const yesPrice = parseFloat(prices[0]);
                    const noPrice = parseFloat(prices[1]);
                    console.log(`   Parsed: YES=${yesPrice} (${typeof prices[0]}), NO=${noPrice} (${typeof prices[1]})`);
                }
            }
        });

        console.log("\n" + "=".repeat(80));

        // Count markets with different price ranges
        const extreme = data.filter(e => {
            const p = parseFloat(e.markets?.[0]?.outcomePrices?.[0] || 0.5);
            return p < 0.1 || p > 0.9;
        }).length;

        const moderate = data.filter(e => {
            const p = parseFloat(e.markets?.[0]?.outcomePrices?.[0] || 0.5);
            return p >= 0.3 && p <= 0.7;
        }).length;

        console.log(`\n📊 Price Distribution:`);
        console.log(`   Extreme (0-10% or 90-100%): ${extreme} markets`);
        console.log(`   Moderate (30-70%): ${moderate} markets`);
        console.log(`   Other: ${data.length - extreme - moderate} markets`);

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testPrices();
