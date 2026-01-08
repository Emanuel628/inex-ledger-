import React, { useEffect, useMemo, useState } from "react";
import "./Budget.css";
import { usePreferences } from "../contexts/PreferencesContext";
import TopRightControls from "../components/TopRightControls.jsx";
import { computeSplitPlan } from "../utils/splitPlan";
import { getPeriodRange, filterTransactionsByPeriod } from "../utils/budgetPeriod";
import { readHistoryIndex, getPeriodGapCount } from "../utils/periodHistory";
import {
  expirePlansIfNeeded,
  getLatestPlan,
  onPlanUpdate,
} from "../lib/payPeriodPlannerStore";
import { buildKey, readNamespacedItem, writeNamespacedItem } from "../utils/userStorage";
const MODE_KEY = "budgetMode";
const TXN_KEY = "liveBudgetTransactions";
const SAVED_SPLIT_KEY = "savedBudgetSplit";
const BEST_LEFTOVER_KEY = "budgetBestLeftover";
const DEFAULT_PROFILE = {
  incomes: [],
  expenses: [],
  savingsBalance: "",
  savingsMonthly: "",
};

const readStoredProfile = () => {
  try {
    const stored = readNamespacedItem("moneyProfile");
    if (!stored) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch (e) {
    return { ...DEFAULT_PROFILE };
  }
};

const loadLiveBudgetTransactions = () => {
  try {
    const stored = readNamespacedItem(TXN_KEY, "[]");
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};
const MILESTONE_GUIDANCE = [
  "Leftover is zero or negative; lock in essentials, pause joy/lifestyle, and bring in quick cash to get a positive buffer.",
  "Build a consistent positive leftover and hold it for 90 days before adding new goals.",
  "Grow leftover toward your next tier target by trimming durable spending or bringing in extra income.",
  "Beat your best leftover by repeating the behaviors that grew your leftover value; small wins add up fast.",
];
const DEFICIT_MESSAGE = {
  deficit:
    "System Deficit detected. Negative cash flow forces us to protect essentials, pause optional spending, and rebuild a positive buffer before splitting leftover.",
  lean:
    "Lean cash flow detected. Prioritize essentials, keep splittable dollars minimal, and rebuild a stable buffer before expanding the plan.",
};

  const PLAN_ROLE = "Plan";
  const PLAN_REASON =
    "This split keeps leftover aligned across stability, debt, and savings.";
  const PLAN_REASSURANCE = "Calm targets protect essentials and keep progress steady.";

const formatNumberInput = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/,/g, "");
  if (str === "") return "";
  const [intPart, decPart] = str.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
};

const loadPlannerPlan = () => {
  expirePlansIfNeeded();
  return getLatestPlan();
};

const Budget = ({ onNavigate = () => {} }) => {
  const { formatCurrency, preferences } = usePreferences();
  const [lastMode, setLastMode] = useState(() => readNamespacedItem(MODE_KEY, "") || "");
  const [profile, setProfile] = useState(() => readStoredProfile());
  const [liveTransactions, setLiveTransactions] = useState(() => loadLiveBudgetTransactions());
  const [showPeriodNotices, setShowPeriodNotices] = useState(true);
  const period = useMemo(() => getPeriodRange(preferences, liveTransactions), [preferences, liveTransactions]);
  const periodLabel = useMemo(() => {
    if (!period?.start || !period?.end) return "";
    const end = new Date(period.end);
    end.setDate(end.getDate() - 1);
    const opts = { month: "short", day: "numeric" };
    const startLabel = period.start.toLocaleDateString(undefined, opts);
    const endLabel = end.toLocaleDateString(undefined, opts);
    if (startLabel === endLabel) return `Current period: ${startLabel}`;
    return `Current period: ${startLabel} - ${endLabel}`;
  }, [period]);

  useEffect(() => {
    const reloadLiveTransactions = () => setLiveTransactions(loadLiveBudgetTransactions());
    const onStorage = (e) => {
      if (e.key === TXN_KEY) reloadLiveTransactions();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("live-budget-updated", reloadLiveTransactions);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("live-budget-updated", reloadLiveTransactions);
    };
  }, []);

  const getTransactionType = (txn) =>
    txn.type === "expense" ? txn.expenseType || "personal" : txn.incomeType || "personal";
  const isPersonalTransaction = (txn) => getTransactionType(txn) === "personal";

  const personalProfileIncomes = useMemo(
    () =>
      (profile.incomes || []).filter(
        (i) => !i.linkedTxnId && (i.incomeType || "personal") === "personal"
      ),
    [profile.incomes]
  );
  const personalProfileExpenses = useMemo(
    () =>
      (profile.expenses || []).filter(
        (e) => !e.linkedTxnId && (e.expenseType || "personal") === "personal"
      ),
    [profile.expenses]
  );
  const businessProfileExpenses = useMemo(
    () =>
      (profile.expenses || []).filter(
        (e) => !e.linkedTxnId && (e.expenseType || "personal") === "business"
      ),
    [profile.expenses]
  );
  const baseIncome = useMemo(
    () => personalProfileIncomes.reduce((s, i) => s + (i.monthly ?? i.amount ?? 0), 0),
    [personalProfileIncomes]
  );
  const baseExpenses = useMemo(
    () => personalProfileExpenses.reduce((s, e) => s + (e.monthly ?? e.amount ?? 0), 0),
    [personalProfileExpenses]
  );
  const personalMonthlyBurn = useMemo(
    () =>
      personalProfileExpenses.reduce(
        (sum, exp) => sum + (Number(exp.monthly ?? exp.amount ?? 0) || 0),
        0
      ),
    [personalProfileExpenses]
  );
  const businessMonthlyBurn = useMemo(
    () =>
      businessProfileExpenses.reduce(
        (sum, exp) => sum + (Number(exp.monthly ?? exp.amount ?? 0) || 0),
        0
      ),
    [businessProfileExpenses]
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
  const isDeficit = totals.leftover < 0;
  const historyIndex = useMemo(
    () => readHistoryIndex(period.mode),
    [period.mode, currentPeriodTransactions.length]
  );
  const lastHistoryKey = historyIndex.length ? historyIndex[historyIndex.length - 1] : null;
  const periodGap = useMemo(
    () => getPeriodGapCount(preferences, period.key, lastHistoryKey),
    [preferences, period.key, lastHistoryKey]
  );
  const hasCurrentPeriodActivity = currentPeriodTransactions.length > 0;
  const needsIncomeConfirmation = liveIncome === 0 && baseIncome > 0;

  useEffect(() => {
    if (!hasCurrentPeriodActivity || needsIncomeConfirmation) {
      setShowPeriodNotices(true);
      const timer = setTimeout(() => setShowPeriodNotices(false), 45000);
      return () => clearTimeout(timer);
    }
    setShowPeriodNotices(false);
    return undefined;
  }, [hasCurrentPeriodActivity, needsIncomeConfirmation]);
  const savingsBalance = useMemo(
    () => Number(profile.savingsBalance) || 0,
    [profile.savingsBalance]
  );
  const splitPlan = useMemo(
    () => computeSplitPlan({ income: totals.income, leftover: totals.leftover }),
    [totals.income, totals.leftover]
  );
  useEffect(() => {
    console.log("Budget totals", totals);
    console.log("Split plan", splitPlan);
  }, [totals, splitPlan]);
  const [savedSplit, setSavedSplit] = useState(null);
  const [starterOpen, setStarterOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [plannerPlan, setPlannerPlan] = useState(() => loadPlannerPlan());

  useEffect(() => {
    const refreshPlan = () => setPlannerPlan(loadPlannerPlan());
    return onPlanUpdate(refreshPlan);
  }, []);

  const parseSplitValue = (value) => {
    const cleaned = String(value ?? "").replace(/,/g, "");
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadSavedSplit = () => {
      try {
        const stored = readNamespacedItem(SAVED_SPLIT_KEY);
        setSavedSplit(stored ? JSON.parse(stored) : null);
      } catch (e) {
        setSavedSplit(null);
      }
    };
    loadSavedSplit();
    window.addEventListener("storage", loadSavedSplit);
    window.addEventListener("budget-split-updated", loadSavedSplit);
    return () => {
      window.removeEventListener("storage", loadSavedSplit);
      window.removeEventListener("budget-split-updated", loadSavedSplit);
    };
  }, []);

  const plannerSummaryLine = plannerPlan?.recommendation.summaryLine;
  const plannerSupportLine = plannerPlan?.recommendation.supportiveLine;
  const plannerStatusLabel = plannerPlan
    ? plannerPlan.status.state === "active"
      ? "Plan active"
      : "Plan recorded"
    : "Plan pending";
  const plannerAllocations = useMemo(() => {
    if (!plannerPlan) return [];
    const rec = plannerPlan.recommendation;
    return [
      { label: "Buffer", value: rec.buffer },
      { label: "Debt progress", value: rec.debt },
      { label: "Breathing room", value: rec.breathingRoom },
    ];
  }, [plannerPlan]);
  const plannerRationale = plannerPlan?.status.rationale;

  const customSplitValues = useMemo(() => {
    if (!savedSplit || typeof savedSplit !== "object") return null;
    const keys = ["needs", "wants", "savings"];
    const values = keys.reduce((acc, key) => {
      acc[key] = parseSplitValue(savedSplit[key]);
      return acc;
    }, {});
    const total = values.needs + values.wants + values.savings;
    if (total <= 0) return null;
    return { values, total };
  }, [savedSplit]);
  const starterAllocations = useMemo(() => {
    const leftover = Math.max(totals.leftover, 0);
    return splitPlan.allocationRows.map((row) => {
      if (customSplitValues?.values && customSplitValues.values[row.key] > 0) {
        const customAmount = customSplitValues.values[row.key];
        const customTotal = customSplitValues.total || 0;
        const normalizedAmount =
          customTotal > 0 && leftover > 0 ? (customAmount / customTotal) * leftover : customAmount;
        const normalizedRatio = leftover > 0 ? normalizedAmount / leftover : row.ratio;
        const percent = leftover > 0 ? Math.round(normalizedRatio * 100) : 0;
        return {
          label: row.label,
          value: `${percent}% of leftover`,
          detail: row.detail,
          amount: normalizedAmount,
          ratio: normalizedRatio,
        };
      }
      return {
        label: row.label,
        value: `${Math.round(row.ratio * 100)}% of leftover`,
        detail: row.detail,
        amount: row.amount,
      };
    });
  }, [customSplitValues, splitPlan, totals.leftover]);

  const plan = useMemo(() => {
    const { income, expenses, leftover } = totals;
    const stageKey = splitPlan.currentStage?.key || "critical";
    const stageLabel = splitPlan.currentStage?.label || "Critical / Survival";

    if (leftover <= 0 || income === 0 || stageKey === "critical") {
      return {
        mode: "critical",
        title: stageLabel,
        allocations: [
          {
            label: "Bare Essentials",
            value: "Keep: housing, utilities, food, transport",
            detail:
              "Pay rent/mortgage, basic utilities, groceries, and the transport you actually need for work. Pause everything else until cash flow is positive.",
          },
          {
            label: "Trim Joy / Lifestyle",
            value: "Cut joy/lifestyle for 60-90 days",
            detail: "Freeze eating out, subscriptions, impulse buys, and upgrades. Set a hard weekly cash cap for anything discretionary.",
          },
          {
            label: "Quick Cash Boost",
            value: "Sell 1-2 items + extra shifts",
            detail:
              "List unused electronics/furniture locally, and add short-term overtime/side shifts to create a fast $300-$700 buffer within 2-3 weeks.",
          },
          {
            label: "Debt Strategy",
            value: "Avalanche on highest APR",
            detail:
              "Keep every minimum on auto-pay to avoid fees, then throw every spare dollar at the highest-interest balance first. Call lenders to ask for lower rates or hardship plans.",
          },
        ],
        tone: "Focus on essentials and small wins until cash flow turns positive. We'll expand the plan once it's stable.",
      };
    }

    if (stageKey === "tight" || stageKey === "balanced") {
      return {
        mode: stageKey,
        title: stageLabel,
        allocations: [
          {
            label: "Debt Above Minimums",
            value: "50% of leftover + hybrid",
            pct: 0.5,
            detail:
              "Pay minimums on auto, then target the highest APR. If motivation lags, clear a small balance first, then return to highest APR to minimize interest.",
          },
          {
            label: "Emergency Buffer",
            value: "30% of leftover + $1k-$3k",
            pct: 0.3,
            detail: "Auto-transfer on payday into savings until you hit $1k-$3k. Keep this in a HYSA for instant access.",
          },
          {
            label: "Goals/Fun",
            value: "20% leftover",
            pct: 0.2,
            detail: "Pick 1-2 goals only. Keep a tiny fun line (even $10-$20/week) to avoid burnout while you build momentum.",
          },
        ],
        tone: "Stay consistent for 90-180 days, then revisit percentages.",
      };
    }

    if (stageKey === "traditional") {
      return {
        mode: "traditional",
        title: stageLabel,
        allocations: [
          {
            label: "Emergency Growth",
            value: "10-20% leftover",
            pct: 0.15,
            detail:
              "Grow to 3-6 months of expenses in a HYSA. Keep one month instantly accessible; rest can be in a high-yield account.",
          },
          {
            label: "Debt Payoff",
            value: "40-50% leftover",
            pct: 0.45,
            detail:
              "Attack the highest interest balance; refinance if possible. Keep auto-pay minimums on everything else.",
          },
          {
            label: "Investing",
            value: "Always take the match",
            detail:
              "Even in payoff mode, capture employer 401k/403b match. After the match, focus leftover cash on high-APR debt until it's gone.",
          },
          {
            label: "Goals/Fun",
            value: "10-20% leftover",
            pct: 0.15,
            detail:
              "Automate transfers for 1-2 goals (move, car, trip) and a small lifestyle bucket to prevent creep and keep morale high.",
          },
        ],
        tone: "Lean into growth while protecting the habits that keep you consistent.",
      };
    }

    if (stageKey === "sovereign") {
      return {
        mode: "sovereign",
        title: "Sovereign Status",
        allocations: [
          {
            label: "Lifestyle Capping",
            value: "Keep expenses flat as income climbs",
            detail:
              "You’ve optimized your life—every future raise should shift into Progress or Opportunity, not lifestyle creep.",
          },
          {
            label: "Opportunity Fund",
            value: "12 months of expenses",
            detail:
              "This isn't an emergency stash. It's strike capital for major moves: investments, business pivots, or a bold career shift.",
          },
          {
            label: "Asset Velocity",
            value: "Debt liquidation & income assets",
            detail:
              "Debt is your only anchor now. Target remaining low-interest balances or pour surplus into income-producing, tax-advantaged assets.",
          },
        ],
        tone:
          "Sovereignty is maintained, not earned once. Guard the 50% margin and keep directing surplus toward opportunity.",
      };
    }

    return {
      mode: "traditional",
      title: stageLabel,
      allocations: [
        {
          label: "Emergency Growth",
          value: "10-20% leftover",
          pct: 0.15,
          detail:
            "Grow to 3-6 months of expenses in a HYSA. Keep one month instantly accessible; rest can be in a high-yield account.",
        },
        {
          label: "Debt Payoff",
          value: "40-50% leftover",
          pct: 0.45,
          detail:
            "Attack the highest interest balance; refinance if possible. Keep auto-pay minimums on everything else.",
        },
        {
          label: "Investing",
          value: "Always take the match",
          detail:
            "Even in payoff mode, capture employer 401k/403b match. After the match, focus leftover cash on high-APR debt until it's gone.",
        },
        {
          label: "Goals/Fun",
          value: "10-20% leftover",
          pct: 0.15,
          detail:
            "Automate transfers for 1-2 goals (move, car, trip) and a small lifestyle bucket to prevent creep and keep morale high.",
        },
      ],
      tone: "Lean into growth while protecting the habits that keep you consistent.",
    };
  }, [totals, splitPlan]);

  const emergencyFund = useMemo(() => {
    const stageKey = splitPlan.currentStage?.key;
    const targets = {
      critical: 300,
      tight: 1000,
      balanced: 1000,
      traditional: totals.expenses > 0 ? totals.expenses * 3 : 0,
      sovereign: totals.expenses > 0 ? totals.expenses * 12 : 0,
    };
    const target = targets[stageKey] ?? 1000;
    const messages = {
      critical:
        "Start small. Even a small amount matters. Build toward a $300 safety cushion so surprises do not derail you.",
      tight:
        "You are stabilizing. Aim for a $1,000 buffer next to cover common surprises.",
      balanced:
        "You are building momentum. A $1,000 buffer protects steady progress.",
      traditional:
        "You are in a strong place. Aim for 3 months of essentials to secure long-term resilience.",
      sovereign:
        "Sovereign status means your margin is strong. Build a 12-month opportunity fund to stay unstoppable.",
    };
    const multiplier =
      stageKey === "traditional" && totals.expenses > 0
        ? 3
        : stageKey === "sovereign" && totals.expenses > 0
        ? 12
        : null;
    return {
      target,
      message: messages[stageKey] || messages.balanced,
      multiplier,
    };
  }, [splitPlan.currentStage, totals.expenses]);

  const emergencyFundBasis = useMemo(() => {
    const stageKey = splitPlan.currentStage?.key;
    if (stageKey === "traditional" && totals.expenses > 0) {
      return `Based on monthly expenses (${formatCurrency(totals.expenses)}) × 3`;
    }
    if (stageKey === "sovereign" && totals.expenses > 0) {
      return `Based on monthly expenses (${formatCurrency(totals.expenses)}) × 12 (Opportunity Fund)`;
    }
    const fixedTargets = {
      critical: "Fixed $300 target",
      tight: "Fixed $1,000 target",
      balanced: "Fixed $1,000 target",
      sovereign: "Annual Opportunity Fund target",
    };
    return fixedTargets[stageKey] || "Fixed $1,000 target";
  }, [splitPlan.currentStage, totals.expenses, formatCurrency]);

  const emergencyProgress = useMemo(() => {
    if (!emergencyFund.target) return 0;
    return Math.min(savingsBalance / emergencyFund.target, 1);
  }, [savingsBalance, emergencyFund.target]);
  const totalSystemBurnValue = personalMonthlyBurn + businessMonthlyBurn;
  const totalSystemBurn =
    totalSystemBurnValue > 0 ? totalSystemBurnValue : totals.expenses || 0;
  const systemLiquidityPercent = emergencyFund.target
    ? Math.min((savingsBalance / emergencyFund.target) * 100, 100)
    : 0;

  const sovereignTips = useMemo(
    () => [
      {
        title: "Lifestyle Capping",
        body: "Every dollar of future raises should go straight to Progress or Opportunity. You've already optimized your life; now optimize your freedom.",
      },
      {
        title: "Opportunity Fund",
        body: "Shift your Stability target to 12 months. This isn't a safety net—it is 'strike' capital for when life-changing chances appear.",
      },
      {
        title: "Asset Velocity",
        body: "Your surplus is a powerful engine. Focus on tax-advantaged growth and liquidity-rich assets to keep the momentum going.",
      },
    ],
    []
  );

  const quickTips = useMemo(() => {
    if (plan.mode === "sovereign") {
      return sovereignTips;
    }
    const splitTip =
      plan.mode === "critical"
        ? "Critical mode protects essentials first, keeps joy/lifestyle minimal, and builds a small buffer as cash flow improves."
        : plan.mode === "tight" || plan.mode === "balanced"
        ? "Leftover split: prioritize stability, keep joy/lifestyle intentional, and build steady progress (savings & debt)."
        : "In Traditional mode, keep stability/buffer steady, keep joy/lifestyle purposeful, and keep growing progress (savings & debt) using leftover momentum.";
    return [
      {
        title: "Essentials First",
        body: "Cover housing, utilities, food, and transport before accelerating other priorities.",
      },
      { title: "Split Guidance", body: splitTip },
      { title: "Pay Yourself", body: "Automate transfers on payday to savings and debt above minimums." },
      {
        title: "One Fun Line",
        body: "Give yourself a modest fun bucket to avoid burnout and rebound spending.",
      },
      {
        title: "Sinking Funds",
        body: "Save monthly for irregulars: car, medical, gifts, travel, renewals.",
      },
    ];
  }, [plan.mode, sovereignTips]);

  useEffect(() => {
    if (!plan.mode) return;
    if (plan.mode !== lastMode) {
      try {
        writeNamespacedItem(MODE_KEY, plan.mode);
      } catch (e) {
        /* ignore */
      }
      setLastMode(plan.mode);
    }
  }, [plan.mode, lastMode]);

  const milestones = useMemo(() => {
    const { income, leftover } = totals;
    const bestKey = BEST_LEFTOVER_KEY;
    let best = 0;
    try {
      const stored = readNamespacedItem(bestKey, "0");
      best = Number(stored) || 0;
    } catch (e) {
      best = 0;
    }
    if (leftover > best) {
      try {
        writeNamespacedItem(bestKey, String(leftover));
      } catch (e) {
        /* ignore */
      }
      best = leftover;
    }

    const nextTierRatio = splitPlan?.nextThreshold;
    const nextTierTarget =
      Number.isFinite(nextTierRatio) && income > 0 ? Math.max(nextTierRatio * income, 0) : null;
    const steps = [
      { label: "Get to $0 or better", achieved: leftover > 0 },
      { label: "Stay positive for 90 days (stability)", achieved: leftover > 0 },
      { label: "Beat your best leftover and lock in long-term stability", achieved: leftover >= best },
    ];

    return { steps, nextTierTarget, best };
  }, [totals, splitPlan, formatCurrency]);

  const nextTierProgress = useMemo(() => {
    if (!Number.isFinite(milestones.nextTierTarget) || milestones.nextTierTarget <= 0) return null;
    return Math.min(Math.max((totals.leftover / milestones.nextTierTarget) * 100, 0), 100);
  }, [milestones.nextTierTarget, totals.leftover]);

      const focusCards = useMemo(() => {
        const protectAction =
          plan.mode === "critical"
            ? "Hold optional spend to zero, log every transaction, and let leftover recover."
            : "Keep essentials steady, review spending regularly, and prevent drift.";
        const bufferAction = emergencyFund.target
          ? `Move something small toward ${formatCurrency(emergencyFund.target)} this week.`
          : "Log income + expenses to unlock your new target.";
        const hasNextTier =
          Number.isFinite(milestones.nextTierTarget) && milestones.nextTierTarget > 0;
        const milestoneProgress = hasNextTier
          ? nextTierProgress ?? 0
          : (milestones.steps.filter((step) => step.achieved).length / milestones.steps.length) *
            100;
        const milestoneDescription = hasNextTier
          ? `Next milestone: reach ${formatCurrency(milestones.nextTierTarget)}`
          : "Keep stability steady for 90 days.";
        const milestoneAction = hasNextTier
          ? `${Math.round(milestoneProgress)}% toward the next tier`
          : "Hold leftover steady and log nightly.";
        const cards = [
          {
            key: "protect",
            title: "Protect essentials",
            description: plan.tone,
            action: protectAction,
          },
          {
            key: "buffer",
            title: "Rebuild your buffer",
            description: emergencyFund.message,
            action: bufferAction,
          },
          {
            key: "milestone",
            title: "Milestone momentum",
            description: milestoneDescription,
            action: milestoneAction,
            progress: Math.round(Math.min(Math.max(milestoneProgress, 0), 100)),
            progressLabel: hasNextTier
              ? `${Math.round(milestoneProgress)}% of target`
              : `${milestones.steps.filter((step) => step.achieved).length} of ${milestones.steps.length} steps`,
          },
        ];
        return cards;
      }, [
        plan.tone,
        plan.mode,
        emergencyFund.message,
        emergencyFund.target,
        formatCurrency,
        milestones.nextTierTarget,
        nextTierProgress,
        milestones,
      ]);

  const recommendedLine = useMemo(() => {
    if (plan.mode === "critical") {
      return "Take it one step at a time: cover essentials, get to positive leftover, and protect your buffer.";
    }
    if (plan.mode === "tight" || plan.mode === "balanced") {
      return "Stick to the plan: grow leftover to the next tier target and hold it for 90-180 days.";
    }
    if (plan.mode === "sovereign") {
      return "Sovereign Status: keep expenses flat, bank raises in Progress/Opportunity, and treat your 12-month fund as mobility capital.";
    }
    return "You're in a strong position: keep momentum, invest in your future, and protect your gains.";
  }, [plan.mode]);

    const stateNarrative = isDeficit
      ? "Cash flow is tight, and that is okay. We'll steady essentials and take the next calm step together."
      : `${plan.title}. ${recommendedLine}`;
    const stateBadgeText = isDeficit ? "Critical — Cash flow negative" : plan.title;
    const stateTone = isDeficit
      ? "critical"
      : ["tight", "balanced", "fragile"].includes(plan.mode)
      ? "fragile"
      : ["stable", "traditional"].includes(plan.mode)
      ? "stable"
      : "thriving";
    const stateReassurance = isDeficit
      ? "We're steadying essentials so leftover can breathe again."
      : "We've got a plan — you're moving forward.";

  useEffect(() => {
    // keep profile fresh if Income & Expenses updates
    const handler = () => {
      try {
        const stored = readNamespacedItem("moneyProfile");
        if (stored) setProfile(JSON.parse(stored));
      } catch (e) {
        /* ignore */
      }
    };
    const refreshProfile = () => handler();
    window.addEventListener("storage", handler);
    window.addEventListener("profile-updated", refreshProfile);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("profile-updated", refreshProfile);
    };
  }, []);

  const handleSavingsChange = (field) => (e) => {
    const raw = e.target.value.replace(/,/g, "");
    setProfile((prev) => {
      const next = { ...prev, [field]: raw };
        try {
          writeNamespacedItem("moneyProfile", JSON.stringify(next));
          window.dispatchEvent(new Event("profile-updated"));
        } catch (err) {
          /* ignore */
        }
      return next;
    });
  };

  return (
    <div className="budget-page">
      <header className="budget-header">
        <TopRightControls
          className="top-controls"
          activePage="budget"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="header-text">
          <div className="title">Money Coach</div>
          <div className="subtitle">Guidance that reflects your real numbers and helps you move forward.</div>
          {periodLabel && <div className="budget-period">{periodLabel}</div>}
        </div>
      </header>
        <div className="budget-container">
          {showPeriodNotices && !hasCurrentPeriodActivity && (
            <div className="budget-monthly-note">
              No activity logged yet this period. We're showing estimates from your baseline until income is confirmed.
              {needsIncomeConfirmation && (
                <>
                  {' '}
                  Add your first paycheck to confirm this period's numbers.
                </>
              )}
            </div>
          )}
          {periodGap > 0 && (
            <div className="budget-monthly-note">
              We haven't seen activity for {periodGap} period{periodGap === 1 ? '' : 's'}. This period starts fresh
              once you log new income or spending.
            </div>
          )}
          <div className="money-coach-body">
            <section className="coach-summary-block">
              <div className="coach-summary-top">
                  <span className={`coach-mode-tag coach-mode-${stateTone} coach-mode-${plan.mode}`}>
                    {stateBadgeText}
                  </span>
                <div className="coach-avatar" aria-hidden="true">
                  <span>💙</span>
                </div>
              </div>
                <p className="coach-summary-copy">{stateNarrative}</p>
                <p className="coach-summary-reassurance">{stateReassurance}</p>
            </section>
            <section className="coach-plan-interpretation interactive-card">
              <div className="coach-plan-interpretation-header">
                <span className="coach-plan-role">{plannerStatusLabel}</span>
                <span className="coach-plan-tag">
                  {plannerPlan
                    ? plannerPlan.status.state === "active"
                      ? "Active"
                      : "Logged"
                    : "Pending"}
                </span>
              </div>
              <p className="coach-plan-interpretation-summary">
                {plannerSummaryLine ||
                  "Luna gathers your income and tier signals before sharing the calm recommendation for this period."}
              </p>
              <p className="coach-plan-interpretation-support">
                {plannerSupportLine ||
                  "Check back once the income cadence is clear and this plan will describe next steps with gentle clarity."}
              </p>
              {plannerAllocations.length > 0 && (
                <div className="coach-plan-interpretation-row">
                  {plannerAllocations.map((allocation) => (
                    <div key={allocation.label} className="coach-plan-interpretation-column">
                      <span className="coach-plan-interpretation-label">{allocation.label}</span>
                      <strong>{formatCurrency(allocation.value)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {plannerRationale && (
                <p className="coach-plan-interpretation-rationale">{plannerRationale}</p>
              )}
              <button
                type="button"
                className="coach-plan-interpretation-action interactive-cta"
                onClick={() => onNavigate("split-gps")}
              >
                View it in Money Map
              </button>
            </section>
            <section className="coach-focus-area">
              <div className="coach-focus-row">
                {focusCards
                  .filter((card) => card.key !== "milestone")
                  .map((card) => (
                    <article key={card.key} className="coach-focus-card interactive-card">
                      <div className="coach-focus-title">{card.title}</div>
                      <p className="coach-focus-copy">{card.description}</p>
                      <p className="coach-focus-action">{card.action}</p>
                    </article>
                  ))}
              </div>
              {focusCards
                .filter((card) => card.key === "milestone")
                .map((card) => (
                  <div key={card.key} className="coach-focus-hero">
                    <article className="coach-focus-card coach-focus-hero-card interactive-card">
                      <div className="coach-focus-title">{card.title}</div>
                      <p className="coach-focus-copy">{card.description}</p>
                      <p className="coach-focus-action">{card.action}</p>
                      {card.progress !== undefined && card.progress !== null && (
                        <div className="coach-focus-progress">
                          <div className="coach-focus-progress-track">
                            <span
                              style={{
                                width: `${card.progress}%`,
                              }}
                            />
                          </div>
                          <span className="coach-focus-progress-label">{card.progressLabel}</span>
                        </div>
                      )}
                    </article>
                  </div>
                ))}
            </section>
            <section className="coach-plan-details">
              <details className="coach-plan-details-panel">
                <summary>
                  <div className="coach-plan-details-summary-text">
                    <span className="coach-plan-role">{PLAN_ROLE}</span>
                    <span>About your plan</span>
                  </div>
                </summary>
                <p>{PLAN_REASON}</p>
                <p className="coach-plan-reassurance">{PLAN_REASSURANCE}</p>
              </details>
            </section>
            <section className="coach-depth-stack">
              <div className="coach-collapse-section">
                  <button
                    className="coach-collapse-toggle interactive-cta"
                    type="button"
                    aria-expanded={starterOpen}
                    aria-controls="coach-starter-content"
                    onClick={() => setStarterOpen((prev) => !prev)}
                  >
                  <span>Starter Plan</span>
                  <span className="coach-collapse-status">
                    {starterOpen ? 'Hide details' : 'Show the plan'}
                  </span>
                </button>
                  <div
                    id="coach-starter-content"
                    className={`coach-collapse-content ${starterOpen ? "is-visible" : ""}`}
                    aria-hidden={!starterOpen}
                  >
                    <p className="coach-collapse-summary">
                      Leftover: {formatCurrency(totals.leftover)} once essentials are paid.
                    </p>
                    <ul>
                      {plan.allocations.slice(0, 3).map((allocation) => (
                        <li key={allocation.label}>
                          <strong>{allocation.label}</strong> - {allocation.value}
                          <p className="coach-collapse-detail">{allocation.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
              </div>
              <div className="coach-collapse-section">
                  <button
                    className="coach-collapse-toggle interactive-cta"
                    type="button"
                    aria-expanded={emergencyOpen}
                    aria-controls="coach-emergency-content"
                    onClick={() => setEmergencyOpen((prev) => !prev)}
                  >
                  <span>Emergency Fund</span>
                  <span className="coach-collapse-status">
                    {emergencyOpen ? 'Hide strategy' : 'Show the strategy'}
                  </span>
                </button>
                  <div
                    id="coach-emergency-content"
                    className={`coach-collapse-content ${emergencyOpen ? "is-visible" : ""}`}
                    aria-hidden={!emergencyOpen}
                  >
                    <p className="coach-collapse-summary">
                      {emergencyFund.target
                        ? `Goal: ${formatCurrency(emergencyFund.target)} (${Math.round(
                            emergencyProgress * 100
                          )}% funded)`
                        : "Add income or expenses to reveal your cushion target."}
                    </p>
                    <div className="ef-bar coach-ef-bar">
                      <span
                        className="ef-fill"
                        style={{ width: `${emergencyProgress * 100}%` }}
                      />
                    </div>
                    <p className="coach-collapse-detail">{emergencyFund.message}</p>
                    {systemLiquidityPercent > 0 && (
                      <p className="coach-collapse-detail">
                        Liquidity sits at {Math.round(systemLiquidityPercent)}% of target.
                      </p>
                    )}
                  </div>
              </div>
              <div className="coach-collapse-section">
                  <button
                    className="coach-collapse-toggle interactive-cta"
                    type="button"
                    aria-expanded={tipsOpen}
                    aria-controls="coach-tips-content"
                    onClick={() => setTipsOpen((prev) => !prev)}
                  >
                  <span>Quick Tips</span>
                  <span className="coach-collapse-status">
                    {tipsOpen ? 'Hide tips' : 'Show the highlights'}
                  </span>
                </button>
                  <div
                    id="coach-tips-content"
                    className={`coach-collapse-content ${tipsOpen ? "is-visible" : ""}`}
                    aria-hidden={!tipsOpen}
                  >
                    <ul>
                      {quickTips.map((tip) => (
                        <li key={tip.title}>
                          <strong>{tip.title}</strong>
                          <p className="coach-collapse-detail">{tip.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
              </div>
            </section>
            <section className="coach-milestone-summary">
              <div className="coach-milestone-heading">Milestones</div>
              <div className="coach-milestone-grid">
                {milestones.steps.slice(0, 2).map((item) => (
                  <div key={item.label} className="coach-milestone-row">
                    <span
                      className={`coach-milestone-dot ${item.achieved ? 'done' : ''}`}
                      aria-hidden="true"
                    >
                      {item.achieved ? '\u2713' : '\u2022'}
                    </span>
                    <p className="coach-milestone-text">{item.label}</p>
                  </div>
                ))}
              </div>
              {Number.isFinite(milestones.nextTierTarget) && milestones.nextTierTarget > 0 && (
                <div className="coach-milestone-progress">
                  {nextTierProgress ? Math.round(nextTierProgress) : 0}% of{' '}
                  {formatCurrency(milestones.nextTierTarget)} milestone
                </div>
              )}
              <p className="coach-milestone-note">Small steps count. Keep momentum quiet and steady.</p>
            </section>
          </div>
        </div>
      </div>
  );
};

export default Budget;
