from pathlib import Path
path = Path('luna/src/pages/Dashboard.jsx')
text = path.read_text()
start = text.index('  const hudSummary')
end = text.index('  return (', start)
new_block = "  const hudSummary =\n    \"You've reached a steady state. Maintain consistency and avoid unnecessary strain while this stability settles.\";\n\n"
path.write_text(text[:start] + new_block + text[end:])
