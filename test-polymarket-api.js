// Test Polymarket API responses
async function testGammaAPI() {
    console.log("Testing Gamma API...\n");

    try {
        const response = await fetch("https://gamma-api.polymarket.com/events?limit=5&offset=0&closed=false");
        const data = await response.json();

        console.log("✅ Gamma API Response:");
        console.log("Total events:", data.length);

        if (data.length > 0) {
            const firstEvent = data[0];
            console.log("\n📊 First Event Sample:");
            console.log("- ID:", firstEvent.id);
            console.log("- Title:", firstEvent.title);
            console.log("- Image:", firstEvent.image);
            console.log("- Markets count:", firstEvent.markets?.length || 0);

            if (firstEvent.markets && firstEvent.markets.length > 0) {
                const market = firstEvent.markets[0];
                console.log("\n💰 Market Data:");
                console.log("- Condition ID:", market.conditionId);
                console.log("- CLOB Token IDs:", market.clobTokenIds);
                console.log("- Outcome Prices:", market.outcomePrices);
                console.log("- Outcomes:", market.outcomes);

                // Test CLOB API with token ID
                if (market.clobTokenIds && market.clobTokenIds.length > 0) {
                    console.log("\n\n🔍 Testing CLOB API with token ID:", market.clobTokenIds[0]);
                    await testCLOBAPI(market.clobTokenIds[0]);
                }
            }
        }
    } catch (error) {
        console.error("❌ Gamma API Error:", error.message);
    }
}

async function testCLOBAPI(tokenId) {
    try {
        // Test price history with different intervals
        console.log("\n📈 Testing intervals:");

        for (const interval of ['all', 'max', '1d']) {
            const historyResponse = await fetch(`https://clob.polymarket.com/prices-history?market=${tokenId}&interval=${interval}`);
            const historyText = await historyResponse.text();

            console.log(`\n  ${interval}: Status ${historyResponse.status}, Length: ${historyText.length}`);

            if (historyResponse.ok && historyText.length > 20) {
                try {
                    const historyData = JSON.parse(historyText);
                    console.log(`  ✅ Data points:`, Array.isArray(historyData) ? historyData.length : typeof historyData);
                    if (Array.isArray(historyData) && historyData.length > 0) {
                        console.log(`  Sample:`, historyData[0]);
                        break; // Found working endpoint
                    }
                } catch (e) {
                    console.log(`  Raw response:`, historyText.substring(0, 100));
                }
            }
        }

        // Test Data API
        console.log("\n💾 Testing Data API:");
        const dataResponse = await fetch(`https://data-api.polymarket.com/prices?market=${tokenId}`);
        console.log("Status:", dataResponse.status);
        if (dataResponse.ok) {
            const dataText = await dataResponse.text();
            console.log("Response length:", dataText.length);
            if (dataText.length > 20) {
                try {
                    const dataJson = JSON.parse(dataText);
                    console.log("Sample:", JSON.stringify(dataJson).substring(0, 200));
                } catch (e) {
                    console.log("Raw:", dataText.substring(0, 200));
                }
            }
        }

    } catch (error) {
        console.error("❌ API Error:", error.message);
    }
}

// Run tests
testGammaAPI();
