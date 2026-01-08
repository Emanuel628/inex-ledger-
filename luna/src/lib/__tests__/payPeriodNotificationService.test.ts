import { describe, expect, it, vi } from "vitest";
import { emitPayPeriodPlanReady, PLAN_READY_EVENT } from "../payPeriodNotificationService";
import { PayPeriodPlanner } from "../payPeriodPlannerService";

const createSamplePlan = () =>
  PayPeriodPlanner.generate({
    totals: { income: 3200, expenses: 2100, leftover: 1100 },
    tier: "steady",
    triggerSource: "manual",
    incomeEntries: [
      { amount: 1200, date: "2025-01-01T00:00:00Z" },
      { amount: 1200, date: "2025-01-14T00:00:00Z" },
    ],
    now: new Date("2025-01-14T00:00:00Z"),
    snapshotOverrides: { currency: "USD" },
  }).plan;

const ensureWindow = () => {
  if (typeof window !== "undefined") return;
  const target = new EventTarget();
  (globalThis as any).window = target as unknown as Window;
};

describe("Pay Period Notification Service", () => {
  it("dispatches a DOM event with the notification payload", () => {
    ensureWindow();
    const plan = createSamplePlan();
    const listener = vi.fn();
    window.addEventListener(PLAN_READY_EVENT, listener);
    const payload = emitPayPeriodPlanReady(plan, "email");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual(payload);
    window.removeEventListener(PLAN_READY_EVENT, listener);
  });

  it("returns a payload that highlights the summary and supportive copy", () => {
    const plan = createSamplePlan();
    const payload = emitPayPeriodPlanReady(plan, "push");
    expect(payload.subject).toContain("calm plan for this pay period");
    expect(payload.body).toContain(plan.recommendation.summaryLine);
    expect(payload.body).toContain(plan.recommendation.supportiveLine);
  });
});
