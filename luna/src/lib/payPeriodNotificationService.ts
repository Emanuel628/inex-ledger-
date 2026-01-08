import { PayPeriodPlan } from "./payPeriodPlannerContract";

export type NotificationChannel = "email" | "push" | "both";

export interface PlanNotificationPayload {
  planId: string;
  subject: string;
  body: string;
  channel: NotificationChannel;
}

export const PLAN_READY_EVENT = "pay-period-plan-ready";

const buildSubject = () => "Your calm plan for this pay period is ready";

const buildBody = (plan: PayPeriodPlan) => {
  const summary = plan.recommendation.summaryLine;
  const supportive = plan.recommendation.supportiveLine;
  return `${summary} ${supportive}`;
};

export const emitPayPeriodPlanReady = (
  plan: PayPeriodPlan,
  channel: NotificationChannel = "both"
): PlanNotificationPayload => {
  const payload: PlanNotificationPayload = {
    planId: plan.id,
    subject: buildSubject(),
    body: buildBody(plan),
    channel,
  };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PLAN_READY_EVENT, { detail: payload }));
  }
  return payload;
};
