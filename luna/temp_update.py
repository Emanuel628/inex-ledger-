from pathlib import Path
path = Path('src/pages/Budget.jsx')
data = path.read_text()
start = data.index('  const tips = [')
end = data.index('  const getTransactionType')
new_block = "  const quickTips = useMemo(() => {\n    const splitTip =\n      plan.mode === \"Critical\"\n        ? \"Critical mode keeps 90% for needs, 5% wants, and 5% savings—lock essentials and pause other spending until you’re positive.\"\n        : plan.mode === \"Steady\"\n        ? \"50/30/20-ish: aim for ~50% needs, 30% wants, 20% building (savings/debt), adjusting to your reality as leftover grows.\"\n        : \"In Thrive mode, keep needs steady, let wants stay purposeful, and let savings/debt-building climb as you roll leftover forward.\";\n    return [\n      {\n        title: \"Essentials First\",\n        body: \"Cover housing, utilities, food, and transport before accelerating other priorities.\",\n      },\n      { title: \"Split Guidance\", body: splitTip },\n      { title: \"Pay Yourself\", body: \"Automate transfers on payday to savings and debt above minimums.\" },\n      {\n        title: \"One Fun Line\",\n        body: \"Give yourself a modest fun bucket to avoid burnout and rebound spending.\",\n      },\n      {\n        title: \"Sinking Funds\",\n        body: \"Save monthly for irregulars: car, medical, gifts, travel, renewals.\",\n      },\n    ];\n  }, [plan.mode]);\n\n"
data = data[:start] + new_block + data[end:]
path.write_text(data)
