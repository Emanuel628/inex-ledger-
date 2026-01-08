import { NotificationPayload, addNotification, getNotifications } from "./notificationStore";
import { PayPeriodPlan, TierSlug } from "./payPeriodPlannerContract";

const PLAN_BLURBS = [
  "This version leans toward buffer strength so life stays steady.",
  "Fresh plan, same calm direction—essentials stay safe while stability grows.",
  "Your plan keeps essentials protected and gives a grounded direction for the period.",
  "This refreshed plan keeps things steady and nudges you toward more cushion.",
];

const DRIFT_SUMMARIES = [
  "Drift noticed in your leftover pacing.",
  "Leftover is stretching beyond the norm.",
  "Cash flow nuance detected.",
];

const DRIFT_SUPPORT = [
  "We nudged the plan to keep essentials shielded.",
  "This keeps stability steady while covering the unexpected.",
  "Small adjustment so the system stays calm.",
];

const MAJOR_EVENT_SUPPORT = [
  "Updated the plan to reflect the shift.",
  "This keeps your guidance grounded after the change.",
  "No panic—just a calmly updated roadmap.",
];

const selectVariant = (id: string, variants: string[]) => {
  if (!variants.length) return "";
  const sum = id
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return variants[sum % variants.length];
};

const selectPlanBlurb = (id: string) => selectVariant(id, PLAN_BLURBS);

const hasActiveNotification = (
  type: NotificationType,
  matcher: (notification: ReturnType<typeof getNotifications>[number]) => boolean
) => {
  return getNotifications().some(
    (notification) => notification.type === type && !notification.acknowledged && matcher(notification)
  );
};

const buildPlanReadyMessage = (plan: PayPeriodPlan) => {
  const summary = plan.recommendation.summaryLine;
  const supportive = plan.recommendation.supportiveLine;
  return `${summary} ${supportive}`;
};

export const notifyPayPeriodPlanReady = (plan: PayPeriodPlan) => {
  if (
    hasActiveNotification("PAY_PERIOD_PLAN", (notification) => notification.payload?.planId === plan.id)
  ) {
    return null;
  }
  const buildPlanReadyId = (): string => {
    const start = plan.period?.start ?? "unknown";
    const end = plan.period?.end ?? "unknown";
    const normalize = (value: string) => value.replace(/[:.]/g, "");
    return `plan-ready-${normalize(start)}-${normalize(end)}`;
  };
  const payload: NotificationPayload = {
    planId: plan.id,
    summaryLine: plan.recommendation.summaryLine,
    supportiveLine: plan.recommendation.supportiveLine,
    tierAtCreation: plan.tierAtCreation,
    periodStart: plan.period.start,
    periodEnd: plan.period.end,
    projectedLeftover: plan.snapshot.leftoverProjected,
    currency: plan.snapshot.currency,
  };
  return addNotification({
    type: "PAY_PERIOD_PLAN",
    title: "Your calm plan for this pay period is ready",
    id: buildPlanReadyId(),
    message: `${buildPlanReadyMessage(plan)} ${selectPlanBlurb(plan.id)}`,
    payload,
    tone: "info",
  });
};

export const notifyTierChange = (previousTier?: TierSlug, newTier?: TierSlug) => {
  if (!previousTier || !newTier || previousTier === newTier) return null;
  const payload: NotificationPayload = {
    previousTier,
    newTier,
  };
  return addNotification({
    type: "TIER_CHANGE",
    title: "Your stability tier has changed",
    message: `Guidance has adapted from ${previousTier} to ${newTier} so you can stay aligned with your current cash picture.`,
    payload,
  });
};

export const notifyDriftAlert = (driftMagnitude: number, context?: string) => {
  const payload: NotificationPayload = {
    driftMagnitude,
    eventContext: context,
    summaryLine: selectVariant(context ?? String(driftMagnitude), DRIFT_SUMMARIES),
    supportiveLine: selectVariant(context ?? String(driftMagnitude), DRIFT_SUPPORT),
  };
  return addNotification({
    type: "DRIFT_ALERT",
    title: "We noticed things drifting a bit",
    message:
      driftMagnitude >= 1
        ? "Spending has drifted ahead of what usually holds this period. We gently rebalanced your plan so the protective habits around leftover stay calm."
        : "We spotted a small drift in your cash picture and quietly tuned your plan so stability stays relaxed.",
    payload,
    tone: "caution",
  });
};

export const notifyMajorEvent = (context: string) => {
  const payload: NotificationPayload = {
    eventContext: context,
    summaryLine: "A major shift happened in your cash picture.",
    supportiveLine: selectVariant(context, MAJOR_EVENT_SUPPORT),
  };
  return addNotification({
    type: "MAJOR_EVENT",
    title: "Your financial picture shifted significantly",
    message: "We reflected the change across your plan so you can see what comes next.",
    payload,
    tone: "info",
  });
};
