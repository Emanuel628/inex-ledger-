import { useMemo } from "react";
import { useMoneyProfile } from "./useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { guidanceEngine } from "../../../gps/guidanceEngine";
import { getPeriodRange } from "../utils/budgetPeriod";
import { getStatusState } from "../utils/tierStatus";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const deriveTrajectoryLabel = (tone, leftover) => {
  if (tone === "inspired") return "Improving";
  if (tone === "confidence") return leftover >= 0 ? "Stable" : "Holding";
  if (tone === "protective") return "Protecting";
  return leftover >= 0 ? "Holding" : "Caution";
};

export const useGuidance = () => {
  const { profile, totals, baseExpenses } = useMoneyProfile();
  const { preferences } = usePreferences();
  const period = useMemo(
    () =>
      getPeriodRange(preferences),
    [preferences.budgetPeriod, preferences.budgetPeriodStartDay, preferences.budgetPeriodAnchor]
  );

  const savingsBalance = Number(profile?.savingsBalance) || 0;
  const expenses = Math.max(Number(baseExpenses) || 1, 1);
  const leftover = Number(totals?.leftover) || 0;
  const bufferPercent = Math.min(
    100,
    Math.max(0, Math.round((savingsBalance / expenses) * 100))
  );
  const bufferMonths = Math.min(2, Math.max(0, savingsBalance / expenses));

  const statusState = useMemo(() => getStatusState(leftover, bufferPercent), [
    leftover,
    bufferPercent,
  ]);

  const periodStart = period?.start ?? new Date();
  const periodEnd =
    period?.end ?? new Date(periodStart.getTime() + MS_PER_DAY * 30);
  const totalDays = Math.max(1, Math.round((periodEnd - periodStart) / MS_PER_DAY));
  const now = new Date();
  const elapsedDays = Math.max(
    0,
    Math.min(totalDays, Math.floor((now - periodStart) / MS_PER_DAY))
  );
  const remainingDays = Math.max(1, totalDays - elapsedDays);
  const dailyLeftover = leftover / remainingDays;
  const context = useMemo(
    () => ({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      periodProgress: totalDays ? elapsedDays / totalDays : 0,
    }),
    [periodStart, periodEnd, elapsedDays, totalDays]
  );

  const guidance = useMemo(
    () =>
      guidanceEngine({
        tier: statusState.level,
        bufferMonths,
        leftoverTrend: leftover >= 0 ? 1 : -1,
        driftFlag: leftover < 0,
        improvements: leftover >= 0,
        timeInTierDays: 0,
        context,
      }),
    [statusState.level, bufferMonths, leftover, context]
  );

  const pacePercent = Math.min(
    100,
    Math.max(6, Math.round(50 + (leftover / expenses) * 20))
  );
  const cushionPercent = Math.min(
    100,
    Math.max(0, Math.round((savingsBalance / expenses) * 100))
  );
  const cushionDays = Math.max(0, Math.round((savingsBalance / expenses) * 30));

  return {
    missionLabel: `${statusState.label} (Tier ${
      statusState.level === "stable" ? 3 : statusState.level === "thriving" ? 4 : 2
    })`,
    trajectoryLabel: deriveTrajectoryLabel(guidance?.tone, leftover),
    liveStatusLine: guidance?.body ?? statusState.guidanceSubtitle,
    winningGuidance: guidance,
    paceStatus: {
      percent: pacePercent,
      label: leftover >= 0 ? "On pace" : "Running ahead",
    },
    coreCashflow: leftover,
    dailyRemaining: dailyLeftover,
    safetyCushion: savingsBalance,
    cushionPercent,
    cushionDaysLabel:
      cushionDays > 0 ? `${cushionDays} day${cushionDays === 1 ? "" : "s"} covered` : "Less than 1 day covered",
    balancedPathTitle: guidance?.title ?? statusState.guidanceTitle,
    balancedPathBody: guidance?.body ?? statusState.guidanceSubtitle,
  };
};
