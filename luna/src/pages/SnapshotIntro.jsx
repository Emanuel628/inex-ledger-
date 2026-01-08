import React from "react";
import "./SnapshotIntro.css";

const SnapshotIntro = ({ onNavigate = () => {} }) => {
  return (
    <div className="snapshot-intro-page">
      <header className="snapshot-intro-hero">
        <p className="snapshot-intro-eyebrow">Welcome</p>
        <h1>Let's build your financial snapshot</h1>
        <p className="snapshot-intro-subtitle">
          We'll start by learning your real numbers so we can show your leftover, place you in the right tier, and
          build a plan that fits.
        </p>
      </header>

      <main className="snapshot-intro-body">
        <div className="snapshot-intro-card">
          <h2>What this unlocks</h2>
          <ul>
            <li>Your true leftover (what’s really left after bills)</li>
            <li>Your current tier and what it means</li>
            <li>A payoff plan built around your reality</li>
          </ul>
          <p className="snapshot-intro-note">This takes about 2-4 minutes. Accuracy beats perfection.</p>
          <button
            type="button"
            className="primary-btn purple-save-btn snapshot-intro-cta"
            onClick={() => onNavigate("onboardingWelcome")}
          >
            Build my snapshot
          </button>
        </div>
      </main>
    </div>
  );
};

export default SnapshotIntro;
