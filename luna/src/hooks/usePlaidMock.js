import { storageManager } from "../utils/storageManager";
import { buildKey } from "../utils/userStorage";

const MOCK_TRANSACTIONS = [
  {
    id: "mock-coffee",
    name: "Morning Coffee",
    category: "Food",
    amount: 5.95,
    type: "expense",
    incomeType: "personal",
    note: "Cafe on Main",
    daysOffset: -2,
  },
  {
    id: "mock-grocery",
    name: "Weekend Groceries",
    category: "Food",
    amount: 78.42,
    type: "expense",
    note: "Weekly run",
    daysOffset: -5,
  },
  {
    id: "mock-rent",
    name: "Rent",
    category: "Housing",
    amount: 1200,
    type: "expense",
    note: "Monthly housing",
    daysOffset: -10,
  },
  {
    id: "mock-paycheck",
    name: "Mock Paycheck",
    category: "Income",
    amount: 3100,
    type: "income",
    note: "Salary stub",
    daysOffset: -4,
  },
  {
    id: "mock-internet",
    name: "Internet",
    category: "WiFi",
    amount: 65.1,
    type: "expense",
    note: "Home internet",
    daysOffset: -3,
  },
];

const SAFE_NUMBER = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const findManualMatch = (manuals, candidate) => {
  if (!manuals.length) return null;
  const candidateDate = new Date(Date.now() + candidate.daysOffset * 24 * 60 * 60 * 1000);
  const toleranceMs = 3 * 24 * 60 * 60 * 1000;

  return manuals.find((manual) => {
    const dateDelta = Math.abs(new Date(manual.date || Date.now()) - candidateDate);
    const amountDelta = Math.abs(SAFE_NUMBER(manual.amount) - candidate.amount);
    return (
      manual.type === candidate.type &&
      dateDelta <= toleranceMs &&
      amountDelta <= 1
    );
  });
};

const computeConfidence = (match, candidate) => {
  if (!match) return 0.25;
  const amountDelta = Math.abs(SAFE_NUMBER(match.amount) - SAFE_NUMBER(candidate.amount));
  const base = 0.9 - Math.min(0.1, amountDelta / (Math.max(1, SAFE_NUMBER(candidate.amount)) || 1));
  return Math.min(1, Math.max(0.7, base + Math.random() * 0.1));
};

const buildTransactions = (manualTransactions) => {
  const now = Date.now();
  return MOCK_TRANSACTIONS.map((entry, index) => {
    const date = new Date(now + entry.daysOffset * 24 * 60 * 60 * 1000);
    const manualMatch = findManualMatch(manualTransactions, entry);
    return {
      ...entry,
      id: `${entry.id}-${Date.now()}-${index}`,
      originalName: entry.name,
      date: date.toISOString(),
      source: "mock",
      type: entry.type,
      incomeType: entry.type === "income" ? "personal" : undefined,
      reconciliationStatus: "needs-review",
      matchConfidence: computeConfidence(manualMatch, entry),
    };
  });
};

export const usePlaidMock = () => {
  const simulateLink = async () => {
    storageManager.setState("syncing");
    await new Promise((resolve) => setTimeout(resolve, 1300));

    const profile = storageManager.get(buildKey("moneyProfile")) || {
      incomes: [],
      expenses: [],
    };
    const nextProfile = {
      ...profile,
      plaidItems: [
        ...(profile.plaidItems || []),
        {
          id: `mock-item-${Date.now()}`,
          institution_name: "Mock Financial",
          status: "connected",
        },
      ],
    };
    storageManager.set(buildKey("moneyProfile"), nextProfile);
    window.dispatchEvent(new CustomEvent("profile-updated"));

    const existingTransactions = storageManager.get(buildKey("liveBudgetTransactions")) || [];
    const manualPool = existingTransactions.filter(
      (txn) => !txn.source || txn.source === "manual" || txn.source === "user"
    );
    const newTransactions = buildTransactions(manualPool);
    storageManager.set(buildKey("liveBudgetTransactions"), [...existingTransactions, ...newTransactions]);
    window.dispatchEvent(new CustomEvent("live-budget-updated"));

    storageManager.setState("synced");
    return { success: true, newTransactions };
  };

  return { simulateLink };
};
