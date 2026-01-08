export const DASHBOARD_HIDDEN_KEY = " dashboardHiddenCards\;
export const HIDDEN_CARDS_EVENT = \dashboard-hidden-cards-updated\;

export const DEFAULT_CARD_ORDER = [
 \premium\,
 \goals\,
 \goalEstimate\,
 \spending\,
 \changes\,
 \moneyCoach\,
 \creditSnapshot\,
];

export const CARD_TITLES = {
 premium: \Freelancer snapshot\,
 goals: \Goals\,
 goalEstimate: \Debt-Free / Goals Timeline\,
 spending: \Spending Breakdown\,
 changes: \What changed this month\,
 moneyCoach: \Money Coach\,
 creditSnapshot: \Credit Snapshot\,
};

export const loadHiddenDashboardCards = () => {
 if (typeof window === \undefined\) return [];
 try {
 const stored = localStorage.getItem(DASHBOARD_HIDDEN_KEY);
 if (!stored) return [];
 const parsed = JSON.parse(stored);
 return Array.isArray(parsed) ? parsed : [];
 } catch (err) {
 return [];
 }
};

export const saveHiddenDashboardCards = (cards) => {
 if (typeof window === \undefined\) return;
 try {
 localStorage.setItem(DASHBOARD_HIDDEN_KEY, JSON.stringify(cards));
 } catch (err) {
 /* ignore */
 }
};

export const broadcastHiddenDashboardCards = (cards) => {
 if (typeof window === \undefined\ || typeof window.CustomEvent === \undefined\) return;
 try {
 const event = new CustomEvent(HIDDEN_CARDS_EVENT, { detail: cards });
 window.dispatchEvent(event);
 } catch (err) {
 /* ignore */
 }
};
