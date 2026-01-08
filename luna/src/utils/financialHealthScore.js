import { getPeriodRange } from "./budgetPeriod";
import { readHistoryEntry, readHistoryIndex, getPeriodGapCount } from "./periodHistory";
import { loadCreditCards } from "./creditCardsStorage";
import { runAvalancheSimulation, runSnowballSimulation } from "./snowball";
import { computeSplitPlan } from "./splitPlan";
import { getActiveDebtPlanType } from "./debtPlanType";
import { getPillarPredictions } from "./predictFinancialPillars";
import { readDebtCashForm, readDebtPlanType } from "./debtStorage";
import { readNamespacedItem, writeNamespacedItem } from "./userStorage";

const SCORE_STORAGE_KEY = "financialHealthScore";
const SCORE_EVENT = "health-score-updated";
const PROFILE_KEY = "moneyProfile";
const PREF_KEY = "lunaPreferences";
const SCORE_HISTORY_LIMIT = 12;

const DEFAULT_PREFERENCES = {
  premiumAccess: false,
  businessFeatures: false,
  budgetPeriod: "monthly",
  budgetPeriodStartDay: 1,
  budgetPeriodAnchor: "",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const safeNumber = (value) => (Number.isFinite(value) ? value : 0);
const toNumber = (value) => {
  const cleaned = String(value ?? "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};
const amountForEntry = (entry = {}) => Number(entry.monthly ?? entry.amount ?? 0) || 0;
const isPersonalTransaction = (txn = {}) => {
  const incomeType = txn?.incomeType;
  const expenseType = txn?.expenseType;
  return incomeType !== "business" && expenseType !== "business";
};
const isPersonalIncome = (item) => (item?.incomeType || "personal") === "personal";
const isPersonalExpense = (item) => (item?.expenseType || "personal") === "personal";

const linearMap = (value, inMin, inMax, outMin, outMax) => {
  if (inMax === inMin) return outMin;
  const ratio = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + ratio * (outMax - outMin);
};

const computeBudgetStabilityScore = ({ income, leftover }) => {
  const safeRatio = income > 0 ? Math.max(leftover / income, 0) : 0;
  if (safeRatio <= 0) return 0;
  if (safeRatio <= 0.05) return linearMap(safeRatio, 0, 0.05, 0, 5);
  if (safeRatio <= 0.12) return linearMap(safeRatio, 0.05, 0.12, 5, 12);
  if (safeRatio <= 0.2) return linearMap(safeRatio, 0.12, 0.2, 12, 22);
  return 30;
};

const getVerifiedTransactions = (transactions = []) =>
  (transactions || []).filter(
    (txn) => txn?.reconciliationStatus === "verified" && isPersonalTransaction(txn)
  );

const sumTransactions = (entries, predicate) => {
  return (entries || []).reduce((acc, entry) => {
    if (predicate(entry)) {
      acc += Number(entry.amount || 0);
    }
    return acc;
  }, 0);
};

const computeLiquidityScore = ({ savingsBalance, monthlyBurn }) => {
  const buffer = safeNumber(savingsBalance);
  const burn = Math.max(monthlyBurn || 1, 1);
  const months = Math.min(buffer / burn, 6);
  return clamp((months / 6) * 100, 0, 100);
};

const computeSavingsRateScore = (verifiedTransactions = []) => {
  const income = sumTransactions(verifiedTransactions, (txn) => Number(txn.amount) > 0);
  const expenses = Math.abs(sumTransactions(verifiedTransactions, (txn) => Number(txn.amount) < 0));
  if (income <= 0) return 0;
  const net = Math.max(income - expenses, 0);
  const ratio = net / income;
  return clamp((ratio / 0.2) * 100, 0, 100);
};

const computeDebtToIncomeScore = ({ debtPayments, income }) => {
  const monthlyIncome = Math.max(income || 0, 1);
  const ratio = debtPayments / monthlyIncome;
  if (ratio <= 0.3) return 100;
  if (ratio >= 0.6) return 0;
  return clamp(((0.6 - ratio) / 0.3) * 100, 0, 100);
};

const computeBudgetAdherenceScore = ({ verifiedTransactions = [], profile = {} }) => {
  const plan = new Map();
  (profile?.expenses || []).forEach((entry) => {
    const key = (entry.category || entry.name || "other").toLowerCase();
    plan.set(key, (plan.get(key) || 0) + amountForEntry(entry));
  });
  if (!plan.size) return 100;

  const actuals = new Map();
  verifiedTransactions
    .filter((txn) => Number(txn.amount) < 0)
    .forEach((entry) => {
      const key = (entry.category || entry.name || "other").toLowerCase();
      actuals.set(key, (actuals.get(key) || 0) + Math.abs(Number(entry.amount) || 0));
    });

  let weighted = 0;
  let total = 0;
  plan.forEach((limit, key) => {
    total += limit;
    const spent = actuals.get(key) || 0;
    const overage = Math.max(0, spent - limit);
    const score = limit > 0 ? Math.max(0, 1 - overage / limit) : 1;
    weighted += score * limit;
  });

  if (!total) return 100;
  return clamp((weighted / total) * 100, 0, 100);
};

const computeVelocityScore = ({ history = [], currentScore, income }) => {
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recent = history.filter((item) => {
    const updated = Date.parse(item?.updatedAt);
    return Number.isFinite(updated) && updated >= now - windowMs;
  });
  if (!recent.length) return 50;
  if (!income || income <= 0) return 50;
  const avg = recent.reduce((sum, item) => sum + Number(item.score || 0), 0) / recent.length;
  const delta = (currentScore || 0) - avg;
  const normalized = clamp((delta + 10) / 20, 0, 1);
  return Math.round(normalized * 100);
};

const MIN_VERIFIED_FOR_READY = 10;

const describeDataStatus = (count) => {
  if (!count) {
    return {
      dataStatus: "insufficient",
      statusDetail: "Verify 10 transactions to unlock your score.",
    };
  }
  if (count < MIN_VERIFIED_FOR_READY) {
    const remaining = MIN_VERIFIED_FOR_READY - count;
    return {
      dataStatus: "partial",
      statusDetail: `Only ${count} verified transactions so far. Verify ${remaining} more to fully unlock the score.`,
    };
  }
  return {
    dataStatus: "ready",
    statusDetail: "Score based on verified personal activity.",
  };
};

const getPillarLabel = (score) => {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Steady";
  if (score >= 40) return "Emerging";
  return "Needs Attention";
};

const PILLAR_TIPS = {
  liquidity: {
    strong: "You have a solid buffer that can cover several months of essentials.",
    steady: "Keep topping up a small portion each month to stay strong.",
    emerging: "Add $100–$200 to your savings each month to build breathing room.",
    weak: "Aim for 3 months of expenses in savings to feel stable.",
  },
  savingsRate: {
    strong: "Your savings rate is excellent—keep that momentum.",
    steady: "You're building spare cash. Keep automating a transfer.",
    emerging: "Move 1–2% more of your income into savings next period.",
    weak: "Start with a $25 automatic deposit to restart the habit.",
  },
  dti: {
    strong: "Debt payments stay below 30% of income. That’s resilient.",
    steady: "You're close to the sweet spot—keep the extra payment steady.",
    emerging: "Try trimming 1 payment or earning a small bump to improve DTI.",
    weak: "Pay down one balance to bring debt below 30% of income.",
  },
  budgetAdherence: {
    strong: "You’re spending exactly where you planned. That’s rare.",
    steady: "Small slips happen. Keep reviewing categories weekly.",
    emerging: "Check one category and keep it under its limit this week.",
    weak: "Pick one category and cut it by 5% to rebuild trust.",
  },
  velocity: {
    strong: "Momentum is up—keep doing what you’re doing.",
    steady: "The score is steady. Two more clean periods routine it.",
    emerging: "Your trend is flattening—add a small win this period.",
    weak: "Consistency will push the score up. Stay steady.",
  },
};

const describePillar = (key, score) => {
  const label = getPillarLabel(score);
  const tier = score >= 80 ? "strong" : score >= 60 ? "steady" : score >= 40 ? "emerging" : "weak";
  const tip = PILLAR_TIPS[key]?.[tier] || "Keep tracking—small wins compound.";
  return { score: Math.round(score), label, tip };
};

const buildAdvancedPillars = ({
  transactions = [],
  verifiedTransactions,
  profile = {},
  totals = {},
  debtEntries = [],
  lastSnapshot = {},
  currentScore = 0,
}) => {
  const verified =
    Array.isArray(verifiedTransactions) && verifiedTransactions.length
      ? verifiedTransactions
      : getVerifiedTransactions(transactions);
  const verifiedExpenses = Math.abs(sumTransactions(verified, (txn) => Number(txn.amount) < 0));
  const liquidityScore = computeLiquidityScore({
    savingsBalance: safeNumber(profile?.savingsBalance),
    monthlyBurn: Math.max(verifiedExpenses, safeNumber(totals?.expenses), 1),
  });
  const savingsRateScore = computeSavingsRateScore(verified);
  const debtPayments = debtEntries.reduce(
    (sum, debt) => sum + Math.max(0, toNumber(debt?.minPayment || debt?.min || 0)),
    0
  );
  const dtiScore = computeDebtToIncomeScore({ debtPayments, income: safeNumber(totals?.income) });
  const budgetAdherenceScore = computeBudgetAdherenceScore({ verifiedTransactions: verified, profile });
  const velocityScore = computeVelocityScore({
    history: lastSnapshot?.history || [],
    currentScore,
    income: safeNumber(totals?.income),
  });

  return {
    liquidity: describePillar("liquidity", liquidityScore),
    savingsRate: describePillar("savingsRate", savingsRateScore),
    dti: describePillar("dti", dtiScore),
    budgetAdherence: describePillar("budgetAdherence", budgetAdherenceScore),
    velocity: describePillar("velocity", velocityScore),
  };
};

const getScoreTierLabel = (score) =>
  score >= 75 ? "Thriving" : score >= 50 ? "Balanced" : score >= 25 ? "Tight" : "Critical";

const buildScoreHistory = (history, entry) => {
  const list = Array.isArray(history) ? history.filter(Boolean) : [];
  const filtered = list.filter((item) => item?.periodKey !== entry.periodKey);
  const next = [...filtered, entry];
  if (next.length <= SCORE_HISTORY_LIMIT) return next;
  return next.slice(next.length - SCORE_HISTORY_LIMIT);
};

const MIN_HISTORY_FOR_PREDICTION = 4;

const getPredictionConfidenceLabel = (value = 0) => {
  if (value >= 0.75) return "high";
  if (value >= 0.4) return "medium";
  return "low";
};

const buildPredictionPayload = (history = []) => {
  if (!Array.isArray(history) || !history.length) return null;
  const enrichedHistory = history.filter((entry) => entry?.pillars);
  if (enrichedHistory.length < MIN_HISTORY_FOR_PREDICTION) return null;
  const predictions = getPillarPredictions(enrichedHistory);
  if (!predictions || !Object.keys(predictions).length) return null;
  const avgConfidence =
    Object.values(predictions).reduce((sum, pillar) => sum + (pillar?.confidence || 0), 0) /
    Math.max(Object.keys(predictions).length, 1);
  const normalizedConfidence = clamp(avgConfidence, 0, 1);
  return {
    entries: predictions,
    confidence: normalizedConfidence,
    confidenceLabel: getPredictionConfidenceLabel(normalizedConfidence),
    historyLength: enrichedHistory.length,
    updatedAt: new Date().toISOString(),
  };
};

const computeSavingsTarget = ({ expenses, tierKey }) => {
  const targets = {
    critical: 300,
    tight: 1000,
    balanced: 1000,
    traditional: expenses > 0 ? expenses * 3 : 0,
  };
  return targets[tierKey] ?? 1000;
};

const buildConfidence = (history = []) => {
  const recent = history.slice(-4).filter((item) => Number.isFinite(item?.score));
  const periods = history.length;
  if (periods < 2) {
    return { label: "Early Confidence", detail: "Building your baseline with early data.", periods };
  }
  if (periods < 4) {
    return { label: "Growing Confidence", detail: "More periods are adding clarity.", periods };
  }
  if (recent.length < 2) {
    return { label: "Growing Confidence", detail: "Your score is stabilizing over time.", periods };
  }
  const avg = recent.reduce((sum, item) => sum + item.score, 0) / recent.length;
  const variance =
    recent.reduce((sum, item) => sum + Math.pow(item.score - avg, 2), 0) / recent.length;
  const volatility = Math.sqrt(variance);
  if (volatility <= 4) {
    return { label: "High Confidence", detail: "Your score is stable and well-informed.", periods };
  }
  return { label: "Growing Confidence", detail: "Some volatility remains as data stabilizes.", periods };
};

const buildMilestones = ({
  lastSnapshot,
  history,
  score,
  savingsBalance,
  expenses,
  tierKey,
}) => {
  const existing = Array.isArray(lastSnapshot?.milestones) ? lastSnapshot.milestones : [];
  const existingKeys = new Set(existing.map((item) => item?.key));
  const milestones = [];
  const tierLabel = getScoreTierLabel(score);
  const previousTier = lastSnapshot?.score != null ? getScoreTierLabel(lastSnapshot.score) : null;

  if (history.length === 1 && !existingKeys.has("first-period")) {
    milestones.push({
      key: "first-period",
      title: "First period completed",
      message: "You closed your first budget period. That is a real milestone.",
      periodKey: history[history.length - 1]?.periodKey,
    });
  }

  if (previousTier && previousTier !== "Balanced" && tierLabel === "Balanced" && !existingKeys.has("tier-balanced")) {
    milestones.push({
      key: "tier-balanced",
      title: "Reached Balanced",
      message: "You moved into Balanced. Your financial footing is getting stronger.",
      periodKey: history[history.length - 1]?.periodKey,
    });
  }

  if (previousTier && previousTier !== "Thriving" && tierLabel === "Thriving" && !existingKeys.has("tier-thriving")) {
    milestones.push({
      key: "tier-thriving",
      title: "Reached Thriving",
      message: "You reached Thriving. Your progress is consistent and strong.",
      periodKey: history[history.length - 1]?.periodKey,
    });
  }

  const target = computeSavingsTarget({ expenses, tierKey });
  if (target > 0) {
    const prevSavings = safeNumber(lastSnapshot?.savingsBalance);
    if (prevSavings < target && savingsBalance >= target && !existingKeys.has("savings-cushion")) {
      milestones.push({
        key: "savings-cushion",
        title: "Emergency cushion reached",
        message: "Your savings cushion hit its first milestone. That is real stability.",
        periodKey: history[history.length - 1]?.periodKey,
      });
    }
  }

  const recent = history.slice(-3);
  const streak = recent.length === 3 && recent.every((item) => Number(item.trend) > 0);
  if (streak && !existingKeys.has("momentum-streak")) {
    milestones.push({
      key: "momentum-streak",
      title: "Momentum streak",
      message: "Your score improved three periods in a row. That is strong momentum.",
      periodKey: history[history.length - 1]?.periodKey,
    });
  }

  const stabilityStreak = history.length === 3 && !existingKeys.has("stability-streak");
  if (stabilityStreak) {
    milestones.push({
      key: "stability-streak",
      title: "Stability streak",
      message: "You have stayed engaged for three periods. Consistency is building strength.",
      periodKey: history[history.length - 1]?.periodKey,
    });
  }

  if (!milestones.length) return existing;
  return [...existing, ...milestones].slice(-6);
};

const getCoachingSuggestion = ({ tierKey, pillarKey, direction }) => {
  const toneKey = tierKey === "critical"
    ? "critical"
    : tierKey === "tight"
      ? "tight"
      : tierKey === "traditional"
        ? "thriving"
        : "balanced";

  const messages = {
    budgetStability: {
      critical: {
        up: "You are stabilizing. Keep one key category steady so your leftover can breathe.",
        down: "Let's steady one category next period so you can regain control step by step.",
        flat: "A small spending trim next period will help you stabilize without pressure.",
      },
      tight: {
        up: "Budget stability is improving. Keep one key category steady to protect your leftover.",
        down: "Budget pressure ticked up. Choose one category to tighten next period and regain control.",
        flat: "A small spending trim next period could lift your leftover and strengthen stability.",
      },
      balanced: {
        up: "Your stability is strengthening. Keep one category consistent to protect momentum.",
        down: "Budget pressure crept in. A small reset next period will keep progress smooth.",
        flat: "A focused trim next period can lift your leftover and build momentum.",
      },
      thriving: {
        up: "Your stability is strong. Keep your key categories steady to stay optimized.",
        down: "Even strong plans wobble. A small adjustment next period keeps things efficient.",
        flat: "A quick tune-up can keep your leftover strong and your plan optimized.",
      },
    },
    debtMomentum: {
      critical: {
        up: "Great step forward. Even a small extra payment next cycle builds momentum.",
        down: "Momentum softened. A small extra payment next cycle helps you regain control.",
        flat: "Keeping minimums steady is a win. Add a small extra payment when you can.",
      },
      tight: {
        up: "Debt momentum is building. A small extra payment next cycle could accelerate progress.",
        down: "Debt momentum softened. A small extra payment next cycle would steady the path.",
        flat: "Keeping minimums steady is good. Add a small extra payment when you can.",
      },
      balanced: {
        up: "Momentum is building. A slightly stronger extra payment could speed up your payoff.",
        down: "Momentum slipped a bit. A small extra payment next period keeps you on track.",
        flat: "A modest extra payment can strengthen payoff efficiency.",
      },
      thriving: {
        up: "Momentum looks strong. Increasing your extra payment slightly could optimize payoff.",
        down: "Momentum softened. A quick extra payment next period keeps the plan optimized.",
        flat: "A targeted extra payment can keep your payoff plan in peak shape.",
      },
    },
    savingsCushion: {
      critical: {
        up: "Your cushion is growing. Keep a small deposit going to build safety.",
        down: "Savings slowed. Even a tiny transfer helps rebuild your buffer.",
        flat: "A small automatic transfer will help you build breathing room.",
      },
      tight: {
        up: "Your savings cushion is growing. Keep the same pace for one more period to lock it in.",
        down: "Savings momentum slowed. Even a small transfer can rebuild your cushion.",
        flat: "A small automatic transfer would strengthen your savings cushion.",
      },
      balanced: {
        up: "Savings are building. Keep the pace to move toward a stronger cushion.",
        down: "Savings softened a bit. A small boost next period keeps momentum alive.",
        flat: "A slightly bigger transfer can strengthen your cushion.",
      },
      thriving: {
        up: "Your cushion is strong and growing. Keep the pace to build long-term resilience.",
        down: "Savings momentum softened. A small boost keeps your long-term buffer strong.",
        flat: "A quick transfer keeps your cushion optimized for the long run.",
      },
    },
    consistency: {
      critical: {
        up: "You're showing up. One more completed period can rebuild confidence fast.",
        down: "A few gaps showed up. One completed period in a row will steady things.",
        flat: "One completed period can make a real difference right now.",
      },
      tight: {
        up: "Consistency is paying off. Complete one more period to reinforce the streak.",
        down: "A few gaps showed up. One completed period in a row rebuilds confidence quickly.",
        flat: "One more completed period will strengthen your consistency score.",
      },
      balanced: {
        up: "Consistency looks strong. One more period will reinforce the gains.",
        down: "Consistency dipped a bit. A clean period will stabilize the trend.",
        flat: "One solid period can lift your consistency quickly.",
      },
      thriving: {
        up: "Consistency is strong. Keep the streak to maintain long-term momentum.",
        down: "Even strong streaks dip. One clean period restores your rhythm.",
        flat: "One more steady period keeps your momentum high.",
      },
    },
  };

  return messages[pillarKey]?.[toneKey]?.[direction] || null;
};

const buildCoachingSuggestion = ({ pillars, previousPillars, trend, tierKey }) => {
  if (!pillars) return null;
  const entries = Object.entries(pillars).map(([key, value]) => ({
    key,
    value: safeNumber(value),
    delta: safeNumber(value) - safeNumber(previousPillars?.[key]),
  }));
  if (!entries.length) return null;
  const weakest = entries.reduce((min, item) => (item.value < min.value ? item : min), entries[0]);
  const direction = trend >= 3 ? "up" : trend <= -3 ? "down" : "flat";

  return getCoachingSuggestion({
    tierKey,
    pillarKey: weakest.key,
    direction,
  });
};

const readPreferences = () => {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = readNamespacedItem(PREF_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (e) {
    return DEFAULT_PREFERENCES;
  }
};

const readMoneyProfile = () => {
  if (typeof window === "undefined") return { incomes: [], expenses: [], savingsBalance: 0 };
  try {
    const stored = readNamespacedItem(PROFILE_KEY);
    if (!stored) return { incomes: [], expenses: [], savingsBalance: 0 };
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : { incomes: [], expenses: [], savingsBalance: 0 };
  } catch (e) {
    return { incomes: [], expenses: [], savingsBalance: 0 };
  }
};

const readTransactions = () => {
  try {
    const stored = readNamespacedItem("liveBudgetTransactions", "[]");
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

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

const buildManualDebts = (form) => {
  if (!form) return [];
  const manualList = Array.isArray(form.manualDebts)
    ? form.manualDebts
    : Array.isArray(form)
      ? form
      : null;

  if (manualList) {
    return manualList
      .map((debt, index) => {
        const balance = Math.max(0, toNumber(debt.balance));
        if (!balance) return null;
        return {
          id: debt.id || `manual-${index}`,
          name: debt.name || debt.type || "Debt",
          balance,
          apr: Math.max(0, toNumber(debt.apr)),
          minPayment: toNumber(debt.minPayment),
        };
      })
      .filter(Boolean);
  }

  return [];
};

const buildTotals = (profile) => {
  const incomes = (profile?.incomes || []).filter(isPersonalIncome);
  const expenses = (profile?.expenses || []).filter(isPersonalExpense);
  const income = incomes.reduce((sum, item) => sum + amountForEntry(item), 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + amountForEntry(item), 0);
  return {
    income,
    expenses: expenseTotal,
    leftover: income - expenseTotal,
  };
};

const computeSavingsScore = ({ savingsBalance, expenses, tierKey }) => {
  const target = computeSavingsTarget({ expenses, tierKey });
  if (!target) return 0;
  const progress = clamp(savingsBalance / target, 0, 2);
  if (progress < 0.1) return linearMap(progress, 0, 0.1, 0, 3);
  if (progress < 0.5) return linearMap(progress, 0.1, 0.5, 5, 12);
  if (progress < 1) return linearMap(progress, 0.5, 1, 12, 18);
  return 20;
};

const computeDebtMomentumScore = ({ debtTotal, payoffMonths, lastDebtTotal, lastPayoffMonths }) => {
  if (debtTotal <= 0) return 30;
  if (!lastDebtTotal || lastDebtTotal <= 0 || !lastPayoffMonths) return 15;

  const debtChangePct = (lastDebtTotal - debtTotal) / lastDebtTotal;
  const payoffChange = lastPayoffMonths - payoffMonths;

  if (debtChangePct < -0.02 || payoffChange < -2) return 4;
  if (debtChangePct < 0.02 && Math.abs(payoffChange) <= 2) return 10;
  if (debtChangePct > 0.08 || payoffChange > 6) return 28;
  if (debtChangePct > 0.02 || payoffChange > 2) return 20;
  return 12;
};

const isCompleteEntry = (entry) => {
  if (!entry) return false;
  return (
    entry.income !== "unknown" &&
    entry.expenses !== "unknown" &&
    entry.leftover !== "unknown"
  );
};

const hasCompletedPeriod = (preferences) => {
  const historyIndex = readHistoryIndex(preferences?.budgetPeriod);
  if (!historyIndex.length) return false;
  return historyIndex.some((key) => isCompleteEntry(readHistoryEntry(key)));
};

const hasMeaningfulFinancialData = ({
  totals,
  savingsBalance,
  debtTotal,
  transactionsCount,
  preferences,
  verifiedCount = 0,
}) => {
  const income = safeNumber(totals?.income);
  const noCoreData =
    income <= 0 &&
    safeNumber(savingsBalance) <= 0 &&
    safeNumber(debtTotal) <= 0 &&
    safeNumber(transactionsCount) <= 0;
  if (noCoreData) return false;
  if (hasCompletedPeriod(preferences)) return true;
  if (income <= 0) return false;
  return (
    safeNumber(savingsBalance) > 0 ||
    safeNumber(debtTotal) > 0 ||
    safeNumber(transactionsCount) > 0
  );
};

const computeConsistencyScore = ({ preferences, periodKey }) => {
  const historyIndex = readHistoryIndex(preferences?.budgetPeriod);
  if (!historyIndex.length || !periodKey) return 6;
  const lastKey = historyIndex[historyIndex.length - 1];
  const gapCount = getPeriodGapCount(preferences, periodKey, lastKey);

  let streak = 0;
  for (let i = historyIndex.length - 1; i >= 0; i -= 1) {
    const entry = readHistoryEntry(historyIndex[i]);
    if (!isCompleteEntry(entry)) break;
    streak += 1;
  }

  if (gapCount >= 2) return 3;
  if (streak >= 3) return 18;
  if (streak === 2) return 14;
  if (streak === 1) return 9;
  return 4;
};

const buildScoreExplanations = ({ currentPillars, previousPillars }) => {
  if (!previousPillars) {
    return {
      summary: {
        tone: "neutral",
        message: "We are building your baseline. Keep tracking to see what changes most.",
      },
      items: [],
    };
  }

  const pillarLabels = {
    budgetStability: "Budget Stability",
    debtMomentum: "Debt Momentum",
    savingsCushion: "Savings Cushion",
    consistency: "Consistency / Financial Behavior",
  };

  const pillarCopy = {
    budgetStability: {
      positive: "Your leftover improved this period — great job keeping spending aligned with your plan.",
      positiveStrong: "Excellent control this period. Your budget stability jumped in a meaningful way.",
      neutral: "Your budget stability stayed mostly steady. Small wins compound over time.",
      negative: "Spending pressed harder on your budget this period. You're still okay — small course corrections can help.",
      negativeStrong: "Budget pressure increased this period. You're not alone — a few adjustments can steady things.",
    },
    debtMomentum: {
      positive: "Your debt is moving in the right direction. Your payoff momentum is building.",
      positiveStrong: "Amazing progress — your debt payoff pace accelerated this period.",
      neutral: "Debt progress stayed mostly steady. Consistency keeps momentum alive.",
      negative: "Debt progress slowed a bit this period. Even staying steady is valuable — you can regain momentum.",
      negativeStrong: "Debt momentum dipped this period. You're still in control — a small push can restart progress.",
    },
    savingsCushion: {
      positive: "Your savings cushion grew. You're building real financial safety.",
      positiveStrong: "Strong savings progress — you're building a real buffer.",
      neutral: "Savings held steady this period. Maintaining a cushion is still a win.",
      negative: "Savings didn't grow this period. That's common during tight months — refocus when you can.",
      negativeStrong: "Savings slipped back this period. That's okay — rebuilding the buffer is still possible.",
    },
    consistency: {
      positive: "You've been consistently engaging with Luna. Habits are strengthening.",
      positiveStrong: "Consistency streak! Sticking with your plan is paying off.",
      neutral: "Your consistency stayed steady. Keeping the routine matters.",
      negative: "There were gaps this period. No worries — picking back up matters more than being perfect.",
      negativeStrong: "Consistency dipped this period. You're still on the path — restarting is what matters.",
    },
  };

  const deltas = Object.keys(pillarLabels).map((key) => {
    const current = safeNumber(currentPillars?.[key]);
    const previous = safeNumber(previousPillars?.[key]);
    const delta = Math.round(current - previous);
    return {
      key,
      title: pillarLabels[key],
      delta,
      current,
      absDelta: Math.abs(delta),
    };
  });

  const totalMovement = deltas.reduce((sum, item) => sum + item.absDelta, 0);
  if (totalMovement < 2) {
    return {
      summary: {
        tone: "neutral",
        message: "No major change this period — stability is progress.",
      },
      items: [],
    };
  }

  const allNegative = deltas.every((item) => item.delta <= -2);
  const allPositive = deltas.every((item) => item.delta >= 2);
  const summary = allNegative
    ? {
        tone: "negative",
        message: "This was a tough period. You're still in control — we will help you get back on track.",
      }
    : allPositive
      ? {
          tone: "positive",
          message: "Strong forward progress this period — keep going.",
        }
      : null;

  const sortedByDelta = [...deltas].sort((a, b) => b.absDelta - a.absDelta);
  const strongestPositive = sortedByDelta.find((item) => item.delta >= 2);
  const strongestNegative = sortedByDelta.find((item) => item.delta <= -2);
  const fallback = sortedByDelta.slice(0, 2);

  const selected = [];
  if (strongestPositive) selected.push(strongestPositive);
  if (strongestNegative && strongestNegative.key !== strongestPositive?.key) {
    selected.push(strongestNegative);
  }
  if (selected.length < 2) {
    fallback.forEach((item) => {
      if (selected.length >= 2) return;
      if (!selected.find((entry) => entry.key === item.key)) {
        selected.push(item);
      }
    });
  }

  const topDrivers = selected.map((item) => {
    let tone = "neutral";
    let copyKey = "neutral";
    if (item.delta >= 5) {
      tone = "positive";
      copyKey = "positiveStrong";
    } else if (item.delta >= 2) {
      tone = "positive";
      copyKey = "positive";
    } else if (item.delta <= -5) {
      tone = "negative";
      copyKey = "negativeStrong";
    } else if (item.delta <= -2) {
      tone = "negative";
      copyKey = "negative";
    }

    return {
      key: item.key,
      title: item.title,
      delta: item.delta,
      tone,
      message: pillarCopy[item.key][copyKey],
    };
  });

  return { summary, items: topDrivers };
};

const computeFinancialHealthScore = ({
  totals,
  savingsBalance,
  debtTotal,
  payoffMonths,
  preferences,
  periodKey,
  lastSnapshot,
  transactions = [],
  verifiedTransactions = [],
  profile = {},
  debtEntries = [],
}) => {
  const income = safeNumber(totals?.income);
  const expenses = safeNumber(totals?.expenses);
  const leftover = safeNumber(totals?.leftover);
  const tierKey = preferences?.tierKey || "balanced";

  const budgetStability = computeBudgetStabilityScore({ income, leftover });
  const debtMomentum = computeDebtMomentumScore({
    debtTotal,
    payoffMonths,
    lastDebtTotal: lastSnapshot?.debtTotal,
    lastPayoffMonths: lastSnapshot?.payoffMonths,
  });
  const savingsCushion = computeSavingsScore({
    savingsBalance,
    expenses,
    tierKey,
  });
  const consistency = computeConsistencyScore({ preferences, periodKey });

  const rawScore =
    budgetStability +
    debtMomentum +
    savingsCushion +
    consistency;
  const clampedRaw = clamp(rawScore, 0, 100);
  const previousScore = safeNumber(lastSnapshot?.score);
  const finalScore = lastSnapshot
    ? previousScore * 0.65 + clampedRaw * 0.35
    : clampedRaw;
  const roundedScore = Math.round(finalScore);
  const trend = Math.round(roundedScore - previousScore);

  const explanations = buildScoreExplanations({
    currentPillars: {
      budgetStability,
      debtMomentum,
      savingsCushion,
      consistency,
    },
    previousPillars: lastSnapshot?.pillars,
  });

  const coaching = buildCoachingSuggestion({
    pillars: {
      budgetStability,
      debtMomentum,
      savingsCushion,
      consistency,
    },
    previousPillars: lastSnapshot?.pillars,
    trend,
    tierKey,
  });

  const advancedPillars = buildAdvancedPillars({
    transactions,
    verifiedTransactions,
    profile,
    totals,
    debtEntries,
    lastSnapshot,
    currentScore: roundedScore,
  });

  return {
    score: roundedScore,
    trend,
    rawScore: Math.round(clampedRaw),
    pillars: {
      budgetStability: Math.round(budgetStability),
      debtMomentum: Math.round(debtMomentum),
      savingsCushion: Math.round(savingsCushion),
      consistency: Math.round(consistency),
    },
    explanations,
    coaching,
    pillarInsights: advancedPillars,
  };
};

const readScoreSnapshot = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = readNamespacedItem(SCORE_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed && !parsed.status) {
      return { status: "insufficient" };
    }
    return parsed;
  } catch (e) {
    return null;
  }
};

const writeScoreSnapshot = (payload) => {
  if (typeof window === "undefined") return;
  try {
    writeNamespacedItem(SCORE_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event(SCORE_EVENT));
  } catch (e) {
    /* ignore */
  }
};

const updateFinancialHealthScore = ({
  totals,
  savingsBalance,
  debtTotal,
  payoffMonths,
  preferences,
  periodKey,
  transactionsCount,
  transactions = [],
  verifiedTransactions = [],
  profile = {},
  debtEntries = [],
  forceRefresh = false,
}) => {
  const lastSnapshot = readScoreSnapshot();
  const verified =
    Array.isArray(verifiedTransactions) && verifiedTransactions.length
      ? verifiedTransactions
      : getVerifiedTransactions(transactions);
  const verifiedCount = verified.length;
  const dataConfidence = clamp(verifiedCount / MIN_VERIFIED_FOR_READY, 0, 1);
  const { dataStatus, statusDetail } = describeDataStatus(verifiedCount);
  const snapshotUpdatedAt = new Date().toISOString();
  const hasData = hasMeaningfulFinancialData({
    totals,
    savingsBalance,
    debtTotal,
    transactionsCount,
    preferences,
    verifiedCount,
  });
  if (!verifiedCount) {
    const insufficient = {
      status: "insufficient",
      periodKey,
      updatedAt: snapshotUpdatedAt,
      history: lastSnapshot?.history || [],
      milestones: lastSnapshot?.milestones || [],
      confidence:
        lastSnapshot?.confidence ||
        { label: "Early Confidence", detail: "Verify 10 transactions to unlock your score.", periods: 0 },
      verifiedCount,
      dataConfidence,
    dataStatus,
    statusDetail,
    prediction: null,
  };
    writeScoreSnapshot(insufficient);
    return insufficient;
  }
  if (!hasData) {
    if (!forceRefresh && lastSnapshot?.periodKey === periodKey && lastSnapshot?.status === "insufficient") {
      return lastSnapshot;
    }
    const insufficient = {
      status: "insufficient",
      periodKey,
      updatedAt: new Date().toISOString(),
      history: [],
      milestones: [],
    confidence: { label: "Early Confidence", detail: "Building your baseline with early data.", periods: 0 },
    prediction: null,
  };
    writeScoreSnapshot(insufficient);
    return insufficient;
  }
  if (
    !forceRefresh &&
    lastSnapshot?.periodKey === periodKey &&
    lastSnapshot?.score != null &&
    lastSnapshot?.status === "ready"
  ) {
    return lastSnapshot;
  }
  const computed = computeFinancialHealthScore({
    totals,
    savingsBalance,
    debtTotal,
    payoffMonths,
    preferences,
    periodKey,
    lastSnapshot,
    transactions,
    verifiedTransactions: verified,
    profile,
    debtEntries,
  });
  const updatedAt = new Date().toISOString();
  const tierLabel = getScoreTierLabel(computed.score);
  const historyEntry = {
    periodKey,
    score: computed.score,
    trend: computed.trend,
    tier: tierLabel,
    updatedAt,
    pillars: computed.pillars,
  };
  const history = buildScoreHistory(lastSnapshot?.history, historyEntry);
  const confidence = buildConfidence(history);
  const milestones = buildMilestones({
    lastSnapshot,
    history,
    score: computed.score,
    savingsBalance,
    expenses: safeNumber(totals?.expenses),
    tierKey: preferences?.tierKey || "balanced",
  });
  const prediction = buildPredictionPayload(history);
  const next = {
    ...computed,
    status: "ready",
    debtTotal,
    payoffMonths,
    savingsBalance,
    periodKey,
    updatedAt,
    history,
    confidence,
    milestones,
    verifiedCount,
    dataConfidence,
    dataStatus,
    statusDetail,
    scoreNormalized: Number((computed.score / 100).toFixed(2)),
    prediction,
  };
  writeScoreSnapshot(next);
  return next;
};

const getFinancialHealthScore = ({ forceRefresh = false } = {}) => {
  if (typeof window === "undefined") return readScoreSnapshot();
  const profile = readMoneyProfile();
  const totals = buildTotals(profile);
  const savingsBalance = toNumber(profile?.savingsBalance);
  const transactions = readTransactions();
  const verifiedTransactions = getVerifiedTransactions(transactions);
  const preferences = readPreferences();
  const period = getPeriodRange(preferences, transactions);
  const periodKey = period?.key || "no-period";
  const planTypeKey = readDebtPlanType();
  const splitPlan = computeSplitPlan({ income: totals.income, leftover: totals.leftover });
  const tierKey = splitPlan?.currentStage?.key || "balanced";
  const activePlanType = getActiveDebtPlanType({
    planTypeKey,
    premiumAccess: preferences.premiumAccess,
    tierKey,
  });

  const creditCards = loadCreditCards();
  const manualForm = readDebtCashForm();
  const debtEntries = [...buildCreditCardDebts(creditCards), ...buildManualDebts(manualForm)];
  const debtTotal = debtEntries.reduce((sum, debt) => sum + (Number(debt.balance) || 0), 0);
  const baseExtra = Math.max(0, totals.leftover || 0) * 0.3;
  let payoffMonths = 0;
  if (debtEntries.length) {
    const entries =
      activePlanType === "avalanche"
        ? runAvalancheSimulation(debtEntries, baseExtra, 0)
        : runSnowballSimulation(debtEntries, baseExtra, 0);
    payoffMonths = entries.reduce((max, entry) => Math.max(max, entry.endMonth || entry.months || 0), 0);
  }

  return updateFinancialHealthScore({
    totals,
    savingsBalance,
    debtTotal,
    payoffMonths,
    preferences: { ...preferences, tierKey },
    periodKey,
    transactionsCount: transactions.length,
    transactions,
    verifiedTransactions,
    profile,
    debtEntries,
    forceRefresh,
  });
};

export {
  SCORE_STORAGE_KEY,
  SCORE_EVENT,
  computeFinancialHealthScore,
  getCoachingSuggestion,
  getFinancialHealthScore,
  readScoreSnapshot,
  updateFinancialHealthScore,
  getPeriodRange,
};
