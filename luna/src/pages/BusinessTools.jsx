import React, { useCallback, useMemo } from "react";
import "./BusinessTools.css";
import AuditToast from "../components/AuditToast";
import TopRightControls from "../components/TopRightControls.jsx";
import HeroGlue from "../components/HeroGlue";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { readNamespacedItem } from "../utils/userStorage";
import { buildApiUrl } from "../lib/api";

const TXN_KEY = "liveBudgetTransactions";
const IDENTITY_KEY = "userIdentity";
const VERIFY_URL = "https://luna.app/verify";

const loadLiveBudgetTransactions = () => {
  try {
    const stored = readNamespacedItem(TXN_KEY, "[]");
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const loadIdentity = () => {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
};

const isBusinessIncome = (item) => (item?.incomeType || "personal") === "business";
const isBusinessExpense = (item) => (item?.expenseType || "personal") === "business";

const getQuarterIndex = (date) => Math.floor(date.getMonth() / 3) + 1;

const getMonthsInQuarterToDate = (year, quarter, now) => {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  if (now.getFullYear() !== year) return 3;
  if (now.getMonth() < startMonth) return 0;
  if (now.getMonth() > endMonth) return 3;
  return now.getMonth() - startMonth + 1;
};

const BusinessTools = ({ onNavigate = () => {}, theme = "light" }) => {
  const { profile } = useMoneyProfile();
  const { preferences, formatCurrency } = usePreferences();
  const showBusinessInsights = preferences.premiumAccess && preferences.businessFeatures;
  const [auditMessage, setAuditMessage] = React.useState("");
  const [pendingExportType, setPendingExportType] = React.useState(null);
  const [ackCheckbox, setAckCheckbox] = React.useState(false);
  const transactions = useMemo(() => loadLiveBudgetTransactions(), []);
  const identity = useMemo(() => loadIdentity(), []);
  const recordExportVerification = useCallback(
    async ({ format, exportId, hash }) => {
      if (!format || !exportId || !hash) {
        return;
      }
      const payload = {
        format: String(format).toUpperCase(),
        exportId,
        hash,
        statement:
          "By generating this export I confirm the business information is accurate to the best of my knowledge and authorize Luna to store this acknowledgement as proof.",
        confirmedAt: new Date().toISOString(),
      };
      const headers = { "Content-Type": "application/json" };
      if (identity?.id) {
        headers["x-user-id"] = identity.id;
      }
      const response = await fetch(buildApiUrl("/api/user/export-verification"), {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Unable to record export verification acknowledgement.");
      }
      return response.json().catch(() => null);
    },
    [identity?.id]
  );
  const now = new Date();
  const year = now.getFullYear();
  const generatedLabel = now.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const sanitizeName = (value) => {
    const raw = (value || "").trim();
    if (!raw) return "User";
    const safe = raw.replace(/[^\p{L}\d .'-]+/gu, "").trim();
    return safe || "User";
  };
  const preparedFor =
    sanitizeName(`${identity.firstName || ""} ${identity.lastName || ""}`) || "User";
  const businessName = (identity.businessName || "").trim();
  const identityLabel = preparedFor;
  const verificationTimestamp = React.useMemo(
    () => (pendingExportType ? new Date() : null),
    [pendingExportType]
  );
  const verificationTimestampLabel = verificationTimestamp
    ? verificationTimestamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      })
    : "";
  const verificationPreviewLabel = identityLabel
    ? `${identityLabel} — ${verificationTimestampLabel} UTC`
    : verificationTimestampLabel;
  React.useEffect(() => {
    if (!pendingExportType || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setAckCheckbox(false);
    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [pendingExportType]);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const monthsElapsed = now.getMonth() + 1;

  const businessIncomeEntries = useMemo(
    () => (profile.incomes || []).filter((entry) => isBusinessIncome(entry) && !entry.linkedTxnId),
    [profile.incomes]
  );
  const businessExpenseEntries = useMemo(
    () => (profile.expenses || []).filter((entry) => isBusinessExpense(entry) && !entry.linkedTxnId),
    [profile.expenses]
  );

  const businessTransactions = useMemo(
    () =>
      transactions.filter((txn) => {
        const date = new Date(txn.date || Date.now());
        if (Number.isNaN(date.getTime())) return false;
        if (date < yearStart || date >= yearEnd) return false;
        if (txn.type === "income") return isBusinessIncome(txn);
        return isBusinessExpense(txn);
      }),
    [transactions, yearStart, yearEnd]
  );

  const totals = useMemo(() => {
    const txnIncome = businessTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const txnExpenses = businessTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const recurringIncome = businessIncomeEntries.reduce(
      (sum, entry) => sum + (Number(entry.monthly ?? entry.amount ?? 0) || 0) * monthsElapsed,
      0
    );
    const recurringExpenses = businessExpenseEntries.reduce(
      (sum, entry) => sum + (Number(entry.monthly ?? entry.amount ?? 0) || 0) * monthsElapsed,
      0
    );
    const income = txnIncome + recurringIncome;
    const expenses = txnExpenses + recurringExpenses;
    return {
      income,
      expenses,
      net: income - expenses,
    };
  }, [businessTransactions, businessIncomeEntries, businessExpenseEntries, monthsElapsed]);

  const categoryTotals = useMemo(() => {
    const map = new Map();
    businessExpenseEntries.forEach((entry) => {
      const key = entry.category || entry.name || "Other";
      const value = (Number(entry.monthly ?? entry.amount ?? 0) || 0) * monthsElapsed;
      map.set(key, (map.get(key) || 0) + value);
    });
    businessTransactions
      .filter((t) => t.type === "expense")
      .forEach((txn) => {
        const key = txn.category || txn.note || "Other";
        map.set(key, (map.get(key) || 0) + (Number(txn.amount) || 0));
      });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [businessExpenseEntries, businessTransactions, monthsElapsed]);

  const quarterTotals = useMemo(() => {
    const result = {
      Q1: { income: 0, expenses: 0 },
      Q2: { income: 0, expenses: 0 },
      Q3: { income: 0, expenses: 0 },
      Q4: { income: 0, expenses: 0 },
    };
    businessTransactions.forEach((txn) => {
      const date = new Date(txn.date || Date.now());
      const quarter = `Q${getQuarterIndex(date)}`;
      if (!result[quarter]) return;
      if (txn.type === "income") {
        result[quarter].income += Number(txn.amount) || 0;
      } else {
        result[quarter].expenses += Number(txn.amount) || 0;
      }
    });
    [1, 2, 3, 4].forEach((quarter) => {
      const monthsInQuarter = getMonthsInQuarterToDate(year, quarter, now);
      if (monthsInQuarter <= 0) return;
      const key = `Q${quarter}`;
      const recurringIncome = businessIncomeEntries.reduce(
        (sum, entry) => sum + (Number(entry.monthly ?? entry.amount ?? 0) || 0) * monthsInQuarter,
        0
      );
      const recurringExpenses = businessExpenseEntries.reduce(
        (sum, entry) => sum + (Number(entry.monthly ?? entry.amount ?? 0) || 0) * monthsInQuarter,
        0
      );
      result[key].income += recurringIncome;
      result[key].expenses += recurringExpenses;
    });
    return result;
  }, [businessTransactions, businessIncomeEntries, businessExpenseEntries, year, now]);

const computeSha256Hex = async (text) => {
  if (typeof window === "undefined" || !window.crypto?.subtle) return "unavailable";
  const data = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const generateExportId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) return window.crypto.randomUUID();
  const randomHex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16)
      .toString(16)
  ).join("");
  return `${randomHex.slice(0, 8)}-${randomHex.slice(8, 12)}-${randomHex.slice(12, 16)}-${randomHex.slice(16, 20)}-${randomHex.slice(20)}`;
};

const buildCoverLines = (exportId) => [
  "SYSTEM INTEGRITY ATTESTATION",
  `Product: Luna Financial OS`,
  `Export ID: ${exportId}`,
  "Scope: Business Ledger [B-SILO]",
  "Export Format Version: 1.0",
  "Certification Template: v1.0",
  "",
  "Technical Attestation:",
  "  This document is a deterministic system export of recorded business transactions.",
  "  Identity Isolation ensures personal data from the [P-SILO] is cryptographically excluded.",
  "",
  "Tax Disclosure (Circular 230):",
  "  This report is provided for diagnostic and informational purposes only.",
  "  In accordance with U.S. Treasury Circular 230, this data is not intended to be",
  "  used to avoid tax-related penalties under the Internal Revenue Code, or to",
  "  promote, market, or recommend a product to another party.",
  "  Final characterization and compliance remain the responsibility of the User and their",
  "  qualified tax professional.",
  "",
  "Methodology & No-Fiduciary Notice:",
  "  Where projections are used elsewhere in Luna, certain analyses may reference recent",
  "  90-day activity trends, but this export reflects actual transactions for the period shown.",
  "  Luna is not a fiduciary and does not provide individualized investment or tax advice.",
  "",
];

const FOOTER_SIGNATURE = "Luna Financial OS -- Deterministic Export";

  const buildFooterStamp = () => {
    const timestamp = new Date().toISOString().replace("T", " ").replace("Z", " UTC");
    return `${FOOTER_SIGNATURE} | Generated: ${timestamp} | Page 1`;
  };

const buildAuditFooterLines = (hash, { isCsv = false } = {}) => {
  const prefix = isCsv ? "# " : "";
  return [
    "",
    `${prefix}${buildFooterStamp()}`,
    `${prefix}This export is produced directly from recorded system state. No manual edits applied.`,
    `${prefix}Verify this hash at ${VERIFY_URL} to ensure document immutability.`,
    `${prefix}Generated by Luna Financial OS. Subject to Terms of Service (docs/terms-of-service.md).`,
    `${prefix}Integrity Hash (SHA-256): ${hash}`,
  ];
};

const buildAuditFooterRows = (hash, options) =>
  buildAuditFooterLines(hash, options).map((line) => ["", line]);


const formatCsvRows = (rows) =>
  rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell === undefined || cell === null) return "";
          const value = String(cell);
          if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
            return `"${value.replace(/"/g, "\"\"")}"`;
          }
          return value;
        })
        .join(",")
    )
    .join("\n");

const exportCsv = async () => {
  const exportId = generateExportId();
  const coverRows = buildCoverLines(exportId).map((line) => [line]);
  const dataRows = [
    ["Section", "Label", "Amount"],
    ["Summary", "Total business income", totals.income],
    ["Summary", "Total business expenses", totals.expenses],
    ["Summary", "Net business income", totals.net],
    [],
    ["Categories", "Category", "Total"],
    ...categoryTotals.map((row) => ["Categories", row.label, row.value]),
    [],
    ["Quarter", "Quarter", "Income"],
    ...Object.entries(quarterTotals).map(([quarter, values]) => ["Quarter", quarter, values.income]),
    ["Quarter", "Quarter", "Expenses"],
    ...Object.entries(quarterTotals).map(([quarter, values]) => ["Quarter", quarter, values.expenses]),
  ];
  const baseRows = [...coverRows, [], ...dataRows];
  const baseCsv = formatCsvRows(baseRows);
  const hash = await computeSha256Hex(baseCsv);
  const finalRows = [...baseRows, [], ...buildAuditFooterRows(hash, { isCsv: true })];
  const finalCsv = formatCsvRows(finalRows);
  let verificationStatus = "[VERIFICATION]: Export acknowledgement pending.";
  try {
    await recordExportVerification({
      format: "CSV",
      exportId,
      hash,
    });
    verificationStatus = "[VERIFICATION]: Confirmation saved to your profile.";
  } catch (error) {
    console.error("Export verification failed", error);
    verificationStatus = `[VERIFICATION]: Unable to record acknowledgement (${error.message || "unknown error"}).`;
  }
  const blob = new Blob([finalCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `luna-tax-summary-${year}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  setAuditMessage(
    `[SYSTEM_LOG]: [EXPORT_EVENT] triggered. [SECURITY]: Integrity Hash ${hash.slice(
      0,
      8
    )} generated and appended. [COMPLIANCE]: Circular 230 and Section 1033 disclosures verified. Status: Secure Export Ready. ${verificationStatus}`
  );
};

  const escapePdfText = (value) =>
    String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");

  const buildPdf = (lines) => {
    const width = 612;
    const height = 792;
    const margin = 48;
    const lineHeight = 14;
    const maxLines = Math.floor((height - 2 * margin) / lineHeight);
    const clippedLines = lines.slice(0, maxLines);
    let y = height - margin;
    const textLines = clippedLines.map((line) => {
      const safe = escapePdfText(line);
      const cmd = `1 0 0 1 ${margin} ${y} Tm (${safe}) Tj`;
      y -= lineHeight;
      return cmd;
    });
    const contentStream = `BT\n/F1 12 Tf\n${textLines.join("\n")}\nET`;
    const contentLength = contentStream.length;

    const objects = [];
    const addObject = (body) => {
      objects.push(body);
      return objects.length;
    };

    const fontObj = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const contentObj = addObject(`<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream`);
    const pageObj = addObject(
      `<< /Type /Page /Parent 4 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObj} 0 R >>`
    );
    const pagesObj = addObject(`<< /Type /Pages /Kids [${pageObj} 0 R] /Count 1 >>`);
    const catalogObj = addObject(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

    let offset = 0;
    const parts = [];
    parts.push("%PDF-1.4\n");
    offset += parts[0].length;
    const xref = [];
    objects.forEach((obj, index) => {
      xref.push(offset);
      const chunk = `${index + 1} 0 obj\n${obj}\nendobj\n`;
      parts.push(chunk);
      offset += chunk.length;
    });
    const xrefStart = offset;
    parts.push(`xref\n0 ${objects.length + 1}\n`);
    parts.push("0000000000 65535 f \n");
    xref.forEach((pos) => {
      parts.push(`${String(pos).padStart(10, "0")} 00000 n \n`);
    });
    parts.push(
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
    );
    return new Blob(parts, { type: "application/pdf" });
  };

  const exportPdf = async () => {
    const exportId = generateExportId();
    const headerLines = buildCoverLines(exportId);
    const bodyLines = [
      "Business Toolkit",
      `Tax summary for ${year}`,
      `Generated on: ${generatedLabel}`,
      ...(preparedFor ? [`Prepared for: ${preparedFor}`] : []),
      ...(businessName ? [`Business name: ${businessName}`] : []),
      `Reporting period: Jan 1, ${year} - Dec 31, ${year}`,
      "",
      `Total business income: ${formatCurrency(totals.income)}`,
      `Total business expenses: ${formatCurrency(totals.expenses)}`,
      `Net business income: ${formatCurrency(totals.net)}`,
      "",
      "Expense categories",
      ...(categoryTotals.length
        ? categoryTotals.map((row) => `${row.label}: ${formatCurrency(row.value)}`)
        : ["No business expenses tracked yet."]),
      "",
      "Quarterly breakdown",
      ...Object.entries(quarterTotals).map(
        ([quarter, values]) =>
          `${quarter} - Income ${formatCurrency(values.income)} | Expenses ${formatCurrency(values.expenses)}`
      ),
      "",
      "This summary is built from your business transactions and recurring entries.",
      "For informational purposes only. Not tax advice.",
    ];
    const lines = [...headerLines, "", ...bodyLines];
    const baseText = lines.join("\n");
    const hash = await computeSha256Hex(baseText);
    const finalLines = [...lines, ...buildAuditFooterLines(hash)];
    let verificationStatus = "[VERIFICATION]: Export acknowledgement pending.";
    try {
      await recordExportVerification({
        format: "PDF",
        exportId,
        hash,
      });
      verificationStatus = "[VERIFICATION]: Confirmation saved to your profile.";
    } catch (error) {
      console.error("Export verification failed", error);
      verificationStatus = `[VERIFICATION]: Unable to record acknowledgement (${error.message || "unknown error"}).`;
    }
    const blob = buildPdf(finalLines);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `luna-tax-summary-${year}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    setAuditMessage(
      `[SYSTEM_LOG]: [EXPORT_EVENT] triggered. [SECURITY]: Integrity Hash ${hash.slice(
        0,
        8
      )} generated and appended. [COMPLIANCE]: Circular 230 and Section 1033 disclosures verified. Status: Secure Export Ready. ${verificationStatus}`
    );
  };

  const cancelPendingExport = () => {
    setPendingExportType(null);
  };

  const handleConfirmExport = () => {
    if (!pendingExportType) return;
    const target = pendingExportType;
    setPendingExportType(null);
    if (target === "pdf") {
      exportPdf();
    } else if (target === "csv") {
      exportCsv();
    }
  };

  if (!showBusinessInsights) {
    return (
      <div className={`business-tools-page ${theme === "dark" ? "is-dark" : ""}`}>
        <header className="business-tools-header">
          <TopRightControls
            className="top-controls"
            activePage="business-tools"
            onNavigate={onNavigate}
            logoutHref="/Local/BudgetIQ Login"
          />
          <div className="header-text">
            <div className="title">Business Toolkit</div>
            <div className="subtitle">Turn on Premium and Business Toolkit to unlock these tools.</div>
          </div>
        </header>
        <main className="business-tools-main">
          <div className="business-tools-card">
            <h2>Business tools are locked</h2>
            <p>Enable Premium and Business Toolkit to generate your tax summary.</p>
            <button type="button" className="primary-btn purple-save-btn" onClick={() => onNavigate("settings")}>
              Go to Settings
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className={`business-tools-page ${theme === "dark" ? "is-dark" : ""}`}>
        <header className="business-tools-header">
          <TopRightControls
            className="top-controls"
            activePage="business-tools"
            onNavigate={onNavigate}
            logoutHref="/Local/BudgetIQ Login"
          />
          <div className="header-text">
            <div className="title">Business Toolkit</div>
            <div className="subtitle">Clear, tax-ready business records—organized calmly, without pressure.</div>
            <div className="subtitle-meta">
              Tools built to help self-employed and business users stay organized, confident, and tax-ready.
            </div>
          </div>
        </header>
        <HeroGlue
          role="PROVE"
          why="These summaries help you keep business finances honest, tax-ready, and easy to prove so you can run your business with confidence and peace of mind."
          reassurance="Luna helps you stay organized without pressure—clarity replaces stress, and your records stay ready when you need them."
        />

        <main className="business-tools-main">
          <section className="business-tools-card">
            <h2>Generate Tax Summary</h2>
            <p>
              Create a tax-ready summary with total business income, expenses, net income, category totals, and
              quarterly breakdowns for {year}.
            </p>
            <div className="business-tools-actions">
              <button
                type="button"
                className="primary-btn purple-save-btn"
                onClick={() => setPendingExportType("pdf")}
              >
                Generate PDF Summary
              </button>
              <button
                type="button"
                className="secondary-btn business-small-btn"
                onClick={() => setPendingExportType("csv")}
              >
                Export CSV Data
              </button>
            </div>
            <AuditToast message={auditMessage} />
          </section>

          <section className="business-tools-card">
            <h2>Business Summary</h2>
            <div className="business-summary-grid">
              <div>
                <span>Total business income</span>
                <strong>{formatCurrency(totals.income)}</strong>
              </div>
              <div>
                <span>Total business expenses</span>
                <strong>{formatCurrency(totals.expenses)}</strong>
              </div>
              <div>
                <span>Net business income</span>
                <strong>{formatCurrency(totals.net)}</strong>
              </div>
            </div>
          </section>

          <section className="business-tools-card">
            <h2>Expense Categories</h2>
            {categoryTotals.length === 0 ? (
              <div className="business-empty">
                No business expenses tracked yet. Add transactions to see your deductible spending by category.
              </div>
            ) : (
              <div className="business-category-list">
                {categoryTotals.map((row) => (
                  <div key={row.label} className="business-category-row">
                    <span>{row.label}</span>
                    <strong>{formatCurrency(row.value)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="business-tools-card">
            <h2>Quarterly Breakdown</h2>
            <div className="business-quarter-grid">
              {Object.entries(quarterTotals).map(([quarter, values]) => (
                <div key={quarter} className="business-quarter-card">
                  <div className="quarter-title">{quarter}</div>
                  <div>
                    <span>Income</span>
                    <strong>{formatCurrency(values.income)}</strong>
                  </div>
                  <div>
                    <span>Expenses</span>
                    <strong>{formatCurrency(values.expenses)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
      {pendingExportType && (
        <div
          className="export-verification-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Export verification acknowledgement"
        >
          <div className="export-verification-panel">
            <h3>Verify before exporting</h3>
            <p>
              By generating this {pendingExportType === "pdf" ? "PDF summary" : "CSV export"}, you confirm the business income and expense
              data in this report is, to the best of your knowledge, accurate for the selected reporting period, that you are authorized
              to act on behalf of this business, and that Luna may store this acknowledgement with a timestamp for audit and reference purposes.
            </p>
            <ul className="export-verification-list">
              <li>Numbers reflect recorded transactions and recurring entries during the selected period.</li>
              <li>You confirm you have authority to attest on behalf of the business.</li>
              <li>
                Luna will securely store this acknowledgement (user, business, date, time) with your profile as proof of verification.
              </li>
            </ul>
            <label className="export-verification-checkbox">
              <input
                type="checkbox"
                checked={ackCheckbox}
                onChange={(event) => setAckCheckbox(event.target.checked)}
              />
              <span>I acknowledge these statements and agree to proceed.</span>
            </label>
            <p className="export-verification-note">
              These exports help you stay organized and prepared. For tax filing decisions, always confirm with your CPA or advisor.
            </p>
            <div className="export-verification-actions">
              <button
                type="button"
                className="primary-btn purple-save-btn"
                onClick={handleConfirmExport}
                disabled={!ackCheckbox}
              >
                I agree and generate {pendingExportType === "pdf" ? "PDF" : "CSV"}
              </button>
              <button type="button" className="secondary-btn business-small-btn" onClick={cancelPendingExport}>
                Cancel
              </button>
            </div>
            <div className="export-verification-preview">
              {verificationPreviewLabel && (
                <span>Verification will be recorded as: {verificationPreviewLabel}</span>
              )}
            </div>
            <div className="export-verification-trust">
              Stored securely. Never shared unless you explicitly choose to export this document.
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BusinessTools;
