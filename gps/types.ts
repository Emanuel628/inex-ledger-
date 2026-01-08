export type GuidanceTier = "critical" | "fragile" | "stable" | "balanced" | "thriving";

export type GPSTone = "reassurance" | "confidence" | "protective" | "inspired";

export type PaySchedule = "weekly" | "biweekly" | "monthly" | "flex";
export type GPSSeason = "year-end" | "spring" | "midyear" | "fall";

export interface GPSContext {
  daysUntilPayday?: number;
  paySchedule?: PaySchedule;
  periodProgress?: number;
  driftSignal?: "up" | "down";
  season?: GPSSeason;
  tierAgeDays?: number;
  milestoneEvent?: "firstCushion" | "backToSafety" | "thrivingStability";
  periodStart?: string;
  periodEnd?: string;
}

export interface GPSInput {
  tier: GuidanceTier;
  bufferMonths: number;
  leftoverTrend: number;
  driftFlag: boolean;
  improvements: boolean;
  timeInTierDays: number;
  context?: GPSContext;
}

export interface GPSOutput {
  eyebrow: string;
  title: string;
  body: string;
  cta?: string;
  tone: GPSTone;
  suppressed?: boolean;
  suppressionReason?: string;
  periodKey?: string;
  guidanceHash?: string;
}
