import React from "react";
import "./ForgotPassword.css";

const ForgotPassword = ({ onNavigate = () => {} }) => (
  <div className="forgot-page">
    <header className="forgot-header">
      <div className="header-text">
        <h1>Forgot your password?</h1>
        <p>This app stores account details on this device only.</p>
      </div>
    </header>

    <main className="forgot-main">
      <div className="forgot-card">
        <p>
          If you no longer remember your password, create a new account on this device. If you do remember it, head
          back to login.
        </p>
        <div className="forgot-actions">
          <button type="button" className="secondary-btn" onClick={() => onNavigate("login")}>
            Back to login
          </button>
          <button type="button" className="primary-btn purple-save-btn" onClick={() => onNavigate("create-account")}>
            Create new account
          </button>
        </div>
      </div>
    </main>
  </div>
);

export default ForgotPassword;
