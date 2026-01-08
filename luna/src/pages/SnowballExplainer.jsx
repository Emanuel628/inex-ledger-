import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./SnowballExplainer.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { usePreferences } from "../contexts/PreferencesContext";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { runAvalancheSimulation, runSnowballSimulation } from "../utils/snowball";
import { computeSplitPlan } from "../utils/splitPlan";
import { CREDIT_CARDS_EVENT, loadCreditCards } from "../utils/creditCardsStorage";
import { readDebtCashForm, readDebtPlanType } from "../utils/debtStorage";

const DEBT_TYPES = [
  { key: "mortgage", label: "Mortgage" },
  { key: "auto", label: "Auto Loan" },
  { key: "personal", label: "Personal Loan" },
  { key: "student", label: "Student Loan" },
  { key: "other", label: "Other" },
];

const toNumber = (value) => {
  const cleaned = String(value ?? "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareByName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
const compareSnowball = (a, b) => {
  const balanceA = Number(a.balance) || 0;
  const balanceB = Number(b.balance) || 0;
  if (balanceA !== balanceB) return balanceA - balanceB;
  const aprA = Number(a.apr) || 0;
  const aprB = Number(b.apr) || 0;
  if (aprA !== aprB) return aprA - aprB;
  return compareByName(a, b);
};
const compareAvalanche = (a, b) => {
  const aprA = Number(a.apr) || 0;
  const aprB = Number(b.apr) || 0;
  if (aprA !== aprB) return aprB - aprA;
  const balanceA = Number(a.balance) || 0;
  const balanceB = Number(b.balance) || 0;
  if (balanceA !== balanceB) return balanceA - balanceB;
  return compareByName(a, b);
};

const formatDuration = (months) => {
  if (!months || months <= 0 || !Number.isFinite(months)) return "Variable";
  const yrs = Math.floor(months / 12);
  const mths = Math.round(months % 12);
  const parts = [];
  if (yrs > 0) parts.push(`${yrs} year${yrs === 1 ? "" : "s"}`);
  if (mths > 0) parts.push(`${mths} month${mths === 1 ? "" : "s"}`);
  return parts.length === 0 ? "Less than a month" : parts.join(" and ");
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const formatFinishLabel = (months) => {
  if (!months || months <= 0 || !Number.isFinite(months)) return "Variable";
  const finish = addMonths(new Date(), months);
  return finish.toLocaleString("en-US", { month: "short", year: "numeric" });
};

const getDebtTypeLabel = (type) => {
  const match = DEBT_TYPES.find((item) => item.key === type);
  return match ? match.label : "Debt";
};

const normalizeManualDebts = (stored) => {
  if (!stored) return [];
  if (Array.isArray(stored.manualDebts)) {
    return stored.manualDebts.map((debt) => ({
      id: debt.id,
      type: debt.type,
      balance: debt.balance ?? "",
      apr: debt.apr ?? "",
      minPayment: debt.minPayment ?? "",
      termMonths: debt.termMonths ?? "",
    }));
  }
  if (stored.housingDebts || stored.carDebts || stored.personalDebts || stored.studentBalance) {
    const debts = [];
    (stored.housingDebts || []).forEach((debt) => {
      debts.push({
        id: debt.id,
        type: "mortgage",
        balance: debt.balance ?? "",
        apr: debt.apr ?? "",
        minPayment: debt.min ?? "",
        termMonths: debt.termMonths ?? "",
      });
    });
    (stored.carDebts || []).forEach((debt) => {
      debts.push({
        id: debt.id,
        type: "auto",
        balance: debt.balance ?? "",
        apr: debt.apr ?? "",
        minPayment: debt.min ?? "",
        termMonths: debt.termMonths ?? "",
      });
    });
    (stored.personalDebts || []).forEach((debt) => {
      debts.push({
        id: debt.id,
        type: "personal",
        balance: debt.balance ?? "",
        apr: debt.apr ?? "",
        minPayment: debt.min ?? "",
        termMonths: debt.termMonths ?? "",
      });
    });
    if (stored.studentBalance) {
      debts.push({
        id: stored.studentId || "student-loan",
        type: "student",
        balance: stored.studentBalance ?? "",
        apr: stored.studentApr ?? "",
        minPayment: stored.studentDeferred ? "0" : stored.studentMin ?? "",
        termMonths: stored.studentTermMonths ?? "",
      });
    }
    return debts;
  }
  if (Array.isArray(stored)) {
    return stored.map((debt) => ({
      id: debt.id,
      type: debt.type,
      balance: debt.balance ?? "",
      apr: debt.apr ?? "",
      minPayment: debt.minPayment ?? "",
      termMonths: debt.termMonths ?? "",
    }));
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
        name: getDebtTypeLabel(debt.type),
        balance,
        apr: Math.max(0, toNumber(debt.apr)),
        minPayment: Math.max(0, toNumber(debt.minPayment)),
        termMonths: toNumber(debt.termMonths) || undefined,
        source: "manual",
        type: debt.type,
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
    source: "credit-card",
  };
};

const buildCreditCardDebts = (cards = []) =>
  (cards || []).map(creditCardToDebtEntry).filter(Boolean);

const loadManualDebts = () => {
  const stored = readDebtCashForm();
  return normalizeManualDebts(stored);
};

const SnowballExplainer = ({ onNavigate = () => {} }) => {
  const { formatCurrency, preferences } = usePreferences();
  const { totals } = useMoneyProfile();
  const [creditCards, setCreditCards] = useState(() => loadCreditCards());
  const [manualDebts, setManualDebts] = useState(() => loadManualDebts());
  const [planType, setPlanType] = useState(() => readDebtPlanType());

  useEffect(() => {
    const refreshCards = () => setCreditCards(loadCreditCards());
    window.addEventListener(CREDIT_CARDS_EVENT, refreshCards);
    window.addEventListener("storage", refreshCards);
    return () => {
      window.removeEventListener(CREDIT_CARDS_EVENT, refreshCards);
      window.removeEventListener("storage", refreshCards);
    };
  }, []);

  useEffect(() => {
    const refreshDebts = () => setManualDebts(loadManualDebts());
    window.addEventListener("debt-cash-updated", refreshDebts);
    window.addEventListener("storage", refreshDebts);
    return () => {
      window.removeEventListener("debt-cash-updated", refreshDebts);
      window.removeEventListener("storage", refreshDebts);
    };
  }, []);

  useEffect(() => {
    const refreshPlanType = () => setPlanType(readDebtPlanType());
    window.addEventListener("storage", refreshPlanType);
    return () => window.removeEventListener("storage", refreshPlanType);
  }, []);

  const debtEntries = useMemo(() => buildCreditCardDebts(creditCards), [creditCards]);
  const manualDebtEntries = useMemo(() => buildManualDebts(manualDebts), [manualDebts]);
  const allDebtEntries = useMemo(
    () => [...debtEntries, ...manualDebtEntries],
    [debtEntries, manualDebtEntries]
  );

  const debtEntriesWithBalance = useMemo(
    () => allDebtEntries.filter((debt) => Number(debt.balance) > 0),
    [allDebtEntries]
  );
  const hasDebts = debtEntriesWithBalance.length > 0;

  const totalDebt = useMemo(
    () => debtEntriesWithBalance.reduce((sum, debt) => sum + (Number(debt.balance) || 0), 0),
    [debtEntriesWithBalance]
  );

  const totalMinimums = useMemo(
    () => debtEntriesWithBalance.reduce((sum, debt) => sum + (Number(debt.minPayment) || 0), 0),
    [debtEntriesWithBalance]
  );

  const availableForSnowball = Math.max(0, totals.leftover || 0);
  const baseExtra = availableForSnowball * 0.3;
  const payoffPower = totalMinimums + baseExtra;

  const tierContext = useMemo(
    () => computeSplitPlan({ income: totals.income, leftover: totals.leftover }).currentStage,
    [totals.income, totals.leftover]
  );
  const isThriving = tierContext.key === "traditional";
  const canChoosePlanType = preferences.premiumAccess && isThriving;
  const effectivePlanType = canChoosePlanType ? planType : "snowball";
  const planLabel = effectivePlanType === "avalanche" ? "Avalanche" : "Snowball";
  const planLower = effectivePlanType === "avalanche" ? "avalanche" : "snowball";

  const buildImpactSummary = useCallback((entries) => {
    if (!entries || entries.length === 0) return null;
    const totalInterest = entries.reduce((sum, entry) => sum + (Number(entry.totalInterest) || 0), 0);
    const timelineMonths = entries.reduce((max, entry) => {
      return Math.max(max, entry.endMonth || entry.payoffEstimateMonths || entry.months || 0);
    }, 0);
    return {
      totalInterest,
      finishLabel: formatFinishLabel(timelineMonths),
    };
  }, []);

  const impactSummary = useMemo(() => {
    if (!preferences.premiumAccess || debtEntriesWithBalance.length === 0) return null;
    const snowballEntries = runSnowballSimulation(debtEntriesWithBalance, baseExtra, 0);
    const avalancheEntries = runAvalancheSimulation(debtEntriesWithBalance, baseExtra, 0);
    const snowball = buildImpactSummary(snowballEntries);
    const avalanche = buildImpactSummary(avalancheEntries);
    if (!snowball || !avalanche) return null;
    const savings = Math.max(0, snowball.totalInterest - avalanche.totalInterest);
    return { snowball, avalanche, savings };
  }, [preferences.premiumAccess, debtEntriesWithBalance, baseExtra, buildImpactSummary]);
  const priorityOrder = useMemo(() => {
    const next = [...debtEntriesWithBalance];
    const comparator = effectivePlanType === "avalanche" ? compareAvalanche : compareSnowball;
    next.sort(comparator);
    return next;
  }, [debtEntriesWithBalance, effectivePlanType]);

  const plan = useMemo(() => {
    const entries =
      effectivePlanType === "avalanche"
        ? runAvalancheSimulation(debtEntriesWithBalance, baseExtra, 0)
        : runSnowballSimulation(debtEntriesWithBalance, baseExtra, 0);
    return entries.map((entry, index) => {
      const termOverride = Number(entry.termMonths) || 0;
      const payoffEstimateMonths = termOverride > 0 ? termOverride : entry.months ?? null;
      const endMonth = termOverride > 0 ? termOverride : entry.endMonth;
      return {
        ...entry,
        order: entry.order ?? index + 1,
        payoffEstimateMonths,
        endMonth,
      };
    });
  }, [debtEntriesWithBalance, baseExtra, effectivePlanType]);

  const orderedPlan = useMemo(
    () =>
      priorityOrder
        .map((debt, index) => {
          const entry = plan.find((item) => item.id === debt.id);
          if (!entry) return null;
          return {
            ...entry,
            order: index + 1,
          };
        })
        .filter(Boolean),
    [priorityOrder, plan]
  );

  const currentTargetId = priorityOrder[0]?.id;

  const currentFocusDebt = orderedPlan[0];
  const focusName = currentFocusDebt?.name ?? "your current focus debt";
  const focusMinPayment = currentFocusDebt?.minPayment ?? 0;
  const focusBalance = currentFocusDebt?.balance ?? 0;
  const nextDebt = orderedPlan[1];
  const nextName = nextDebt?.name ?? "the next debt";
  const nextMinPayment = nextDebt?.minPayment ?? 0;
  const extraAfterFocus = baseExtra + focusMinPayment;
  const nextDebtPayment = nextMinPayment + extraAfterFocus;

  const thisMonthRows = useMemo(
    () =>
      orderedPlan.map((entry) => {
        const extra = entry.id === currentTargetId ? baseExtra : 0;
        return {
          id: entry.id,
          name: entry.name,
          minPayment: entry.minPayment,
          extra,
          payThisMonth: entry.minPayment + extra,
        };
      }),
    [orderedPlan, currentTargetId, baseExtra]
  );

  const rolloverSteps = useMemo(() => {
    const steps = [];
    let rolledAmount = 0;
    orderedPlan.forEach((entry, index) => {
      const paymentWhenTarget = entry.minPayment + baseExtra + rolledAmount;
      steps.push({
        id: entry.id,
        step: index + 1,
        name: entry.name,
        minPayment: entry.minPayment,
        rollover: rolledAmount,
        paymentWhenTarget,
        payoffEstimate: entry.payoffEstimateMonths,
      });
      rolledAmount += entry.minPayment;
    });
    return steps;
  }, [orderedPlan, baseExtra]);

  const hasTimeline = plan.length > 0;
  const totalTimelineMonths = hasTimeline
    ? plan[plan.length - 1].payoffEstimateMonths ||
      plan[plan.length - 1].months ||
      plan[plan.length - 1].endMonth ||
      null
    : null;
  const totalTimelineLabel = totalTimelineMonths ? formatDuration(totalTimelineMonths) : "Variable";

  return (
    <div className="snowball-page">
      <TopRightControls
        className="top-controls"
        activePage="snowball-explainer"
        onNavigate={onNavigate}
        logoutHref="/Local/Luna Login"
      />

      <header className="sb-hero">
        <p className="sb-eyebrow">{planLabel} plan</p>
        <h1>Your {planLabel} Plan in Plain English</h1>
        <p className="sb-subtitle">
  {effectivePlanType === "avalanche"
    ? "Highest interest first for efficiency. We still pay every minimum so nothing falls behind."
    : "Smallest balance first for momentum. We still pay every minimum so nothing falls behind."}
</p>
      </header>

      <section className="sb-education">
        <div className="sb-education-grid">
          <article>
            <h3>Snowball</h3>
            <p>Smallest balance first for momentum while every minimum payment stays current.</p>
          </article>
          <article>
            <h3>Avalanche</h3>
            <p>Highest interest first for efficiency, all while keeping the minimums paid on every debt.</p>
          </article>
        </div>
        <p className="sb-education-note">
          Payoff timelines already include future roll-over payments once earlier debts are paid off so the pace
          you see is the pace you can trust.
        </p>
      </section>

      {hasTimeline && (
        <section className="sb-timeline-card">
          <div className="sb-timeline-label">Total timeline (all debts)</div>
          <div className="sb-timeline-value">{totalTimelineLabel}</div>
          <p>
            Because your extra {formatCurrency(baseExtra)} goes to one debt at a time, the timeline already counts the
            freed minimums rolling forward when each balance clears, so it matches what you will actually pay.
          </p>
        </section>
      )}

      <main className="sb-body">
        {hasDebts && (
          <section className="sb-summary">
            <div className="sb-summary-card">
              <span>Debts tracked</span>
              <strong>{debtEntriesWithBalance.length}</strong>
            </div>
            <div className="sb-summary-card">
              <span>Total debt</span>
              <strong>{formatCurrency(totalDebt)}</strong>
            </div>
            <div className="sb-summary-card">
              <span>Monthly plan</span>
              <strong>{formatCurrency(payoffPower)}</strong>
              <small>
                {formatCurrency(totalMinimums)} minimums + {formatCurrency(baseExtra)} {planLower}
              </small>
            </div>
          </section>
        )}

        {hasDebts && impactSummary && (
          <section className="sb-impact-card">
            <div className="sb-impact-header">
              <div>
                <div className="sb-impact-title">Total Impact</div>
                <div className="sb-impact-sub">
                  Compare total interest and debt-free timing with your current inputs.
                </div>
              </div>
            </div>
            <div className="sb-impact-table">
              <div className="sb-impact-row sb-impact-head">
                <span />
                <span>Snowball</span>
                <span>Avalanche</span>
              </div>
              <div className="sb-impact-row">
                <span>Debt free date</span>
                <strong>{impactSummary.snowball.finishLabel}</strong>
                <strong>{impactSummary.avalanche.finishLabel}</strong>
              </div>
              <div className="sb-impact-row">
                <span>Total interest</span>
                <strong>{formatCurrency(impactSummary.snowball.totalInterest)}</strong>
                <strong>{formatCurrency(impactSummary.avalanche.totalInterest)}</strong>
              </div>
              <div className="sb-impact-row">
                <span>Total savings</span>
                <strong>N/A</strong>
                <strong>{formatCurrency(impactSummary.savings)}</strong>
              </div>
            </div>
            <div className="sb-impact-note">
              Snowball favors quicker wins by clearing smaller balances first. Avalanche targets the highest APR first
              to reduce total interest on the biggest leaks. Both plans keep every minimum payment current, so you
              can choose the approach that keeps you most consistent.
            </div>
          </section>
        )}

        <section className="sb-rule">
          <h2>The rule we never break</h2>
          <p>
            Every debt always gets at least its minimum payment. Extra money goes to one target at a time.
          </p>
        </section>

        {hasDebts && (
          <section className="sb-personalized">
            <p>
              Because your tracked debts demand {formatCurrency(totalMinimums)} in minimums and you still have{" "}
              {formatCurrency(availableForSnowball)} leftover, the extra {formatCurrency(baseExtra)} goes to {focusName} without
              touching other obligations.
            </p>
            <p>
              When {focusName} drops to zero, its {formatCurrency(focusMinPayment)} minimum joins the extra so {nextName}
              now receives {formatCurrency(nextDebtPayment)} ({formatCurrency(nextMinPayment)} minimum +{" "}
              {formatCurrency(extraAfterFocus)} added), which is why later payments grow and payoff speeds up.
            </p>
            <p>
              Minimums are fixed obligations totaling {formatCurrency(totalMinimums)}, so freed payments must roll forward and
              the timeline you trust already reflects those roll-overs while updating as your leftover changes.
            </p>
          </section>
        )}

        {!hasDebts && (
          <section className="sb-empty-state">
            <div className="sb-empty-state-card">
              <p className="sb-empty-state-title">Track your debts first</p>
              <p className="sb-empty-state-body">Add your balances in Loans &amp; Payments to unlock the plan details.</p>
              <button type="button" className="sb-primary" onClick={() => onNavigate("total-debt")}>
                Back to Loans &amp; Payments
              </button>
            </div>
          </section>
        )}

        {hasDebts && (
          <section className="sb-current">
            <div className="sb-section-header">
              <h2>This month&#39;s real pay plan</h2>
              <p>These are the payments you make right now. Only the first debt gets the extra payment.</p>
            </div>
            {thisMonthRows.length === 0 ? (
              <div className="sb-empty">Add debts in Loans &amp; Payments to see your plan here.</div>
            ) : (
              <div className="sb-table">
                <div className="sb-row sb-head">
                  <span>Debt</span>
                  <span>Minimum</span>
                  <span>Extra now</span>
                  <span>Pay this month</span>
                </div>
                {thisMonthRows.map((row) => (
                  <div className="sb-row" key={row.id}>
                    <span data-label="Debt">{row.name}</span>
                    <span data-label="Minimum">{formatCurrency(row.minPayment)}</span>
                    <span data-label="Extra now">{formatCurrency(row.extra)}</span>
                    <span data-label="Pay this month">{formatCurrency(row.payThisMonth)}</span>
                  </div>
                ))}
                <div className="sb-row sb-total">
                  <span data-label="Debt">Total</span>
                  <span data-label="Minimum">{formatCurrency(totalMinimums)}</span>
                  <span data-label="Extra now">{formatCurrency(baseExtra)}</span>
                  <span data-label="Pay this month">{formatCurrency(payoffPower)}</span>
                </div>
              </div>
            )}
          </section>
        )}

        {hasDebts && (
          <section className="sb-steps">
            <div className="sb-section-header">
              <h2>How your payments grow and speed things up</h2>
              <p>
                When a debt is paid off, its old minimum payment joins the extra payment on the next debt. That is why
                payoff dates speed up over time.
              </p>
            </div>
            {rolloverSteps.length === 0 ? (
              <div className="sb-empty">Add debts to see your payoff order and roll-over plan.</div>
            ) : (
              <div className="sb-step-grid">
                {rolloverSteps.map((step) => (
                  <article key={step.id} className="sb-step-card">
                    <header>
                      <span className="sb-step-tag">Step {step.step}</span>
                      <h3>{step.name}</h3>
                    </header>
                    <div className="sb-step-row">
                      <span>Minimum payment</span>
                      <strong>{formatCurrency(step.minPayment)}</strong>
                    </div>
                    <div className="sb-step-row">
                      <span>Roll-over added by then</span>
                      <strong>{formatCurrency(step.rollover)}</strong>
                    </div>
                    <div className="sb-step-row">
                      <span>Payment once this becomes the focus</span>
                      <strong>{formatCurrency(step.paymentWhenTarget)}</strong>
                    </div>
                    <div className="sb-step-row">
                      <span>Estimated payoff</span>
                      <strong>{formatDuration(step.payoffEstimate)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {hasDebts && (
        <section className="sb-faq">
          <h2>If you are wondering...</h2>
          <div className="sb-faq-grid">
            <article>
              <h3>Why does my payoff timeline look faster than what I'm paying right now?</h3>
              <p>
                Because the plan already includes future roll-over payments once earlier debts are paid off. The
                timeline assumes those payments stack later.
              </p>
            </article>
            <article>
              <h3>Do these numbers change?</h3>
              <p>
                Yes. If leftover grows, the extra {planLower} grows and payoff speeds up. If leftover shrinks,
                timelines stretch and the plan updates.
              </p>
            </article>
            <article>
              <h3>What if I add more extra money?</h3>
              <p>
                Your extra payment amount increases and the plan recalculates instantly. Every added dollar pushes
                payoff dates forward.
              </p>
            </article>
          </div>
        </section>
        )}

        {hasDebts && (
          <div className="sb-footer">
            <p className="sb-reassure">
              You don't have to memorize any of this. We track it, update it, and do the math for you so the plan always
              stays accurate.
            </p>
            <button type="button" className="sb-primary" onClick={() => onNavigate("total-debt")}>
              Back to Loans &amp; Payments
            </button>
          </div>
        )}

      </main>
    </div>
  );
};

export default SnowballExplainer;







