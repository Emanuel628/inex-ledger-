from pathlib import Path
import re
path = Path('js/exports.js')
text = path.read_text()
new_block = """function renderExportHistory() {
  const historyList = document.getElementById(\"exportHistoryList\");
  if (!historyList) return;

  const history = getExportHistory()
    .slice()
    .sort((a, b) => new Date(b.exportedAt) - new Date(a.exportedAt));

  if (history.length === 0) {
    historyList.innerHTML = <p class=\"small-note\"><\/p>;
    return;
  }

  historyList.innerHTML = "";
  const rangeLabel = t(\"exports_history_range_label\");
  const exportedOnLabel = t(\"exports_history_exported_on\");

  history.forEach((entry) => {
    const record = document.createElement(\"div\");
    record.className = \"history-record\";
    const startDate = entry.startDate || \"—\";
    const endDate = entry.endDate || \"—\";
    record.innerHTML = 
      <p>
        <strong></strong>
        <strong></strong> – <strong></strong>
      </p>
      <p>
          ·
        <a href=\"#\" class=\"history-link\" data-history-id=\"\">
          
        </a>
      </p>
    ;
    historyList.appendChild(record);
  });
}
"""
pattern = r"function renderExportHistory\(\)[\s\S]*?\n\nfunction formatTimestamp"
replacement = new_block + "\n\nfunction formatTimestamp"
new_text, count = re.subn(pattern, replacement, text, count=1)
if count == 0:
    raise SystemExit('renderExportHistory block not replaced')
path.write_text(new_text)
