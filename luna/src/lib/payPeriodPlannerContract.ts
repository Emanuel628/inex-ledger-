import { z } from "zod";

export type PaySchedule = "weekly" | "biweekly" | "monthly" | "flex";
export type TierSlug = "critical" | "fragile" | "steady" | "thriving";
export type TriggerSource = "income" | "tierChange" | "manual" | "drift" | "fallback";
export type PlanStatusState = "active" | "acknowledged" | "superseded" | "expired";

export interface PeriodWindow {
  schedule: PaySchedule;
  start: string; // ISO date
  end: string; // ISO date
  createdAt: string; // ISO timestamp
}

export interface PlanSnapshot {
  incomeThisPeriod?: number;
  essentialsThisPeriod?: number;
  bufferCurrent?: number;
  leftoverProjected?: number;
  driftSignal?: "up" | "down";
  currency: string;
}

export interface PlanRecommendation {
  essentials: number;
  buffer: number;
  debt: number;
  breathingRoom: number;
  summaryLine: string;
  supportiveLine: string;
}

export interface PlanStatus {
  version: 1;
  state: PlanStatusState;
  acknowledgedAt?: string;
  rationale?: string;
}

export interface PayPeriodPlan {
  id: string;
  period: PeriodWindow;
  tierAtCreation: TierSlug;
  snapshot: PlanSnapshot;
  recommendation: PlanRecommendation;
  status: PlanStatus;
}

export interface PlannerOutput {
  plan: PayPeriodPlan;
  metadata: {
    triggeredBy: TriggerSource;
    noticeText?: string;
    reason?: string;
  };
}

export interface PayPeriodPlanStore {
  plans: PayPeriodPlan[];
  latestPlanId?: string;
  addPlan(plan: PayPeriodPlan): void;
  getLatest(): PayPeriodPlan | undefined;
}

export const PayPeriodPlanSchema = z.object({
  id: z.string(),
  period: z.object({
    schedule: z.enum(["weekly", "biweekly", "monthly", "flex"]),
    start: z.string(),
    end: z.string(),
    createdAt: z.string(),
  }),
  tierAtCreation: z.enum(["critical", "fragile", "steady", "thriving"]),
  snapshot: z
    .object({
      incomeThisPeriod: z.number().optional(),
      essentialsThisPeriod: z.number().optional(),
      bufferCurrent: z.number().optional(),
      leftoverProjected: z.number().optional(),
      driftSignal: z.enum(["up", "down"]).optional(),
      currency: z.string(),
    })
    .strict(),
  recommendation: z.object({
    essentials: z.number(),
    buffer: z.number(),
    debt: z.number(),
    breathingRoom: z.number(),
    summaryLine: z.string(),
    supportiveLine: z.string(),
  }),
  status: z.object({
    version: z.literal(1),
    state: z.enum(["active", "acknowledged", "superseded", "expired"]),
    acknowledgedAt: z.string().optional(),
    rationale: z.string().optional(),
  }),
});

export const PlannerOutputSchema = z.object({
  plan: PayPeriodPlanSchema,
  metadata: z.object({
    triggeredBy: z.enum(["income", "tierChange", "manual", "drift", "fallback"]),
    noticeText: z.string().optional(),
    reason: z.string().optional(),
  }),
});

export const DEFAULT_CURRENCY = "USD";

export const makePlanSnapshot = (
  partial: Partial<Omit<PlanSnapshot, "currency">> & { currency?: string }
): PlanSnapshot => ({
  incomeThisPeriod: partial.incomeThisPeriod,
  essentialsThisPeriod: partial.essentialsThisPeriod,
  bufferCurrent: partial.bufferCurrent,
  leftoverProjected: partial.leftoverProjected,
  driftSignal: partial.driftSignal,
  currency: partial.currency ?? DEFAULT_CURRENCY,
});

export const isPlanActive = (plan: PayPeriodPlan): boolean => plan.status.state === "active";

