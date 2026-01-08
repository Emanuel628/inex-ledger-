const fs=require('fs');
const text=fs.readFileSync('luna/src/pages/BudgetSplit.jsx','utf8');
const start=text.indexOf('const optionalPanels');
console.log(text.slice(start,start+600));
