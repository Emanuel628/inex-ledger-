import React, { useEffect, useState } from "react";
import "./Onboarding.css";
import TopRightControls from "../components/TopRightControls.jsx";
import PlaidStart from "../components/PlaidStart";
import PayPeriodCalendar from "../components/PayPeriodCalendar";
import { getDisplayName } from "../utils/nameUtils";
import { usePreferences } from "../contexts/PreferencesContext";
import { buildKey, markOnboardingComplete } from "../utils/userStorage";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "threeMonths", label: "3 Months" },
  { value: "annual", label: "Annually" },
];

const FREQUENCY_MULTIPLIERS = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  threeMonths: 1 / 3,
  annual: 1 / 12,
};

const getFrequencyLabel = (value) =>
  FREQUENCY_OPTIONS.find((option) => option.value === value)?.label || "Monthly";

const normalizeToMonthly = (amount, frequency = "monthly") => {
  const parsed = Number(amount);
  if (Number.isNaN(parsed)) return 0;
  const multiplier = FREQUENCY_MULTIPLIERS[frequency] ?? 1;
  return parsed * multiplier;
};

const getItemAmount = (item) => Number(item?.amount ?? item?.monthly ?? 0) || 0;
const extractFirstName = (value = "") => {
  const name = (value || "").trim();
  if (!name) return "";
  return name.split(/\s+/)[0];
};

const getCurrentYear = () => new Date().getFullYear();
const isYearWithinAgeRange = (year, currentYear) =>
  Number.isFinite(year) && year >= currentYear - 120 && year <= currentYear;
const meetsMinimumAge = (year, currentYear) => currentYear - year >= 18;

const IDENTITY_KEY = "userIdentity";

const readIdentityFirstName = () => {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    if (!stored) return "";
    const parsed = JSON.parse(stored);
    return extractFirstName(parsed?.firstName || "");
  } catch (e) {
    return "";
  }
};

const STORAGE_KEY = "moneyProfile";
const ONBOARDING_COMPLETE = "luna_onboarding_complete";
const TERMS_URL = "/docs/terms-of-service.md";
const PRIVACY_URL = "/docs/data-contract.md";
const AGE_VERIFIED_KEY = "luna_age_verified";
const AGE_YEAR_KEY = "luna_year_of_birth";
const CONSENT_ACK_KEY = "luna_consent_acknowledged";

const readFromStorage = (key, fallback = "") => {
  if (typeof window === "undefined") return fallback;
  const namespaced = buildKey(key);
  const stored = localStorage.getItem(namespaced);
  if (stored !== null && stored !== undefined) {
    return stored;
  }
  const legacy = localStorage.getItem(key);
  return legacy ?? fallback;
};

const defaultProfile = { name: "", incomes: [], expenses: [], payPeriod: "monthly", payPeriodAnchor: "" };
const PAY_PERIOD_OPTIONS = FREQUENCY_OPTIONS;

const Onboarding = ({ onNavigate = () => {} }) => {
  const [step, setStep] = useState(2);
  const readStoredProfile = () => {
    try {
      const stored =
        localStorage.getItem(buildKey(STORAGE_KEY)) ?? localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultProfile, ...JSON.parse(stored) } : defaultProfile;
    } catch (e) {
      return defaultProfile;
    }
  };

  const [profile, setProfile] = useState(readStoredProfile);
  const [identityFirstName, setIdentityFirstName] = useState(() => readIdentityFirstName());
  const { formatCurrency, setBudgetPeriod, setBudgetPeriodAnchor, preferences } = usePreferences();

  const [showItemModal, setShowItemModal] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [modalType, setModalType] = useState(""); // income | expense
  const [modalLabel, setModalLabel] = useState("");
  const [modalPlaceholder, setModalPlaceholder] = useState("");
  const [modalName, setModalName] = useState("");
  const [modalAmount, setModalAmount] = useState("");
  const [modalFrequency, setModalFrequency] = useState("monthly");

  const [amountCategory, setAmountCategory] = useState("");
  const [amountNameLabel, setAmountNameLabel] = useState("");
  const [amountIsIncome, setAmountIsIncome] = useState(false);
  const [housingType, setHousingType] = useState("");
  const [payPeriod, setPayPeriod] = useState(() => profile.payPeriod || "monthly");
  const [payPeriodAnchor, setPayPeriodAnchor] = useState(() => profile.payPeriodAnchor || "");
  const [bankLinked, setBankLinked] = useState(false);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [bankSkipped, setBankSkipped] = useState(false);
  const [yearOfBirth, setYearOfBirth] = useState(() => readFromStorage(AGE_YEAR_KEY));
  const [ageVerified, setAgeVerified] = useState(() => readFromStorage(AGE_VERIFIED_KEY) === "true");
  const [consentAcknowledged, setConsentAcknowledged] = useState(
    () => readFromStorage(CONSENT_ACK_KEY) === "true"
  );

  const formatNumberInput = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value).replace(/,/g, "");
    if (str === "") return "";
    const [intPart, decPart] = str.split(".");
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
  };

  const handleAmountChange = (event) => {
    const cleaned = event.target.value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    setModalAmount(normalized);
  };

  const parseAmount = (value) => {
    const cleaned = String(value ?? "").replace(/,/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const saveProfile = (next) => {
    const toSave = next ?? profile;
    setProfile(toSave);
    localStorage.setItem(buildKey(STORAGE_KEY), JSON.stringify(toSave));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("profile-updated"));
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refreshName = () => setIdentityFirstName(readIdentityFirstName());
    const handleStorage = (event) => {
      if (!event.key || event.key === IDENTITY_KEY) {
        refreshName();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("identity-updated", refreshName);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("identity-updated", refreshName);
    };
  }, []);

  useEffect(() => {
    if (profile.payPeriod && profile.payPeriod !== payPeriod) {
      setPayPeriod(profile.payPeriod);
    }
  }, [profile.payPeriod, payPeriod]);

  useEffect(() => {
    if (profile.payPeriodAnchor && profile.payPeriodAnchor !== payPeriodAnchor) {
      setPayPeriodAnchor(profile.payPeriodAnchor);
    }
  }, [profile.payPeriodAnchor, payPeriodAnchor]);

  useEffect(() => {
    const nextPeriod = preferences.budgetPeriod || "monthly";
    if (nextPeriod && nextPeriod !== payPeriod) {
      setPayPeriod(nextPeriod);
    }
  }, [preferences.budgetPeriod, payPeriod]);

  useEffect(() => {
    const nextAnchor = preferences.budgetPeriodAnchor || "";
    if (nextAnchor !== payPeriodAnchor) {
      setPayPeriodAnchor(nextAnchor);
    }
  }, [preferences.budgetPeriodAnchor, payPeriodAnchor]);


  const goToStep3 = () => {
    if (profile.incomes.length === 0) {
      alert("Add at least one income entry.");
      return;
    }
    setStep(3);
  };

  const limitedAccessRoutes = new Set([
    "settings",
    "security",
    "privacy",
    "about",
    "security-manifest",
    "privacy-manifest",
  ]);
  const handleConsentChange = (value) => {
    setConsentAcknowledged(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(buildKey("luna_us_consent"), value ? "true" : "false");
      if (value) {
        localStorage.setItem(buildKey(CONSENT_ACK_KEY), "true");
      } else {
        localStorage.removeItem(buildKey(CONSENT_ACK_KEY));
      }
    }
    if (!value) {
      setAgeVerified(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem(buildKey(AGE_VERIFIED_KEY));
      }
      return;
    }
    const currentYear = getCurrentYear();
    const yearNumber = Number(yearOfBirth);
    const isYearValid = isYearWithinAgeRange(yearNumber, currentYear);
    const derivedAgeRequirement = isYearValid && meetsMinimumAge(yearNumber, currentYear);
    if (derivedAgeRequirement) {
      setAgeVerified(true);
      if (typeof window !== "undefined") {
        localStorage.setItem(buildKey(AGE_VERIFIED_KEY), "true");
        localStorage.setItem(buildKey(AGE_YEAR_KEY), yearOfBirth);
      }
    }
  };

  const handlePayPeriodChange = (value) => {
    setPayPeriod(value);
    const next = { ...profile, payPeriod: value };
    saveProfile(next);
    setBudgetPeriod(value);
  };

  const handlePayPeriodAnchorChange = (value) => {
    setPayPeriodAnchor(value);
    const next = { ...profile, payPeriodAnchor: value };
    saveProfile(next);
    setBudgetPeriodAnchor(value);
  };

  const handleYearChange = (value) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    const prevYear = yearOfBirth;
    if (typeof window !== "undefined") {
      localStorage.setItem(buildKey(AGE_YEAR_KEY), cleaned);
    }
    if (ageVerified && cleaned !== prevYear) {
      setAgeVerified(false);
      setConsentAcknowledged(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem(buildKey(AGE_VERIFIED_KEY));
        localStorage.removeItem(buildKey(CONSENT_ACK_KEY));
      }
    }
    setYearOfBirth(cleaned);
  };

  const currentYear = getCurrentYear();
  const yearNumber = Number(yearOfBirth);
  const isYearValid = isYearWithinAgeRange(yearNumber, currentYear);
  const derivedAgeRequirement = isYearValid && meetsMinimumAge(yearNumber, currentYear);
  const ageRequirementMet = ageVerified || derivedAgeRequirement;
  const ageMessage = ageRequirementMet
    ? "Age verified. Thank you."
    : !yearOfBirth
    ? "Year of birth is required for age assurance (18+)."
    : !isYearValid
    ? "Enter a valid year to confirm you are 18 or older."
    : "We must confirm you are 18 or older before we can process sensitive data.";

  const finishSetup = () => {
    if (!ageRequirementMet) {
      alert("We need to confirm you are 18 or older before processing your snapshot.");
      return;
    }
    if (!consentAcknowledged) {
      alert("Please acknowledge the US disclosures to continue.");
      return;
    }
    saveProfile();
    if (typeof window !== "undefined") {
      markOnboardingComplete();
      const wasCompleted = localStorage.getItem(ONBOARDING_COMPLETE) === "true";
      localStorage.setItem(ONBOARDING_COMPLETE, "true");
      if (!wasCompleted) {
        onNavigate("budget");
        return;
      }
    }
    onNavigate("snapshot-result");
  };

  const handleMenuNavigate = (target) => {
    if (!ageRequirementMet && !limitedAccessRoutes.has(target)) {
      alert("We need to verify your year of birth (18+) before you access the full OS.");
      return;
    }
    if (!consentAcknowledged && !limitedAccessRoutes.has(target)) {
      alert(
        "Luna is currently in Privacy Lock mode. Provide consent in the panel to access the OS."
      );
      return;
    }
    onNavigate(target);
  };

  const renderList = (items, isIncome) => {
    const list = items || [];
    if (!list.length) {
      return <div className="small-note">No {isIncome ? "income" : "expenses"} added yet.</div>;
    }
    return list.map((item) => (
      <div key={item.id} className="entry-row">
        <div>
          {(() => {
            const baseLabel =
              isIncome && item.category === "Income" && item.name
                ? item.name
                : item.category || item.name;
            const detail =
              item.name && item.category && item.name !== baseLabel ? ` - ${item.name}` : "";
            return (
              <strong>
                {baseLabel}
                {detail}
              </strong>
            );
          })()}
            <br />
          {formatCurrency(getItemAmount(item))} / month
        </div>
        <button className="delete-btn" onClick={() => deleteItem(isIncome ? "income" : "expense", item.id)}>
          Remove
        </button>
      </div>
    ));
  };

  const deleteItem = (type, id) => {
    if (type === "income") {
      const next = { ...profile, incomes: profile.incomes.filter((i) => i.id !== id) };
      saveProfile(next);
    } else {
      const next = { ...profile, expenses: profile.expenses.filter((e) => e.id !== id) };
      saveProfile(next);
    }
  };

  const openItemModal = (type, label, placeholder) => {
    setModalType(type);
    setModalLabel(label);
    setModalPlaceholder(placeholder);
    setModalName("");
    setModalAmount("");
    setModalFrequency("monthly");
    setShowItemModal(true);
  };

  const saveItemFromModal = () => {
    console.log("saveItemFromModal", { modalName, modalAmount, modalType, modalLabel });
    const name = modalName.trim();
    const amount = parseAmount(modalAmount);
    if (!name) return alert("Name required.");
    if (isNaN(amount) || amount < 0) return alert("Enter valid amount.");
    const monthlyAmount = normalizeToMonthly(amount);
    const newItem = {
      id: Date.now(),
      name,
      amount: monthlyAmount,
    };
    const incomes = Array.isArray(profile.incomes) ? profile.incomes : [];
    const expenses = Array.isArray(profile.expenses) ? profile.expenses : [];
    if (modalType === "income") {
      const next = { ...profile, incomes: [...incomes, newItem] };
      saveProfile(next);
    } else {
      const next = {
        ...profile,
        expenses: [...expenses, { ...newItem, category: modalLabel }],
      };
      saveProfile(next);
    }
    setShowItemModal(false);
  };

  const openAmountOnlyModal = (category, label, type) => {
    setAmountCategory(category);
    setAmountNameLabel(label);
    setAmountIsIncome(type === "income");
    setHousingType("");
    setModalAmount("");
    setModalFrequency("monthly");
    setShowAmountModal(true);
  };

  const openSalaryModal = () => {
    const frequency = payPeriod || "monthly";
    setAmountCategory("Salary");
    setAmountNameLabel(`Salary (${getFrequencyLabel(frequency)})`);
    setAmountIsIncome(true);
    setModalAmount("");
    setModalFrequency(frequency);
    setShowAmountModal(true);
  };

  const saveSalaryAmount = () => {
    const annual = parseAmount(modalAmount);
    if (isNaN(annual) || annual < 0) return alert("Enter valid salary.");
    const monthly = normalizeToMonthly(annual);
    const incomes = Array.isArray(profile.incomes) ? profile.incomes : [];
    const next = {
      ...profile,
      incomes: [...incomes, { id: Date.now(), name: "Salary", category: "Income", amount: monthly }],
    };
    saveProfile(next);
    setShowAmountModal(false);
  };

  const saveAmountOnlyItem = () => {
    if (amountCategory === "Salary") return saveSalaryAmount();
    const amount = parseAmount(modalAmount);
    if (isNaN(amount) || amount < 0) return alert("Invalid amount.");
    if (amountCategory === "Housing" && !housingType) {
      return alert("Select Renting or Mortgage.");
    }
    const monthlyAmount = normalizeToMonthly(amount);
    const entry = {
      id: Date.now(),
      category: amountCategory,
      name: amountNameLabel,
      amount: monthlyAmount,
      housingType: amountCategory === "Housing" ? housingType : undefined,
    };
    const incomes = Array.isArray(profile.incomes) ? profile.incomes : [];
    const expenses = Array.isArray(profile.expenses) ? profile.expenses : [];
    if (amountIsIncome) {
      const next = { ...profile, incomes: [...incomes, entry] };
      saveProfile(next);
    } else {
      const next = { ...profile, expenses: [...expenses, entry] };
      saveProfile(next);
    }
    setShowAmountModal(false);
  };

  const handleBankLinked = (payload) => {
    setBankLinked(true);
    setBankTransactions(payload?.newTransactions || []);
    setBankSkipped(false);
  };

  const handleBankSkip = () => {
    setBankSkipped(true);
  };

  const totalIncome = (profile.incomes || []).reduce((sum, i) => sum + getItemAmount(i), 0);
  const totalExpenses = (profile.expenses || []).reduce((sum, e) => sum + getItemAmount(e), 0);
  const leftover = totalIncome - totalExpenses;
  const welcomeName = getDisplayName(profile.name, identityFirstName);

  return (
    <div className="onboarding-page">
      <header>
        <TopRightControls
          className="top-controls"
          activePage="onboarding"
          onNavigate={handleMenuNavigate}
          logoutHref="/Local/Luna Login"
        />
        <div className="onboarding-title">Income & Expenses</div>
        <div className="onboarding-subtitle">Start here to build your financial snapshot</div>
      </header>

      <div className="onboarding-tier-note">
        Your tier updates automatically as your leftover improves.
      </div>
      <div className="pay-period-card">
        <label htmlFor="payPeriodSelect">Pay period</label>
        <select
          id="payPeriodSelect"
          className="rounded-select"
          value={payPeriod}
          onChange={(e) => handlePayPeriodChange(e.target.value)}
        >
          {PAY_PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="small-note">
          Tell us how often your income hits so Luna can time reminders and keep bills aligned with each paycheck.
        </p>
        <PayPeriodCalendar
          period={payPeriod}
          label={getFrequencyLabel(payPeriod)}
          anchorDate={payPeriodAnchor}
          onAnchorDateChange={handlePayPeriodAnchorChange}
          className="pay-period-card__calendar"
        />
        <div className="pay-period-card__helper">
          <span aria-hidden="true" className="info-icon">
            i
          </span>
          <span>
          The pay period tells Luna when your income arrives so she can schedule confirmations and keep your timing
          accurate; the budget period (shown elsewhere) remains the primary reporting window.
          </span>
        </div>
      </div>

      <div className="main">
        {step === 2 && (
          <div className="step active">
            <div className="story-bubble">
              <div className="story-text">
                {welcomeName ? (
                  <>
                  <span>{welcomeName}</span>, let's get a clear picture of your money.
                  </>
                ) : (
                  "Let's get a clear picture of your money."
                )}
                <br />
                Choose a category to add income or expenses.
              </div>
            </div>
            <div className="bubble-grid">
              <div className="icon-bubble" onClick={openSalaryModal}>
                <div>💼</div>
                <div className="icon-bubble-label">Salary</div>
                
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Other Income", "Other Income", "income")}>
                <div>➕</div>
                <div className="icon-bubble-label">Other Inc.</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Housing", "Housing", "expense")}>
                <div>🏠</div>
                <div className="icon-bubble-label">Housing</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Car Payment", "Car Payment", "expense")}>
                <div>🚙</div>
                <div className="icon-bubble-label">Car Pay</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Fuel", "Fuel", "expense")}>
                <div>⛽</div>
                <div className="icon-bubble-label">Fuel</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Car Insurance", "Car Insurance", "expense")}>
                <div>🛡️</div>
                <div className="icon-bubble-label">Car Ins.</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Health Insurance", "Health Insurance", "expense")}>
                <div>🏥</div>
                <div className="icon-bubble-label">Health Ins.</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Food", "Food", "expense")}>
                <div>🍔</div>
                <div className="icon-bubble-label">Food</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Electricity", "Electricity", "expense")}>
                <div>💡</div>
                <div className="icon-bubble-label">Electric</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("WiFi", "WiFi", "expense")}>
                <div>🌐</div>
                <div className="icon-bubble-label">WiFi</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Water", "Water", "expense")}>
                <div>🚰</div>
                <div className="icon-bubble-label">Water</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Phone Bill", "Phone Bill", "expense")}>
                <div>☎️</div>
                <div className="icon-bubble-label">Phone Bill</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Other Utility", "Other Utility", "expense")}>
                <div>🧰</div>
                <div className="icon-bubble-label">Other Util.</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Fun", "Fun", "expense")}>
                <div>🎮</div>
                <div className="icon-bubble-label">Fun</div>
              </div>
              <div className="icon-bubble" onClick={() => openItemModal("expense", "Custom", "Name this item")}>
                <div>➕</div>
                <div className="icon-bubble-label">Custom</div>
              </div>
</div>

            <div className="list-card">
              <h3>Your Income</h3>
              <div id="incomeList">{renderList(profile.incomes, true)}</div>
            </div>
            <div className="list-card">
              <h3>Your Monthly Expenses</h3>
              <div id="expenseList">{renderList(profile.expenses, false)}</div>
            </div>

            <button className="primary-btn" onClick={goToStep3}>
              See My Summary
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="step active">
            <div className="story-bubble">
              <div className="story-text">
                {welcomeName ? (
                  <>
                    Here's what we learned about your finances,{" "}
                    <span className="story-name-highlight">{welcomeName}</span>.
                  </>
                ) : (
                  "Here's what we learned about your finances."
                )}
              </div>
            </div>
            <div className="summary-box">
              <h3>Monthly Snapshot</h3>
              <div>
                <strong>Total Income:</strong> {formatCurrency(totalIncome)}
              </div>
              <div>
                <strong>Total Expenses:</strong> {formatCurrency(totalExpenses)}
              </div>
              <div>
                <strong>Leftover:</strong> {formatCurrency(leftover)}
              </div>
              <div>
                <strong>Pay period:</strong> {getFrequencyLabel(payPeriod)}
              </div>
            </div>
              <div className="bank-link-section">
                <div className="bank-link-title">
                  Want your real world activity to auto-update Luna?
                </div>
                <PlaidStart onLinked={handleBankLinked} onSkip={handleBankSkip} />
                {bankLinked && (
                <div className="bank-linked-note">
                  Imported {bankTransactions.length} placeholder entries so you can feel the
                  sync.
                </div>
                )}
                {bankSkipped && (
                  <div className="bank-linked-note bank-skipped-note">
                    Manual tracking keeps working. You can link a bank later from Settings.
                  </div>
                )}
              </div>
              <div className="consent-panel">
                <div className={`age-field ${ageRequirementMet ? "" : "is-warning"}`}>
                  <label htmlFor="yearOfBirth">Year of birth</label>
                  <input
                    id="yearOfBirth"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    placeholder="YYYY"
                    value={yearOfBirth}
                    onChange={(e) => handleYearChange(e.target.value)}
                  />
                  <small>{ageMessage}</small>
                </div>
                <label className="consent-checkbox">
                  <input
                    type="checkbox"
                    checked={consentAcknowledged}
                    onChange={(e) => handleConsentChange(e.target.checked)}
                    disabled={!ageRequirementMet}
                  />
                  <span>
                    I consent to Luna's{" "}
                    <a href={TERMS_URL} target="_blank" rel="noreferrer">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href={PRIVACY_URL} target="_blank" rel="noreferrer">
                      Privacy Policy
                    </a>
                    , acknowledge this snapshot is gross of fees, and understand past performance does not guarantee future system stability.
                  </span>
                </label>
                <p>
                  Section 1033 rights: you can unlink any bank at any time and trigger the PURGE_EVENT to delete linked data. We keep your billing identity siloed and only ingest the data needed to model the snapshot.
                </p>
              </div>
              <button className="primary-btn purple-save-btn" onClick={finishSetup} disabled={!consentAcknowledged}>
                Save & Continue
              </button>
            </div>
        )}
      </div>
      <div className="onboarding-helper-note helper-note">
        These entries feed Luna's modeled insights. The wording throughout this setup is a system-level snapshot—not personalized financial advice. Your billing identity (email/Stripe) lives in a separate silo from your encrypted vault, linked only by the blind UUID, and you keep the key. Every export is logged so compliance-ready reports stay trustworthy.
      </div>

      {showItemModal && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setShowItemModal(false)} style={{ display: "flex" }}>
      <div className="modal-content">
        <div className="modal-title">Add {modalLabel}</div>
        <input
          id="modalNameInput"
          type="text"
          placeholder={modalPlaceholder}
          value={modalName}
          onChange={(e) => setModalName(e.target.value)}
        />
            <input
              id="modalAmountInput"
              type="text"
              inputMode="decimal"
              placeholder={`Amount (${getFrequencyLabel(modalFrequency)})`}
              value={formatNumberInput(modalAmount)}
              onChange={handleAmountChange}
            />
            <div className="inline-group">
              <label htmlFor="modalFrequencySelect">Frequency</label>
              <select
                id="modalFrequencySelect"
                value={modalFrequency}
                onChange={(e) => setModalFrequency(e.target.value)}
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
        <button className="primary-btn purple-save-btn" onClick={saveItemFromModal}>
          Save
        </button>
      </div>
        </div>
      )}

      {showAmountModal && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setShowAmountModal(false)} style={{ display: "flex" }}>
          <div className="modal-content">
            <div className="modal-title">Add {amountNameLabel || amountCategory}</div>
            {amountCategory === "Salary" && (
              <div className="modal-note">Use after-tax income only.</div>
            )}
            {amountCategory === "Housing" && (
              <div className="modal-checkboxes">
                <label className="modal-check">
                  <input
                    type="checkbox"
                    checked={housingType === "Renting"}
                    onChange={() =>
                      setHousingType((prev) => (prev === "Renting" ? "" : "Renting"))
                    }
                  />
                  Renting
                </label>
                <label className="modal-check">
                  <input
                    type="checkbox"
                    checked={housingType === "Mortgage"}
                    onChange={() =>
                      setHousingType((prev) => (prev === "Mortgage" ? "" : "Mortgage"))
                    }
                  />
                  Mortgage
                </label>
              </div>
            )}
            <input
              id="amountOnlyInput"
              type="text"
              inputMode="decimal"
              placeholder={amountCategory === "Salary" ? `Salary (${getFrequencyLabel(modalFrequency)})` : `Amount (${getFrequencyLabel(modalFrequency)})`}
              value={formatNumberInput(modalAmount)}
              onChange={handleAmountChange}
            />
        <div className="inline-group">
          <label htmlFor="amountFrequencySelect">Frequency</label>
          <select
            id="amountFrequencySelect"
            value={modalFrequency}
            onChange={(e) => setModalFrequency(e.target.value)}
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
            <button className="primary-btn purple-save-btn" onClick={saveAmountOnlyItem}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;




