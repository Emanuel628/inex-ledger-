const fs=require('fs');
const text=fs.readFileSync('luna/src/pages/BudgetSplit.jsx','utf8');
const start=text.indexOf('coverageWeeks');
console.log(text.slice(start-60,start+400));
