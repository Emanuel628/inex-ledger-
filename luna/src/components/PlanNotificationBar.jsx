import React from "react";
import "./PlanNotificationBar.css";

const PlanNotificationBar = ({ plan, onDismiss }) => {
  if (!plan) return null;
  return (
    <div className="plan-notification-bar interactive-card">
      <div className="plan-notification-body">
        <span className="plan-notification-eyebrow">Pay-period plan</span>
        <p className="plan-notification-summary">{plan.recommendation.summaryLine}</p>
        <p className="plan-notification-support">{plan.recommendation.supportiveLine}</p>
      </div>
      <div className="plan-notification-actions">
        <button
          type="button"
          className="plan-notification-action interactive-cta"
          onClick={onDismiss}
        >
          Looks good
        </button>
      </div>
    </div>
  );
};

export default PlanNotificationBar;
