const { readFileSync } = require('node:fs');
const lines = readFileSync('js/settings.js', 'utf8').split(/\r?\n/);
for (let i = 70; i < 120; i++) {
  console.log(${i+1}: );
}
