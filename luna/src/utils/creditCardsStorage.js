import { readNamespacedItem, writeNamespacedItem } from "./userStorage";

const CARD_KEY = "creditCards";
const CREDIT_CARDS_EVENT = "credit-cards-updated";

const normalizeCards = (cards) =>
  (cards || []).map((card) => ({
    ...card,
    paid: !!card.paid,
    balance: Number(card.balance) || 0,
    apr: Number(card.apr) || 0,
    minPayment: Number(card.minPayment) || 0,
    rollForward: Number(card.rollForward) || 0,
  }));

const loadCreditCards = () => {
  if (typeof window === "undefined") return [];
  try {
    const stored = readNamespacedItem(CARD_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return normalizeCards(parsed);
  } catch (e) {
    return [];
  }
};

const saveCreditCards = (cards = []) => {
  if (typeof window === "undefined") {
    return normalizeCards(cards);
  }
  try {
    writeNamespacedItem(CARD_KEY, JSON.stringify(cards));
  } catch (e) {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CREDIT_CARDS_EVENT));
  return normalizeCards(cards);
};

export { CARD_KEY, CREDIT_CARDS_EVENT, loadCreditCards, saveCreditCards };
