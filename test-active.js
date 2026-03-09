// Find markets with active prices
async function test() {
    const response = await fetch('https://gamma-api.polymarket.com/events?limit=100&closed=false');
    const data = await response.json();

    console.log('\n📊 Finding markets with active prices:\n');

    let found = 0;

    for (const event of data) {
        if (!event.markets) continue;

        // Check ALL markets in the event
        for (const market of event.markets) {
            const rawPrices = market.outcomePrices;
            if (!rawPrices) continue;

            let prices = rawPrices;
            if (typeof prices === 'string') {
                try { prices = JSON.parse(prices); } catch (e) { continue; }
            }

            if (!Array.isArray(prices) || prices.length < 2) continue;

            const yesPrice = parseFloat(prices[0]);
            const noPrice = parseFloat(prices[1]);

            // Only show markets with active prices (not 0 or 1)
            if (yesPrice > 0.05 && yesPrice < 0.95) {
                found++;
                console.log(`${found}. ${market.question || event.title}`);
                console.log(`   YES: ${(yesPrice * 100).toFixed(1)}% | NO: ${(noPrice * 100).toFixed(1)}%`);
                console.log(`   Image: ${event.image ? '✅' : '❌'}`);
                console.log(`   Volume: $${(event.volume / 1000).toFixed(0)}K`);
                console.log('');

                if (found >= 15) break;
            }
        }
        if (found >= 15) break;
    }

    console.log(`\n✅ Found ${found} markets with active prices`);
}

test();
