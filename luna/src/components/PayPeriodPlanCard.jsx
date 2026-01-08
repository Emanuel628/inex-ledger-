import React, { useMemo } from "react";
import "./PayPeriodPlanCard.css";
import { usePreferences } from "../contexts/PreferencesContext";
import { getPeriodRange } from "../utils/budgetPeriod";

const formatDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const detailRows = [
  { label: "Essentials", key: "essentials" },
  { label: "Buffer", key: "buffer" },
  { label: "Debt / progress", key: "debt" },
  { label: "Breathing room", key: "breathingRoom" },
];

const PayPeriodPlanCard = ({ plan, formatCurrency }) => {
  const { preferences } = usePreferences();
  const budgetPeriod = useMemo(() => getPeriodRange(preferences), [preferences]);
  const budgetPeriodRange = useMemo(() => {
    if (!budgetPeriod?.start || !budgetPeriod?.end) return "";
    const startLabel = formatDate(budgetPeriod.start);
    const endDate = new Date(budgetPeriod.end);
    endDate.setDate(endDate.getDate() - 1);
    const endLabel = formatDate(endDate);
    if (!startLabel || !endLabel) return "";
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }, [budgetPeriod]);
  const periodTitle = budgetPeriodRange ? `This budget period: ${budgetPeriodRange}` : "This budget period";

  if (!plan) {
    return (
      <article className="pay-period-plan-card interactive-card">
        <div className="ppp-header">
          <p className="ppp-eyebrow">Budget period plan</p>
          <h3 className="ppp-title">Calm planning is on its way</h3>
        </div>
        <p className="ppp-empty-state">
          As soon as Luna confirms your income this budget period, she'll share a gentle recommendation so you can use
          leftover with confidence.
        </p>
      </article>
    );
  }

  const { recommendation, status } = plan;

  return (
    <article className="pay-period-plan-card interactive-card">
      <div className="ppp-header">
        <div>
          <p className="ppp-eyebrow">Budget period plan</p>
          <h3 className="ppp-title">{periodTitle}</h3>
        </div>
        <span className={`ppp-state-chip ${status.state}`}>{status.state}</span>
      </div>
      <p className="ppp-summary">{recommendation.summaryLine}</p>
      <div className="ppp-grid">
        {detailRows.map((row) => (
          <div key={row.key} className="ppp-grid-row">
            <div className="ppp-grid-label">{row.label}</div>
            <div className="ppp-grid-value">
              {formatCurrency(recommendation[row.key] ?? 0, { minimumFractionDigits: 0 })}
            </div>
          </div>
        ))}
      </div>
      <p className="ppp-supportive">{recommendation.supportiveLine}</p>
      {status.rationale && <p className="ppp-rationale">{status.rationale}</p>}
    </article>
  );
};

export default PayPeriodPlanCard;
