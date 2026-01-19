const fs = require('fs');
const lines = fs.readFileSync('js/transactions.js', 'utf8').split('\n');
for (let i = 120; i < 200; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
