const HIDDEN_CARDS_KEY = "dashboardHiddenCards";
const HIDDEN_CARDS_EVENT = "dashboard-hidden-cards-updated";

const CARD_LABELS = {
  score: "Financial Score",
  goals: "Goals",
  moneyCoach: "Money Coach",
  monthlySnapshot: "Monthly Snapshot",
  spending: "Spending Breakdown",
  creditSnapshot: "Budget Plan",
  savings: "Savings",
  netWorth: "Net Worth",
  businessToolkit: "Business Toolkit",
};

const hasLocalStorage = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const getStorage = () => (hasLocalStorage ? window.localStorage : null);

const safeParse = (value) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

const loadHiddenDashboardCards = () => {
  const storage = getStorage();
  if (!storage) return [];
  const stored = storage.getItem(HIDDEN_CARDS_KEY);
  if (!stored) return [];
  return safeParse(stored);
};

const saveHiddenDashboardCards = (cards) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(HIDDEN_CARDS_KEY, JSON.stringify(cards));
  } catch (err) {
    /* ignore */
  }
};

const broadcastHiddenDashboardCards = () => {
  if (typeof window === "undefined") return;
  try {
    const event = new CustomEvent(HIDDEN_CARDS_EVENT);
    window.dispatchEvent(event);
  } catch (err) {
    /* ignore */
  }
};

export {
  HIDDEN_CARDS_KEY,
  HIDDEN_CARDS_EVENT,
  CARD_LABELS,
  loadHiddenDashboardCards,
  saveHiddenDashboardCards,
  broadcastHiddenDashboardCards,
};
