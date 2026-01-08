import React, { useMemo, useState } from "react";
import "./PaymentOptions.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";

const PaymentOptions = ({ onNavigate = () => {}, theme = "light" }) => {
  const { profile } = useMoneyProfile();
  const { preferences, setPremiumAccess } = usePreferences();
  const [upgradeNote, setUpgradeNote] = useState("");
  const isPremium = useMemo(() => {
    const statusRaw = profile.subscriptionStatus;
    const status = (statusRaw || "").toLowerCase();
    if (status) {
      return status === "active" || status === "trialing";
    }
    return preferences?.premiumAccess === true;
  }, [profile.subscriptionStatus, preferences?.premiumAccess]);

  const openBilling = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/billing");
    }
  };
  const handleUpgrade = () => {
    setPremiumAccess(true);
    setUpgradeNote("Premium is now active on this device.");
  };

  return (
    <div className={`payment-options-page ${theme === "dark" ? "is-dark" : ""}`}>
      <header className="payment-header">
        <TopRightControls
          className="top-controls"
          activePage="payment-options"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="header-text">
          <div className="title">Subscription Controls</div>
          <div className="subtitle">
            Manage your Premium subscription and billing details securely.
          </div>
        </div>
      </header>

      <main className="payment-main">
        <section className="payment-card payment-form-card payment-premium-card">
          <div className="card-title-row">
            <div>
              <h2>{isPremium ? "Premium is active" : "Upgrade to Premium"}</h2>
              <p>
                {isPremium
                  ? "You have access to advanced insights designed for freelancers and 1099 earners."
                  : "Tools designed for freelancers and 1099 earners, built to keep your plan steady."}
              </p>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="primary-btn purple-save-btn"
              onClick={isPremium ? openBilling : handleUpgrade}
              >
              {isPremium ? "Manage" : "Upgrade to Premium"}
            </button>
          </div>
          {upgradeNote && <p className="payment-partner-note">{upgradeNote}</p>}
          <p className="payment-partner-note">
            {isPremium
              ? "Billing, payment security, and subscription changes are handled safely through our trusted billing partner."
              : "Billing and payments are securely handled by our trusted payment partner. You can cancel anytime."}
          </p>
        </section>

        <section className="payment-card payment-list-card">
          <div className="card-title-row">
            <div>
              <h2>{isPremium ? "Premium benefits" : "Premium unlocks"}</h2>
              <p>
                {isPremium
                  ? "These tools are active on your account."
                  : "Upgrade to access these freelancer-focused tools and guidance."}
              </p>
            </div>
          </div>
          <ul className="premium-feature-list">
            <li>Quarterly tax reminders so you don't fall behind.</li>
            <li>Highlighted deductible spending on your dashboard.</li>
            <li>Custom tips tailored to freelancers and 1099 income.</li>
          </ul>
        </section>
      </main>
      <div className="payment-helper helper-note">
        Payments and Premium controls are synced with your billing silo only; the vault remains encrypted and separate. The advice on this page is a modeled insight about your tier, not personalized financial advice, and every billing or purge event is logged so compliance-ready records exist.
      </div>
    </div>
  );
};

export default PaymentOptions;
