import {
  makePlanSnapshot,
  PayPeriodPlan,
  PlannerOutput as PlannerOutputType,
  PlannerOutputSchema,
  PlanSnapshot,
  PlanStatus,
  TierSlug,
  TriggerSource,
} from "./payPeriodPlannerContract";

type IncomeEntry = {
  amount?: number;
  date?: string;
  source?: string;
};

interface PlannerInputs {
  totals: {
    income: number;
    expenses: number;
    leftover: number;
  };
  tier: TierSlug;
  triggerSource: TriggerSource;
  incomeEntries?: IncomeEntry[];
  snapshotOverrides?: Partial<PlanSnapshot>;
  lastPlan?: PayPeriodPlan;
  now?: Date;
}

interface PayScheduleResult {
  schedule: PaySchedule;
  lastPayDate?: Date;
  nextPayDate?: Date;
  reason?: string;
}

const SCHEDULE_DAY_MAP: Record<PaySchedule, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  flex: 30,
};

export const tierRules: Record<
  TierSlug,
  {
    bufferTarget: number;
    debtWeight: number;
    minBreathingRoom: number;
    summaryLine: string;
    supportiveLine: string;
    rationale: string;
  }
> = {
  critical: {
    bufferTarget: 300,
    debtWeight: 0.1,
    minBreathingRoom: 50,
    summaryLine: "Here’s a calm plan for this pay period.",
    supportiveLine: "Protect essentials first while Luna keeps everything steady.",
    rationale: "Protect survival, rebuild buffer, keep optional spend intentional.",
  },
  fragile: {
    bufferTarget: 500,
    debtWeight: 0.18,
    minBreathingRoom: 75,
    summaryLine: "Here’s a stabilizing recommendation for this period.",
    supportiveLine: "Buffer strength keeps momentum going while essentials stay solid.",
    rationale: "Prevent slipping backward with steady buffer build and gentle debt progress.",
  },
  steady: {
    bufferTarget: 1000,
    debtWeight: 0.28,
    minBreathingRoom: 150,
    summaryLine: "Here’s a confident plan for this pay period.",
    supportiveLine: "You’re in control—keep essentials covered and let leftover push progress.",
    rationale: "Buffer targets, meaningful debt payoff, and calm breathing room.",
  },
  thriving: {
    bufferTarget: 1500,
    debtWeight: 0.35,
    minBreathingRoom: 250,
    summaryLine: "Here’s a growth-forward plan for this pay period.",
    supportiveLine: "Use the strength you’ve built to keep goals steady and life comfortable.",
    rationale: "Fuel future-building while keeping discretionary room intentional.",
  },
};

const createId = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (error) {
    /* fallback */
  }
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const addDays = (base: Date, days: number) => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};

const toIso = (value: Date) => value.toISOString();

export const allocateRecommendation = (rule: typeof tierRules[TierSlug], snapshot: PlanSnapshot): PlanRecommendation => {
  const leftover = Math.max(snapshot.leftoverProjected ?? 0, 0);
  const buffer = Math.min(rule.bufferTarget, leftover);
  const afterBuffer = Math.max(leftover - buffer, 0);
  const debt = Math.min(Math.round(afterBuffer * rule.debtWeight), afterBuffer);
  const breathingRoom = Math.max(afterBuffer - debt, rule.minBreathingRoom, 0);
  return {
    essentials: Math.max(snapshot.essentialsThisPeriod ?? 0, 0),
    buffer,
    debt,
    breathingRoom: breathingRoom > afterBuffer ? afterBuffer : breathingRoom,
    summaryLine: rule.summaryLine,
    supportiveLine: rule.supportiveLine,
  };
};

export const inferPaySchedule = (incomeEntries: IncomeEntry[] = [], now = new Date()): PayScheduleResult => {
  const parsed = incomeEntries
    .map((entry) => {
      if (!entry.date) return null;
      const date = new Date(entry.date);
      return Number.isFinite(date.getTime()) ? date : null;
    })
    .filter((item): item is Date => item !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  if (parsed.length < 2) {
    return {
      schedule: "flex",
      reason: "Not enough income dates to infer cadence.",
    };
  }
  const mostRecent = parsed[0];
  const previous = parsed[1];
  const diffMs = mostRecent.getTime() - previous.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  let schedule: PaySchedule = "flex";
  if (diffDays <= 9) {
    schedule = "weekly";
  } else if (diffDays <= 17) {
    schedule = "biweekly";
  } else if (diffDays <= 35) {
    schedule = "monthly";
  }
  const nextDate = addDays(mostRecent, SCHEDULE_DAY_MAP[schedule]);
  return {
    schedule,
    lastPayDate: mostRecent,
    nextPayDate: nextDate,
    reason: `Detected ${schedule} cadence from ${Math.round(diffDays)} day gap.`,
  };
};

const buildPeriodWindow = (
  schedule: PaySchedule,
  anchor: Date,
  now: Date
): { start: Date; end: Date; createdAt: Date } => {
  const start = anchor;
  const duration = SCHEDULE_DAY_MAP[schedule];
  const end = addDays(start, duration);
  return {
    start,
    end,
    createdAt: now,
  };
};

export const shouldRegeneratePlan = (
  previousPlan: PayPeriodPlan | undefined,
  inputs: PlannerInputs,
  scheduleResult: PayScheduleResult
): boolean => {
  if (!previousPlan) return true;
  if (inputs.triggerSource === "manual" || inputs.triggerSource === "drift") return true;
  if (previousPlan.tierAtCreation !== inputs.tier) return true;
  const prevEnd = new Date(previousPlan.period.end);
  const now = inputs.now ?? new Date();
  if (now > prevEnd) return true;
  if (scheduleResult.schedule !== previousPlan.period.schedule) return true;
  return false;
};

export const PayPeriodPlanner = {
  generate(inputs: PlannerInputs): PlannerOutputType {
    const now = inputs.now ?? new Date();
    const scheduleResult = inferPaySchedule(inputs.incomeEntries, now);
    const anchor = scheduleResult.lastPayDate ?? now;
    const window = buildPeriodWindow(scheduleResult.schedule, anchor, now);
    const snapshot = makePlanSnapshot({
      currency: inputs.snapshotOverrides?.currency,
      incomeThisPeriod: inputs.snapshotOverrides?.incomeThisPeriod ?? inputs.totals.income,
      essentialsThisPeriod: inputs.snapshotOverrides?.essentialsThisPeriod ?? inputs.totals.expenses,
      bufferCurrent: inputs.snapshotOverrides?.bufferCurrent ?? Math.max(inputs.totals.leftover * 0.2, 0),
      leftoverProjected: inputs.snapshotOverrides?.leftoverProjected ?? inputs.totals.leftover,
      driftSignal: inputs.snapshotOverrides?.driftSignal,
    });
    const recommendation = allocateRecommendation(tierRules[inputs.tier], snapshot);
    const periodWindow = {
      schedule: scheduleResult.schedule,
      start: toIso(window.start),
      end: toIso(window.end),
      createdAt: toIso(window.createdAt),
    };
    const status: PlanStatus = {
      version: 1,
      state: "active",
      rationale: tierRules[inputs.tier].rationale,
    };
    const plan: PayPeriodPlan = {
      id: createId(),
      period: periodWindow,
      tierAtCreation: inputs.tier,
      snapshot,
      recommendation,
      status,
    };
    const output: PlannerOutputType = {
      plan,
      metadata: {
        triggeredBy: inputs.triggerSource,
        noticeText: scheduleResult.reason,
        reason: scheduleResult.reason,
      },
    };
    PlannerOutputSchema.parse(output);
    return output;
  },
  shouldRegenerate: (previousPlan: PayPeriodPlan | undefined, inputs: PlannerInputs): boolean => {
    const now = inputs.now ?? new Date();
    const scheduleResult = inferPaySchedule(inputs.incomeEntries, now);
    return shouldRegeneratePlan(previousPlan, inputs, scheduleResult);
  },
};
