import React from "react";
import "../Onboarding.css";

const OnboardingWelcome = ({ onNavigate = () => {} }) => {
  return (
    <div className="onboarding-page">
      <header className="onboarding-hero">
        <p className="onboarding-eyebrow">Welcome</p>
        <h1>Let’s build your snapshot</h1>
        <p className="onboarding-subtitle">
          We’ll answer “what’s really left after bills,” tell you where your stability starts, and
          keep the tone calm.
        </p>
      </header>
      <main className="onboarding-body">
        <div className="onboarding-card">
          <h2>What this unlocks</h2>
          <ul>
            <li>Clear leftover + tier insight</li>
            <li>Calm, practical guidance</li>
            <li>A plan that adapts as life changes</li>
          </ul>
          <button
            type="button"
            className="primary-btn purple-save-btn onboarding-cta"
            onClick={() => onNavigate("onboardingPayRhythm")}
          >
            Start
          </button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingWelcome;
