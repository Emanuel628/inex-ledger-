import React from "react";
import "./CoachingCard.css";

const toneMap = {
  critical: {
    headline: "Power down your essentials, protect the cushion.",
    action: "Focus on covering must-haves and refrain from new commitments.",
    encouragement: "You’re steering through a tight period — steadiness wins.",
  },
  survival: {
    headline: "Leaning into protection keeps you safe.",
    action: "Honor the split and let leftover rebuild the buffer.",
    encouragement: "Discipline today keeps the system calm tomorrow.",
  },
  balanced: {
    headline: "Consistency keeps your momentum real.",
    action: "Automate transfers and keep the split steady.",
    encouragement: "Your discipline is the leverage you can feel.",
  },
  traditional: {
    headline: "This is wealth mode. Keep optimizing.",
    action: "Deploy small wins toward high-impact debt or goals.",
    encouragement: "You’re building a future that feels inevitable.",
  },
};

const CoachingCard = ({ modeKey = "balanced", leftover = 0, bufferPercent = 0, onNavigate }) => {
  const tone = toneMap[modeKey] || toneMap.balanced;
  return (
    <div className="coaching-card">
      <div className="coaching-title">
        <p className="eyebrow">Today’s Guidance</p>
        <h3>Stay steady. Move forward.</h3>
      </div>
      <p className="coaching-headline">{tone.headline}</p>
      <div className="coaching-body">
        <p>{tone.action}</p>
        <p className="coaching-encouragement">{tone.encouragement}</p>
      </div>
      <div className="coaching-meta">
        <span>Leftover: {formatCurrency(leftover)}</span>
        <span>Buffer at {bufferPercent}%</span>
      </div>
      <button className="primary-btn" onClick={() => onNavigate("budget")}>
        Review plan
      </button>
    </div>
  );
};

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(2)}`;
};

export default CoachingCard;
