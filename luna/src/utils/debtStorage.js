import { readNamespacedItem, writeNamespacedItem } from "./userStorage";

const DEBT_CASH_KEY = "debtCashForm";
const PLAN_TYPE_KEY = "debtPlanType";

const safeParseJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const readDebtCashForm = () => {
  const stored = readNamespacedItem(DEBT_CASH_KEY);
  return safeParseJson(stored);
};

const writeDebtCashForm = (payload) => {
  if (!payload) {
    writeNamespacedItem(DEBT_CASH_KEY, "");
    return;
  }
  try {
    writeNamespacedItem(DEBT_CASH_KEY, JSON.stringify(payload));
  } catch (error) {
    writeNamespacedItem(DEBT_CASH_KEY, "");
  }
};

const readDebtPlanType = () => {
  const stored = readNamespacedItem(PLAN_TYPE_KEY);
  return stored === "avalanche" ? "avalanche" : "snowball";
};

const writeDebtPlanType = (value) => {
  writeNamespacedItem(PLAN_TYPE_KEY, value === "avalanche" ? "avalanche" : "snowball");
};

export {
  DEBT_CASH_KEY,
  PLAN_TYPE_KEY,
  readDebtCashForm,
  writeDebtCashForm,
  readDebtPlanType,
  writeDebtPlanType,
};
