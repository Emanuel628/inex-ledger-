const fs = require('fs');
const path = 'js/exports.js';
const text = fs.readFileSync(path, 'utf8');
const startMarker = 'function renderExportHistory() {';
const endMarker = 'function describeHistoryEntry';
const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  throw new Error('markers not found');
}
const newBlock = unction renderHistoryDetails(entryId) {
  const historyDetails = document.getElementById( exportHistoryDetails);
  const placeholder = document.getElementById(exportHistoryPlaceholder);
  if (!historyDetails) {
    return;
  }
  const entry = getExportHistory().find((record) => record.id === entryId);
  if (!entry) {
    historyDetails.innerHTML = ;
 historyDetails.classList.remove(active);
 return;
 }

 const rangeLabel = typeof t === function ? t(exports_history_range_label) : Range;
 const exportedOnLabel =
 typeof t === function ? t(exports_history_exported_on) : Exported on;
 const { formatLabel, langLabel } = describeHistoryEntry(entry);
 const startDate = entry.startDate || ---;
 const endDate = entry.endDate || ---;
 const exportedOnText = formatTimestamp(entry.exportedAt);
 historyDetails.innerHTML = 
 <p>
 <strong></strong>
 <strong></strong> to <strong></strong>
 </p>
 <p>
 · 
 </p>
 <p class=small-note>
 Format: · Language: 
 </p>
 <button type=button class=history-replay data-history-id=>
 Re-run export
 </button>
 ;
 historyDetails.classList.add(active);
 if (placeholder) {
 placeholder.hidden = true;
 }
}

function renderExportHistory() {
 const historySelect = document.getElementById(exportHistoryDropdown);
 const placeholder = document.getElementById(exportHistoryPlaceholder);
 if (!historySelect) {
 return;
 }

 const history = getExportHistory()
 .slice()
 .sort((a, b) => new Date(b.exportedAt) - new Date(a.exportedAt));

 if (history.length === 0) {
 historySelect.innerHTML = <option value=></option>;
    historySelect.disabled = true;
    if (placeholder) {
      placeholder.hidden = false;
    }
    const historyDetails = document.getElementById(exportHistoryDetails);
    if (historyDetails) {
      historyDetails.innerHTML = ;
 historyDetails.classList.remove(active);
 }
 return;
 }

 historySelect.disabled = false;
 if (placeholder) {
 placeholder.hidden = true;
 }

 historySelect.innerHTML = ;
  history.forEach((entry) => {
    const { formatLabel, langLabel } = describeHistoryEntry(entry);
    const option = document.createElement(option);
    option.value = entry.id;
    const startDate = entry.startDate || ;
 const endDate = entry.endDate || ;
    option.textContent = ${startDate} ?  ·  · ;
    historySelect.appendChild(option);
  });

  const firstEntryId = history[0].id;
  historySelect.value = firstEntryId;
  renderHistoryDetails(firstEntryId);
}

function replayHistoryEntry(entryId) {
  if (!entryId) {
    return;
  }
  const entry = getExportHistory().find((record) => record.id === entryId);
  if (!entry) {
    return;
  }
  if (entry.format === PDF_FORMAT) {
    exportPdf(entry.startDate, entry.endDate, false, entry.filename, entry.exportLang);
  } else {
    const tier = entry.tier || (entry.format === CSV_FULL_FORMAT ? v1 : free);
    exportCsv(entry.startDate, entry.endDate, false, entry.filename, tier, entry.exportLang);
  }
}
;
const newText = text.slice(0, start) + newBlock + text.slice(end);
fs.writeFileSync(path, newText, utf8);
