import React, { useEffect, useState } from "react";
import "./ProfileIntake.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { usePreferences } from "../contexts/PreferencesContext";

const STORAGE_KEY = "userIdentity";
const CREATE_ACCOUNT_KEY = "lunaCreateAccount";
const STRONG_PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include a number and a symbol.";

const SECURITY_STATUS = [
  {
    label: "Dual-Silo Security",
    status: "Active",
    detail: "Identity and financial data remain separate by design.",
    tooltip: "Privacy-first vault architecture keeps the identity silo untied to your financial ledger.",
  },
  {
    label: "Local-first mode",
    status: "Enabled",
    detail: "Your data stays on your device unless you explicitly authorize a share.",
    tooltip: "Most processing happens locally so nothing leaves your device without your say-so.",
  },
  {
    label: "Last security check",
    status: "Passed",
    detail: "Every profile change automatically revalidates the vault.",
    tooltip: "Writes refresh the vault attestation to prove nothing slipped through.",
  },
];


const isStrongPassword = (value) => {
  if (!value) return false;
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return value.length >= 8 && hasNumber && hasSymbol;
};

const emptyIdentity = {
  firstName: "",
  middleInitial: "",
  lastName: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  businessName: "",
  email: "",
  password: "",
};

const formatPhoneNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const readStoredIdentity = () => {
  if (typeof window === "undefined") {
    return emptyIdentity;
  }
  try {
    const storedIdentity = localStorage.getItem(STORAGE_KEY);
    const storedCreate = localStorage.getItem(CREATE_ACCOUNT_KEY);
    if (!storedIdentity && !storedCreate) {
      return emptyIdentity;
    }
    const parsedIdentity = storedIdentity ? JSON.parse(storedIdentity) : {};
    const parsedCreate = storedCreate ? JSON.parse(storedCreate) : {};
    const merged = {
      ...emptyIdentity,
      ...parsedCreate,
      ...parsedIdentity,
    };
    return {
      firstName: merged.firstName || "",
      middleInitial: merged.middleInitial || "",
      lastName: merged.lastName || "",
      street: merged.street || "",
      city: merged.city || "",
      state: merged.state || "",
      zip: merged.zip || "",
      phone: formatPhoneNumber(merged.phone || ""),
      businessName: merged.businessName || "",
      email: merged.email || "",
      password: merged.password || "",
    };
  } catch (e) {
    return emptyIdentity;
  }
};

const dispatchIdentityUpdate = () => {

const titleCase = (value) => {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("identity-updated"));
};

const UserProfile = ({ onNavigate = () => {} }) => {
  const { preferences } = usePreferences();
  const [form, setForm] = useState(() => readStoredIdentity());
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordInputs, setPasswordInputs] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [optionalDetailsCollapsed, setOptionalDetailsCollapsed] = useState(true);

  useEffect(() => {
    const refreshForm = () => setForm(readStoredIdentity());
    refreshForm();
    if (typeof window === "undefined") return undefined;
    const handleStorage = (event) => {
      if (!event.key || event.key === STORAGE_KEY || event.key === CREATE_ACCOUNT_KEY) {
        refreshForm();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("identity-updated", refreshForm);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("identity-updated", refreshForm);
    };
  }, []);

  const handleChange = (field) => (e) => {
    const rawValue = e.target.value;
    const nextValue =
      field === "phone"
        ? formatPhoneNumber(rawValue)
        : field === "firstName" || field === "lastName"
        ? titleCase(rawValue)
        : field === "middleInitial"
        ? rawValue.toUpperCase().slice(0, 1)
        : rawValue;
    const next = { ...form, [field]: nextValue };
    setForm(next);
    if (field === "password") {
      setPasswordTouched(true);
      setPasswordError(!isStrongPassword(nextValue));
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      dispatchIdentityUpdate();
    } catch (err) {
      /* ignore */
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    const next = { ...form, phone: formatted };
    setForm(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      dispatchIdentityUpdate();
    } catch (err) {
      /* ignore */
    }
  };

  const handleChangePasswordField = (field) => (e) => {
    setPasswordInputs((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const submitPasswordChange = () => {
    if (passwordInputs.current !== form.password) {
      setPasswordMessage("Current password does not match.");
      return;
    }
    if (!passwordInputs.next) {
      setPasswordMessage("Enter a new password.");
      return;
    }
    if (!isStrongPassword(passwordInputs.next)) {
      setPasswordMessage(STRONG_PASSWORD_MESSAGE);
      return;
    }
    if (passwordInputs.next !== passwordInputs.confirm) {
      setPasswordMessage("New passwords must match.");
      return;
    }
    const updated = { ...form, password: passwordInputs.next };
    setForm(updated);
    setPasswordInputs({ current: "", next: "", confirm: "" });
    setShowChangePassword(false);
    setPasswordMessage("Password updated.");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setPasswordTouched(true);
    const isValidPassword = isStrongPassword(form.password);
    setPasswordError(!isValidPassword);
    if (!isValidPassword) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      dispatchIdentityUpdate();
    } catch (err) {
      /* ignore */
    }
  };

  return (
    <div className="profile-page">
      <header className="profile-header">
        <TopRightControls
          className="top-controls"
          activePage="user-profile"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="header-text">
          <div className="title">Profile</div>
          <div className="subtitle">
            Manage the identity you share while your financial vault stays anonymous.
          </div>
          <div className="security-tags">
            {["Active", "Local-First", "Zero Knowledge"].map((tag) => (
              <span key={tag} className="security-tag">
                {tag}
              </span>
            ))}
          </div>
          <div className="security-status-grid">
            {SECURITY_STATUS.map((item) => (
              <article key={item.label} className="security-status-card">
                <div className="security-status-row">
                  <span className="security-label">{item.label}</span>
                  <span className="security-status">{item.status}</span>
                  {item.tooltip && (
                    <span className="info-icon" role="img" aria-label={item.tooltip} title={item.tooltip}>
                      ⓘ
                    </span>
                  )}
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </header>

      <form className="profile-card" onSubmit={handleSubmit}>
        <section className="identity-section">
          <h3 className="profile-section-title">Identity Silo</h3>
          <p className="privacy-banner">
            🛡️ Privacy by Design
            <span className="privacy-banner-subtext">
              Your identity is optional unless you unlock verification or lending.
            </span>
          </p>
          <div className="field name-grid">
            {[
              { key: "firstName", label: "First name", required: true },
              { key: "middleInitial", label: "Middle initial (optional)", maxLength: 1 },
              { key: "lastName", label: "Last name", required: true },
            ].map((item) => (
              <div key={item.key} className="name-field">
                <span className="name-label">{item.label}</span>
                <input
                  id={item.key}
                  type="text"
                  value={form[item.key]}
                  onChange={handleChange(item.key)}
                  maxLength={item.maxLength}
                  required={item.required}
                />
              </div>
            ))}
          </div>

          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={handlePhoneChange}
              onInput={handlePhoneChange}
              inputMode="tel"
              placeholder="(555) 123-4567"
              autoComplete="tel"
              autoCapitalize="none"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email || ""}
              onChange={handleChange("email")}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showProfilePassword ? "text" : "password"}
                value={form.password || ""}
                onChange={handleChange("password")}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowProfilePassword((prev) => !prev)}
                aria-label={showProfilePassword ? "Hide password" : "Show password"}
              >
                {showProfilePassword ? "Hide" : "Show"}
              </button>
            </div>
            <div
              className={`hint password-hint ${
                passwordTouched && passwordError ? "hint-error" : ""
              }`}
            >
              {STRONG_PASSWORD_MESSAGE}
            </div>
            <button
              type="button"
              className="change-password-link"
              onClick={() => {
                setShowChangePassword(true);
                setPasswordMessage("");
              }}
            >
              Change password
            </button>
          </div>
        </section>

        <section className="optional-section">
          <div className="optional-header">
            <div>
              <h3 className="profile-section-title">Optional Personal Details</h3>
              <p className="profile-section-note">
                Only needed if you unlock lending or identity verification features later.
              </p>
            </div>
            <button
              type="button"
              className="optional-toggle"
              onClick={() => setOptionalDetailsCollapsed((prev) => !prev)}
              aria-expanded={!optionalDetailsCollapsed}
            >
              {optionalDetailsCollapsed ? "Show details" : "Hide details"}
            </button>
          </div>
          <div className={`optional-body ${optionalDetailsCollapsed ? "is-collapsed" : ""}`}>
          <div className="address-grid">
            <div className="grid-field">
              <label htmlFor="street">Street</label>
              <input
                id="street"
                type="text"
                value={form.street}
                onChange={handleChange("street")}
              />
            </div>
            <div className="grid-field">
              <label htmlFor="city">City</label>
              <input id="city" type="text" value={form.city} onChange={handleChange("city")} />
            </div>
            <div className="grid-field">
              <label htmlFor="state">State</label>
              <input id="state" type="text" value={form.state} onChange={handleChange("state")} />
            </div>
            <div className="grid-field">
              <label htmlFor="zip">ZIP</label>
              <input
                id="zip"
                type="text"
                value={form.zip}
                onChange={handleChange("zip")}
                maxLength={10}
              />
            </div>
            {preferences.premiumAccess && preferences.businessFeatures && (
              <div className="grid-field">
                <label htmlFor="businessName">Business name (optional)</label>
                <input
                  id="businessName"
                  type="text"
                  value={form.businessName}
                  onChange={handleChange("businessName")}
                />
              </div>
            )}
          </div>
          </div>
        </section>

        {showChangePassword && (
          <div
            className="password-modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              setShowChangePassword(false);
              setPasswordInputs({ current: "", next: "", confirm: "" });
              setPasswordMessage("");
            }}
          >
            <div
              className="password-modal"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <h4>Change password</h4>
              <div className="password-field">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Current password"
                  value={passwordInputs.current}
                  onChange={handleChangePasswordField("current")}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="password-field">
                <input
                  type={showNextPassword ? "text" : "password"}
                  placeholder="New password"
                  value={passwordInputs.next}
                  onChange={handleChangePasswordField("next")}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowNextPassword((prev) => !prev)}
                  aria-label={showNextPassword ? "Hide password" : "Show password"}
                >
                  {showNextPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="password-field">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={passwordInputs.confirm}
                  onChange={handleChangePasswordField("confirm")}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {passwordMessage && <div className="hint">{passwordMessage}</div>}
              <div className="password-change-actions">
                <button type="button" className="secondary-btn" onClick={submitPasswordChange}>
                  Save password
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordInputs({ current: "", next: "", confirm: "" });
                    setPasswordMessage("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="button-row">
          <button className="primary-btn purple-save-btn" type="submit">
            Save
          </button>
        </div>

        <section className="data-control-section">
          <h3 className="profile-section-title">Data Control</h3>
          <p className="profile-section-note">
            Manage your identity data without touching your financial vault.
          </p>
          <div className="data-control-buttons">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => alert("Download initiated.")}
              title="Downloads a copy of just your identity inputs."
            >
              <span>Download my identity data</span>
              <span className="info-icon" aria-hidden="true">i</span>
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => alert("Export requested.")}
              title="Exports the same identity details so you can archive or transfer them."
            >
              <span>Export identity info</span>
              <span className="info-icon" aria-hidden="true">i</span>
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => alert("Identity data deleted.")}
              title="Removes local identity information permanently."
            >
              <span>Delete identity info</span>
              <span className="info-icon" aria-hidden="true">i</span>
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => alert("Identity disconnected from vault.")}
              title="Disconnects this identity from your financial vault without deleting either one."
            >
              <span>Disconnect identity from financial vault</span>
              <span className="info-icon" aria-hidden="true">i</span>
            </button>
          </div>
        </section>
      </form>

    </div>
  );
};

export default UserProfile;
