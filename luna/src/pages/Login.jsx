import React, { useEffect, useRef, useState } from "react";
import "./Login.css";
import { deriveUserId, setCurrentUserId, buildKey } from "../utils/userStorage";

const STORAGE_KEY = "lunaCreateAccount";
const IDENTITY_KEY = "userIdentity";
const STAY_LOGGED_IN_KEY = "lunaStayLoggedIn";
const LOGIN_STATUS_KEY = "lunaLoggedIn";
const ACCOUNTS_INDEX_KEY = "lunaAccounts";
const EMAIL_LIST_KEY = "lunaAccountEmails";

const isStrongPassword = (value) => {
  if (!value) return false;
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return value.length >= 8 && hasNumber && hasSymbol;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const Login = ({ onNavigate = () => {} }) => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotForm, setForgotForm] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [forgotStatus, setForgotStatus] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const readAccountsIndex = () => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(ACCOUNTS_INDEX_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  const writeAccountEntry = (email, record) => {
    if (typeof window === "undefined" || !email) return;
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    try {
      const existing = readAccountsIndex();
      const next = { ...existing, [normalized]: { ...(existing[normalized] || {}), ...record } };
      localStorage.setItem(ACCOUNTS_INDEX_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const findAccountRecord = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const index = readAccountsIndex();
    if (index[normalized]) {
      return index[normalized];
    }
    try {
      const storedEmails = localStorage.getItem(EMAIL_LIST_KEY);
      const emailList = storedEmails ? JSON.parse(storedEmails) : [];
      const match = (emailList || []).find((entry) => normalizeEmail(entry) === normalized);
      if (match) {
        const userId = deriveUserId(match);
        const credentialKey = buildKey(STORAGE_KEY, userId);
        const stored =
          localStorage.getItem(credentialKey) ?? localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { ...(JSON.parse(stored) ?? {}), userId };
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const clearValidity = () => {
    if (emailRef.current) emailRef.current.setCustomValidity("");
    if (passwordRef.current) passwordRef.current.setCustomValidity("");
  };

  const showFieldValidity = (field, message) => {
    if (!field) return;
    field.setCustomValidity(message);
    field.reportValidity();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    clearValidity();
    if (!form.email && !form.password) {
      showFieldValidity(emailRef.current, "Enter your email.");
      showFieldValidity(passwordRef.current, "Enter your password.");
      return;
    }
    if (!form.email) {
      showFieldValidity(emailRef.current, "Enter your email.");
      return;
    }
    if (!form.password) {
      showFieldValidity(passwordRef.current, "Enter your password.");
      return;
    }
    try {
      const normalizedEmail = normalizeEmail(form.email);
      const accountRecord = findAccountRecord(normalizedEmail);
      if (!accountRecord) {
        showFieldValidity(emailRef.current, "No account data found. Create an account first.");
        return;
      }
      const userId = accountRecord.userId || deriveUserId(normalizedEmail);
      if (normalizeEmail(accountRecord.email) !== normalizedEmail) {
        showFieldValidity(emailRef.current, "Email does not match.");
        return;
      }
      if (accountRecord.password !== form.password) {
        showFieldValidity(passwordRef.current, "Password does not match.");
        return;
      }
      const storedIdentity =
        localStorage.getItem(buildKey(IDENTITY_KEY, userId)) ??
        localStorage.getItem(IDENTITY_KEY);
      const parsedIdentity = storedIdentity ? JSON.parse(storedIdentity) : {};
      const identified = { ...parsedIdentity, userId };
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(identified));
      localStorage.setItem(buildKey(IDENTITY_KEY, userId), JSON.stringify(identified));
      setCurrentUserId(userId);
      if (stayLoggedIn) {
        localStorage.setItem(STAY_LOGGED_IN_KEY, "true");
        localStorage.setItem(LOGIN_STATUS_KEY, "true");
        sessionStorage.removeItem(LOGIN_STATUS_KEY);
      } else {
        localStorage.removeItem(STAY_LOGGED_IN_KEY);
        localStorage.removeItem(LOGIN_STATUS_KEY);
        sessionStorage.setItem(LOGIN_STATUS_KEY, "true");
      }
      window.dispatchEvent(new Event("auth-updated"));
      onNavigate("dashboard");
    } catch (error) {
      showFieldValidity(emailRef.current, "Unable to read saved account. Please refresh.");
    }
  };

  const handleResetLocal = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      /* ignore */
    }
    window.dispatchEvent(new Event("auth-updated"));
    window.dispatchEvent(new Event("profile-updated"));
    window.dispatchEvent(new Event("identity-updated"));
    onNavigate("dashboard");
  };

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    clearValidity();
    setStatus("");
  };

  const handleForgotChange = (field) => (event) => {
    setForgotForm((prev) => ({ ...prev, [field]: event.target.value }));
    setForgotStatus("");
  };

  const handleForgotSubmit = (event) => {
    event.preventDefault();
    setForgotStatus("");
    if (!forgotForm.email || !forgotForm.newPassword || !forgotForm.confirmPassword) {
      setForgotStatus("Enter your email and new password.");
      return;
    }
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      setForgotStatus("Passwords do not match.");
      return;
    }
    if (!isStrongPassword(forgotForm.newPassword)) {
      setForgotStatus("Password must be at least 8 characters and include a number and a symbol.");
      return;
    }
    try {
      const normalizedEmail = normalizeEmail(forgotForm.email);
      const accountRecord = findAccountRecord(normalizedEmail);
      if (!accountRecord) {
        setForgotStatus("Account not found on this device.");
        return;
      }
      const userId = accountRecord.userId || deriveUserId(normalizedEmail);
      if (normalizeEmail(accountRecord.email) !== normalizedEmail) {
        setForgotStatus("Email does not match the saved account.");
        return;
      }
      const nextAccount = {
        ...accountRecord,
        password: forgotForm.newPassword,
        updatedAt: new Date().toISOString(),
      };
      const storedIdentity =
        localStorage.getItem(buildKey(IDENTITY_KEY, userId)) ??
        localStorage.getItem(IDENTITY_KEY);
      const parsedIdentity = storedIdentity ? JSON.parse(storedIdentity) : {};
      const nextIdentity = { ...parsedIdentity, password: forgotForm.newPassword };
      const credentialKey = buildKey(STORAGE_KEY, userId);
      localStorage.setItem(credentialKey, JSON.stringify(nextAccount));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAccount));
      localStorage.setItem(buildKey(IDENTITY_KEY, userId), JSON.stringify(nextIdentity));
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(nextIdentity));
      writeAccountEntry(forgotForm.email, {
        ...nextAccount,
        identity: nextIdentity,
      });
      window.dispatchEvent(new Event("identity-updated"));
      setShowForgot(false);
      setForgotForm({ email: "", newPassword: "", confirmPassword: "" });
      setStatus("Password updated. Please log in.");
    } catch (error) {
      setForgotStatus("Unable to update password right now. Please try again.");
    }
  };

  useEffect(() => {
    try {
      const stay = localStorage.getItem(STAY_LOGGED_IN_KEY) === "true";
      const loggedIn =
        localStorage.getItem(LOGIN_STATUS_KEY) === "true" ||
        sessionStorage.getItem(LOGIN_STATUS_KEY) === "true";
      setStayLoggedIn(stay);
      if (stay && loggedIn) {
        onNavigate("dashboard");
      }
    } catch (e) {
      /* ignore */
    }
  }, [onNavigate]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("modal-open", showForgot);
    return () => document.body.classList.remove("modal-open");
  }, [showForgot]);

  return (
    <div className="login-page">
      <header className="login-header">
        <div className="header-text">
          <p className="header-eyebrow">Welcome back</p>
          <h1>Let’s get you signed in.</h1>
          <p>Log in to continue your plan.</p>
        </div>
      </header>

      <main className="login-main">
        <form className="login-form" onSubmit={handleSubmit}>
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
                placeholder="Password"
                onChange={handleChange("password")}
                autoComplete="current-password"
                ref={passwordRef}
                required
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

          <label className="login-remember">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(event) => setStayLoggedIn(event.target.checked)}
            />
            <span>Stay logged in</span>
            <small>Stay signed in only on private devices.</small>
          </label>

          <button className="primary-btn purple-save-btn" type="submit">
            Log in
          </button>
          <div className="login-link-group">
            <button type="button" className="link-btn" onClick={() => setShowForgot(true)}>
              Forgot password?
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => onNavigate("create-account")}
            >
              Create account
            </button>
          </div>
          {status && <div className="form-status">{status}</div>}
        </form>
      </main>

      {showForgot && (
        <div className="login-modal-backdrop" role="dialog" aria-modal="true">
          <div className="login-modal">
            <div className="login-modal-header">
              <div>
                <h2>Reset password</h2>
              <p>Confirm the email associated with the account so we can update the password.</p>
              </div>
              <button type="button" className="login-modal-close" onClick={() => setShowForgot(false)}>
                Close
              </button>
            </div>

            <form className="login-modal-form" onSubmit={handleForgotSubmit}>
              <div className="login-modal-body">
                <label>
                  Email
                  <input
                    type="email"
                    value={forgotForm.email}
                    placeholder="you@example.com"
                    onChange={handleForgotChange("email")}
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  New password
                  <div className="password-field">
                    <input
                      type={showForgotPassword ? "text" : "password"}
                      value={forgotForm.newPassword}
                      placeholder="Create a secure password"
                      onChange={handleForgotChange("newPassword")}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowForgotPassword((prev) => !prev)}
                      aria-label={showForgotPassword ? "Hide password" : "Show password"}
                    >
                      {showForgotPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <label>
                  Confirm password
                  <div className="password-field">
                    <input
                      type={showForgotConfirm ? "text" : "password"}
                      value={forgotForm.confirmPassword}
                      placeholder="Re-enter password"
                      onChange={handleForgotChange("confirmPassword")}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowForgotConfirm((prev) => !prev)}
                      aria-label={showForgotConfirm ? "Hide password" : "Show password"}
                    >
                      {showForgotConfirm ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                {forgotStatus && <div className="form-status is-error">{forgotStatus}</div>}
              </div>
              <div className="login-modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowForgot(false)}>
                  Cancel
                </button>
                <button className="primary-btn purple-save-btn" type="submit">
                  Update password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
