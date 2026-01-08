import React from "react";
import { storageManager } from "../../utils/storageManager";
import { buildKey } from "../../utils/userStorage";
import "./HealthScoreInsights.css";

const PILLAR_LABELS = {
  liquidity: "Liquidity",
  savingsRate: "Savings Rate",
  dti: "Debt-to-Income",
  budgetAdherence: "Budget Adherence",
  velocity: "Velocity",
};

const formatConfidence = (value, count) => {
  const level = value >= 0.8 ? "high" : value >= 0.5 ? "medium" : "low";
  return {
    text:
      level === "high"
        ? "🟢 High Confidence"
        : level === "medium"
        ? "🟡 Partial Data"
        : "🟠 Low Confidence",
    className: `confidence-badge-${level}`,
    subtitle: `${count || 0} transactions verified • ${Math.round((value || 0) * 100)}% confident`,
  };
};

export const HealthScoreInsights = ({ isOpen, onClose }) => {
  const healthData = storageManager.get(buildKey("financialHealthScore"));
  if (!isOpen || !healthData) return null;

  const {
    score = "--",
    pillarInsights = {},
    pillars = {},
    dataConfidence = 0,
    verifiedCount = 0,
    statusDetail = "",
  } = healthData;
  const confidence = formatConfidence(dataConfidence, verifiedCount);
  const heroClass = score >= 80 ? "score-hero high-score" : "score-hero";

  return (
    <div className="insights-overlay" role="dialog" aria-modal="true">
      <div className="insights-modal">
        <header className="insights-header">
          <div>
            <p className="insights-eyebrow">Data Trust</p>
            <h2>Your financial vitality</h2>
          </div>
          <div className={`confidence-badge ${confidence.className}`}>
            <span className="badge-label">{confidence.text}</span>
            <span className="badge-subtitle">{confidence.subtitle}</span>
          </div>
        </header>

        <div className={heroClass}>
          <div className="hero-score">{score}</div>
          <p className="hero-subline">{statusDetail}</p>
        </div>

        <div className="pillar-grid">
          {Object.entries(pillars).map(([key, value]) => (
            <article key={key} className="pillar-card">
              <div className="pillar-label">
                <span>{PILLAR_LABELS[key] || key}</span>
                <span className="pillar-score">{Math.round(value)} / 100</span>
              </div>
              <div className="pillar-bar">
                <div className="pillar-bar-fill" style={{ width: `${Math.min(value, 100)}%` }} />
              </div>
              <p className="pillar-tip">{pillarInsights[key]?.tip || "Insight loading..."}</p>
              <button type="button" className="pillar-action">
                View {PILLAR_LABELS[key] || key} math
              </button>
            </article>
          ))}
        </div>

        <div className="insights-footer">
          <button type="button" className="btn-close" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default HealthScoreInsights;
