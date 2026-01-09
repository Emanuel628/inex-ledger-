import React, { useMemo, useRef, useState } from "react";
import "./CreateAccount.css";
import { IdentityIsolationBadge } from "../components/ui/IdentityIsolationBadge";
import { deriveUserId, setCurrentUserId, buildKey } from "../utils/userStorage";
import { generateVaultSalt } from "../security/vaultUtils";
import { VAULT_KDF_ARGON2 } from "../security/securityConstants";

const STORAGE_KEY = "lunaCreateAccount";
const IDENTITY_KEY = "userIdentity";
const PROFILE_KEY = "moneyProfile";
const LOGIN_STATUS_KEY = "lunaLoggedIn";
const EMAIL_LIST_KEY = "lunaAccountEmails";
const ACCOUNTS_INDEX_KEY = "lunaAccounts";

const STRONG_PASSWORD_MESSAGE =
  "Please choose a stronger password with at least 8 characters, a number, and a symbol.";

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
};

const resetLocalAccountData = (displayName = "", userId) => {
  try {
    const emptyProfile = { incomes: [], expenses: [], savingsBalance: "", savingsMonthly: "", name: displayName };
    const profileKey = buildKey(PROFILE_KEY, userId);
    localStorage.setItem(profileKey, JSON.stringify(emptyProfile));
    const keysToRemove = [
      "creditCards",
      "debtCashForm",
      "assetProfile",
      "liveBudgetTransactions",
      "goals",
      "savedBudgetSplit",
      "budgetMode",
      "budgetBestLeftover",
    ];
    const removeScopedKey = (keyName) => {
      localStorage.removeItem(keyName);
      if (userId) {
        localStorage.removeItem(buildKey(keyName, userId));
      }
    };
    keysToRemove.forEach(removeScopedKey);
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith("periodHistory_") ||
        key.startsWith("periodHistoryIndex_") ||
        key.startsWith("monthlyHistory_") ||
        key === "monthlyHistoryIndex"
      ) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    /* ignore */
  }
  try {
    localStorage.setItem("luna_us_consent", "false");
  } catch (e) {
    /* ignore */
  }
};

const isStrongPassword = (value) => {
  if (!value) return false;
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return value.length >= 8 && hasNumber && hasSymbol;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const readAccountsIndex = () => {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(ACCOUNTS_INDEX_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const writeAccountsIndex = (index) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCOUNTS_INDEX_KEY, JSON.stringify(index));
  } catch {
    /* ignore */
  }
};

const CreateAccount = ({ onNavigate = () => {} }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState("");
  const [emailTaken, setEmailTaken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef(null);

  const isSubmitDisabled = useMemo(
    () => !form.email || !form.password || !form.firstName || !form.lastName || emailTaken,
    [form, emailTaken]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      setStatus("Fill out all fields to continue.");
      return;
    }
    if (!isStrongPassword(form.password)) {
      setStatus(STRONG_PASSWORD_MESSAGE);
      return;
    }
    if (typeof window === "undefined") return;
    const normalizedEmail = normalizeEmail(form.email);
    const accountsIndex = readAccountsIndex();
    if (normalizedEmail && accountsIndex[normalizedEmail]) {
      setStatus("That email is already in use on this device.");
      return;
    }
    const payload = {
      ...form,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const storedEmails = localStorage.getItem(EMAIL_LIST_KEY);
    const existingList = storedEmails ? JSON.parse(storedEmails) : [];
    const emailList = Array.isArray(existingList) ? existingList : [];
    if (normalizedEmail && !emailList.some((email) => normalizeEmail(email) === normalizedEmail)) {
      localStorage.setItem(EMAIL_LIST_KEY, JSON.stringify([...emailList, normalizedEmail]));
    }
    const identityPayload = {
      firstName: form.firstName,
      middleInitial: "",
      lastName: form.lastName,
      street: "",
      city: "",
      state: "",
      zip: "",
      email: form.email,
      password: form.password,
      vaultSalt: generateVaultSalt(),
      vaultKdf: VAULT_KDF_ARGON2,
    };
    const userId = deriveUserId(identityPayload.email);
    identityPayload.userId = userId;
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identityPayload));
    localStorage.setItem(buildKey(IDENTITY_KEY, userId), JSON.stringify(identityPayload));
    localStorage.setItem(buildKey(STORAGE_KEY, userId), JSON.stringify(payload));
    const nextIndex = {
      ...accountsIndex,
      ...(normalizedEmail ? {
      [normalizedEmail]: {
        userId,
        email: form.email,
        password: form.password,
        identity: identityPayload,
        vaultSalt: identityPayload.vaultSalt,
        vaultKdf: identityPayload.vaultKdf,
        updatedAt: new Date().toISOString(),
      },
      } : {}),
    };
    writeAccountsIndex(nextIndex);
    setCurrentUserId(userId);
    sessionStorage.setItem(LOGIN_STATUS_KEY, "true");
    const displayName = form.firstName?.trim() || "";
    resetLocalAccountData(displayName, userId);
    window.dispatchEvent(new Event("identity-updated"));
    window.dispatchEvent(new Event("profile-updated"));
    window.dispatchEvent(new Event("auth-updated"));
    setStatus("Account details saved on this device.");
    onNavigate("snapshot-intro");
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    if (field === "email") {
      const normalizedEmail = normalizeEmail(value);
      const accountsIndex = readAccountsIndex();
      const isTaken = normalizedEmail && Boolean(accountsIndex[normalizedEmail]);
      setEmailTaken(isTaken);
      if (isTaken && emailRef.current) {
        emailRef.current.setCustomValidity("That email is already in use.");
      } else if (emailRef.current) {
        emailRef.current.setCustomValidity("");
      }
    }
    setStatus("");
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="create-account-page">
      <header className="create-account-header">
        <div className="header-text">
          <p className="header-eyebrow">Create account</p>
          <h1>Calmly secure your workspace.</h1>
          <p>This keeps your progress safe across devices.</p>
        </div>
      </header>

      <main className="create-account-main">
        <form className="create-account-form" onSubmit={handleSubmit}>
          <p className="form-intro">
            Dual-silo security keeps your identity and your financial vault separated on this device.
          </p>
          <IdentityIsolationBadge />

          <label>
            First name
            <input
              type="text"
              value={form.firstName}
              placeholder="First name"
              onChange={handleChange("firstName")}
              autoComplete="given-name"
            />
          </label>
          <label>
            Last name
            <input
              type="text"
              value={form.lastName}
              placeholder="Last name"
              onChange={handleChange("lastName")}
              autoComplete="family-name"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              placeholder="you@example.com"
              onChange={handleChange("email")}
              autoComplete="email"
              ref={emailRef}
              required
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                placeholder="Create a secure password"
                onChange={handleChange("password")}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div className="create-account-actions">
            <button
              className={`primary-btn purple-save-btn create-account-submit ${isSubmitDisabled ? "btn-disabled" : ""}`}
              type="submit"
              aria-disabled={isSubmitDisabled}
            >
              Create account
            </button>
          </div>
          <button
            type="button"
            className="secondary-btn create-account-cancel create-account-cancel-inline"
            onClick={() => onNavigate("login")}
          >
            Cancel
          </button>
          <p className="create-account-note">You can always update your profile later.</p>
          {status && <div className="form-status">{status}</div>}
        </form>
      </main>
    </div>
  );
};

export default CreateAccount;
