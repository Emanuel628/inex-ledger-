import React, { useEffect, useMemo } from "react";
import "./CommandCenterDashboard.css";
import TopRightControls from "../components/TopRightControls.jsx";
import SyncStatus from "../components/SyncStatus";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { guidanceEngine } from "../../../gps/guidanceEngine";
import { getPeriodRange } from "../utils/budgetPeriod";
import { getStatusState } from "../utils/tierStatus";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const toneToTheme = (tone) => {
  if (tone === "protective") {
    return "critical";
  }
  if (tone === "reassurance") {
    return "warning";
  }
  return "stable";
};

const toneToIcon = (tone) => {
  if (tone === "protective") {
    return "⚠️";
  }
  if (tone === "reassurance") {
    return "🛡️";
  }
  return "✨";
};

const formatRange = (start, end) => {
  if (!start || !end) return "";
  try {
    const options = { month: "short", day: "numeric" };
    const startLabel = start.toLocaleDateString(undefined, options);
    const endLabel = new Date(end.getTime() - 1).toLocaleDateString(undefined, options);
    return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  } catch {
    return "";
  }
};

const CommandCenterDashboard = ({ onNavigate = () => {} }) => {
  const { profile, totals, baseExpenses } = useMoneyProfile();
  const { preferences, formatCurrency } = usePreferences();
  const period = useMemo(
    () => getPeriodRange(preferences),
    [preferences.budgetPeriod, preferences.budgetPeriodStartDay, preferences.budgetPeriodAnchor]
  );
  useEffect(() => {
    console.log("COMMAND CENTER MOUNTED");
  }, []);

  const savingsBalance = Number(profile?.savingsBalance) || 0;
  const expenses = Math.max(Number(baseExpenses) || 0, 1);
  const leftover = Number(totals?.leftover) || 0;
  const bufferMonths = Math.min(2, Math.max(0, savingsBalance / expenses));
  const bufferPercent = Math.min(100, Math.max(0, Math.round((savingsBalance / expenses) * 100)));
  const statusState = useMemo(() => getStatusState(leftover, bufferPercent), [leftover, bufferPercent]);

  const periodStart = period?.start ?? new Date();
  const periodEnd = period?.end ?? new Date(periodStart.getTime() + MS_PER_DAY * 30);
  const totalDays = Math.max(1, Math.round((periodEnd - periodStart) / MS_PER_DAY));
  const now = new Date();
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((now - periodStart) / MS_PER_DAY)));
  const remainingDays = Math.max(1, totalDays - elapsedDays);
  const dailyLeftover = leftover / remainingDays;
  const paceRatio = Math.min(100, Math.max(0, Math.round(50 + (leftover / expenses) * 20)));
  const cushionDays = Math.max(0, Math.min(60, Math.round((savingsBalance / expenses) * 30)));
  const burnRatePct = Math.max(0, Math.min(100, Math.round((leftover / expenses) * 100)));
  const progressLabel = leftover >= 0 ? "On pace" : "Running ahead";

  const guidance = useMemo(() => {
    const context = {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      periodProgress: totalDays ? elapsedDays / totalDays : 0,
    };
    return guidanceEngine({
      tier: statusState.level,
      bufferMonths,
      leftoverTrend: leftover >= 0 ? 1 : -1,
      driftFlag: leftover < 0,
      improvements: leftover >= 0,
      timeInTierDays: 0,
      context,
    });
  }, [statusState.level, bufferMonths, leftover, periodStart, periodEnd, elapsedDays, totalDays]);

  const showActionStrip = guidance && !guidance.suppressed;
  const actionTheme = toneToTheme(guidance?.tone);
  const showMoveSurplusButton = guidance?.key === "P4_OPTIMIZE" || guidance?.cta?.includes("Surplus");

  return (
    <div className="dashboard-page command-center">
      <header className="top-controls">
        <TopRightControls activePage="dashboard" onNavigate={onNavigate} />
        <div className="top-controls__actions">
          <SyncStatus />
        </div>
      </header>

      <main className="command-center__stack">
        <section className="hud">
          <p className="hud-eyebrow">Luna HUD</p>
          <div className="hud-row">
            <span className="hud-label">Mission</span>
            <span className="hud-value">
              {statusState.label} (Tier {statusState.level === "stable" ? "3" : "2"})
            </span>
          </div>
          <div className="hud-row">
            <span className="hud-label">Trajectory</span>
            <span className="hud-value">{statusState.message}</span>
          </div>
          <p className="hud-status">Live status line — steady cadence protects what's working today.</p>
        </section>

        {showActionStrip && (
          <section className={`action-strip action-strip--${actionTheme}`}>
            <span className="action-strip__icon" aria-hidden="true">
              {toneToIcon(guidance.tone)}
            </span>
            <div className="action-strip__text">
              <p className="action-strip__title">{guidance.title}</p>
              <p className="action-strip__body">{guidance.body}</p>
              {showMoveSurplusButton && (
                <button className="primary-btn" type="button" onClick={() => onNavigate("total-debt")}>
                  Move Surplus to Snowball
                </button>
              )}
            </div>
          </section>
        )}

        <section className="gauges">
          <article className="gauge-card">
            <p className="gauge-eyebrow">Core Cashflow</p>
            <p className="gauge-number monospace">
              {formatCurrency(dailyLeftover, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="gauge-subline">Burn Rate: {Math.abs(burnRatePct)}%</p>
          </article>
          <article className="gauge-card">
            <p className="gauge-eyebrow">Defense</p>
            <p className="gauge-number monospace">{formatCurrency(savingsBalance)}</p>
            <div className="cushion-track" aria-label={`Covers ${cushionDays} days of essentials`}>
              <span className="cushion-track__segment low" />
              <span className="cushion-track__segment med" />
              <span className="cushion-track__segment high" />
              <span
                className="cushion-track__pointer"
                style={{ left: `${Math.min(100, (savingsBalance / Math.max(expenses, 1)) * 100)}%` }}
              />
            </div>
            <p className="gauge-subline">{cushionDays > 0 ? `${cushionDays} days covered` : "Less than 1 day covered"}</p>
          </article>
          <article className="gauge-card">
            <p className="gauge-eyebrow">Pace</p>
            <div className="pace-track">
              <div className="pace-progress" style={{ width: `${paceRatio}%` }} />
              <span className="pace-needle" style={{ left: `${paceRatio}%` }} />
            </div>
            <p className="gauge-subline">{progressLabel}</p>
          </article>
        </section>

        <footer className="structure-footer">
          <div className="structure-footer__header">
            <span className="hud-eyebrow">Financial Structure</span>
            <button type="button" className="ghost-btn" onClick={() => onNavigate("settings")}>
              Guidance level
            </button>
          </div>
          <div className="structure-footer__meta">
            <span>Period: {formatRange(periodStart, periodEnd)}</span>
            <span className="monospace">Key: {period?.key || "—"}</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default CommandCenterDashboard;
