import React, { useEffect, useMemo, useState } from "react";
import "./Savings.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { readNamespacedItem, writeNamespacedItem } from "../utils/userStorage";

const formatNumberInput = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/,/g, "");
  if (str === "") return "";
  const [intPart, decPart] = str.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
};

const tierCopy = {
  fragile: {
    heroTitle: "Your safety cushion is still forming",
    heroSubtitle: "You're covering essentials, but there's no real protection yet. That's okay. This page helps you build steady calm, not perfection.",
    heroNote: "Growing, but not protective yet. We'll build this gently, together.",
    coachingTitle: "Small steps matter",
    coachingBody: "Even $25-$100 per period builds surprising stability if it keeps going. Tiny deposits count. You're not behind — you're building.",
  },
  balanced: {
    heroTitle: "You're close to feeling truly safe",
    heroSubtitle: "Your cushion is starting to hold real weight. A little more consistency can turn 'almost steady' into 'I can breathe.'",
    heroNote: "Your buffer is taking shape - keep this steady.",
    coachingTitle: "Consistency is your best friend now",
    coachingBody: "You're proving stability. Staying gentle and predictable with savings helps life feel quieter and adds control when surprises show up.",
  },
  thriving: {
    heroTitle: "You built real protection",
    heroSubtitle: "This cushion absorbs life. It turns stress into options. This is powerful - and worth guarding.",
    heroNote: "Your safety cushion is working for you.",
    coachingTitle: "Now your money gives you choices",
    coachingBody: "With this protection in place, you can shape life more intentionally. We'll help you protect it while you decide what comes next.",
  },
};

const Savings = ({ onNavigate = () => {} }) => {
  const { profile, totals, refreshProfile } = useMoneyProfile();
  const { formatCurrency } = usePreferences();
  const [form, setForm] = useState({
    savingsBalance: profile.savingsBalance || "",
    savingsMonthly: profile.savingsMonthly || "",
  });
  const [saveMessage, setSaveMessage] = useState("");
  const [toastKey, setToastKey] = useState(0);

  const saved = useMemo(() => Number(profile.savingsBalance) || 0, [profile.savingsBalance]);
  const monthlyExpenses = Math.max(Number(totals.expenses) || 0, 0);
  const cushionPercent = useMemo(() => {
    if (!monthlyExpenses) return 0;
    return Math.min((saved / monthlyExpenses) * 100, 999);
  }, [saved, monthlyExpenses]);

  const tierSlug = useMemo(() => {
    if (cushionPercent >= 100) return "thriving";
    if (cushionPercent >= 30) return "balanced";
    return "fragile";
  }, [cushionPercent]);
  const copy = tierCopy[tierSlug];

  const updateProfile = (next) => {
    try {
      const stored = readNamespacedItem("moneyProfile", "{}");
      const parsed = stored ? JSON.parse(stored) : {};
      const updated = { ...parsed, ...next };
      writeNamespacedItem("moneyProfile", JSON.stringify(updated));
      window.dispatchEvent(new Event("profile-updated"));
      refreshProfile();
    } catch (e) {
      /* ignore */
    }
  };

  const handleChange = (field) => (event) => {
    const raw = event.target.value.replace(/,/g, "");
    setForm((prev) => ({ ...prev, [field]: raw }));
    updateProfile({ [field]: raw });
  };

  const handleSave = () => {
    updateProfile({
      savingsBalance: form.savingsBalance,
      savingsMonthly: form.savingsMonthly,
    });
    setSaveMessage("Saved");
    setToastKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!saveMessage) return;
    const timeoutId = window.setTimeout(() => setSaveMessage(""), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  return (
    <div className="savings-page">
      <TopRightControls
        className="top-controls"
        activePage="savings"
        onNavigate={onNavigate}
        logoutHref="/Local/Luna Login"
      />

      <section className="savings-hero-block">
        <div className="savings-copy">
          <p className="savings-eyebrow">Your safety cushion lives here</p>
          <h1>{copy.heroTitle}</h1>
          <p className="savings-subtitle">{copy.heroSubtitle}</p>
        </div>
        <div className="savings-status-card">
          <div className="status-label">Current cushion</div>
          <div className="status-value">{formatCurrency(saved)}</div>
          <div className="status-percent">
            {monthlyExpenses ? `${Math.round(cushionPercent)}% of one month covered` : "0% of one month covered"}
          </div>
          <div className="status-progress">
            <div className="status-progress-track">
              <div
                className="status-progress-fill"
                style={{ width: `${monthlyExpenses ? Math.min(cushionPercent, 100) : 0}%` }}
              />
            </div>
          </div>
          <p className="status-note">{copy.heroNote}</p>
        </div>
      </section>

      <section className="savings-update">
        <div className="update-header">
          <h2>Update your savings</h2>
          <p className="update-subtext">Update this anytime — Luna adapts without judgment.</p>

        </div>
        <div className="savings-grid">
          <label>
            Current savings balance
            <input
              type="text"
              inputMode="decimal"
              value={formatNumberInput(form.savingsBalance)}
              onChange={handleChange("savingsBalance")}
              placeholder="e.g. 2,500"
            />
          </label>
          <label>
            Monthly savings contribution
            <input
              type="text"
              inputMode="decimal"
              value={formatNumberInput(form.savingsMonthly)}
              onChange={handleChange("savingsMonthly")}
              placeholder="e.g. 200"
            />
          </label>
        </div>
      </section>

      <section className="savings-coaching">
        <div className="coaching-content">
          <h3>{copy.coachingTitle}</h3>
          <p>{copy.coachingBody}</p>
        </div>
      </section>

      <div className="savings-actions">
        {saveMessage ? (
          <span key={toastKey} className="savings-save-toast">
            {saveMessage}
          </span>
        ) : null}
        <button type="button" className="primary-btn purple-save-btn" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default Savings;
