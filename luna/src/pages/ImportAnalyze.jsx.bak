import React, { useMemo, useState } from "react";
import "./ImportAnalyze.css";

const CATEGORY_MAP = [
  { key: "housing", match: ["rent", "mortgage", "zillow"] },
  { key: "transport", match: ["uber", "lyft", "shell", "chevron", "exxon", "gas"] },
  { key: "food", match: ["starbucks", "coffee", "mcd", "burger", "wendy", "chipotle", "food", "restaurant"] },
  { key: "shopping", match: ["amazon", "amzn", "target", "walmart", "etsy"] },
  { key: "utilities", match: ["wifi", "verizon", "att", "comcast", "xfinity", "water", "electric", "utility"] },
  { key: "insurance", match: ["insurance", "ins", "geico", "progressive"] },
  { key: "income", match: ["payroll", "salary", "deposit", "paycheck"] },
];

const detectCategory = (desc = "") => {
  const lower = desc.toLowerCase();
  for (const rule of CATEGORY_MAP) {
    if (rule.match.some((m) => lower.includes(m))) return rule.key;
  }
  return "uncategorized";
};

const normalizeAmount = (amt) => {
  const n = Number(amt);
  return Number.isFinite(n) ? n : 0;
};

const parseCsvText = (text) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idxDate = header.findIndex((h) => h.includes("date"));
  const idxDesc = header.findIndex((h) => h.includes("desc"));
  const idxAmt = header.findIndex((h) => h.includes("amount"));
  const idxCat = header.findIndex((h) => h.includes("cat"));
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    const rawAmount = parts[idxAmt] ?? "0";
    const amount = normalizeAmount(rawAmount);
    const desc = parts[idxDesc] ?? "";
    const cat =
      idxCat !== -1 && parts[idxCat]
        ? parts[idxCat].toLowerCase()
        : detectCategory(desc);
    const date = parts[idxDate] ?? "";
    return { date, desc, amount, category: cat };
  });
};

async function parseXlsxFile(file) {
  try {
    // If you want XLSX support, install the optional dependency:
    // npm install xlsx
    if (typeof window === "undefined") {
      throw new Error("XLSX parsing not available in this environment.");
    }
    const XLSX = window.XLSX;
    if (!XLSX) {
      throw new Error("Install the 'xlsx' package and load it to enable Excel parsing.");
    }
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return json.map((row) => {
      const keys = Object.keys(row).reduce((acc, k) => {
        acc[k.toLowerCase()] = row[k];
        return acc;
      }, {});
      const amount = normalizeAmount(keys.amount ?? keys.amt ?? keys.value ?? 0);
      const desc = keys.description ?? keys.desc ?? "";
      const cat = keys.category ?? detectCategory(desc);
      const date = keys.date ?? "";
      return { date, desc, amount, category: String(cat).toLowerCase() };
    });
  } catch (err) {
    throw new Error(
      "XLSX parsing requires the optional 'xlsx' package loaded on window.XLSX. Please upload CSV for now."
    );
  }
}

const ImportAnalyze = ({ onNavigate = () => {}, canGoBack = false }) => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg") {
      setProcessing(true);
      setRows([]);
      try {
        const parsed = await sendToParserAPI(file);
        setRows(parsed.filter((r) => r.amount !== 0));
        setError("");
      } catch (e) {
        setError(
          e?.message ||
            "Could not parse that file. PDF/image parsing requires a backend OCR service; please upload CSV/XLSX for now."
        );
      } finally {
        setProcessing(false);
      }
      return;
    }
    try {
      if (ext === "xlsx" || ext === "xls") {
        const parsedXlsx = await parseXlsxFile(file);
        setRows(parsedXlsx.filter((r) => r.amount !== 0));
        return;
      }
      if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        const parsed = parseCsvText(text);
        setRows(parsed.filter((r) => r.amount !== 0));
        return;
      }
      setError("Unsupported file type. Please upload CSV/XLSX.");
    } catch (e) {
      setRows([]);
      setError(
        e?.message ||
          "Could not read that file. Try a CSV/XLSX with columns: Date, Description, Amount, Category (optional)."
      );
    }
  };

  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const byCat = {};
    rows.forEach((r) => {
      if (r.amount >= 0) income += r.amount;
      else expenses += Math.abs(r.amount);
      const key = r.amount >= 0 ? "income" : r.category;
      byCat[key] = (byCat[key] || 0) + Math.abs(r.amount);
    });
    return { income, expenses, byCat, leftover: income - expenses };
  }, [rows]);

  const categories = useMemo(() => {
    return Object.entries(totals.byCat)
      .filter(([k]) => k !== "income")
      .map(([k, v]) => ({ key: k, total: v }));
  }, [totals.byCat]);

  const pieArcs = useMemo(() => {
    const total = categories.reduce((s, c) => s + c.total, 0);
    if (total <= 0) return [];
    let cumulative = 0;
    return categories.map((c) => {
      const start = cumulative / total;
      cumulative += c.total;
      const end = cumulative / total;
      return {
        key: c.key,
        path: describeArc(50, 50, 45, start * 360, end * 360),
      };
    });
  }, [categories]);

  return (
    <div className="import-page">
      <header className="import-header">
        <div className="top-controls">
          <div className="menu-container">
            <div
              className="hamburger"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
            >
              <div />
              <div />
              <div />
            </div>
            <div className="dropdown-menu" style={{ display: menuOpen ? "block" : "none" }}>
              <a href="/Local/Luna Dashboard">Dashboard</a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onNavigate("snapshot");
                }}
              >
                Debt Snapshot
              </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onNavigate("goals");
                }}
              >
                Goals
              </a>
              <a
                href="#"
                className="active"
                onClick={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                onNavigate("import");
              }}
            >
              Bank Statements
            </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onNavigate("onboarding");
                }}
              >
                Onboarding
              </a>
              <a href="/Local/Settings">Settings</a>
              <a
                href="/Local/Luna Login"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  window.location.replace("/Local/Luna Login");
                }}
              >
                Logout
              </a>
            </div>
          </div>
        </div>
        Bank Statements
      </header>

      {canGoBack && (
        <button className="mobile-back-btn" type="button" onClick={() => onNavigate("back")}>
          &lt;
        </button>
      )}
      <div className="container">
        <div className="card">
          <h2>Upload a CSV</h2>
          <p className="helper">
            Columns: Date, Description, Amount, Category (optional). Amounts: income positive, expenses negative.
            <br />
            CSV/XLSX supported. PDF/images use the parser API when available; otherwise please upload CSV/XLSX.
          </p>
          <label className="upload-area">
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.pdf,image/png,image/jpeg"
              onChange={(e) => handleFile(e.target.files?.[0])}
              style={{ display: "none" }}
            />
            <div>Click to choose a CSV file</div>
            {fileName && <div className="filename">{fileName}</div>}
          </label>
          {processing && <div className="helper">Processing file...</div>}
          {error && <div className="error">{error}</div>}
        </div>

        {rows.length > 0 && (
          <div className="card">
            <h3>Summary</h3>
            <div className="summary-row">
              <span>Total Income</span>
              <b>${totals.income.toFixed(2)}</b>
            </div>
            <div className="summary-row">
              <span>Total Expenses</span>
              <b>${totals.expenses.toFixed(2)}</b>
            </div>
            <div className="summary-row">
              <span>Leftover</span>
              <b>${totals.leftover.toFixed(2)}</b>
            </div>

            <div className="category-list">
              {categories.map((c) => (
                <div key={c.key} className="cat-row">
                  <span>{c.key}</span>
                  <b>${c.total.toFixed(2)}</b>
                </div>
              ))}
            </div>
            {categories.length > 0 && (
              <div className="chart-box">
                <svg viewBox="0 0 100 100" className="pie-chart">
                  {pieArcs.map((arc, idx) => (
                    <path key={arc.key} d={arc.path} className={`slice slice-${idx % 6}`} />
                  ))}
                </svg>
                <div className="chart-legend">
                  {categories.map((c, idx) => (
                    <div key={c.key} className="legend-row">
                      <span className={`legend-swatch slice-${idx % 6}`} />
                      <span>{c.key}</span>
                      <b>${c.total.toFixed(2)}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Helpers for pie chart
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  const d = ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y, "L", x, y, "Z"].join(" ");
  return d;
}

// Placeholder for future backend OCR/parse service
async function sendToParserAPI(file) {
  // Expecting a backend endpoint /api/parse-upload that returns { rows: [{ date, desc, amount, category }] }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/parse-upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Parser service unavailable. Please use CSV/XLSX for now.");
  const data = await res.json();
  if (!data.rows) throw new Error("Parser response invalid. Please use CSV/XLSX for now.");
  return data.rows.map((r) => ({
    date: r.date || "",
    desc: r.desc || r.description || "",
    amount: normalizeAmount(r.amount),
    category: String(r.category || detectCategory(r.desc || "")).toLowerCase(),
  }));
}

export default ImportAnalyze;
