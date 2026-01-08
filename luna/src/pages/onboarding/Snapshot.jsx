import React, { useMemo, useState } from "react";
import "../Onboarding.css";
import { guidanceEngine } from "../../../../gps/guidanceEngine";
import { markOnboardingComplete } from "../../utils/userStorage";
import { useMoneyProfile } from "../../hooks/useMoneyProfile";
import { usePreferences } from "../../contexts/PreferencesContext";
import { getStatusState } from "../../utils/tierStatus";

const Snapshot = ({ onNavigate = () => {} }) => {
  const { profile, totals } = useMoneyProfile();
  const { formatCurrency } = usePreferences();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  const savingsBalance = Number(profile.savingsBalance) || 0;
  const rawExpenses = Number(totals.expenses) || 0;
  const expenses = Math.max(rawExpenses, 1);
  const savingsPercent = Math.round(((savingsBalance / expenses) * 100) || 0);
  const bufferPercent = Math.min(100, Math.max(0, savingsPercent));
  const cushionSubline =
    savingsBalance > 0 ? "Room for life to happen" : "No emergency buffer yet";
  const cushionMeta = `${bufferPercent}% of one month of expenses`;
  const statusState = useMemo(
    () => getStatusState(Number(totals.leftover), bufferPercent),
    [totals.leftover, bufferPercent]
  );
  const guidance = useMemo(
    () =>
      guidanceEngine({
        tier: statusState.level,
        bufferMonths: Math.min(1, Math.max(0, savingsBalance / expenses)),
        leftoverTrend: Number(totals.leftover) >= 0 ? 1 : -1,
        driftFlag: false,
        improvements: false,
        timeInTierDays: 0,
      }),
    [statusState.level, savingsBalance, expenses, totals.leftover]
  );

  const handleContinue = () => {
    if (!consent) {
      setError("Please confirm consent to continue.");
      return;
    }
    markOnboardingComplete();
    setError("");
    onNavigate("dashboard");
  };

  return (
    <div className="onboarding-page">
      <header className="onboarding-hero">
        <p className="onboarding-eyebrow">Financial snapshot</p>
        <h1>Here’s where you stand</h1>
        <p className="onboarding-subtitle">
          This reflects what you just shared. We’ll keep things calm and steady while you refine more
          details over time.
        </p>
      </header>
      <main className="onboarding-body">
        <section className="onboarding-card">
          <div className="onboarding-summary-row">
            <div>
              <span>Monthly income</span>
              <strong>{formatCurrency(totals.income)}</strong>
            </div>
            <div>
              <span>Monthly expenses</span>
              <strong>{formatCurrency(totals.expenses)}</strong>
            </div>
            <div>
              <span>Leftover each month</span>
              <strong>{formatCurrency(totals.leftover)}</strong>
            </div>
          </div>
          <div className="onboarding-card__intro">
            <p className="onboarding-card__intro-title">Welcome to Luna</p>
            <p className="onboarding-card__intro-body">
              This snapshot is a calm reveal of where your money already stands—no judgment, just clarity.
            </p>
          </div>
          <div className="onboarding-guidance">
            <p className="onboarding-guidance-eyebrow">{guidance.eyebrow}</p>
            <h3 className={`onboarding-guidance-title onboarding-guidance-title--${guidance.tone}`}>
              {guidance.title}
            </h3>
            <p className="onboarding-guidance-body">{guidance.body}</p>
          </div>
          <div className="onboarding-tier">
            <strong>Tier: {statusState.label}</strong>
            <p>{statusState.message}</p>
            <p className="onboarding-tier-reassurance">{statusState.reassurance}</p>
          </div>
          <div className="onboarding-cushion">
            <div>
              <p className="onboarding-cushion__label">Safety Cushion</p>
              <strong>{formatCurrency(savingsBalance)}</strong>
              <p className="onboarding-cushion__subline">{cushionSubline}</p>
              <span className="onboarding-cushion__meta">{cushionMeta}</span>
            </div>
            <div className="onboarding-cushion__meter" aria-label={`Buffer at ${bufferPercent}% of ${formatCurrency(expenses)}`}>
              <span className="onboarding-cushion__fill" style={{ width: `${bufferPercent}%` }} />
            </div>
            <p className="onboarding-cushion__tip">
              {savingsBalance > 0
                ? "Keep feeding this cushion so you stay steady if life surprises you."
                : "Start with small deposits - $25-$100 per period keeps momentum alive."}
            </p>
          </div>
          <p className="onboarding-note">
            Your tier simply describes where things are today—it’s not a judgment. You can update
            income or expenses anytime from Refine your numbers.
          </p>
          <label className="onboarding-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                if (error) setError("");
              }}
            />
            <span>
              I am 18 or older and agree to Luna’s{" "}
              <a href="/docs/terms-of-service.md" target="_blank" rel="noreferrer">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/docs/data-contract.md" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          {error && <p className="onboarding-error">{error}</p>}
          <button
            type="button"
            className="primary-btn purple-save-btn onboarding-cta"
            onClick={handleContinue}
            disabled={!consent}
          >
            Continue to dashboard
          </button>
        </section>
      </main>
    </div>
  );
};

export default Snapshot;




