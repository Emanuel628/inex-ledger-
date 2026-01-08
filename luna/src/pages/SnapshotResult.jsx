import React, { useMemo, useState } from "react";
import "./SnapshotResult.css";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { computeSplitPlan } from "../utils/splitPlan";
import { loadCreditCards } from "../utils/creditCardsStorage";
import { runSnowballSimulation } from "../utils/snowball";
import { getPeriodRange } from "../utils/budgetPeriod";
import { readHistoryEntry, readHistoryIndex, getPeriodGapCount } from "../utils/periodHistory";
import { readDebtCashForm } from "../utils/debtStorage";
import { readNamespacedItem } from "../utils/userStorage";

const toNumber = (value) => {
  const cleaned = String(value ?? "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeManualDebts = (stored) => {
  if (!stored) return [];
  if (Array.isArray(stored.manualDebts)) {
    return stored.manualDebts;
  }
  if (stored.housingDebts || stored.carDebts || stored.personalDebts || stored.studentBalance) {
    const debts = [];
    (stored.housingDebts || []).forEach((debt) => debts.push({ ...debt, type: "mortgage" }));
    (stored.carDebts || []).forEach((debt) => debts.push({ ...debt, type: "auto" }));
    (stored.personalDebts || []).forEach((debt) => debts.push({ ...debt, type: "personal" }));
    if (stored.studentBalance) {
      debts.push({
        balance: stored.studentBalance,
        apr: stored.studentApr,
        minPayment: stored.studentDeferred ? "0" : stored.studentMin,
        termMonths: stored.studentTermMonths,
        type: "student",
      });
    }
    return debts;
  }
  if (Array.isArray(stored)) {
    return stored;
  }
  return [];
};

const buildManualDebts = (manualDebts = []) =>
  (manualDebts || [])
    .map((debt, index) => {
      const balance = Math.max(0, toNumber(debt.balance));
      if (!balance) return null;
      return {
        id: debt.id || `manual-${index}`,
        name: debt.name || "Debt",
        balance,
        apr: Math.max(0, toNumber(debt.apr)),
        minPayment: Math.max(0, toNumber(debt.minPayment ?? debt.min)),
        termMonths: toNumber(debt.termMonths) || undefined,
      };
    })
    .filter(Boolean);

const creditCardToDebtEntry = (card) => {
  if (!card) return null;
  const balance = Math.max(0, Number(card.balance) || 0);
  const minPayment = Math.max(0, Number(card.minPayment) || 0);
  if (balance <= 0 && !card.paid) return null;
  return {
    id: card.id || `card-${card.name || "unknown"}`,
    name: card.name || "Credit Card",
    balance,
    apr: Math.max(0, Number(card.apr) || 0),
    minPayment,
  };
};

const buildCreditCardDebts = (cards = []) =>
  (cards || []).map(creditCardToDebtEntry).filter(Boolean);

const loadManualDebts = () => {
  const stored = readDebtCashForm();
  return normalizeManualDebts(stored);
};

const loadLiveBudgetTransactions = () => {
  try {
    const stored = readNamespacedItem("liveBudgetTransactions", "[]");
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const getTimelineMonths = (entries) => {
  if (!entries.length) return null;
  return entries.reduce((max, entry) => {
    const value = entry.endMonth || entry.months || 0;
    return Math.max(max, value);
  }, 0);
};

const SnapshotResult = ({ onNavigate = () => {} }) => {
  const { totals } = useMoneyProfile();
  const { formatCurrency, preferences } = usePreferences();
  const [creditCards] = useState(() => loadCreditCards());
  const [manualDebts] = useState(() => loadManualDebts());
  const [liveTransactions] = useState(() => loadLiveBudgetTransactions());
  const period = useMemo(() => getPeriodRange(preferences, liveTransactions), [preferences, liveTransactions]);
  const historyIndex = useMemo(() => readHistoryIndex(period.mode), [period.mode, period.key]);
  const currentHistory = useMemo(
    () => readHistoryEntry(period.key),
    [period.key, historyIndex.length]
  );
  const lastHistoryKey = historyIndex.length ? historyIndex[historyIndex.length - 1] : null;
  const previousKey =
    lastHistoryKey === period.key
      ? historyIndex[historyIndex.length - 2]
      : historyIndex[historyIndex.length - 1];
  const previousHistory = useMemo(
    () => (previousKey ? readHistoryEntry(previousKey) : null),
    [previousKey]
  );
  const periodGap = useMemo(
    () => getPeriodGapCount(preferences, period.key, previousKey),
    [preferences, period.key, previousKey]
  );
  const incomeConfirmed =
    currentHistory && typeof currentHistory.income === "number" ? currentHistory.income > 0 : false;
  const tierShifted =
    currentHistory?.tier &&
    previousHistory?.tier &&
    currentHistory.tier !== "unknown" &&
    previousHistory.tier !== "unknown" &&
    currentHistory.tier !== previousHistory.tier;

  const splitPlan = useMemo(
    () => computeSplitPlan({ income: totals.income, leftover: totals.leftover }),
    [totals.income, totals.leftover]
  );

  const tier = splitPlan.currentStage;
  const experience = tier?.experience || "You're building your first clear snapshot.";
  const focus = tier?.focus || "Stay steady and keep refining your numbers.";
  const debtEntries = useMemo(() => {
    const cards = buildCreditCardDebts(creditCards);
    const manual = buildManualDebts(manualDebts);
    return [...cards, ...manual].filter((debt) => Number(debt.balance) > 0);
  }, [creditCards, manualDebts]);
  const timeImpact = useMemo(() => {
    const currentExtra = Number(currentHistory?.snowballExtra);
    const prevExtra = Number(previousHistory?.snowballExtra);
    if (!debtEntries.length || !Number.isFinite(currentExtra) || !Number.isFinite(prevExtra)) {
      return null;
    }
    const currentPlan = runSnowballSimulation(debtEntries, currentExtra, 0);
    const previousPlan = runSnowballSimulation(debtEntries, prevExtra, 0);
    const currentMonths = getTimelineMonths(currentPlan);
    const previousMonths = getTimelineMonths(previousPlan);
    if (!currentMonths || !previousMonths) return null;
    const delta = previousMonths - currentMonths;
    if (Math.abs(delta) < 1) {
      return { status: "steady", months: 0 };
    }
    return {
      status: delta > 0 ? "saved" : "extended",
      months: Math.abs(Math.round(delta)),
    };
  }, [debtEntries, currentHistory?.snowballExtra, previousHistory?.snowballExtra]);
  const snapshotNote = useMemo(() => {
    if (periodGap > 0) {
      return "Welcome back - this period starts fresh, and your numbers will update as you log activity.";
    }
    if (!incomeConfirmed) {
      return "Estimates active - income not confirmed yet this period.";
    }
    if (tierShifted) {
      return "Your tier looks different from last month. We'll keep it updated as this month fills in.";
    }
    return "";
  }, [periodGap, incomeConfirmed, tierShifted]);

  return (
    <div className="snapshot-result-page">
        <header className="snapshot-result-hero">
        <p className="snapshot-result-eyebrow">Your Snapshot</p>
        <h1>Here's where you stand</h1>
        <p className="snapshot-result-subtitle">
          This snapshot reflects your raw numbers. Luna continuously models this data so the status stays accurate as
          you refine it.
        </p>
        {snapshotNote && <div className="snapshot-result-note">{snapshotNote}</div>}
      </header>

      <main className="snapshot-result-body">
        <section className="snapshot-result-summary">
          <div className="snapshot-result-card">
            <span>Monthly income</span>
            <strong>{formatCurrency(totals.income)}</strong>
          </div>
          <div className="snapshot-result-card">
            <span>Monthly expenses</span>
            <strong>{formatCurrency(totals.expenses)}</strong>
          </div>
          <div className="snapshot-result-card">
            <span>Leftover each month</span>
            <strong>{formatCurrency(totals.leftover)}</strong>
          </div>
        </section>

        <section className="snapshot-result-tier">
          <h2>Current Tier: {tier.label}</h2>
          <p>{experience}</p>
          <p className="snapshot-result-helper">
            System insight: Your tier is inferred from {formatCurrency(totals.leftover)} leftover against {formatCurrency(
              totals.expenses
            )} expenses—it describes your current state, not a rule.
          </p>
          <div className="snapshot-result-focus">
            <strong>What this status means</strong>
            <span>{focus}</span>
          </div>
        </section>
        {timeImpact && (
          <section className="snapshot-result-time">
            <h2>Time impact</h2>
            {timeImpact.status === "saved" && (
              <p>
                Because your position improved, your payoff timeline shortens by about{" "}
                <strong>{timeImpact.months} month{timeImpact.months === 1 ? "" : "s"}</strong>.
              </p>
            )}
            {timeImpact.status === "extended" && (
              <p>
                This month is tighter, so your payoff timeline stretches by about{" "}
                <strong>{timeImpact.months} month{timeImpact.months === 1 ? "" : "s"}</strong>. Stabilizing your
                leftover brings that time down again.
              </p>
            )}
            {timeImpact.status === "steady" && (
              <p>Your payoff timeline is about the same as last month. Staying steady keeps you on track.</p>
            )}
          </section>
        )}

        <section className="snapshot-result-next">
          <p>
            You can refine these numbers anytime. Your snapshot and plan update automatically as your income,
            expenses, or spending change.
          </p>
          <button
            type="button"
            className="primary-btn purple-save-btn snapshot-result-cta"
            onClick={() => onNavigate("dashboard")}
          >
            Continue to dashboard
          </button>
        </section>
        <p className="helper-note snapshot-disclaimer">
          This page is a deterministic snapshot model of your data and is not individualized financial advice. Your billing identity (email/Stripe) stays in a separate silo from the encrypted vault, linked only by the blind UUID, and you hold the key. Every export, sync, and purge is logged so you can prove how data moved.
        </p>
      </main>
    </div>
  );
};

export default SnapshotResult;
