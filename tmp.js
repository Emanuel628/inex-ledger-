const fs = require('fs');
const text = fs.readFileSync('js/global.js','utf8');
console.log(text.slice(0, 100));
