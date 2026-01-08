import { GuidanceTier, GPSContext, GPSOutput } from "../types";

const clamp01 = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return undefined;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const paydayCue = (daysUntilPayday?: number): string | null => {
  if (daysUntilPayday === undefined) return null;
  if (daysUntilPayday <= 0) {
    return "Payday is today—keep essentials locked and let autopay breathe.";
  }
  if (daysUntilPayday <= 2) {
    return "Payday is just around the corner; confirm automatic deposits so nothing slips.";
  }
  if (daysUntilPayday <= 5) {
    return "A few days remain before payday—use this window to steady essentials and plan the next deposit.";
  }
  return null;
};

const driftCue = (driftSignal?: GPSContext["driftSignal"]): string | null => {
  if (driftSignal === "down") {
    return "Drift is nudging downward; protect this progress with small, steady moves.";
  }
  if (driftSignal === "up") {
    return "Momentum is heading upward—keep the habits that are tilting the scale.";
  }
  return null;
};

const periodCue = (progress?: number): string | null => {
  if (progress === undefined) return null;
  const clamped = clamp01(progress);
  if (clamped >= 0.85) {
    return "This period is drawing to a close; wrap the numbers before the next one starts.";
  }
  if (clamped <= 0.15) {
    return "Fresh period ahead—use this calm moment to steady essentials before activity peaks.";
  }
  return null;
};

const seasonCue = (season?: GPSContext["season"], tier?: GuidanceTier): string | null => {
  if (!season) return null;
  if (season === "year-end") {
    return tier === "thriving"
      ? "Year-end is here—pair your momentum with purpose-driven giving or planning."
      : "Year-end brings extra cash flow pressure; keep cushions steady and timeless.";
  }
  if (season === "spring") {
    return "Spring momentum is a great reminder to revisit your buffer and stay gentle with progress.";
  }
  return null;
};

export const applyContextNarrative = (
  guidance: GPSOutput,
  context?: GPSContext,
  tier?: GuidanceTier
): GPSOutput => {
  if (!context) return guidance;
  const tierAgeCue = (age?: number): string | null => {
    if (age === undefined) return null;
    if (age <= 30) {
      return "You’re still settling in—take the time to learn the rhythm.";
    }
    if (age <= 90) {
      return "Patterns are forming—keep the steady moves that calm the week.";
    }
    return "This tier is becoming part of your identity; keep guarding the habits that built it.";
  };

  const milestoneCue = (event?: GPSContext["milestoneEvent"]): string | null => {
    if (!event) return null;
    switch (event) {
      case "firstCushion":
        return "Your first full month of cushion is real—each quiet deposit gave you that strength.";
      case "backToSafety":
        return "You slipped back toward safety and held the line; that’s resoundingly steady.";
      case "thrivingStability":
        return "Thriving for 90 days? That calm momentum deserves a breath and a gentle smile.";
      default:
        return null;
    }
  };
  const cues = [
    paydayCue(context.daysUntilPayday),
    driftCue(context.driftSignal),
    periodCue(context.periodProgress),
    seasonCue(context.season, tier),
    tierAgeCue(context.tierAgeDays),
    milestoneCue(context.milestoneEvent),
  ].filter(Boolean) as string[];
  if (!cues.length) return guidance;
  const normalizedBody = guidance.body.toLowerCase();
  const cueToAppend = cues.find((cue) => !normalizedBody.includes(cue.toLowerCase()));
  if (!cueToAppend) return guidance;
  return {
    ...guidance,
    body: `${guidance.body} ${cueToAppend}`,
  };
};
