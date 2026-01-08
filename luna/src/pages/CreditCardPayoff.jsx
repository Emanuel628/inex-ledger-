import React, { useEffect, useMemo, useState } from "react";
import "./CreditCardPayoff.css";
import { usePreferences } from "../contexts/PreferencesContext";
import { runSnowballSimulation } from "../utils/snowball";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { computeSplitPlan } from "../utils/splitPlan";
import { getPeriodRange, filterTransactionsByPeriod } from "../utils/budgetPeriod";
import TopRightControls from "../components/TopRightControls.jsx";
import {
  CREDIT_CARDS_EVENT,
  loadCreditCards,
  saveCreditCards,
} from "../utils/creditCardsStorage";
import { readNamespacedItem } from "../utils/userStorage";

const TXN_KEY = "liveBudgetTransactions";

const loadLiveBudgetTransactions = () => {
  try {
    const stored = readNamespacedItem(TXN_KEY, "[]");
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const getTransactionType = (txn) =>
  txn.type === "expense" ? (txn.expenseType || "personal") : (txn.incomeType || "personal");

const isPersonalTransaction = (txn) => getTransactionType(txn) === "personal";

const formatDuration = (months) => {
  if (!months || months <= 0 || !Number.isFinite(months)) return "Variable";
  const yrs = Math.floor(months / 12);
  const mths = Math.round(months % 12);
  const parts = [];
  if (yrs > 0) parts.push(`${yrs} year${yrs === 1 ? "" : "s"}`);
  if (mths > 0) parts.push(`${mths} month${mths === 1 ? "" : "s"}`);
  return parts.length === 0 ? "Less than a month" : parts.join(" and ");
};

const CreditCardPayoff = ({ onNavigate = () => {} }) => {
  const { profile } = useMoneyProfile();
  const [cards, setCards] = useState(() => loadCreditCards());
  const [form, setForm] = useState({ name: "", balance: "", apr: "", minPayment: "" });
  const [liveTransactions, setLiveTransactions] = useState(() => loadLiveBudgetTransactions());
  const { formatCurrency, preferences } = usePreferences();
  const period = useMemo(() => getPeriodRange(preferences, liveTransactions), [preferences, liveTransactions]);
  const [confirmCard, setConfirmCard] = useState(null);
  const [confirmStage, setConfirmStage] = useState("pending");

  useEffect(() => {
    const refreshLive = () => setLiveTransactions(loadLiveBudgetTransactions());
    const matchesNamespacedKey = (eventKey, baseKey) =>
      eventKey === baseKey || eventKey?.endsWith(`_${baseKey}`);
    const handleStorage = (e) => {
      if (matchesNamespacedKey(e.key, TXN_KEY)) {
        refreshLive();
      }
    };
    const handleLiveBudget = () => refreshLive();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("live-budget-updated", handleLiveBudget);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("live-budget-updated", handleLiveBudget);
    };
  }, []);

  useEffect(() => {
    const refreshCards = () => setCards(loadCreditCards());
    window.addEventListener(CREDIT_CARDS_EVENT, refreshCards);
    return () => {
      window.removeEventListener(CREDIT_CARDS_EVENT, refreshCards);
    };
  }, []);

  const persistCards = (next) => {
    setCards((prev) => {
      const nextCards = typeof next === "function" ? next(prev) : next;
      saveCreditCards(nextCards);
      return nextCards;
    });
  };

  const markCardPaid = (id, extraApplied = 0) => {
    persistCards((prev) =>
      prev.map((card) =>
        card.id === id
          ? {
              ...card,
              paid: true,
              balance: 0,
              rollForward: Number(card.minPayment) + Number(extraApplied || 0),
            }
          : card
      )
    );
  };

  const handleConfirmYes = () => {
    if (!confirmCard) return;
    const extraApplied = confirmCard.isTarget ? snowballExtraMonthly : 0;
    markCardPaid(confirmCard.id, extraApplied);
    setConfirmStage("done");
  };

  const handleConfirmNo = () => {
    setConfirmCard(null);
    setConfirmStage("pending");
  };

  const closeConfirm = () => {
    setConfirmCard(null);
    setConfirmStage("pending");
  };

  const filterLinked = (list) => (list || []).filter((item) => !item.linkedTxnId);

  const baseIncome = useMemo(
    () =>
      filterLinked(profile.incomes)
        .filter((i) => (i.incomeType || "personal") === "personal")
        .reduce((s, i) => s + (i.monthly ?? i.amount ?? 0), 0),
    [profile.incomes]
  );
  const baseExpenses = useMemo(
    () =>
      filterLinked(profile.expenses)
        .filter((e) => (e.expenseType || "personal") === "personal")
        .reduce((s, e) => s + (e.monthly ?? e.amount ?? 0), 0),
    [profile.expenses]
  );
  const currentPeriodTransactions = useMemo(
    () => filterTransactionsByPeriod(liveTransactions, period),
    [liveTransactions, period]
  );
  const liveIncome = useMemo(
    () =>
      currentPeriodTransactions
        .filter((t) => t.type === "income" && isPersonalTransaction(t) && !t.baselineSync)
        .reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [currentPeriodTransactions]
  );
  const liveExpenses = useMemo(
    () =>
      currentPeriodTransactions
        .filter((t) => t.type === "expense" && isPersonalTransaction(t))
        .reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [currentPeriodTransactions]
  );
  const totals = useMemo(() => {
    const income = baseIncome + liveIncome;
    const expenses = baseExpenses + liveExpenses;
    const leftover = income - expenses;
    return { income, expenses, leftover };
  }, [baseIncome, baseExpenses, liveIncome, liveExpenses]);
  const tierContext = useMemo(() => {
    const stage = computeSplitPlan({ income: totals.income, leftover: totals.leftover }).currentStage;
    const messages = {
      critical: "Focus on steady progress while protecting essentials. Next step: choose one consistent extra payment and keep it going.",
      tight: "Stay consistent and let the snowball build momentum safely. Next step: keep the top card paid first.",
      balanced: "You can push payoff speed without squeezing essentials. Next step: add a little extra to the target balance.",
      traditional: "Optimize payoff order and interest costs for efficiency. Next step: direct extra toward the highest-rate card.",
    };
    return { label: stage.label, message: messages[stage.key] || "" };
  }, [totals.income, totals.leftover]);

  const availableForSnowball = Math.max(0, totals.leftover);

  const debtAllocationPct = 0.3;
  const baseExtra = availableForSnowball * debtAllocationPct;
  const paidRollForward = useMemo(
    () =>
      (cards || [])
        .filter((c) => c.paid)
        .reduce((sum, c) => sum + (Number(c.rollForward) || 0), 0),
    [cards]
  );
  const snowballExtraMonthly = baseExtra + paidRollForward;
  const activeCards = useMemo(
    () => (cards || []).filter((c) => !c.paid && (Number(c.balance) || 0) > 0),
    [cards]
  );
  const plan = useMemo(() => {
    const entries = runSnowballSimulation(activeCards, baseExtra, paidRollForward);
    return entries.map((entry, index) => ({
      ...entry,
      balance: entry.startBalance,
      order: entry.order ?? index + 1,
      isTarget: index === 0,
      payoffEstimateMonths: entry.months ?? null,
    }));
  }, [activeCards, baseExtra, paidRollForward]);

  const totalPrincipal = plan.reduce((sum, card) => sum + (card.startBalance || 0), 0);
  const totalInterestPaid = plan.reduce((sum, card) => sum + (card.totalInterest || 0), 0);
  const totalPayoffCost = totalPrincipal + totalInterestPaid;
  const timelineMonths = plan.reduce((max, card) => Math.max(max, card.endMonth || 0), 0);
  const payoffTimeline = formatDuration(timelineMonths);
  const payoffTimelineLabel = plan.length
    ? payoffTimeline
    : "We’ll show how long your snowball will take once cards are added.";

  const handleAddCard = () => {
    const balance = Number(form.balance) || 0;
    const apr = Number(form.apr) || 0;
    const minPayment = Number(form.minPayment) || 0;
    if (!form.name.trim() || balance <= 0 || minPayment <= 0) {
      return;
    }
    const next = [
      ...cards,
      {
        id: Date.now(),
        name: form.name.trim(),
        balance,
        apr,
        minPayment,
        paid: false,
        rollForward: 0,
      },
    ];
    persistCards(next);
    setForm({ name: "", balance: "", apr: "", minPayment: "" });
  };

  const handleRemoveCard = (id) => {
    persistCards((prev) => prev.filter((card) => card.id !== id));
  };

  const sortedCardsHint = plan.map((card) => `${card.order}. ${card.name}`).join(", ");
  const priorityCard = plan[0];
  const priorityCopy = priorityCard
    ? `First: ${priorityCard.name} - pay ${formatCurrency(
        priorityCard.recommendedPayment
      )} each month; clears the debt in ${
        priorityCard.months ? `${priorityCard.months} ${priorityCard.months === 1 ? "month" : "months"}` : "variable"
      }.`
    : "We’ll rank your debts and show which to pay first once cards are added.";
  const timelineCopy = plan.length
    ? `Your listed ${plan.length === 1 ? "card is" : "cards are"} expected to clear in about ${payoffTimeline} using this plan.`
    : "";

  return (
    <div className="cc-page">
      <TopRightControls
        className="top-controls"
        activePage="credit-payoff"
        onNavigate={onNavigate}
        logoutHref="/Local/BudgetIQ Login"
      />

      <header className="cc-hero cc-hero-center">
        <div className="cc-hero-text">
          <div className="cc-eyebrow">Debt Payoff</div>
          <div className="cc-heading">Snowball guidance grounded in your real numbers</div>
          <p className="cc-subtitle">
            Track your payoff path, direct leftover cash to the smallest balance first, and let each cleared payment strengthen the next.
          </p>
          <p className="cc-tier-note">
            Tier lens: {tierContext.label}. {tierContext.message}
          </p>
        </div>
      </header>


      {totals.leftover < 0 && (
        <div className="cc-negative-banner">Focus on becoming net positive before investing leftover toward debt.</div>
      )}

      <section className="cc-summary-grid">
        <div className="cc-card cc-timeline-card">
          <div className="cc-summary-combined-top">
          <div>
            <div className="cc-label">Leftover</div>
            <div className={`cc-value ${totals.leftover < 0 ? "neg" : ""}`}>{formatCurrency(totals.leftover)}</div>
            <div className="cc-note">Portion of leftover to Snowball (30%): {formatCurrency(baseExtra)}</div>
            <div className="cc-note">Rolled payments: {formatCurrency(paidRollForward)}</div>
            <div className="cc-note">Rolled payments grow as cards are paid off.</div>
            <div className="cc-note">Total snowball power: {formatCurrency(snowballExtraMonthly)}</div>
          </div>
          </div>
          <div className="cc-divider" />
          <div>
            <div className="cc-label">Total payoff timeline</div>
            <div className="cc-timeline-value">{payoffTimelineLabel}</div>
            {timelineCopy && <p className="cc-timeline-note">{timelineCopy}</p>}
            <div className="cc-label">Snowball priority</div>
            <p className="cc-note cc-priority">{priorityCopy}</p>
          </div>
          <div className="cc-divider" />
          <div className="cc-cost-summary">
            <div>
              <div className="cc-label">Projected total cost</div>
              <div className="cc-value">{formatCurrency(totalPayoffCost)}</div>
            </div>
            <p className="cc-note">
              {plan.length
                ? `Includes ${formatCurrency(totalInterestPaid)} interest across ${plan.length} ${plan.length === 1 ? "card" : "cards"}.`
                : "Add cards to see your total payoff cost once everything is cleared."}
            </p>
            <p className="cc-note">If your spending or leftover changes, we'll refresh your payoff roadmap.</p>
          </div>
        </div>
      </section>

      <section className="cc-card cc-plan-card-layout">
        <div className="cc-plan-grid">
          {plan.length === 0 ? (
            <div className="cc-empty">No cards yet. Add one to see the snowball order.</div>
          ) : (
            plan.map((card) => (
              <article key={card.id} className={`cc-plan-card ${card.isTarget ? "is-target" : ""}`}>
                <header className="cc-plan-header">
                  <div>
                    <h3 className="cc-plan-title">{card.name}</h3>
                    <div className="cc-note">Balance: {formatCurrency(card.balance)}</div>
                  </div>
                  <div className="cc-plan-actions">
                    <button
                      className="cc-mark-paid"
                      type="button"
                      onClick={() => {
                        setConfirmCard(card);
                        setConfirmStage("pending");
                      }}
                    >
                      Mark paid
                    </button>
                    <button className="cc-delete" type="button" onClick={() => handleRemoveCard(card.id)}>
                      Remove
                    </button>
                  </div>
                </header>
                <div className="cc-plan-body">
                  <div>
                    <span className="cc-plan-label">Recommended payment</span>
                    <span className="cc-plan-value">{formatCurrency(card.recommendedPayment)}</span>
                  </div>
                  <div>
                    <span className="cc-plan-label">APR</span>
                    <span className="cc-plan-value">{card.apr.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="cc-plan-label">Position</span>
                    <span className="cc-plan-value">{card.order}</span>
                  </div>
                  <div>
                    <span className="cc-plan-label">Payoff estimate</span>
                    <span className="cc-plan-value">
                      {card.payoffEstimateMonths
                        ? `${card.payoffEstimateMonths} ${card.payoffEstimateMonths === 1 ? "month" : "months"}`
                        : "Variable"}
                    </span>
                  </div>
                  <div>
                    <span className="cc-plan-label">Interest estimate</span>
                    <span className="cc-plan-value">{formatCurrency(card.totalInterest)}</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="cc-card cc-form-card">
        <div className="cc-form-header">
          <div>
            <div className="cc-label">Add a credit card</div>
            <div className="cc-note">Each card needs a balance, APR, and minimum payment so we can build your payoff roadmap.</div>
          </div>
        </div>
        <div className="cc-form-fields">
          {["name", "balance", "apr", "minPayment"].map((field) => (
            <label key={field} className="cc-form-field">
              <span>
                {field === "minPayment"
                  ? "Minimum payment"
                  : field === "apr"
                    ? "APR (%)"
                    : field === "name"
                      ? "Card name"
                      : "Balance"}
              </span>
              <input
                type={field === "name" ? "text" : "number"}
                min="0"
                step="0.01"
                value={form[field]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder={field === "name" ? "e.g. Visa" : "0.00"}
              />
            </label>
          ))}
        </div>
        <button className="cc-btn primary cc-add-btn purple-save-btn" type="button" onClick={handleAddCard}>
          Add card
        </button>
      </section>

      {confirmCard && (
        <div className="cc-confirm-overlay" onClick={closeConfirm}>
          <div className="cc-confirm-box" onClick={(e) => e.stopPropagation()}>
            {confirmStage === "pending" ? (
              <>
                <div className="cc-confirm-title">Mark this card as paid?</div>
                <div className="cc-confirm-copy">
                  You&rsquo;re about to mark <strong>{confirmCard.name}</strong> as paid. All future snowball
                  funds will roll into the next balance.
                </div>
                <div className="cc-confirm-actions">
                  <button className="cc-btn primary" type="button" onClick={handleConfirmYes}>
                    Yes
                  </button>
                  <button className="cc-btn secondary" type="button" onClick={handleConfirmNo}>
                    No
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="cc-confirm-title">Congratulations 🎉</div>
                <div className="cc-confirm-copy">
                  That card is now marked as paid. Keep the snowball rolling!
                </div>
                <button className="cc-btn primary cc-confirm-close" type="button" onClick={closeConfirm}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditCardPayoff;
