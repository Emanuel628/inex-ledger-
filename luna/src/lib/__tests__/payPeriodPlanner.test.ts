import { beforeEach, describe, expect, it } from "vitest";
import { makePlanSnapshot } from "../payPeriodPlannerContract";
import {
  allocateRecommendation,
  inferPaySchedule,
  PayPeriodPlanner,
  shouldRegeneratePlan,
  tierRules,
} from "../payPeriodPlannerService";
import {
  clearPlanHistory,
  expirePlansIfNeeded,
  getLatestPlan,
  getPlanHistory,
  markPlanAcknowledged,
  persistPlan,
} from "../payPeriodPlannerStore";

const BASE_DATE = new Date("2025-01-10T00:00:00Z");

const createIncomeEntries = (offsetDays: number[]) =>
  offsetDays.map((offset, index) => ({
    amount: 1200 + index * 5,
    date: new Date(BASE_DATE.getTime() - offset * 24 * 60 * 60 * 1000).toISOString(),
  }));

const attachMockGlobals = () => {
  const storage: Record<string, string> = {};
  const mockStorage = {
    getItem: (key: string) => (key in storage ? storage[key] : null),
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    },
  };

  (globalThis as any).localStorage = mockStorage;
  if (typeof (globalThis as any).window === "undefined") {
    (globalThis as any).window = {};
  }
  Object.assign((globalThis as any).window, {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: mockStorage,
  });
  (globalThis as any).CustomEvent =
    (globalThis as any).CustomEvent ||
    class {
      type: string;
      detail: unknown;
      constructor(type: string, options?: { detail?: unknown }) {
        this.type = type;
        this.detail = options?.detail;
      }
    };
};

beforeEach(() => {
  attachMockGlobals();
  clearPlanHistory();
});

describe("Pay Period Planner cadence inference", () => {
  it("detects weekly schedule from consistent 7-day spacing", () => {
    const entries = createIncomeEntries([0, 7, 14]);
    const result = inferPaySchedule(entries, BASE_DATE);
    expect(result.schedule).toBe("weekly");
  });

  it("detects biweekly when spacing is ~14 days", () => {
    const entries = createIncomeEntries([0, 14, 28]);
    const result = inferPaySchedule(entries, BASE_DATE);
    expect(result.schedule).toBe("biweekly");
  });

  it("detects monthly cadence for ~30-day gaps", () => {
    const entries = createIncomeEntries([0, 32]);
    const result = inferPaySchedule(entries, BASE_DATE);
    expect(result.schedule).toBe("monthly");
  });

  it("falls back to flex when spacing is erratic", () => {
    const entries = createIncomeEntries([0, 40, 80]);
    const result = inferPaySchedule(entries, BASE_DATE);
    expect(result.schedule).toBe("flex");
  });

  it("returns flex when only one paycheck exists", () => {
    const entries = createIncomeEntries([0]);
    const result = inferPaySchedule(entries, BASE_DATE);
    expect(result.schedule).toBe("flex");
  });

  it("updates cadence when spacing changes", () => {
    const weekly = inferPaySchedule(createIncomeEntries([0, 7]), BASE_DATE);
    expect(weekly.schedule).toBe("weekly");
    const doubled = inferPaySchedule(createIncomeEntries([0, 15]), BASE_DATE);
    expect(doubled.schedule).toBe("biweekly");
  });
});

describe("Pay Period Planner allocation math", () => {
  it("caps buffer for critical tier and includes calm summary copy", () => {
    const plan = PayPeriodPlanner.generate({
      totals: { income: 4000, expenses: 1500, leftover: 2000 },
      tier: "critical",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 14]),
      now: new Date("2025-01-10T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;

    expect(plan.recommendation.buffer).toBeLessThanOrEqual(300);
    expect(plan.recommendation.summaryLine).toContain("calm plan");
  });

  it("honors the breathing room floor for fragile tier", () => {
    const plan = PayPeriodPlanner.generate({
      totals: { income: 4000, expenses: 1700, leftover: 1600 },
      tier: "fragile",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 14]),
      now: new Date("2025-01-12T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;

    expect(plan.recommendation.breathingRoom).toBeGreaterThanOrEqual(tierRules.fragile.minBreathingRoom);
    expect(plan.recommendation.supportiveLine).toContain("Buffer strength");
  });

  it("allocates zero buffer/debt when leftover is negative", () => {
    const plan = PayPeriodPlanner.generate({
      totals: { income: 3200, expenses: 3500, leftover: -300 },
      tier: "steady",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 7]),
      now: new Date("2025-01-08T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;

    expect(plan.recommendation.buffer).toBe(0);
    expect(plan.recommendation.debt).toBe(0);
    expect(plan.recommendation.breathingRoom).toBe(0);
  });

  it("allocateRecommendation clamps negative leftover even without full plan", () => {
    const snapshot = makePlanSnapshot({
      currency: "USD",
      leftoverProjected: -150,
      essentialsThisPeriod: 1200,
    });
    const recommendation = allocateRecommendation(tierRules.critical, snapshot);
    expect(recommendation.buffer).toBe(0);
    expect(recommendation.debt).toBe(0);
    expect(recommendation.breathingRoom).toBeGreaterThanOrEqual(0);
  });
});

describe("Pay Period Planner persistence and regeneration", () => {
  it("persists plans immutably and supersedes previous entries", () => {
    const firstPlan = PayPeriodPlanner.generate({
      totals: { income: 3500, expenses: 2000, leftover: 1500 },
      tier: "steady",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 14]),
      now: new Date("2025-01-01T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;
    persistPlan(firstPlan);

    const secondPlan = PayPeriodPlanner.generate({
      totals: { income: 3600, expenses: 1900, leftover: 1700 },
      tier: "steady",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 14, 28]),
      now: new Date("2025-01-15T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;
    persistPlan(secondPlan);

    const history = getPlanHistory();
    expect(history.length).toBe(2);
    expect(history[0].status.state).toBe("superseded");
    expect(getLatestPlan()?.id).toBe(secondPlan.id);
  });

  it("marks plans as expired once their window passes", () => {
    const plan = PayPeriodPlanner.generate({
      totals: { income: 2800, expenses: 1800, leftover: 1000 },
      tier: "fragile",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 14]),
      now: new Date("2025-01-01T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;
    persistPlan(plan);

    expirePlansIfNeeded(new Date("2025-02-20T00:00:00Z"));
    expect(getLatestPlan()?.status.state).toBe("expired");
  });

  it("regenerates when the period ends or cadence changes", () => {
    const plan = PayPeriodPlanner.generate({
      totals: { income: 3100, expenses: 2100, leftover: 1000 },
      tier: "steady",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 7]),
      now: new Date("2025-01-01T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;
    persistPlan(plan);

    const inputs = {
      totals: { income: 3200, expenses: 2050, leftover: 1150 },
      tier: "steady",
      triggerSource: "income" as const,
      incomeEntries: createIncomeEntries([0, 32]),
      now: new Date(new Date(plan.period.end).getTime() + 1000),
    };
    const schedule = inferPaySchedule(inputs.incomeEntries, inputs.now);
    expect(shouldRegeneratePlan(plan, inputs, schedule)).toBe(true);

    const calmInputs = {
      totals: inputs.totals,
      tier: inputs.tier,
      triggerSource: "income" as const,
      incomeEntries: createIncomeEntries([0, 7]),
      now: new Date(new Date(plan.period.start).getTime() + 1000),
    };
    const calmSchedule = inferPaySchedule(calmInputs.incomeEntries, calmInputs.now);
    expect(shouldRegeneratePlan(plan, calmInputs, calmSchedule)).toBe(false);
  });

  it("triggers regeneration on tier change and manual actions", () => {
    const plan = PayPeriodPlanner.generate({
      totals: { income: 3000, expenses: 2200, leftover: 800 },
      tier: "fragile",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 14]),
      now: new Date("2025-01-05T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;

    const tierChangeInputs = {
      totals: { income: 3000, expenses: 2200, leftover: 800 },
      tier: "steady",
      triggerSource: "tierChange" as const,
      incomeEntries: createIncomeEntries([0, 14]),
      now: new Date("2025-01-07T00:00:00Z"),
    };
    const tierSchedule = inferPaySchedule(tierChangeInputs.incomeEntries, tierChangeInputs.now);
    expect(shouldRegeneratePlan(plan, tierChangeInputs, tierSchedule)).toBe(true);

    const manualInputs = {
      ...tierChangeInputs,
      tier: plan.tierAtCreation,
      triggerSource: "manual" as const,
      now: new Date("2025-01-07T00:00:00Z"),
    };
    expect(shouldRegeneratePlan(plan, manualInputs, tierSchedule)).toBe(true);
  });
});

describe("Pay Period Planner robustness", () => {
  it("ignores malformed storage entries when reading the latest plan", () => {
    window.localStorage.setItem("payPeriodPlans", "not-json");
    window.localStorage.setItem("payPeriodLatestPlanId", JSON.stringify({ id: "missing" }));
    expect(getLatestPlan()).toBeNull();
  });

  it("rejects invalid plans at persistence time", () => {
    expect(() => persistPlan({} as any)).toThrow();
  });

  it("copes with multiple income entries on the same day while still detecting cadence", () => {
    const entries = [
      { amount: 1200, date: new Date(BASE_DATE).toISOString() },
      { amount: 800, date: new Date(BASE_DATE).toISOString() },
      { amount: 1200, date: new Date(BASE_DATE.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() },
    ];
    const result = inferPaySchedule(entries, BASE_DATE);
    expect(result.schedule).toBe("weekly");
  });

  it("returns flex when entries lack valid dates instead of throwing", () => {
    const entries = [{ amount: 800 }, { amount: 750, date: "invalid" }];
    const result = inferPaySchedule(entries, BASE_DATE);
    expect(result.schedule).toBe("flex");
  });

  it("acknowledges the latest plan and marks status accordingly", () => {
    const plan = PayPeriodPlanner.generate({
      totals: { income: 2900, expenses: 2000, leftover: 900 },
      tier: "steady",
      triggerSource: "manual",
      incomeEntries: createIncomeEntries([0, 14]),
      now: new Date("2025-01-01T00:00:00Z"),
      snapshotOverrides: { currency: "USD" },
    }).plan;
    persistPlan(plan);
    const acknowledged = markPlanAcknowledged(plan.id);
    expect(acknowledged?.status.state).toBe("acknowledged");
    expect(acknowledged?.status.acknowledgedAt).toBeDefined();
    expect(getLatestPlan()?.status.state).toBe("acknowledged");
  });
});
