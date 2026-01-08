import React, { useEffect, useMemo, useRef, useState } from "react";
import "./LiveBudget.css";
import TopRightControls from "../components/TopRightControls.jsx";
import HeroGlue from "../components/HeroGlue";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { getPeriodRange, filterTransactionsByPeriod } from "../utils/budgetPeriod";
import { storageManager } from "../utils/storageManager";
import { readHistoryIndex, getPeriodGapCount } from "../utils/periodHistory";
import { buildKey, readNamespacedItem, writeNamespacedItem } from "../utils/userStorage";

const TXN_KEY = "liveBudgetTransactions";
const PROFILE_KEY = "moneyProfile";
const PROFILE_FALLBACK = {
  incomes: [],
  expenses: [],
  savingsBalance: "",
  savingsMonthly: "",
  name: "",
};

const DEFAULT_EXPENSE_CATEGORIES = [
  "Housing",
  "Car Payment",
  "Fuel",
  "Car Insurance",
  "Health Insurance",
  "Food",
  "Electric",
  "WiFi",
  "Water",
  "Phone Bill",
  "Other Util.",
  "Fun",
];

const amountForEntry = (entry = {}) => Number(entry.monthly ?? entry.amount ?? 0) || 0;
const isPersonalIncome = (item) => (item?.incomeType || "personal") === "personal";
const isPersonalExpense = (item) => (item?.expenseType || "personal") === "personal";


const getTransactionScope = (txn) =>
  txn.type === "income" ? txn.incomeType || "personal" : txn.expenseType || "personal";

const buildCategoriesFromProfile = (profile) => {
  const set = new Set();
  (profile.expenses || [])
    .filter((exp) => isPersonalExpense(exp) && !exp.linkedTxnId)
    .forEach((exp) => {
      const key = exp.category || exp.name || "";
      if (key) set.add(key);
    });
  return Array.from(set.values());
};

const buildCategoriesFromTransactions = (transactions = []) => {
  const set = new Set();
  (transactions || []).forEach((txn) => {
    if (txn.type !== "expense") return;
    const category = String(txn.category || "").trim();
    if (category && category !== "Income") {
      set.add(category);
    }
  });
  return Array.from(set.values());
};

const areTransactionsEqual = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i] || {};
    const right = b[i] || {};
    if (left.id !== right.id) return false;
    if (left.type !== right.type) return false;
    if (left.category !== right.category) return false;
    if (left.amount !== right.amount) return false;
    if (left.note !== right.note) return false;
    if (left.date !== right.date) return false;
    if (left.incomeType !== right.incomeType) return false;
    if (left.expenseType !== right.expenseType) return false;
  }
  return true;
};

const loadLiveBudgetTransactions = () => {
  const parsed = storageManager.get(buildKey(TXN_KEY));
  return Array.isArray(parsed) ? parsed : [];
};

const readStoredProfile = () => {
  if (typeof window === "undefined") return { ...PROFILE_FALLBACK };
  try {
    const stored = readNamespacedItem(PROFILE_KEY);
    if (!stored) return { ...PROFILE_FALLBACK };
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return { ...PROFILE_FALLBACK };
    }
    return { ...PROFILE_FALLBACK, ...parsed };
  } catch (e) {
    return { ...PROFILE_FALLBACK };
  }
};

const syncIncomeToProfile = (entry) => {
  try {
    const parsed = readStoredProfile();
    const incomes = Array.isArray(parsed?.incomes) ? parsed.incomes : [];
    const nextProfile = {
      ...parsed,
      incomes: [...incomes, entry],
    };
    storageManager.set(buildKey(PROFILE_KEY), nextProfile);
    window.dispatchEvent(new Event("profile-updated"));
  } catch (e) {
    /* ignore storage issues */
  }
};

const removeIncomeFromProfile = (id) => {
  if (!id) return;
  try {
    const parsed = readStoredProfile();
    const incomes = Array.isArray(parsed?.incomes) ? parsed.incomes : [];
    const nextIncomes = incomes.filter((entry) => entry?.id !== id);
    if (nextIncomes.length === incomes.length) return;
    const nextProfile = { ...parsed, incomes: nextIncomes };
    storageManager.set(buildKey(PROFILE_KEY), nextProfile);
    window.dispatchEvent(new Event("profile-updated"));
  } catch (e) {
    /* ignore storage issues */
  }
};

const syncExpenseToProfile = (txn) => {
  if (!txn || txn.type !== "expense") return;
  const amount = Number(txn.amount);
  if (!Number.isFinite(amount) || amount <= 0) return;
  try {
    const parsed = readStoredProfile();
    const expenses = Array.isArray(parsed?.expenses) ? parsed.expenses : [];
    const nextExpense = {
      id: txn.id,
      name: txn.note?.trim() || txn.category || "Expense",
      category: txn.category,
      expenseType: txn.expenseType || "personal",
      amount,
      linkedTxnId: txn.id,
    };
    const nextProfile = {
      ...parsed,
      expenses: [...expenses.filter((entry) => entry?.linkedTxnId !== txn.id), nextExpense],
    };
    storageManager.set(buildKey(PROFILE_KEY), nextProfile);
    window.dispatchEvent(new Event("profile-updated"));
  } catch (e) {
    /* ignore */
  }
};

const removeExpenseFromProfile = (txnId) => {
  if (!txnId) return;
  try {
    const parsed = readStoredProfile();
    const expenses = Array.isArray(parsed?.expenses) ? parsed.expenses : [];
    const nextExpenses = expenses.filter((entry) => entry?.linkedTxnId !== txnId);
    if (nextExpenses.length === expenses.length) return;
    storageManager.set(buildKey(PROFILE_KEY), { ...parsed, expenses: nextExpenses });
    window.dispatchEvent(new Event("profile-updated"));
  } catch (e) {
    /* ignore */
  }
};

const LiveBudget = ({ onNavigate = () => {}, canGoBack }) => {
  const { profile } = useMoneyProfile();
  const { formatCurrency, preferences } = usePreferences();
  const showBusinessInsights = preferences.premiumAccess && preferences.businessFeatures;
  const [transactions, setTransactions] = useState(() => loadLiveBudgetTransactions());
  const transactionsRef = useRef(transactions);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    type: "expense",
    category: "",
    customCategory: "",
    expenseType: "personal",
    incomeType: "personal",
    amount: "",
    note: "",
  });
  const [range, setRange] = useState("month");
  const [showHistory, setShowHistory] = useState(false);
  const [showRecent, setShowRecent] = useState(true);
  const [showPeriodNotices, setShowPeriodNotices] = useState(true);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef(null);
  const lastAddAtRef = useRef(0);
  const [addFeedback, setAddFeedback] = useState("");
  const [recentTxnId, setRecentTxnId] = useState(null);
  const feedbackTimer = useRef(null);
  const highlightTimer = useRef(null);
  const autoHistoryTimer = useRef(null);
  const historyManualRef = useRef(false);

  useEffect(() => {
    const refreshTransactions = () => setTransactions(loadLiveBudgetTransactions());
    const handleStorage = (event) => {
      if (event.key === TXN_KEY) {
        refreshTransactions();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("live-budget-updated", refreshTransactions);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("live-budget-updated", refreshTransactions);
    };
  }, []);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  const personalProfileIncomes = useMemo(
    () => (profile.incomes || []).filter((i) => isPersonalIncome(i) && !i.linkedTxnId),
    [profile.incomes]
  );
  const personalProfileExpenses = useMemo(
    () => (profile.expenses || []).filter((e) => isPersonalExpense(e) && !e.linkedTxnId),
    [profile.expenses]
  );

  const categories = useMemo(() => {
    const profileCategories = buildCategoriesFromProfile(profile);
    const transactionCategories = buildCategoriesFromTransactions(transactions);
    const extras = Array.from(new Set([...profileCategories, ...transactionCategories])).filter(
      (category) => !DEFAULT_EXPENSE_CATEGORIES.includes(category)
    );
    return [...DEFAULT_EXPENSE_CATEGORIES, ...extras.sort((a, b) => a.localeCompare(b))];
  }, [profile, transactions]);

  const baseIncome = useMemo(
    () => personalProfileIncomes.reduce((sum, entry) => sum + amountForEntry(entry), 0),
    [personalProfileIncomes]
  );
  const baseExpenses = useMemo(
    () => personalProfileExpenses.reduce((sum, entry) => sum + amountForEntry(entry), 0),
    [personalProfileExpenses]
  );

  const period = useMemo(() => getPeriodRange(preferences, transactions), [preferences, transactions]);
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

  const periodTransactions = useMemo(
    () => filterTransactionsByPeriod(transactions, period),
    [transactions, period]
  );
  const personalPeriodTransactions = useMemo(
    () => periodTransactions.filter((txn) => getTransactionScope(txn) !== "business"),
    [periodTransactions]
  );
  const businessPeriodTransactions = useMemo(
    () => periodTransactions.filter((txn) => getTransactionScope(txn) === "business"),
    [periodTransactions]
  );

  const liveIncome = useMemo(
    () =>
      personalPeriodTransactions
        .filter((t) => t.type === "income" && !t.baselineSync)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [personalPeriodTransactions]
  );
  const liveExpenses = useMemo(
    () =>
      personalPeriodTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [personalPeriodTransactions]
  );

  const periodIncome = baseIncome + liveIncome;
  const periodExpenses = baseExpenses + liveExpenses;
  const leftover = periodIncome - periodExpenses;
  const budgeted = baseExpenses;
  const spent = liveExpenses;
  const spendingBalance = periodIncome - spent;

  const incomeEntries = useMemo(() => {
    const profileEntries = personalProfileIncomes
      .map((entry) => ({
        amount: Number(entry.monthly ?? entry.amount ?? 0) || 0,
        date: entry.date,
        source: entry.name,
      }))
      .filter((entry) => Number.isFinite(entry.amount));
    const transactionEntries = personalPeriodTransactions
      .filter((txn) => txn.type === "income")
      .map((txn) => ({
        amount: Number(txn.amount ?? 0),
        date: txn.date,
        source: txn.note || txn.category,
      }))
      .filter((entry) => Number.isFinite(entry.amount));
    return [...profileEntries, ...transactionEntries];
  }, [personalProfileIncomes, personalPeriodTransactions]);

  const hasAnyTransactions = transactions.length > 0;
  const hasCurrentPeriodActivity = periodTransactions.length > 0;
  const needsIncomeConfirmation = liveIncome === 0 && baseIncome > 0;
  const isZeroState = !hasAnyTransactions;

  const historyIndex = useMemo(
    () => readHistoryIndex(period.mode),
    [period.mode, period.key, periodTransactions.length]
  );
  const lastHistoryKey = historyIndex.length ? historyIndex[historyIndex.length - 1] : null;
  const periodGap = useMemo(
    () => getPeriodGapCount(preferences, period.key, lastHistoryKey),
    [preferences, period.key, lastHistoryKey]
  );

  useEffect(() => {
    if (!hasCurrentPeriodActivity || needsIncomeConfirmation) {
      setShowPeriodNotices(true);
      const timer = setTimeout(() => setShowPeriodNotices(false), 45000);
      return () => clearTimeout(timer);
    }
    setShowPeriodNotices(false);
    return undefined;
  }, [hasCurrentPeriodActivity, needsIncomeConfirmation]);

  useEffect(() => {
    if (!categoryMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target)) {
        setCategoryMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setCategoryMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [categoryMenuOpen]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
      if (highlightTimer.current) {
        clearTimeout(highlightTimer.current);
      }
      if (autoHistoryTimer.current) {
        clearTimeout(autoHistoryTimer.current);
      }
    };
  }, []);

  const periodNotice = useMemo(() => {
    if (!hasCurrentPeriodActivity) {
      return "We'll begin tracking this period the moment you log your first transaction.";
    }
    if (needsIncomeConfirmation) {
      return "Add your first paycheck this period and we'll keep the numbers grounded.";
    }
    return "";
  }, [hasCurrentPeriodActivity, needsIncomeConfirmation]);

  const showNegativeBanner = leftover < 0 && (periodIncome > 0 || periodExpenses > 0);

  const summaryValue = (value) => {
    if (isZeroState && Number(value) === 0) return "--";
    return formatCurrency(value);
  };
  const spendingBalanceDisplay = summaryValue(spendingBalance);
  const spendingBalanceClass =
    spendingBalance < 0 && spendingBalanceDisplay !== "--" ? "neg" : "";
  const summaryDelta = budgeted - spent;
  const baselineLeftoverPlan = baseIncome - baseExpenses;
  const showSummaryDelta = hasCurrentPeriodActivity && budgeted > 0 && baselineLeftoverPlan > 0;
  const summaryDeltaCopy =
    summaryDelta >= 0
      ? `Buffer growing by ${formatCurrency(summaryDelta)}`
      : `Giving leftover room to reset (${formatCurrency(Math.abs(summaryDelta))})`;
  const summaryDeltaClass = summaryDelta >= 0 ? "pos" : "neg";

  const sortedPeriodTransactions = useMemo(() => {
    return [...periodTransactions].sort((a, b) => {
      const dateA = new Date(a.date || Date.now());
      const dateB = new Date(b.date || Date.now());
      return dateB - dateA;
    });
  }, [periodTransactions]);

  const recentPersonal = useMemo(
    () => sortedPeriodTransactions.filter((t) => getTransactionScope(t) !== "business").slice(0, 6),
    [sortedPeriodTransactions]
  );
  const recentBusiness = useMemo(
    () => sortedPeriodTransactions.filter((t) => getTransactionScope(t) === "business").slice(0, 6),
    [sortedPeriodTransactions]
  );

  const businessProfileIncomeTotal = useMemo(
    () =>
      (profile.incomes || [])
        .filter((entry) => (entry.incomeType || "personal") === "business" && !entry.linkedTxnId)
        .reduce((sum, entry) => sum + (Number(entry.monthly ?? entry.amount ?? 0) || 0), 0),
    [profile.incomes]
  );
  const businessProfileExpenseTotal = useMemo(
    () =>
      (profile.expenses || [])
        .filter((entry) => (entry.expenseType || "personal") === "business" && !entry.linkedTxnId)
        .reduce((sum, entry) => sum + (Number(entry.monthly ?? entry.amount ?? 0) || 0), 0),
    [profile.expenses]
  );
  const businessPeriodIncome = useMemo(
    () =>
      businessPeriodTransactions
        .filter((txn) => txn.type === "income")
        .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0),
    [businessPeriodTransactions]
  );
  const businessPeriodExpenses = useMemo(
    () =>
      businessPeriodTransactions
        .filter((txn) => txn.type === "expense")
        .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0),
    [businessPeriodTransactions]
  );
  const businessIncomeTotal = businessProfileIncomeTotal + businessPeriodIncome;
  const businessExpenseTotal = businessProfileExpenseTotal + businessPeriodExpenses;
  const businessNetTotal = businessIncomeTotal - businessExpenseTotal;

  const paceRatio = periodIncome > 0 ? spent / periodIncome : 0;
  const paceClass =
    leftover < 0 ? "bad" : paceRatio > 0.8 ? "warn" : "good";
  const paceLabel =
    leftover < 0 ? "Plan needs attention" : paceRatio > 0.8 ? "Running a bit ahead" : "On pace";
  const paceHelper =
    leftover < 0
      ? "Your plan is structurally short this period. Tracking still helps—every honest entry keeps the picture accurate."
      : paceRatio > 0.8
        ? "Spending is running a bit ahead of income. A calm slowdown keeps things steady."
        : "You're in sync with income—keep holding this steady pace.";

  const rangeFiltered = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (range === "day") {
      start.setHours(0, 0, 0, 0);
    } else if (range === "week") {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
    } else if (range === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (range === "year") {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    }
    return transactions.filter((t) => {
      const d = new Date(t.date || Date.now());
      return d >= start && d <= now;
    });
  }, [transactions, range]);

  const historyBlocks = useMemo(() => {
    const groups = new Map();
    rangeFiltered.forEach((t) => {
      const d = new Date(t.date || Date.now());
      const key = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      if (!groups.has(key)) groups.set(key, { income: 0, expense: 0, list: [] });
      const g = groups.get(key);
      const amt = Number(t.amount) || 0;
      if (t.type === "income") g.income += amt;
      else g.expense += amt;
      g.list.push(t);
    });
    return Array.from(groups.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [rangeFiltered]);

  const persistTransactions = (updater) => {
    const prev = transactionsRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (areTransactionsEqual(prev, next)) return;
    setTransactions(next);
    try {
      storageManager.set(buildKey(TXN_KEY), next);
      window.dispatchEvent(new Event("live-budget-updated"));
    } catch (e) {
      /* ignore storage issues */
    }
  };

  const showHistoryPreview = () => {
    if (historyManualRef.current) return;
    setShowHistory(true);
    if (autoHistoryTimer.current) {
      clearTimeout(autoHistoryTimer.current);
    }
    autoHistoryTimer.current = window.setTimeout(() => {
      setShowHistory(false);
      autoHistoryTimer.current = null;
    }, 3600);
  };

  const handleHistoryToggle = () => {
    historyManualRef.current = true;
    if (autoHistoryTimer.current) {
      clearTimeout(autoHistoryTimer.current);
      autoHistoryTimer.current = null;
    }
    setShowHistory((prev) => !prev);
  };

  const handleAdd = () => {
    const now = Date.now();
    if (now - lastAddAtRef.current < 500) return;
    lastAddAtRef.current = now;
    const amt = Number(draft.amount);
    if (!amt || amt <= 0) return;
    const resolvedCategory =
      draft.category === "__custom__" ? draft.customCategory.trim() : draft.category.trim();
    if (draft.type === "expense" && !resolvedCategory) {
      alert("Pick a category for this expense.");
      return;
    }
    const payloadId =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now();
    const syncToBaseline =
      draft.type === "income" && (draft.incomeType || "personal") === "personal";
    const payload = {
      id: payloadId,
      type: draft.type,
      category: draft.type === "income" ? "Income" : resolvedCategory,
      incomeType: draft.type === "income" ? draft.incomeType : undefined,
      expenseType: draft.type === "expense" ? draft.expenseType : undefined,
      amount: amt,
      note: draft.note,
      date: new Date().toISOString(),
      baselineSync: syncToBaseline || undefined,
    };
    const existing = loadLiveBudgetTransactions();
    if (existing.some((entry) => entry.id === payload.id)) return;
    persistTransactions((prev) =>
      prev.some((entry) => entry.id === payload.id) ? prev : [payload, ...prev.slice(0, 199)]
    );
    if (syncToBaseline) {
      syncIncomeToProfile({
        id: payload.id,
        name: draft.note?.trim() || "Income",
        category: "Income",
        amount: amt,
        incomeType: draft.incomeType || "personal",
      });
    }
    if (payload.type === "expense" && (payload.expenseType || "personal") === "personal") {
      syncExpenseToProfile(payload);
    }
    setDraft((d) => ({
      ...d,
      amount: "",
      note: "",
      category: "",
      customCategory: "",
      expenseType: "personal",
      incomeType: "personal",
    }));
    setShowForm(false);
    const successMessage =
      payload.type === "income" ? "Income added ✓" : "Expense noted ✓";
    setAddFeedback(successMessage);
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = window.setTimeout(() => {
      setAddFeedback("");
    }, 3200);
    setRecentTxnId(payload.id);
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => {
      setRecentTxnId(null);
    }, 3800);
    showHistoryPreview();
  };

  const deleteTransaction = (id) => {
    const target = transactionsRef.current.find((t) => t.id === id);
    if (target?.baselineSync && target?.type === "income") {
      removeIncomeFromProfile(target.id);
    }
    if (
      target?.type === "expense" &&
      (target.expenseType || "personal") === "personal"
    ) {
      removeExpenseFromProfile(target.id);
    }
    persistTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="live-budget-page">
        <header className="lb-header">
          <TopRightControls
            className="top-controls"
            activePage="livebudget"
            onNavigate={onNavigate}
            logoutHref="/Local/BudgetIQ Login"
          />
          {canGoBack && (
            <button className="back-btn" type="button" onClick={() => onNavigate("back")}>
              {"<"}
            </button>
          )}
        </header>
        <div>
          <div className="lb-title">Track Spending</div>
          <div className="lb-subtitle">Track spending in real time and stay on plan.</div>
        </div>
        <HeroGlue
          role="Record"
          why="Logging transactions keeps your plan grounded in reality."
          reassurance="The more true the picture, the calmer and smarter Luna can guide you."
        />

      {periodLabel && <div className="lb-period-note">{periodLabel}</div>}
      {showNegativeBanner && (
        <div className="lb-negative-banner">
          Your plan is structurally short this period. Tracking still helps—each honest entry keeps the picture clear.
          <span className="lb-negative-detail">
            Your required bills and obligations are larger than this period’s income, so this is a funding gap, not just a spending pace.
          </span>
        </div>
      )}
      {periodGap > 0 && (
        <div className="lb-monthly-note">
          We haven't seen activity for {periodGap} period{periodGap === 1 ? "" : "s"}. This period starts fresh once you log new spending.
        </div>
      )}
      {showPeriodNotices && periodNotice && (
        <div className="lb-monthly-note">{periodNotice}</div>
      )}

      <div className="lb-container">
        {isZeroState && (
          <div className="lb-zero-state">
            <div className="lb-zero-title">Your spending story starts here</div>
            <div className="lb-zero-body">
              This page keeps your spending steady through the month. We'll begin tracking this period the moment you
              log your first transaction.
            </div>
            <button className="primary-btn purple-save-btn interactive-cta pressable" onClick={() => setShowForm(true)}>
              Add your first transaction
            </button>
          </div>
        )}

        <div className="lb-hero-group">
          <div className="lb-card lb-highlight interactive-card">
            <div className="lb-section-label">
              <div className="lb-section-label-title">This period snapshot</div>
              <div className="lb-section-label-sub">
                Personal budget only. Business items stay separate from your personal plan.
              </div>
            </div>
            <div className="lb-summary-grid">
              <div className="lb-summary-income">
                <div className="lb-label">Income this period</div>
                <div className="lb-value">{summaryValue(periodIncome)}</div>
              </div>
              <div className="lb-summary-budgeted">
                <div className="lb-label">Budgeted</div>
                <div className="lb-value">{summaryValue(budgeted)}</div>
              </div>
              <div className="lb-summary-spent">
                <div className="lb-label">Spent so far</div>
                <div className="lb-value">{summaryValue(spent)}</div>
                {showSummaryDelta && (
                  <div className={`lb-delta ${summaryDeltaClass}`}>{summaryDeltaCopy}</div>
                )}
              </div>
              <div className="lb-leftover-col">
                <div className="lb-label">Spending Balance</div>
                <div className={`lb-value leftover ${spendingBalanceClass}`}>{spendingBalanceDisplay}</div>
              </div>
            </div>
            {!isZeroState && (
              <div className="lb-cta-row">
                <button className="primary-btn purple-save-btn interactive-cta pressable" onClick={() => setShowForm(true)}>
                  Add Transaction
                </button>
                {addFeedback && (
                  <div className="lb-add-feedback reassure-banner" role="status" aria-live="polite">
                    {addFeedback}
                  </div>
                )}
              </div>
            )}
          </div>

          {(showBusinessInsights || businessPeriodTransactions.length > 0) && (
            <div className="lb-card lb-business-card interactive-card">
              <div className="lb-card-title">Business Snapshot</div>
              <div className="lb-helper">
                Business items stay separate from your personal budget. Business income won’t change your baseline.
              </div>
              <div className="lb-business-summary">
                <div>
                  <div className="lb-label">Business income</div>
                  <div className="lb-value">{formatCurrency(businessIncomeTotal)}</div>
                </div>
                <div>
                  <div className="lb-label">Business expenses</div>
                  <div className="lb-value">{formatCurrency(businessExpenseTotal)}</div>
                </div>
                <div>
                  <div className="lb-label">Net business</div>
                  <div className={`lb-value ${businessNetTotal < 0 ? "neg" : ""}`}>
                    {formatCurrency(businessNetTotal)}
                  </div>
                </div>
              </div>
              <div className="lb-business-cta">
                <button className="secondary-btn" type="button" onClick={() => onNavigate("business-tools")}>
                  Generate tax summary
                </button>
              </div>
            </div>
          )}
        </div>

        {hasCurrentPeriodActivity && (
          <div className="lb-card interactive-card">
            <div className="lb-card-title">Spending Pace</div>
              <div className="lb-helper">Tracks spending against income in real time.</div>
            <div className="lb-bar-card">
              <div className="lb-bar-header">
                <div>
                  <div className="lb-label">Spent so far</div>
                  <div className="lb-value">{formatCurrency(spent)}</div>
                </div>
                <div>
                  <div className="lb-label">Target (income)</div>
                  <div className="lb-value">{formatCurrency(periodIncome)}</div>
                </div>
              </div>
              <div className="lb-bar-shell">
                <div
                  className={`lb-bar-fill ${paceClass}`}
                  style={{ width: `${Math.min(paceRatio * 100, 140)}%` }}
                />
              </div>
              <div className="lb-bar-footer">
                <span className={`lb-chip ${paceClass}`}>{paceLabel}</span>
                <span className="lb-status-helper">{paceHelper}</span>
              </div>
            </div>
          </div>
        )}

        {hasAnyTransactions && (
          <div className="lb-card interactive-card">
            <div className="lb-card-title-row">
              <div className="lb-card-title">Recent Activity</div>
              <button className="lb-collapse-btn" onClick={() => setShowRecent((v) => !v)} aria-label="Toggle recent activity">
                {showRecent ? "\u25BC" : "\u25B6"}
              </button>
            </div>
            {showRecent && (
              <>
                {!hasCurrentPeriodActivity ? (
                  <div className="lb-helper">No activity logged yet this period. Add a transaction to start tracking.</div>
                ) : (
                  <div className="lb-recent-sections">
                    <div className="lb-activity-section">
                      <div className="lb-activity-section-header">
                        <span>Personal activity</span>
                        <span>{recentPersonal.length} items</span>
                      </div>
                      {recentPersonal.length === 0 ? (
                        <div className="lb-helper">No recent personal transactions.</div>
                      ) : (
                        <div className="lb-feed">
                          {recentPersonal.map((t) => {
                            const isRecentEntry = recentTxnId === t.id;
                          return (
                            <div key={t.id} className={`lb-feed-row pressable${isRecentEntry ? " recent" : ""}`}>
                                <div>
                                  <div className="lb-feed-title">
                                    {t.note || t.category || "Transaction"}
                                    <span className="lb-transaction-type-label personal">Personal</span>
                                  </div>
                                  <div className="lb-feed-note">
                                    {t.type === "income" ? "Income" : "Expense"}
                                  </div>
                                </div>
                                <div className={`lb-feed-amt ${t.type === "income" ? "pos" : "neg"}`}>
                                  {t.type === "income" ? "+" : "-"}
                                  {formatCurrency(Number(t.amount || 0))}
                                </div>
                                <button className="lb-delete-btn" onClick={() => deleteTransaction(t.id)}>
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {(showBusinessInsights || businessPeriodTransactions.length > 0) && (
                      <div className="lb-activity-section">
                        <div className="lb-activity-section-header">
                          <span>Business activity</span>
                          <span>{recentBusiness.length} items</span>
                        </div>
                        {recentBusiness.length === 0 ? (
                          <div className="lb-helper">No business activity yet.</div>
                        ) : (
                          <div className="lb-feed">
                            {recentBusiness.map((t) => {
                              const isRecentEntry = recentTxnId === t.id;
                              return (
                            <div key={t.id} className={`lb-feed-row pressable${isRecentEntry ? " recent" : ""}`}>
                                  <div>
                                    <div className="lb-feed-title">
                                      {t.note || t.category || "Transaction"}
                                      <span className="lb-transaction-type-label business">Business</span>
                                    </div>
                                    <div className="lb-feed-note">
                                      {t.type === "income" ? "Income" : "Expense"}
                                    </div>
                                  </div>
                                  <div className={`lb-feed-amt ${t.type === "income" ? "pos" : "neg"}`}>
                                    {t.type === "income" ? "+" : "-"}
                                    {formatCurrency(Number(t.amount || 0))}
                                  </div>
                                  <button className="lb-delete-btn" onClick={() => deleteTransaction(t.id)}>
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {hasAnyTransactions && (
          <div className="lb-card interactive-card">
            <div className="lb-card-title-row">
              <div className="lb-card-title">History</div>
              <button className="lb-collapse-btn" onClick={handleHistoryToggle} aria-label="Toggle history">
                {showHistory ? "\u25BC" : "\u25B6"}
              </button>
            </div>
            <div className="lb-range-row">
              {["day", "week", "month", "year"].map((r) => (
                <button key={r} className={`lb-range-btn ${range === r ? "active" : ""}`} onClick={() => setRange(r)}>
                  {r === "day" ? "Today" : r === "week" ? "This Week" : r === "month" ? "This Month" : "This Year"}
                </button>
              ))}
            </div>
            {showHistory &&
              (historyBlocks.length === 0 ? (
                <div className="lb-helper">No activity yet in this range.</div>
              ) : (
                <div className="lb-history">
                  {historyBlocks.map((block) => (
                    <div key={block.date} className="lb-history-card">
                      <div className="lb-history-head">
                        <div className="lb-history-date">{block.date}</div>
                        <div className="lb-history-sum">
                          <span className="pos">+{formatCurrency(block.income)}</span>
                          <span className="neg">-{formatCurrency(block.expense)}</span>
                        </div>
                      </div>
                      <div className="lb-history-list">
                      {block.list.slice(0, 4).map((t) => {
                        const scope = getTransactionScope(t);
                        const isRecentEntry = recentTxnId === t.id;
                        return (
                          <div key={t.id} className={`lb-history-row pressable${isRecentEntry ? " recent" : ""}`}>
                            <span className="lb-history-label">
                              {t.note || t.category || "Entry"}
                              <span className={`lb-transaction-type-label ${scope}`}>
                                {scope === "business" ? "Business" : "Personal"}
                              </span>
                            </span>
                            <span className={`lb-history-amt ${t.type === "income" ? "pos" : "neg"}`}>
                              {t.type === "income" ? "+" : "-"}
                              {formatCurrency(Number(t.amount || 0))}
                            </span>
                          </div>
                        );
                      })}
                        {block.list.length > 4 && <div className="lb-helper">+{block.list.length - 4} more</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="lb-modal" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="lb-modal-content">
            <div className="lb-modal-title">Add Transaction</div>
            <label className="lb-form-label">Type</label>
            <div className="lb-toggle">
            {["expense", "income"].map((type) => (
              <button
                key={type}
                className={`lb-toggle-btn ${draft.type === type ? "active" : ""}`}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    type,
                    category: "",
                    customCategory: "",
                    expenseType: "personal",
                    incomeType: "personal",
                  }))
                }
              >
                {type === "expense" ? "Expense" : "Income"}
              </button>
            ))}
            </div>

            {draft.type === "expense" ? (
              <>
                {showBusinessInsights && (
                  <>
                    <label className="lb-form-label">Expense type</label>
                    <select
                      className="lb-input"
                      value={draft.expenseType}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          expenseType: e.target.value,
                        }))
                      }
                    >
                      <option value="personal">Personal</option>
                      <option value="business">Business</option>
                    </select>
                  </>
                )}
                <label className="lb-form-label">Category</label>
                <div className="lb-dropdown" ref={categoryMenuRef}>
                  <button
                    type="button"
                    className="lb-dropdown-btn"
                    onClick={() => setCategoryMenuOpen((open) => !open)}
                  >
                    {draft.category
                      ? draft.category === "__custom__"
                        ? "Custom"
                        : draft.category
                      : "Select"}
                    <span className="lb-dropdown-caret" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  {categoryMenuOpen && (
                    <div className="lb-dropdown-menu">
                      <button
                        type="button"
                        className="lb-dropdown-item"
                        onClick={() => {
                          setDraft((d) => ({ ...d, category: "", customCategory: "" }));
                          setCategoryMenuOpen(false);
                        }}
                      >
                        Select
                      </button>
                      {categories.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="lb-dropdown-item"
                          onClick={() => {
                            setDraft((d) => ({ ...d, category: c, customCategory: "" }));
                            setCategoryMenuOpen(false);
                          }}
                        >
                          {c}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="lb-dropdown-item"
                        onClick={() => {
                          setDraft((d) => ({ ...d, category: "__custom__" }));
                          setCategoryMenuOpen(false);
                        }}
                      >
                        Custom
                      </button>
                    </div>
                  )}
                </div>
                {draft.category === "__custom__" && (
                  <input
                    className="lb-input"
                    value={draft.customCategory}
                    onChange={(e) => setDraft((d) => ({ ...d, customCategory: e.target.value }))}
                    placeholder="Enter custom category"
                    style={{ marginTop: 8 }}
                  />
                )}
              </>
            ) : (
              <>
                {showBusinessInsights && (
                  <>
                    <label className="lb-form-label">Income type</label>
                    <select
                      className="lb-input"
                      value={draft.incomeType}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          incomeType: e.target.value,
                        }))
                      }
                    >
                      <option value="personal">Personal</option>
                      <option value="business">Business</option>
                    </select>
                  </>
                )}
                <div className="lb-helper" style={{ marginTop: 8 }}>
                  Income is tracked without a category.
                </div>
              </>
            )}

            <label className="lb-form-label">Amount</label>
            <input
              className="lb-input"
              type="number"
              min="0"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              placeholder="e.g. 42.50"
            />

            <label className="lb-form-label">Note (optional)</label>
            <input
              className="lb-input"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              placeholder="e.g. Grocery run"
            />

            <div className="lb-modal-actions">
              <button className="primary-btn purple-save-btn" onClick={handleAdd}>
                {showBusinessInsights ? "Add transaction" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveBudget;
