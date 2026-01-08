const fs = require('fs');
const path = require('path');
const filePath = path.resolve('luna/src/pages/BudgetSplit.jsx');
let text = fs.readFileSync(filePath, 'utf8');
const pattern = /    {\r\n      key:  income,[\s\S]*?    },/;
