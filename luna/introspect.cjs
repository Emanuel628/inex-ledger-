const fs = require('fs');
const path = require('path');
const file = path.join('src','pages','Onboarding.jsx');
let text = fs.readFileSync(file, 'utf8');
text = text.replace('openAmountOnlyModal( Gas, Gas, expense)', 'openAmountOnlyModal(Fuel, Fuel, expense)');
text = text.replace('icon-bubble-label>Gas, icon-bubble-label>Fuel');
const waterBlock = '                <div className=icon-bubble onClick={() => openAmountOnlyModal(Water, Water, expense)}>\n                dYs°\n                <div className=icon-bubble-label>Water</div>\n              </div>\n';
const phoneBlock = '              <div className=icon-bubble onClick={() => openAmountOnlyModal(Phone Bill, Phone Bill, expense)}>\n                ?\n                <div className=icon-bubble-label>Phone Bill</div>\n              </div>\n';
if (!text.includes(waterBlock)) {
  throw new Error('water block not found');
}
text = text.replace(waterBlock, waterBlock + phoneBlock);
fs.writeFileSync(file, text);
