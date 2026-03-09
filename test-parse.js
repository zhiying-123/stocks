console.log('Testing parseFloat on Polymarket data:');
console.log('parseFloat("0") =', parseFloat("0"));
console.log('parseFloat("1") =', parseFloat("1"));
console.log('parseFloat("0.5") =', parseFloat("0.5"));
console.log('parseFloat("0.23") =', parseFloat("0.23"));

// Test with actual array
const prices = ["0", "1"];
console.log('\nWith array ["0", "1"]:');
console.log('  prices[0] =', prices[0], 'type:', typeof prices[0]);
console.log('  parseFloat(prices[0]) =', parseFloat(prices[0]));
console.log('  parseFloat(prices[0]) * 100 =', parseFloat(prices[0]) * 100);
