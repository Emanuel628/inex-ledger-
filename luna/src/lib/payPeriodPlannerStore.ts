import { storageManager } from "../utils/storageManager";
import { PayPeriodPlan, PayPeriodPlanSchema } from "./payPeriodPlannerContract";
import { buildKey } from "../utils/userStorage";

const PLAN_HISTORY_KEY = "payPeriodPlans";
const LATEST_PLAN_ID_KEY = "payPeriodLatestPlanId";
const PLAN_UPDATE_EVENT = "pay-period-plan-updated";

const planHistoryKey = () => buildKey(PLAN_HISTORY_KEY);
const latestPlanIdKey = () => buildKey(LATEST_PLAN_ID_KEY);

const readHistory = () => {
  const stored = storageManager.get(planHistoryKey());
  return Array.isArray(stored) ? stored : [];
};

const writeHistory = (history: PayPeriodPlan[]) => {
  storageManager.set(planHistoryKey(), history);
};

const getLatestPlanId = (): string | null => {
  const stored = storageManager.get(latestPlanIdKey());
  if (stored && typeof stored === "object" && typeof stored.id === "string") {
    return stored.id;
  }
  return null;
};

const setLatestPlanId = (planId: string) => {
  storageManager.set(latestPlanIdKey(), { id: planId });
};

const markSuperseded = (plan: PayPeriodPlan): PayPeriodPlan => {
  if (plan.status.state === "active") {
    return { ...plan, status: { ...plan.status, state: "superseded" } };
  }
  return plan;
};

const shouldExpire = (plan: PayPeriodPlan, now: Date) => {
  if (plan.status.state === "expired") return false;
  const endDate = plan.period?.end ? new Date(plan.period.end) : null;
  return endDate !== null && !Number.isNaN(endDate.getTime()) && endDate < now;
};

const dispatchPlanUpdate = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PLAN_UPDATE_EVENT));
};

export const getPlanHistory = (): PayPeriodPlan[] => readHistory();

export const getLatestPlan = (): PayPeriodPlan | null => {
  const history = readHistory();
  const latestId = getLatestPlanId();
  if (!latestId) return history.length ? history[history.length - 1] : null;
  const match = history.find((plan) => plan.id === latestId);
  return match || null;
};

export const persistPlan = (plan: PayPeriodPlan): PayPeriodPlan => {
  const normalized = PayPeriodPlanSchema.parse(plan);
  const history = readHistory();
  const superseded = history.map(markSuperseded);
  const next = [...superseded, normalized];
  writeHistory(next);
  setLatestPlanId(normalized.id);
  dispatchPlanUpdate();
  return normalized;
};

export const expirePlansIfNeeded = (now: Date = new Date()): PayPeriodPlan[] => {
  const history = readHistory();
  let mutated = false;
  const next = history.map((plan) => {
    if (shouldExpire(plan, now)) {
      mutated = true;
      return { ...plan, status: { ...plan.status, state: "expired" } };
    }
    return plan;
  });
  if (mutated) {
    writeHistory(next);
    dispatchPlanUpdate();
  }
  return next;
};

export const clearPlanHistory = () => {
  writeHistory([]);
  storageManager.set(latestPlanIdKey(), { id: "" });
};

export const markPlanAcknowledged = (planId: string): PayPeriodPlan | null => {
  const history = readHistory();
  let acknowledgedPlan: PayPeriodPlan | null = null;
  const next = history.map((plan) => {
    if (plan.id !== planId) return plan;
    acknowledgedPlan = {
      ...plan,
      status: {
        ...plan.status,
        state: "acknowledged",
        acknowledgedAt: new Date().toISOString(),
      },
    };
    return acknowledgedPlan;
  });
  if (!acknowledgedPlan) return null;
  writeHistory(next);
  setLatestPlanId(planId);
  dispatchPlanUpdate();
  return acknowledgedPlan;
};

export const onPlanUpdate = (listener: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PLAN_UPDATE_EVENT, listener);
  return () => window.removeEventListener(PLAN_UPDATE_EVENT, listener);
};
