import React, { useEffect, useState } from "react";
import "../Onboarding.css";
import { readNamespacedItem, writeNamespacedItem } from "../../utils/userStorage";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks (≈26 / year)" },
  { value: "semimonthly", label: "Twice per month (24 / year)" },
  { value: "monthly", label: "Monthly" },
  { value: "irregular", label: "Irregular / custom" },
];

const PayRhythm = ({ onNavigate = () => {} }) => {
  const [frequency, setFrequency] = useState("monthly");
  const [anchorDate, setAnchorDate] = useState("");

  useEffect(() => {
    try {
      const stored = readNamespacedItem("payPeriod");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.frequency) {
          setFrequency(parsed.frequency);
        }
        if (parsed?.anchorDate) {
          setAnchorDate(parsed.anchorDate);
        }
      }
    } catch (error) {
      // ignore invalid storage
    }
  }, []);

  const handleContinue = () => {
    writeNamespacedItem(
      "payPeriod",
      JSON.stringify({ frequency, anchorDate: anchorDate || "" })
    );
    onNavigate("onboardingMonthlyPicture");
  };

  return (
    <div className="onboarding-page">
      <header className="onboarding-hero">
        <p className="onboarding-eyebrow">Pay rhythm</p>
        <h1>Anchor Luna to your paychecks</h1>
        <p className="onboarding-subtitle">
          If your income doesn’t follow a predictable schedule, that’s okay. Just tell us when you
          expect your next paycheck, and Luna will stay aligned with your real life — not a rigid
          calendar.
        </p>
      </header>
      <main className="onboarding-body">
        <section className="onboarding-card">
          <label htmlFor="frequency-select">Pay frequency</label>
          <select
            id="frequency-select"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value)}
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {frequency === "irregular" && (
            <p className="onboarding-note">
              Irregular is normal. Pick the next paycheck date for now — you can change it anytime.
            </p>
          )}
          <label htmlFor="anchor-date">Next paycheck</label>
          <input
            id="anchor-date"
            type="date"
            value={anchorDate}
            onChange={(event) => setAnchorDate(event.target.value)}
          />
          <p className="onboarding-note">
            This helps anchor your cycle. 📅 mm/dd/yyyy
          </p>
          <button
            type="button"
            className="primary-btn purple-save-btn onboarding-cta"
            onClick={handleContinue}
          >
            Continue
          </button>
        </section>
      </main>
    </div>
  );
};

export default PayRhythm;
