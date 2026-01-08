const fs = require('fs');
const path = require('path');
const file = path.join('src','pages','Onboarding.jsx');
let text = fs.readFileSync(file, 'utf8');
const start = text.indexOf('            <div className= bubble-grid>');
const end = text.indexOf('            <div className=list-card>', start);
if (start === -1 || end === -1) {
  throw new Error('markers not found');
}
const newBlock = 
            <div className=bubble-grid>
              {QUICK_ENTRY_ITEMS.map((item) => (
                <div key={item.key} className=icon-entry>
                  <button
                    type=button
                    className=icon-bubble
                    onClick={() => handleInlineAdd(item)}
                  >
                    <span>{item.icon}</span>
                    <div className=icon-bubble-label>{item.label}</div>
                  </button>
                  {item.inline && (
                    <div className=inline-controls>
                      <input
                        type=number
                        placeholder=.00
                        value={inlineEntries[item.key]?.amount ?? }
 onChange={(e) => updateInlineEntry(item.key, amount, e.target.value)}
 />
 <select
 value={inlineEntries[item.key]?.frequency}
 onChange={(e) => updateInlineEntry(item.key, frequency, e.target.value)}
 >
 {FREQUENCY_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 </div>
 )}
 </div>
 ))}
 </div>

;
text = text.slice(0, start) + newBlock + text.slice(end);
fs.writeFileSync(file, text);
