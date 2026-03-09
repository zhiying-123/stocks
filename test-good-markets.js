// Find markets with diverse prices
async function findGoodMarkets() {
    console.log("🔍 Looking for markets with interesting prices...\n");

    try {
        const response = await fetch("https://gamma-api.polymarket.com/events?limit=100&offset=0&closed=false&order=volume24hr");
        const data = await response.json();

        console.log(`✅ Fetched ${data.length} markets\n`);

        // Filter for binary markets with good prices
        const allMarkets = [];
        data.forEach(event => {
            if (event.markets && event.markets.length > 0) {
                // Check ALL markets in the event, not just the first one
                event.markets.forEach((market, idx) => {
                    const prices = market.outcomePrices || [];
                    const yesPrice = parseFloat(prices[0] || "0");
                    const noPrice = parseFloat(prices[1] || "0");

                    if (idx < 2 && event.markets.length < 5) { // Debug: print first few
                        console.log(`DEBUG: Event="${event.title?.substring(0, 30)}" Market ${idx}: prices=${JSON.stringify(prices)}, YES=${yesPrice}, NO=${noPrice}`);
                    }

                    allMarkets.push({
                        eventTitle: event.title,
                        marketQuestion: market.question || `Option ${idx + 1}`,
                        yesPrice,
                        noPrice,
                        volume: event.volume / event.markets.length, // Split volume
                        image: event.image
                    });
                });
            }
        });

        console.log(`\n📋 Total markets found: ${allMarkets.length}`);
        console.log(`   Price distribution:`);
        const extreme = allMarkets.filter(m => m.yesPrice <= 0.05 || m.yesPrice >= 0.95).length;
        const moderate = allMarkets.filter(m => m.yesPrice > 0.3 && m.yesPrice < 0.7).length;
        const reasonable = allMarkets.filter(m => m.yesPrice > 0.05 && m.yesPrice < 0.95).length;
        console.log(`   - Extreme (0-5% or 95-100%): ${extreme}`);
        console.log(`   - Reasonable (5-95%): ${reasonable}`);
        console.log(`   - Moderate (30-70%): ${moderate}\n`);

        // Show some sample prices
        console.log(`📊 Sample prices from all markets:`);
        allMarkets.slice(0, 10).forEach((m, i) => {
            console.log(`   ${i + 1}. YES=${(m.yesPrice * 100).toFixed(1)}% "${m.marketQuestion.substring(0, 40)}"`);
        });
        console.log();

        const goodMarkets = allMarkets
            .filter(m => m.yesPrice > 0.05 && m.yesPrice < 0.95) // Filter extremes
            .sort((a, b) => b.volume - a.volume) // Sort by volume
            .slice(0, 20);

        console.log(`📊 Found ${goodMarkets.length} markets with reasonable prices:\n`);
        console.log("=".repeat(90));

        goodMarkets.forEach((m, idx) => {
            console.log(`\n${idx + 1}. ${m.eventTitle.substring(0, 60)}`);
            console.log(`   Market: ${m.marketQuestion.substring(0, 60)}`);
            console.log(`   YES: ${(m.yesPrice * 100).toFixed(1)}% | NO: ${(m.noPrice * 100).toFixed(1)}%`);
            console.log(`   Volume: $${(m.volume / 1000).toFixed(0)}K | Image: ${m.image ? '✅' : '❌'}`);
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

findGoodMarkets();
