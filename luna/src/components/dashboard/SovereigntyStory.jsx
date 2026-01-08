import React from "react";
import "./SovereigntyStory.css";

const SovereigntyStory = ({
  modeLabel = "Traditional / Optimized",
  tierLabel = "Traditional",
  isPositive = true,
  leftover = 0,
  bufferCurrent = 0,
  bufferTarget = 0,
  planFrequency = "Bi-Weekly",
  narrativeCopy,
  nextUnlockCopy,
  milestoneDetails = [],
  nextUpInfo,
  finalMilestone,
  deployableCash = 0,
  onOpenCoach,
  onViewDebts,
  formatCurrency = (value) => `$${Number(value).toFixed(2)}`,
}) => {
  const safetyTone = isPositive
    ? "Cash flow is positive but lean. Luna keeps essentials protected while routing every extra dollar to your next debt."
    : "Cash flow is tight. Essentials first while Luna rebuilds the buffer and keeps your plan steady.";
  const storyCopy = narrativeCopy
    ? narrativeCopy
    : `You're in ${modeLabel} mode. ${safetyTone} Money Coach is protecting the cash while Debt Plan rolls every snowball dollar toward the next unlock: ${
        nextUnlockCopy || "Hold this stability to unlock the next tier."
      }`;

  return (
    <div className="sovereignty-card">
      <div className="sovereignty-header">
        <div>
          <p className="eyebrow">Sovereignty Story</p>
          <h2>One mission. All of Luna.</h2>
        </div>
        <span className="tier-badge">Tier: {tierLabel}</span>
      </div>

      <p className="story-text">{storyCopy}</p>

      <div className="mission-grid">
        <div className="mission-cell">
          <div className="mission-label">Today's Focus</div>
          <div className="mission-value">{isPositive ? "Steady automation" : "Protect essentials"}</div>
        </div>
        <div className="mission-cell">
          <div className="mission-label">Safety Track</div>
          <div className="mission-value">
            {formatCurrency(bufferCurrent)} / {formatCurrency(bufferTarget)}
          </div>
        </div>
        <div className="mission-cell">
          <div className="mission-label">Plan Rhythm</div>
          <div className="mission-value">{planFrequency}</div>
        </div>
      </div>

      {milestoneDetails?.length > 0 && (
        <div className="tier-milestone-stack">
          {milestoneDetails.map((item) => (
            <div key={item.title} className="tier-milestone-card">
              <div className="tier-milestone-title">{item.title}</div>
              <p className="tier-milestone-detail">{item.detail}</p>
            </div>
          ))}
        </div>
      )}

      {nextUpInfo && (
        <div className="milestone-next-card">
          <div className="milestone-next-title">{nextUpInfo.title}</div>
          {nextUpInfo.metric && (
            <div className="milestone-next-target">{nextUpInfo.metric}</div>
          )}
          {nextUpInfo.detail && (
            <div className="milestone-next-detail">{nextUpInfo.detail}</div>
          )}
          {nextUpInfo.progress && (
            <div className="milestone-next-progress">{nextUpInfo.progress}</div>
          )}
        </div>
      )}

      {finalMilestone && (
        <div className="milestone-final-card">
          <div className="milestone-final-title">Final Milestone</div>
          <div className="milestone-final-text">{finalMilestone}</div>
        </div>
      )}

      <div className="mission-details">
        <div className="mission-detail">
          <span className="detail-label">Deployable cash</span>
          <strong>{formatCurrency(deployableCash)}</strong>
          <small>Available to accelerate your Debt Plan momentum</small>
        </div>
        <div className="mission-detail">
          <span className="detail-label">Leftover</span>
          <strong>{formatCurrency(leftover)}</strong>
          <small>Net after bills, feeding this plan’s buffer</small>
        </div>
      </div>

      <div className="mission-callout">
        <p>Debt Plan stays tied to leftover and buffer so every payment nudges the next milestone.</p>
        <p>Money Coach keeps the snowball order in check and reroutes deployable cash as conditions shift.</p>
      </div>

      <div className="cta-row">
        <button type="button" className="primary-btn" onClick={onOpenCoach}>
          Adjust your strategy in Money Coach
        </button>
        <button type="button" className="primary-btn secondary" onClick={onViewDebts}>
          See how your plan rolls forward in Debt Plan
        </button>
      </div>

      <p className="story-footnote">
        {nextUnlockCopy ? nextUnlockCopy : "Add to the buffer and we’ll unlock the next tier."}
      </p>
    </div>
  );
};

export default SovereigntyStory;
