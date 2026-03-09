// Quick test to check price format
async function test() {
    const response = await fetch('https://gamma-api.polymarket.com/events?limit=10&closed=false');
    const data = await response.json();

    console.log('\n📊 Checking price data format:\n');

    data.slice(0, 10).forEach((event, i) => {
        const market = event.markets?.[0];
        if (market) {
            const rawPrices = market.outcomePrices;
            console.log(`${i + 1}. ${event.title?.substring(0, 50)}`);
            console.log(`   Type: ${typeof rawPrices}`);
            console.log(`   Raw: ${rawPrices}`);

            if (typeof rawPrices === 'string') {
                try {
                    const parsed = JSON.parse(rawPrices);
                    console.log(`   Parsed YES: ${(parseFloat(parsed[0]) * 100).toFixed(1)}%`);
                    console.log(`   Parsed NO: ${(parseFloat(parsed[1]) * 100).toFixed(1)}%`);
                } catch (e) {
                    console.log(`   Parse error: ${e.message}`);
                }
            }
            console.log('');
        }
    });
}

test();
