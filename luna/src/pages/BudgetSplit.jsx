import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./BudgetSplit.css";
import TopRightControls from "../components/TopRightControls.jsx";
import PayPeriodPlanCard from "../components/PayPeriodPlanCard";
import PlanNotificationBar from "../components/PlanNotificationBar";
import { useAssetProfile } from "../hooks/useAssetProfile";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { computeSplitPlan, SPLIT_GUIDANCE } from "../utils/splitPlan";
import {
  inferPaySchedule,
  PayPeriodPlanner,
  shouldRegeneratePlan,
} from "../lib/payPeriodPlannerService";
import {
  expirePlansIfNeeded,
  getLatestPlan,
  markPlanAcknowledged,
  persistPlan,
} from "../lib/payPeriodPlannerStore";
import { emitPayPeriodPlanReady } from "../lib/payPeriodNotificationService";
import {
  notifyPayPeriodPlanReady,
  notifyTierChange,
  notifyDriftAlert,
  notifyMajorEvent,
} from "../lib/notificationManager";
import { readNamespacedItem, writeNamespacedItem } from "../utils/userStorage";
import { loadCreditCards, CREDIT_CARDS_EVENT } from "../utils/creditCardsStorage";
import { readDebtCashForm } from "../utils/debtStorage";
import { computeFinancialSnapshot } from "../utils/financialTotals";

const SAVED_SPLIT_KEY = "savedBudgetSplit";
const STAGE_TIER_MAP = {
  critical: "critical",
  tight: "fragile",
  balanced: "steady",
  traditional: "thriving",
  sovereign: "thriving",
};

const mapStageKeyToTier = (key) => STAGE_TIER_MAP[key] || "steady";

const SplitGPS = ({ onNavigate = () => {} }) => {
  const { totals, profile } = useMoneyProfile();
  const { formatCurrency, preferences } = usePreferences();
  const { profile: assetProfile } = useAssetProfile();
  const [creditCards, setCreditCards] = useState(() => loadCreditCards());
  const [debtCashForm, setDebtCashForm] = useState(() => readDebtCashForm());
  const financialSnapshot = useMemo(
    () =>
      computeFinancialSnapshot({
        assetProfile,
        profile,
        creditCards,
        manualDebts: debtCashForm,
        expenses: profile.expenses || [],
      }),
    [assetProfile, profile, creditCards, debtCashForm]
  );
  const { totalAssets, totalDebt, netWorth, savingsValue } = financialSnapshot;

  const leftover = totals.leftover ?? 0;
  const formattedLeftover = useMemo(() => formatCurrency(leftover), [formatCurrency, leftover]);
  const income = totals.income;

  const plan = useMemo(() => computeSplitPlan({ income, leftover }), [income, leftover]);
  const {
    allocationRows,
    currentStage,
    nextStage,
    nextThreshold,
    recommendedVariant,
    sliderPercent,
    recommendedAmounts,
  } = plan;
  const currentTier = mapStageKeyToTier(currentStage?.key);
  const previousTierRef = useRef(null);

  useEffect(() => {
    const previous = previousTierRef.current;
    if (previous && currentTier && previous !== currentTier) {
      notifyTierChange(previous, currentTier);
    }
    previousTierRef.current = currentTier;
  }, [currentTier]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refreshCards = () => setCreditCards(loadCreditCards());
    refreshCards();
    window.addEventListener(CREDIT_CARDS_EVENT, refreshCards);
    window.addEventListener("storage", refreshCards);
    return () => {
      window.removeEventListener(CREDIT_CARDS_EVENT, refreshCards);
      window.removeEventListener("storage", refreshCards);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refreshManualDebts = () => setDebtCashForm(readDebtCashForm());
    refreshManualDebts();
    window.addEventListener("debt-cash-updated", refreshManualDebts);
    window.addEventListener("storage", refreshManualDebts);
    return () => {
      window.removeEventListener("debt-cash-updated", refreshManualDebts);
      window.removeEventListener("storage", refreshManualDebts);
    };
  }, []);

  const formatForInput = (value) => (Number.isFinite(value) ? value.toFixed(2) : "0.00");
  const [customAlloc, setCustomAlloc] = useState(() =>
    SPLIT_GUIDANCE.reduce((acc, item) => ({ ...acc, [item.key]: formatForInput(0) }), {})
  );
  const [hasCustomPlan, setHasCustomPlan] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("success");
  const [toastKey, setToastKey] = useState(0);
  const [openPanels, setOpenPanels] = useState(() => []);

  useEffect(() => {
    if (hasCustomPlan) return;
    setCustomAlloc(
      SPLIT_GUIDANCE.reduce(
        (acc, item) => ({ ...acc, [item.key]: formatForInput(recommendedAmounts[item.key]) }),
        {}
      )
    );
  }, [recommendedAmounts, hasCustomPlan]);

  const parseInputAmount = (value) => {
    const cleaned = String(value).replace(/,/g, "");
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : 0;
  };
  const handleCustomChange = (key) => (event) => {
    setCustomAlloc((prev) => ({ ...prev, [key]: event.target.value }));
    setHasCustomPlan(true);
    setStatusMessage("");
  };
  const resetCustomPlan = () => setHasCustomPlan(false);
  const customTotal = useMemo(
    () => Object.values(customAlloc).reduce((sum, value) => sum + parseInputAmount(value), 0),
    [customAlloc]
  );
  const totalDifference = customTotal - Math.max(leftover, 0);

  const incomeSources = (profile.incomes || []).filter((entry) => Number(entry.monthly ?? entry.amount) > 0);
  const expenseItems = (profile.expenses || []).filter((entry) => Number(entry.monthly ?? entry.amount) > 0);
  const incomeEntries = useMemo(
    () =>
      (profile.incomes || [])
        .map((entry) => ({
          amount: Number(entry.monthly ?? entry.amount ?? 0) || 0,
          date: entry.date,
          source: entry.name || entry.incomeType,
        }))
        .filter((item) => Number.isFinite(item.amount)),
    [profile.incomes]
  );

  const customValues = useMemo(
    () =>
      SPLIT_GUIDANCE.reduce((acc, item) => {
        acc[item.key] = parseInputAmount(customAlloc[item.key]);
        return acc;
      }, {}),
    [customAlloc]
  );

  const actualRatios = useMemo(() => {
    if (!customTotal) return {};
    return SPLIT_GUIDANCE.reduce((acc, item) => {
      const percent = (customValues[item.key] / customTotal) * 100;
      acc[item.key] = Number.isFinite(percent) ? percent : 0;
      return acc;
    }, {});
  }, [customTotal, customValues]);

  const recommendedRatios = useMemo(
    () => ({
      needs: recommendedVariant.needs,
      wants: recommendedVariant.wants,
      savings: recommendedVariant.savings,
    }),
    [recommendedVariant]
  );

  const deviationEntries = useMemo(
    () =>
      SPLIT_GUIDANCE.map((item) => ({
        key: item.key,
        label: item.label,
        delta: Math.abs((actualRatios[item.key] || 0) - (recommendedRatios[item.key] || 0)),
      })),
    [actualRatios, recommendedRatios]
  );

  const allWithinRange = useMemo(() => deviationEntries.every((entry) => entry.delta <= 6), [
    deviationEntries,
  ]);
  const maxDeviationEntry = useMemo(() => {
    if (!deviationEntries.length) return null;
    return deviationEntries.reduce((best, entry) => {
      if (!best || entry.delta > best.delta) return entry;
      return best;
    }, null);
  }, [deviationEntries]);

  const splitStatusMessage = useMemo(() => {
    if (!maxDeviationEntry) return "Set custom amounts to see how they compare with the recommendation.";
    if (allWithinRange) {
      return "Your custom split stays within the recommended range.";
    }
    return `${maxDeviationEntry.label} is ${maxDeviationEntry.delta.toFixed(
      1
    )}% away from the recommended ${recommendedRatios[maxDeviationEntry.key]}%.`;
  }, [allWithinRange, maxDeviationEntry, recommendedRatios]);

  const activeRatios = useMemo(() => {
    if (customTotal > 0) {
      return actualRatios;
    }
    return recommendedRatios;
  }, [actualRatios, recommendedRatios, customTotal]);

  const nextTierTarget = useMemo(() => {
    if (!nextStage || !nextThreshold || !Number.isFinite(nextThreshold)) return null;
    if (!Number.isFinite(income) || income <= 0) return null;
    return Math.max(nextThreshold * income, 0);
  }, [nextStage, nextThreshold, income]);

  const emergencyFund = useMemo(() => {
    const stageKey = currentStage?.key;
    const targets = {
      critical: 300,
      tight: 1000,
      balanced: 1000,
      traditional: totals.expenses > 0 ? totals.expenses * 3 : 0,
    };
    const target = targets[stageKey] ?? 1000;
    const messages = {
      critical: "Start with a small buffer before accelerating debt payoff.",
      tight: "A $1,000 buffer protects you from common surprises.",
      balanced: "Protect a $1,000 buffer while you keep progressing.",
      traditional: "Aim for 3 months of essentials for long-term resilience.",
    };
    return { target, message: messages[stageKey] || messages.balanced };
  }, [currentStage, totals.expenses]);

  const accountBalance = Math.max(savingsValue, 0);
  const positiveLeftover = Math.max(leftover, 0);
  const cashAvailable = accountBalance + positiveLeftover;
  const expensesPerWeek = totals.expenses > 0 ? totals.expenses / 4 : 0;
  const coverageWeeks =
    expensesPerWeek > 0
      ? Number(Math.min(99, (cashAvailable / expensesPerWeek).toFixed(1)))
      : null;
  const coverageDays = coverageWeeks ? Math.round(coverageWeeks * 7) : null;
  const coverageMonths = coverageWeeks ? Number((coverageWeeks / 4).toFixed(1)) : null;
  const coverageNarrative = coverageWeeks
    ? `Enough to cover about ${coverageDays} day${coverageDays === 1 ? "" : "s"}${
        coverageDays && coverageDays > 31 ? ` (~${coverageMonths} months)` : ""
      } of essentials.`
    : "Add expenses so this cash can be interpreted confidently.";
  const flowSummary =
    leftover >= 0
      ? "Your system is functioning. Cash is flowing steadily."
      : "Spending has been heavier recently; awareness keeps stability steady.";
  const totalTrackedBalance = Math.max(accountBalance, Math.max(totals.leftover, 0));
  const directionSense = "The map is calm and steady. Keep the habits that protect leftover.";
  const directionPoints = [
    `${incomeSources.length} income source${incomeSources.length === 1 ? "" : "s"}`,
    `${expenseItems.length} expense item${expenseItems.length === 1 ? "" : "s"}`,
  ];
  if (nextStage?.label) {
    directionPoints.push(`Next tier direction: ${nextStage.label}`);
  }
  const getInitialPlan = () => {
    if (typeof window === "undefined") return null;
    expirePlansIfNeeded();
    return getLatestPlan();
  };
  const [latestPlan, setLatestPlan] = useState(getInitialPlan);
  const mountedRef = useRef(false);
  const [planNotification, setPlanNotification] = useState(null);
  const [notificationKey, setNotificationKey] = useState(null);
  const metricsRef = useRef({
    leftover,
    income: totals.income ?? 0,
    expenses: totals.expenses ?? 0,
  });
  const driftCooldownRef = useRef(0);
  const majorEventCooldownRef = useRef(0);

  const regeneratePlan = useCallback(
    (triggerSource) => {
      const now = new Date();
      expirePlansIfNeeded(now);
      const previousPlan = getLatestPlan();
      const tier = mapStageKeyToTier(currentStage?.key);
      const inputs = {
        totals: {
          income: totals.income ?? 0,
          expenses: totals.expenses ?? 0,
          leftover,
        },
        tier,
        triggerSource,
        incomeEntries,
      };
      const scheduleResult = inferPaySchedule(incomeEntries, now);
      if (!shouldRegeneratePlan(previousPlan, inputs, scheduleResult)) {
        setLatestPlan(previousPlan);
        return previousPlan;
      }
      const { plan } = PayPeriodPlanner.generate({
        ...inputs,
        snapshotOverrides: { currency: preferences.currency },
      });
      const persisted = persistPlan(plan);
      setLatestPlan(persisted);
      notifyPayPeriodPlanReady(persisted);
      emitPayPeriodPlanReady(persisted);
      return persisted;
    },
    [currentStage?.key, incomeEntries, leftover, preferences.currency, totals.expenses, totals.income]
  );

  const regeneratePlanRef = useRef(regeneratePlan);
  useEffect(() => {
    regeneratePlanRef.current = regeneratePlan;
  }, [regeneratePlan]);

  useEffect(() => {
    const plan = regeneratePlanRef.current("manual");
    mountedRef.current = true;
    setLatestPlan(plan);
  }, []);

  useEffect(() => {
    if (!latestPlan) return;
    if (notificationKey === latestPlan.id) return;
    if (latestPlan.status.state !== "active") return;
    setNotificationKey(latestPlan.id);
    setPlanNotification(latestPlan);
  }, [latestPlan, notificationKey]);

  const acknowledgePlan = useCallback(() => {
    if (!planNotification) return;
    const acknowledged = markPlanAcknowledged(planNotification.id);
    setLatestPlan(acknowledged ?? latestPlan);
    setPlanNotification(null);
  }, [planNotification, latestPlan]);

  useEffect(() => {
    if (!planNotification || typeof window === "undefined") return;
    const handle = window.setTimeout(() => setPlanNotification(null), 60000);
    return () => window.clearTimeout(handle);
  }, [planNotification]);

  useEffect(() => {
    if (!mountedRef.current) {
      metricsRef.current = {
        leftover,
        income: totals.income ?? 0,
        expenses: totals.expenses ?? 0,
      };
      return;
    }
    const prev = metricsRef.current;
    const current = {
      leftover,
      income: totals.income ?? 0,
      expenses: totals.expenses ?? 0,
    };
    const now = Date.now();
    const leftoverDelta = current.leftover - prev.leftover;
    const leftoverBase = Math.max(Math.abs(prev.leftover), 1);
    const driftRatio = Math.abs(leftoverDelta) / leftoverBase;
    const driftCooldown = 1000 * 60 * 30;
    if (
      driftRatio >= 0.25 &&
      leftoverDelta < 0 &&
      now - driftCooldownRef.current > driftCooldown
    ) {
      notifyDriftAlert(
        Number((driftRatio * 100).toFixed(1)),
        `Leftover shifted from ${prev.leftover} to ${current.leftover}.`
      );
      driftCooldownRef.current = now;
    }

    const majorCooldown = 1000 * 60 * 30;
    const incomeChange = current.income - prev.income;
    const expenseChange = current.expenses - prev.expenses;
    if (
      prev.income > 0 &&
      Math.abs(incomeChange) / Math.max(prev.income, 1) >= 0.4 &&
      now - majorEventCooldownRef.current > majorCooldown
    ) {
      notifyMajorEvent(
        `Income updated from ${prev.income} to ${current.income} this period.`
      );
      majorEventCooldownRef.current = now;
    } else if (
      prev.expenses > 0 &&
      Math.abs(expenseChange) / Math.max(prev.expenses, 1) >= 0.4 &&
      now - majorEventCooldownRef.current > majorCooldown
    ) {
      notifyMajorEvent(
        `Expenses updated from ${prev.expenses} to ${current.expenses} this period.`
      );
      majorEventCooldownRef.current = now;
    }

    metricsRef.current = current;
  }, [leftover, totals.expenses, totals.income]);

  const incomeSignature = useMemo(() => {
    const sum = incomeEntries.reduce((acc, entry) => acc + entry.amount, 0);
    const latestDate = incomeEntries.length ? incomeEntries[0].date || "" : "";
    return `${incomeEntries.length}-${sum}-${latestDate}`;
  }, [incomeEntries]);

  useEffect(() => {
    if (!mountedRef.current) return;
    regeneratePlanRef.current("income");
  }, [incomeSignature]);

  useEffect(() => {
    if (!mountedRef.current) return;
    regeneratePlanRef.current("tierChange");
  }, [currentStage?.key]);
  const optionalPanels = [
    {
      key: "assets",
      title: "Assets & Net Worth",
      summary:
        totalAssets > 0 ? `Assets: ${formatCurrency(totalAssets)}` : "No assets tracked yet.",
      detail:
        savingsValue > 0
          ? `Safety cushion: ${formatCurrency(
              savingsValue
            )}. Net worth: ${formatCurrency(netWorth)} (${formatCurrency(
              totalAssets
            )} assets - ${formatCurrency(totalDebt)} debt) matches the Assets & Net Worth totals.`
          : `Net worth: ${formatCurrency(
              netWorth
            )} (${formatCurrency(totalAssets)} assets - ${formatCurrency(totalDebt)} debt) matches the Assets & Net Worth totals.`,
    },
    {
      key: "cash",
      title: "Savings & Cash Breakdown",
      summary: `Cash buffer: ${formatCurrency(cashAvailable)}`,
      detail: coverageNarrative,
    },
    {
      key: "debt",
      title: "Debt & Payoff Overview",
      summary: "No debts added yet.",
      detail:
        "Add debts when ready to see how payoff fits alongside the rest of your map.",
    },
    {
      key: "income",
      title: "Income & Expense Sources",
      summary: `${incomeSources.length} income source${incomeSources.length === 1 ? "" : "s"} • ${
        expenseItems.length
      } expense item${expenseItems.length === 1 ? "" : "s"}`,
      detail: `Leftover this period: ${formattedLeftover} — keeping both sides visible supports confident decisions.`,
    },
  ];

  const handlePanelToggle = (key) => {
    setOpenPanels((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const deviationMap = useMemo(
    () =>
      deviationEntries.reduce((acc, entry) => {
        acc[entry.key] = entry.delta;
        return acc;
      }, {}),
    [deviationEntries]
  );


  const handleSavePlan = () => {
    if (typeof window === "undefined") return;
    try {
      writeNamespacedItem(SAVED_SPLIT_KEY, JSON.stringify(customAlloc));
      window.dispatchEvent(new Event("budget-split-updated"));
      setHasCustomPlan(true);
      setStatusTone("success");
      setStatusMessage("Saved");
      setToastKey((prev) => prev + 1);
    } catch (error) {
      setStatusTone("error");
      setStatusMessage("Save failed");
      setToastKey((prev) => prev + 1);
    }
  };

  useEffect(() => {
    if (!statusMessage) return;
    const timeoutId = window.setTimeout(() => setStatusMessage(""), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = readNamespacedItem(SAVED_SPLIT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCustomAlloc((prev) => ({ ...prev, ...parsed }));
        setHasCustomPlan(true);
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  return (
    <div className="split-gps-page money-map-page">
      <header className="split-gps-header">
        <TopRightControls
          className="top-controls"
          activePage="split-gps"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="header-text">
          <h1>Money Map</h1>
          <p>A clear picture of where your money lives and how it moves.</p>
        </div>
      </header>
      <section className="money-map-why">
        <h2>Why this matters</h2>
        <p>Seeing your accounts and balances in one place keeps your picture honest and grounded.</p>
        <p>Clarity helps decisions feel calmer—without pressure or judgment.</p>
      </section>

      <main className="split-gps-main money-map-main">
        <section className="money-map-plan-section">
          <div className="money-map-plan-heading">
            <h2>Your plan for this budget period</h2>
            <p>A calm guide based on your real numbers.</p>
            <p className="money-map-plan-subhead">Based on your current budget period.</p>
          </div>
          <PlanNotificationBar plan={planNotification} onDismiss={acknowledgePlan} />
          <PayPeriodPlanCard plan={latestPlan} formatCurrency={formatCurrency} />
        </section>
        <section className="money-map-focus-grid">
          <article className="money-map-card interactive-card">
            <div className="money-map-card-title">Accounts &amp; Connections</div>
            <div className="money-map-card-value">{formatCurrency(totalTrackedBalance)}</div>
            <p className="money-map-card-note">Total across tracked accounts</p>
            <p className="money-map-card-link">Add a bank connection to keep the picture complete.</p>
          </article>

          <article className="money-map-card interactive-card">
            <div className="money-map-card-title">Cash Position</div>
            <div className="money-map-card-value">{formatCurrency(cashAvailable)}</div>
            <p className="money-map-card-note">Cash available</p>
            <p className="money-map-card-copy">{coverageNarrative}</p>
          </article>

          <article className="money-map-card interactive-card">
            <div className="money-map-card-title">Money Flow</div>
            <div className="money-map-flow-path">
              <span>{formatCurrency(totals.income)}</span>
              <span className="money-map-flow-arrow">→</span>
              <span>{formatCurrency(totals.expenses)}</span>
              <span className="money-map-flow-arrow">→</span>
              <span>{formatCurrency(Math.max(leftover, 0))}</span>
            </div>
            <p className="money-map-card-note">Income → Bills → Leftover</p>
            <p className="money-map-card-copy">{flowSummary}</p>
          </article>
        </section>

        <section className="money-map-panels">
          {optionalPanels.map((panel) => {
            const isOpen = openPanels.includes(panel.key);
            return (
              <article key={panel.key} className="money-map-panel interactive-card">
                <div className="money-map-panel-summary">
                  <div>
                    <strong>{panel.title}</strong>
                    <p>{panel.summary}</p>
                  </div>
                  <button
                    type="button"
                    className="money-map-panel-toggle"
                    aria-expanded={isOpen}
                    onClick={() => handlePanelToggle(panel.key)}
                  >
                    {isOpen ? "Hide details" : "Show details"}
                  </button>
                </div>
                {isOpen && (
                  <div className="money-map-panel-body">
                    <p>{panel.detail}</p>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="money-map-direction interactive-card">
          <div>
            <h3>Direction</h3>
            <p>{directionSense}</p>
          </div>
          <ul className="money-map-direction-list">
            {directionPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default SplitGPS;



