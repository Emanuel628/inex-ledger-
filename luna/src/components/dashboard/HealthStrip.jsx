import React from "react";
import "./HealthStrip.css";

const HealthStrip = ({ stability, bufferPercent, riskLabel }) => (
  <div className="health-strip">
    <div className="health-chip">
      <div className="chip-title-row">
        <span className="chip-title">Stability</span>
        <span className="chip-info" title="Your current tier, showing whether you're in protective, stable, or thriving mode.">
          i
        </span>
      </div>
      <strong>{stability}</strong>
    </div>
    <div className="health-chip">
      <div className="chip-title-row">
        <span className="chip-title">Buffer</span>
        <span className="chip-info" title="How much of your target buffer you currently have.">
          i
        </span>
      </div>
      <strong>{bufferPercent}%</strong>
    </div>
    <div className="health-chip">
      <div className="chip-title-row">
        <span className="chip-title">Risk Lens</span>
        <span
          className="chip-info"
          title="A quick indicator of how conservative Luna thinks you should be right now."
        >
          i
        </span>
      </div>
      <strong>{riskLabel}</strong>
    </div>
  </div>
);

export default HealthStrip;
