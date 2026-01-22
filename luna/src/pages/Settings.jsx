import React, { useEffect, useState } from "react";
import "./Settings.css";
import {
  CURRENCY_OPTIONS,
  REGION_OPTIONS,
  usePreferences,
} from "../contexts/PreferencesContext";
import TopRightControls from "../components/TopRightControls.jsx";
import PayPeriodCalendar from "../components/PayPeriodCalendar";
import {
  CARD_LABELS,
  HIDDEN_CARDS_EVENT,
  HIDDEN_CARDS_KEY,
  broadcastHiddenDashboardCards,
  loadHiddenDashboardCards,
  saveHiddenDashboardCards,
} from "../utils/dashboardHiddenCards";
import { SyncToggle } from "../components/settings/SyncToggle";
import { buildApiUrl } from "../lib/api";

const IDENTITY_KEY = "userIdentity";
const HEALTH_CONSOLE_KEY = "healthConsoleEnabled";
const HEALTH_CONSOLE_EVENT = "health-console-toggle";
const LUNA_CHAT_KEY = "hideLunaChat";
const LUNA_CHAT_EVENT = "luna-chat-visibility";
const readIdentityFromStorage = () => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
};

const NAV_ITEMS = [
  "Account",
  "Security",
  "Financial Setup",
  "Experience",
  "Notifications",
  "Advanced",
];

const Settings = ({
  onNavigate = () => {},
  theme = "light",
  setTheme = () => {},
  healthConsoleEnabled = false,
  setHealthConsoleEnabled = () => {},
}) => {
  const {
    preferences,
    setCurrency,
    setRegion,
    setBusinessFeatures,
    setBudgetPeriod,
    setBudgetPeriodStartDay,
    setBudgetPeriodAnchor,
    setPrivacyShieldEnabled,
    setHardwareKeyEnabled,
    setGuidanceLevel,
    setNotificationLevel,
    setTonePreference,
  } = usePreferences();
  const [hiddenCards, setHiddenCards] = useState(() => loadHiddenDashboardCards());
  const [hiddenOverlayOpen, setHiddenOverlayOpen] = useState(false);
  const [deleteOverlayOpen, setDeleteOverlayOpen] = useState(false);
  const [parserMessage, setParserMessage] = useState("");
  const [parserBusy, setParserBusy] = useState(false);
  const [identityData, setIdentityData] = useState(() => readIdentityFromStorage());
  const subscriptionStatus = (identityData?.subscriptionStatus || "FREE").toUpperCase();
  const handleUpgradeClick = () => onNavigate("payment-options");
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({
    period: preferences.budgetPeriod || "monthly",
    startDay: Number(preferences.budgetPeriodStartDay || 1),
    anchor: preferences.budgetPeriodAnchor || "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleStorage = (event) => {
      if (event.key === HIDDEN_CARDS_KEY) {
        setHiddenCards(loadHiddenDashboardCards());
      }
    };
    const handleBroadcast = () => {
      setHiddenCards(loadHiddenDashboardCards());
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(HIDDEN_CARDS_EVENT, handleBroadcast);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(HIDDEN_CARDS_EVENT, handleBroadcast);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateIdentity = () => setIdentityData(readIdentityFromStorage());
    const handleStorage = (event) => {
      if (!event.key || event.key === IDENTITY_KEY) {
        updateIdentity();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("identity-updated", updateIdentity);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("identity-updated", updateIdentity);
    };
  }, []);

  useEffect(() => {
    setBudgetDraft({
      period: preferences.budgetPeriod || "monthly",
      startDay: Number(preferences.budgetPeriodStartDay || 1),
      anchor: preferences.budgetPeriodAnchor || "",
    });
  }, [preferences.budgetPeriod, preferences.budgetPeriodStartDay, preferences.budgetPeriodAnchor]);

  const [activeTab, setActiveTab] = useState("Account");
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const [chatHidden, setChatHidden] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(LUNA_CHAT_KEY);
    if (stored === "false") return false;
    return true;
  });

  const toggleHealthConsole = () => {
    const next = !healthConsoleEnabled;
    setHealthConsoleEnabled(next);
    try {
      localStorage.setItem(HEALTH_CONSOLE_KEY, next ? "true" : "false");
      window.dispatchEvent(new Event(HEALTH_CONSOLE_EVENT));
    } catch (e) {
      /* ignore */
    }
  };

  const toggleChatVisibility = () => {
    const next = !chatHidden;
    setChatHidden(next);
    try {
      localStorage.setItem(LUNA_CHAT_KEY, next ? "true" : "false");
      window.dispatchEvent(new CustomEvent(LUNA_CHAT_EVENT, { detail: { hidden: next } }));
    } catch (e) {
      /* ignore */
    }
  };

  const togglePrivacyShield = () =>
    setPrivacyShieldEnabled(!preferences.privacyShieldEnabled);

  const toggleHardwareKey = () =>
    setHardwareKeyEnabled(!preferences.hardwareKeyEnabled);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleStorage = (event) => {
      if (event.key === LUNA_CHAT_KEY) {
        setChatHidden(event.newValue === "true");
      }
    };
    const handleVisibility = (event) => {
      const next = event?.detail?.hidden;
      if (typeof next === "boolean") {
        setChatHidden(next);
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(LUNA_CHAT_EVENT, handleVisibility);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LUNA_CHAT_EVENT, handleVisibility);
    };
  }, []);

  const budgetPeriodOptions = [
    { value: "monthly", label: "Calendar month" },
    { value: "weekly", label: "Weekly (7-day)" },
    { value: "biweekly", label: "Biweekly (14-day)" },
    { value: "four-week", label: "4-week cycle" },
    { value: "paycheck", label: "Paycheck-based" },
    { value: "quarterly", label: "Quarterly" },
    { value: "custom-day", label: "Custom monthly start day" },
  ];

  const startDayOptions = Array.from({ length: 28 }, (_, i) => i + 1);

  const getBudgetPeriodLabel = (value) =>
    budgetPeriodOptions.find((option) => option.value === value)?.label || "Budget period";

  const openHiddenCardsOverlay = () => setHiddenOverlayOpen(true);
  const closeHiddenCardsOverlay = () => setHiddenOverlayOpen(false);
  const openDeleteOverlay = () => setDeleteOverlayOpen(true);
  const closeDeleteOverlay = () => setDeleteOverlayOpen(false);
  const hasBudgetChanges =
    budgetDraft.period !== (preferences.budgetPeriod || "monthly") ||
    budgetDraft.startDay !== Number(preferences.budgetPeriodStartDay || 1) ||
    budgetDraft.anchor !== (preferences.budgetPeriodAnchor || "");
  const saveBudgetPeriod = () => {
    setBudgetPeriod(budgetDraft.period);
    setBudgetPeriodStartDay(budgetDraft.startDay);
    setBudgetPeriodAnchor(budgetDraft.anchor || "");
    setBudgetSaved(true);
  };
  useEffect(() => {
    if (!budgetSaved) return;
    const timeoutId = window.setTimeout(() => setBudgetSaved(false), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [budgetSaved]);

  const handleDeleteAccount = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      /* ignore */
    }
    setHiddenCards([]);
    setIdentityData({});
    window.dispatchEvent(new Event("auth-updated"));
    window.dispatchEvent(new Event("identity-updated"));
    window.dispatchEvent(new Event("profile-updated"));
    window.dispatchEvent(new Event("debt-cash-updated"));
    setDeleteOverlayOpen(false);
    onNavigate("login");
  };

  const restoreHiddenCard = (key) => {
    setHiddenCards((prev) => {
      const next = prev.filter((card) => card !== key);
      saveHiddenDashboardCards(next);
      broadcastHiddenDashboardCards();
      return next;
    });
  };

  const handleRemoveStatements = async () => {
    setParserBusy(true);
    setParserMessage("");
    try {
      const res = await fetch(buildApiUrl("/api/parse-upload"), { method: "DELETE" });
      if (!res.ok) throw new Error("Request failed");
      setParserMessage("Uploaded statements removed.");
    } catch (e) {
      setParserMessage("Unable to remove statements right now.");
    } finally {
      setParserBusy(false);
    }
  };

  const renderAccountSection = () => (
    <>
      <section className="settings-section">
        <div className="section-header">
          <h2>Account &amp; Subscription</h2>
          <p className="settings-section-description">Keep your tier, billing, and profile in sync.</p>
        </div>
        <div className="settings-section-cards section-grid">
          <div className="settings-card status-card">
            <div className="status-row">
              <div>
                <p className="status-label">Status</p>
                <p className="status-value">
                  {subscriptionStatus === "PRO" ? "Luna Pro" : "Luna Free"}
                </p>
              </div>
              <span className={`status-chip ${subscriptionStatus === "PRO" ? "status-chip--pro" : ""}`}>
                {subscriptionStatus === "PRO" ? "Fortress verified" : "Upgrade available"}
              </span>
            </div>
            <p className="section-note">Your tier updates automatically as your leftover improves.</p>
            <div className="button-row">
              <button type="button" className="primary-btn" onClick={handleUpgradeClick}>
                {subscriptionStatus === "PRO" ? "View perks" : "Upgrade to Luna Pro"}
              </button>
              <button type="button" className="secondary-btn" onClick={() => onNavigate("payment-options")}>
                Manage billing
              </button>
            </div>
          </div>
          <div className="settings-card account-actions-card">
            <h3>Account basics</h3>
            <div className="button-grid">
              <button type="button" className="link-btn" onClick={() => onNavigate("user-profile")}>
                View profile
              </button>
              <button type="button" className="link-btn" onClick={() => onNavigate("security")}>
                Security &amp; privacy
              </button>
            </div>
            <p className="section-helper">
              Privacy by design keeps your billing identity separate from your financial data.
            </p>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-header-section">
          <h2>Danger Zone</h2>
          <p className="settings-section-description">Use with care. These actions cannot be undone.</p>
        </div>
        <div className="settings-section-cards section-grid">
          <div className="settings-card danger-card">
            <h3>Delete account</h3>
            <p>Permanently remove your account and all saved data from this device.</p>
            <div className="button-row">
              <button type="button" className="secondary-btn danger-btn" onClick={openDeleteOverlay}>
                Delete account
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  const renderSecuritySection = () => (
    <section className="settings-section">
      <div className="section-header">
        <h2>Security</h2>
        <p className="settings-section-description">Choose the protections that stay active on your account.</p>
      </div>
      <div className="settings-section-cards section-grid">
        <div className="settings-card security-card">
          <div className="toggle-row">
            <span>Privacy Shield (auto blur when Luna loses focus)</span>
            <button
              type="button"
              className={`switch ${preferences.privacyShieldEnabled ? "on" : ""}`}
              onClick={togglePrivacyShield}
              aria-label="Toggle Privacy Shield"
            >
              <span className="knob" />
            </button>
          </div>
          <div className="toggle-row">
            <span>Hardware key (USB/FIDO2) opt-in</span>
            <button
              type="button"
              className={`switch ${preferences.hardwareKeyEnabled ? "on" : ""}`}
              onClick={toggleHardwareKey}
              aria-label="Toggle hardware key"
            >
              <span className="knob" />
            </button>
          </div>
          <div className="section-helper">
            Hardware keys will be registered from the Security screen once the WebAuthn endpoints are ready.
          </div>
        </div>
      </div>
    </section>
  );

  const renderFinancialSection = () => (
    <section className="settings-section">
      <div className="section-header">
        <h2>Financial Setup</h2>
        <p className="settings-section-description">Everything you need to keep your money profile current.</p>
      </div>
      <div className="settings-section-cards section-grid">
        <div
          className="settings-card financial-master-card"
          role="button"
          tabIndex={0}
          onClick={() => setIsFinancialOpen((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              setIsFinancialOpen((prev) => !prev);
            }
          }}
          aria-expanded={isFinancialOpen}
        >
          <div>
            <p className="settings-section-description accent-text">Status</p>
            <h3 className="settings-section-title">Connected</h3>
            <p className="settings-section-description">
              Bank verification up-to-date. Income and expense data sync is healthy.
            </p>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={(event) => {
                event.stopPropagation();
                setIsFinancialOpen((prev) => !prev);
              }}
            >
              {isFinancialOpen ? "Hide details" : "View details"}
            </button>
          </div>
        </div>
        <div className="settings-financial-details" style={{ display: isFinancialOpen ? "grid" : "none" }}>
          <div className="settings-card financial-card">
            <div>
              <h3>Loan verification</h3>
              <p>Share identity details when you explore debt consolidation or loan options.</p>
              <div className="button-row">
                <button className="secondary-btn" onClick={() => onNavigate("user-profile")}>
                  Open Verification Form
                </button>
              </div>
            </div>
            <div>
              <h3>Income &amp; Expenses</h3>
              <p>Update income and expenses anytime. For loan recommendations, complete Verification first.</p>
              <div className="button-row">
                <button className="secondary-btn" onClick={() => onNavigate("onboarding")}>
                  Open Income &amp; Expenses
                </button>
              </div>
            </div>
            <div>
              <h3>Bank statements</h3>
              <p>Review or remove your uploaded statements.</p>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleRemoveStatements}
                  disabled={parserBusy}
                >
                  {parserBusy ? "Removing..." : "Remove statements"}
                </button>
              </div>
              {parserMessage && <div className="section-helper">{parserMessage}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderExperienceSection = () => (
    <section className="settings-section">
      <div className="section-header">
        <h2>Experience</h2>
        <p className="settings-section-description">Make Luna feel like your workspace.</p>
      </div>
      <div className="settings-section-cards section-grid experience-grid">
        <div className="settings-card">
          <h3>Appearance &amp; controls</h3>
          <div className="toggle-row">
            <span>Dark mode</span>
            <button
              type="button"
              className={`switch ${theme === "dark" ? "on" : ""}`}
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              <span className="knob" />
            </button>
          </div>
          <div className="toggle-row">
            <span>{chatHidden ? "Reveal Luna AI chat" : "Hide Luna AI chat"}</span>
            <button
              type="button"
              className={`switch ${!chatHidden ? "on" : ""}`}
              onClick={toggleChatVisibility}
              aria-label="Toggle Luna AI chat"
            >
              <span className="knob" />
            </button>
          </div>
          {preferences.premiumAccess && (
            <div className="toggle-row business-toggle-row">
              <span>Business toolkit</span>
              <button
                type="button"
                className={`switch ${preferences.businessFeatures ? "on" : ""}`}
                onClick={() => setBusinessFeatures(!preferences.businessFeatures)}
                aria-label="Toggle business toolkit"
              >
                <span className="knob" />
              </button>
            </div>
          )}
          <SyncToggle />
          <div className="hidden-card-link-row">
            <button type="button" className="hidden-card-link" onClick={openHiddenCardsOverlay}>
              Manage hidden dashboard cards
            </button>
          </div>
        </div>
        <div className="settings-card">
          <h3>Budget period</h3>
          <p>Control how your live performance resets.</p>
          <PayPeriodCalendar
            period={budgetDraft.period}
            label={getBudgetPeriodLabel(budgetDraft.period)}
            startDay={budgetDraft.startDay}
            anchorDate={budgetDraft.anchor}
            onAnchorDateChange={(value) => setBudgetDraft((prev) => ({ ...prev, anchor: value }))}
            className="settings-pay-period-calendar"
          />
          <div className="settings-pay-period-helper">
            <span aria-hidden="true" className="info-icon">
              i
            </span>
            <span>
              This controls when live totals reset. Choose the rhythm that matches your income, then log the next
              paycheck to lock the period in place.
            </span>
          </div>
          <div className="settings-select-row">
            <label>
              <strong>Budget period</strong>
              <select
                value={budgetDraft.period}
                onChange={(e) => setBudgetDraft((prev) => ({ ...prev, period: e.target.value }))}
              >
                {budgetPeriodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {budgetDraft.period === "custom-day" && (
              <label>
                <strong>Cycle starts on</strong>
                <select
                  value={budgetDraft.startDay}
                  onChange={(e) => setBudgetDraft((prev) => ({ ...prev, startDay: Number(e.target.value) }))}
                >
                  {startDayOptions.map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="settings-helper">
            This only affects your live performance cycle. Baseline income, expenses, and debts stay the same.
          </div>
          <div className="button-row budget-period-actions">
            <button
              type="button"
              className="primary-btn purple-save-btn"
              onClick={saveBudgetPeriod}
              disabled={!hasBudgetChanges}
            >
              Save budget period
            </button>
            <span className="settings-save-slot">{budgetSaved && <span className="settings-save-fade">Saved</span>}</span>
          </div>
          {budgetDraft.period === "paycheck" && (
            <div className="settings-helper">
              Paycheck mode resets when you log a new income entry. If no income is logged, we use the last baseline
              for estimates.
            </div>
          )}
        </div>
        <div className="settings-card">
          <h3>Region &amp; Currency</h3>
          <p>Choose how your money is displayed.</p>
          <div className="settings-region-row">
            <label>
              <strong>Region</strong>
              <select value={preferences.region || "US"} onChange={(e) => setRegion(e.target.value)}>
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="settings-region-row">
            <label>
              <strong>Currency</strong>
              <select value={preferences.currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="settings-helper">
            Choosing a region sets a default currency, but you can still change it anytime.
          </div>
          <div className="hidden-card-link-row">
            <button type="button" className="hidden-card-link" onClick={() => onNavigate("budget-period-guide")}>
              How budget periods work
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  const renderNotificationsSection = () => (
    <section className="settings-section">
      <div className="section-header">
        <h2>Guidance &amp; Notifications</h2>
        <p className="settings-section-description">
          Choose how often Luna speaks, how it sounds, and when you want undisturbed focus.
        </p>
      </div>
      <div className="settings-section-cards section-grid">
        <div className="settings-card guidance-card">
          <h3>Respectful insights</h3>
          <div className="settings-select-row">
            <label>
              <strong>How much guidance would you like?</strong>
              <select
                value={preferences.guidanceLevel || "normal"}
                onChange={(e) => setGuidanceLevel(e.target.value)}
              >
                <option value="normal">Normal (recommended)</option>
                <option value="minimal">Minimal (only important updates)</option>
                <option value="off">Off (numbers only)</option>
              </select>
            </label>
            <p className="section-helper">
              Pick the cadence that fits your attention. Minimal keeps only the most vital nudges, while Off keeps Luna
              quiet.
            </p>
          </div>
          <div className="settings-select-row">
            <label>
              <strong>When should we notify you?</strong>
              <select
                value={preferences.notificationLevel || "normal"}
                onChange={(e) => setNotificationLevel(e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="important_only">Important only</option>
                <option value="off">Never</option>
              </select>
            </label>
            <p className="section-helper">
              Notifications only arrive when they really matter. Important only keeps alerts calm and rare.
            </p>
          </div>
          <div className="settings-select-row">
            <label>
              <strong>How should guidance sound?</strong>
              <select
                value={preferences.tonePreference || "supportive"}
                onChange={(e) => setTonePreference(e.target.value)}
              >
                <option value="supportive">Supportive</option>
                <option value="neutral">Neutral</option>
              </select>
            </label>
            <p className="section-helper">
              Tone follows your preferenceƒ?"supportive for warmth, neutral for a straight-ahead update.
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  const renderAdvancedSection = () => (
    <section className="settings-section">
      <div className="section-header">
        <h2>Advanced</h2>
        <p className="settings-section-description">Tools for power users and troubleshooting.</p>
      </div>
      <div className="settings-section-cards section-grid">
        <div className="settings-card">
          <h3>Developer tools</h3>
          <p>Enable runtime diagnostics while you use the app.</p>
          <div className="toggle-row">
            <span>Health Console</span>
            <button
              type="button"
              className={`switch ${healthConsoleEnabled ? "on" : ""}`}
              onClick={toggleHealthConsole}
              aria-label="Toggle health console"
            >
              <span className="knob" />
            </button>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-btn" onClick={() => onNavigate("features-guide")}>
              Explore features
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className={`settings-page ${theme === "dark" ? "is-dark" : ""}`}>
      <div className="settings-shell">
        <aside className="settings-sidebar">
          <div className="sidebar-heading">Settings</div>
          <div className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                className={`settings-sidebar-button ${
                  activeTab === (item === "Financial Setup" ? "Financial" : item) ? "settings-sidebar-button--active" : ""
                }`}
                onClick={() => {
                  setActiveTab(item === "Financial Setup" ? "Financial" : item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </aside>

        <div className="settings-main">
          <header className="settings-header">
            <TopRightControls
              className="top-controls"
              activePage="settings"
              onNavigate={onNavigate}
              logoutHref="/Local/BudgetIQ Login"
            />
            <div className="header-text">
              <div className="title">Settings</div>
              <div className="subtitle">Your account, preferences, and verification details in one place.</div>
              <div className="subtitle tier-note">Your tier updates automatically as your leftover improves.</div>
            </div>
          </header>
          <div className="settings-container">
            {activeTab === "Account" && renderAccountSection()}
            {activeTab === "Security" && renderSecuritySection()}
            {activeTab === "Financial" && renderFinancialSection()}
            {activeTab === "Experience" && renderExperienceSection()}
            {activeTab === "Notifications" && renderNotificationsSection()}
            {activeTab === "Advanced" && renderAdvancedSection()}
            <div className="settings-footer-note helper-note">
              Luna is modeling insights from your inputs—this page reflects system-generated snapshots, not personalized financial advice. Your billing identity (email/Stripe) stays in a separate silo from the encrypted vault and is linked only by the blind UUID. Every export, ledger sync, and purge is logged so your compliance trail stays verifiable.
            </div>
          </div>
{hiddenOverlayOpen && (
        <div className="hidden-cards-overlay" onClick={closeHiddenCardsOverlay}>
          <div className="hidden-cards-modal" onClick={(event) => event.stopPropagation()}>
            <div className="hidden-cards-header">
              <h4>Manage removed cards</h4>
              <p>Bring back any cards you hid from the dashboard.</p>
            </div>
            <div className="hidden-cards-list">
              {hiddenCards.length === 0 ? (
                <div className="hidden-cards-empty settings-helper">No cards are hidden right now.</div>
              ) : (
                hiddenCards.map((key) => (
                  <div key={key} className="hidden-card-row">
                    <span>{CARD_LABELS[key] || key}</span>
                    <button
                      type="button"
                      className="secondary-btn hidden-card-restore"
                      onClick={() => restoreHiddenCard(key)}
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="button-row">
              <button type="button" className="secondary-btn full-width" onClick={closeHiddenCardsOverlay}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteOverlayOpen && (
        <div className="hidden-cards-overlay" onClick={closeDeleteOverlay}>
          <div className="hidden-cards-modal delete-account-modal" onClick={(event) => event.stopPropagation()}>
            <div className="hidden-cards-header">
              <h4>Delete account</h4>
              <p>This will permanently remove your account and all saved data from this device.</p>
            </div>
            <div className="button-row delete-actions">
              <button type="button" className="secondary-btn" onClick={closeDeleteOverlay}>
                Cancel
              </button>
              <button type="button" className="secondary-btn danger-btn" onClick={handleDeleteAccount}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
</div>
  );
};

export default Settings;










