import React, { useEffect, useState } from "react";
import SyncStatus from "../SyncStatus";
import "./LegacyDashboard.css";
import { expirePlansIfNeeded, getLatestPlan, onPlanUpdate } from "../../lib/payPeriodPlannerStore";

export const LEGACY_COACH_TIPS = [
  "Log one expense today to keep your snapshot accurate.",
  "If leftover is tight, shrink one want category this week.",
  "Small gains count. Aim for a positive leftover this month.",
  "Pay the smallest debt first to build momentum.",
  "Stay close to your recommended ranges to keep things steady.",
];

const loadLatestPlan = () => {
  expirePlansIfNeeded();
  return getLatestPlan();
};

const LegacyDashboard = ({
  greeting,
  periodLabel,
  dashboardNote,
  totals,
  formatCurrency,
  onNavigate,
  businessNetTotal,
  planLabel,
  savingsBalance,
  savingsTarget,
  assetSummary,
  scoreInfo,
  coachTip,
  goals,
  expenseCategories,
}) => {
  const [latestPlan, setLatestPlan] = useState(() => loadLatestPlan());

  useEffect(() => {
    const refreshPlan = () => setLatestPlan(loadLatestPlan());
    return onPlanUpdate(refreshPlan);
  }, []);

  const planCells = latestPlan
    ? [
        { label: "Buffer", value: latestPlan.recommendation.buffer, helper: "strengthens safety" },
        { label: "Debt progress", value: latestPlan.recommendation.debt, helper: "steady momentum" },
        { label: "Breathing room", value: latestPlan.recommendation.breathingRoom, helper: "space to live" },
      ]
    : [];
  const planSummary = latestPlan?.recommendation.summaryLine;
  const planSupport = latestPlan?.recommendation.supportiveLine;
  const planState = latestPlan?.status.state === "active" ? "Active plan" : "Plan ready";
  const showExpenses = expenseCategories.length > 0;
  const planMessage =
    totals.leftover < 0
      ? "Leftover is currently negative; focus on covering essentials before adding new plans."
      : "Leftover is positive; keep protecting essentials and divert surplus toward your goals.";
  const bufferMeta =
    savingsTarget > 0
      ? `${formatCurrency(savingsBalance)} saved · ${Math.min(
          100,
          Math.round((savingsBalance / savingsTarget) * 100)
        )}% of target`
      : `${formatCurrency(savingsBalance)} saved`;
  const netWorthValue = assetSummary.netWorth ?? 0;
  const assetsValue = assetSummary.totalAssets ?? netWorthValue;
  const coachMessage = coachTip || LEGACY_COACH_TIPS[0];
  return (
    <div className="legacy-dashboard">
      <header className="legacy-header">
        <div className="legacy-sync-status">
          <SyncStatus />
        </div>
        <div className="legacy-hero-text">
          <div className="legacy-greeting">{greeting}</div>
          <div className="legacy-subtitle">Here's your money snapshot.</div>
          {periodLabel && <div className="legacy-period">{periodLabel}</div>}
          {dashboardNote && <div className="legacy-note">{dashboardNote}</div>}
          <div className="legacy-tier">
            <span>Level:</span> {planLabel || "Standard"}
          </div>
        </div>
      </header>
      {latestPlan && (
        <div className="legacy-plan-teaser">
          <div className="legacy-plan-teaser-header">
            <span className="legacy-plan-eyebrow">This period plan</span>
            <span className="legacy-plan-status">{planState}</span>
          </div>
          <p className="legacy-plan-teaser-summary">{planSummary}</p>
          <p className="legacy-plan-teaser-support">{planSupport}</p>
          <div className="legacy-plan-allocations">
            {planCells.map((cell) => (
              <div key={cell.label} className="legacy-plan-alloc">
                <span>{cell.label}</span>
                <strong>{formatCurrency(cell.value)}</strong>
                <small>{cell.helper}</small>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="legacy-plan-cta interactive-cta"
            onClick={() => onNavigate("split-gps")}
          >
            View plan in Money Map
          </button>
        </div>
      )}
      <div className="legacy-card">
        <div className="legacy-card-title">Financial Health Score</div>
        <div className="legacy-score-value">{scoreInfo.displayValue}</div>
        <div className="legacy-score-subline">{scoreInfo.subline}</div>
      </div>
      <div className="legacy-card highlight legacy-leftover">
        <div className="legacy-card-title">Leftover After Bills</div>
        <div className="legacy-leftover-main">
          <div className="legacy-leftover-value">
            {formatCurrency(totals.leftover)}
            <span className="legacy-leftover-period">/ month</span>
          </div>
          <div className="legacy-leftover-right">
            <button className="primary-btn legacy-primary track-btn" onClick={() => onNavigate("livebudget")}>
              Track Spending
            </button>
            <div className="legacy-amount-boxes">
              <div className="legacy-amount-box">
                <span>Monthly Income</span>
                <strong>{formatCurrency(totals.income)}</strong>
              </div>
              <div className="legacy-amount-box">
                <span>Monthly Expenses</span>
                <strong>{formatCurrency(totals.expenses)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="legacy-card">
        <div className="legacy-card-title">Budget Plan - {planLabel || "Critical / Survival"}</div>
        <div className="legacy-card-body">{planMessage}</div>
      </div>
      <div className="legacy-card">
        <div className="legacy-card-title">Savings</div>
        <div className="legacy-card-value">{formatCurrency(savingsBalance)} saved</div>
        <div className="legacy-card-meta">{bufferMeta}</div>
      </div>
      <div className="legacy-card">
        <div className="legacy-card-title">Net Worth</div>
        <div className="legacy-card-value">Net worth {formatCurrency(netWorthValue)}</div>
        <div className="legacy-card-meta">Assets {formatCurrency(assetsValue)}</div>
      </div>
      <div className="legacy-card">
        <div className="legacy-card-title">Money Coach</div>
        <div className="legacy-card-body">{coachMessage}</div>
      </div>
      <div className="legacy-card">
        <div className="legacy-card-title">Spending Breakdown</div>
        <div className="legacy-card-body">
          {showExpenses
            ? "Expenses tracked. Visit the tracker to explore categories."
            : "Add your expenses during onboarding to see your spending breakdown."}
        </div>
      </div>
      <div className="legacy-card">
        <div className="legacy-card-title">Goals</div>
        <div className="legacy-card-body">
          {goals.length === 0
            ? "No goals yet. When you're ready, add one to turn your leftover into steady progress."
            : `Tracking ${goals.length} goal${goals.length > 1 ? "s" : ""}.`}
        </div>
      </div>
    </div>
  );
};

export default LegacyDashboard;
