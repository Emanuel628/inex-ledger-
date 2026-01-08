import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storageManager } from "../../utils/storageManager";
import { buildKey } from "../../utils/userStorage";
import "./ReconciliationExplorer.css";

const REVIEW_STATUS = "needs-review";
const MATCH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const loadTransactions = () => storageManager.get(buildKey("liveBudgetTransactions")) || [];

const findManualCandidate = (txn, pool) => {
  if (!pool.length) return null;
  const txDate = new Date(txn.date || Date.now()).getTime();
  return pool.find((manual) => {
    const manualDate = new Date(manual.date || Date.now()).getTime();
    const delta = Math.abs(manualDate - txDate);
    const amountDelta = Math.abs(Number(manual.amount || 0) - Number(txn.amount || 0));
    return (
      (manual.type === txn.type || txn.type === "expense") &&
      delta <= MATCH_WINDOW_MS &&
      amountDelta <= 1
    );
  });
};

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "$0.00";
  return `$${parsed.toFixed(2)}`;
};

export const ReconciliationExplorer = () => {
  const [queue, setQueue] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [isVisible, setIsVisible] = useState(true);
  const lastQueueLength = useRef(0);

  const refresh = useCallback(() => {
    const transactions = loadTransactions();
    setAllTransactions(transactions);
    setQueue(transactions.filter((txn) => txn.reconciliationStatus === REVIEW_STATUS));
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("live-budget-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("live-budget-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  const manualPool = useMemo(
    () =>
      allTransactions.filter(
        (txn) =>
          !txn.source ||
          txn.source === "manual" ||
          txn.source === "user" ||
          txn.reconciliationStatus === "verified"
      ),
    [allTransactions]
  );

  const updateTransaction = useCallback((id, patch) => {
    const transactions = loadTransactions();
    const next = transactions.map((txn) => (txn.id === id ? { ...txn, ...patch } : txn));
    storageManager.set(buildKey("liveBudgetTransactions"), next);
    window.dispatchEvent(new CustomEvent("live-budget-updated"));
  }, []);

  const handleConfirm = useCallback(
    (txn) => {
      updateTransaction(txn.id, {
        reconciliationStatus: "verified",
        matchConfidence: Math.max((txn.matchConfidence || 0) + 0.1, 0.9),
      });
    },
    [updateTransaction]
  );

  const handleRecategorize = useCallback(
    (txn) => {
      const nextCategory = window.prompt("New category", txn.category || txn.originalName || "Uncategorized");
      if (!nextCategory) return;
      updateTransaction(txn.id, {
        category: nextCategory.trim(),
        reconciliationStatus: "verified",
        matchConfidence: 0.8,
      });
    },
    [updateTransaction]
  );

  const handleExclude = useCallback(
    (txn) => {
      updateTransaction(txn.id, {
        reconciliationStatus: "matched",
        excluded: true,
      });
    },
    [updateTransaction]
  );

  const findMatch = useCallback(
    (txn) => findManualCandidate(txn, manualPool),
    [manualPool]
  );

  useEffect(() => {
    if (queue.length === 0) {
      lastQueueLength.current = 0;
      setIsVisible(false);
      return;
    }
    if (queue.length > lastQueueLength.current) {
      setIsVisible(true);
    }
    lastQueueLength.current = queue.length;
  }, [queue.length]);

  if (!queue.length || !isVisible) return null;

  return (
    <div className="recon-explorer-overlay">
      <div className="recon-explorer-card">
        <header className="recon-header">
          <div>
            <h3>Verify New Activity</h3>
            <p>Track Spending found {queue.length} new transaction(s) that need your attention.</p>
          </div>
          <button
            type="button"
            className="recon-close"
            aria-label="Close verification alert"
            onClick={() => setIsVisible(false)}
          >
            ×
          </button>
        </header>
        <div className="recon-list">
          {queue.map((txn) => {
            const match = findMatch(txn);
            const confidence = Math.round((txn.matchConfidence || 0) * 100);
            return (
              <article key={txn.id} className="recon-item">
                <div className="recon-item-info">
                  <div className="recon-item-name">
                    <strong>{txn.name || txn.originalName || "Bank activity"}</strong>
                    <span>{formatCurrency(txn.amount)}</span>
                  </div>
                  <div className="recon-item-meta">
                    <span>Category: {txn.category || "Uncategorized"}</span>
                    <span>Confidence: {confidence}%</span>
                  </div>
                  {txn.originalName && txn.originalName !== txn.name && (
                    <div className="recon-original">
                      Bank label: <em>{txn.originalName}</em>
                    </div>
                  )}
                  {match && (
                    <div className="recon-match">
                      <strong>Possible match:</strong> {match.name || "Manual entry"} ·{" "}
                      {formatCurrency(match.amount)} · {match.category || "Uncategorized"}
                    </div>
                  )}
                </div>
                <div className="recon-actions">
                  <button type="button" className="btn-confirm" onClick={() => handleConfirm(txn)}>
                    Confirm
                  </button>
                  <button type="button" className="btn-edit" onClick={() => handleRecategorize(txn)}>
                    Recategorize
                  </button>
                  <button type="button" className="btn-exclude" onClick={() => handleExclude(txn)}>
                    Exclude
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ReconciliationExplorer;
