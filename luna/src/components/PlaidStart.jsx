import React, { useMemo, useState } from "react";
import { usePlaidMock } from "../hooks/usePlaidMock";
import PrivacyNut from "./PrivacyNut";
import "./PlaidStart.css";

const STATUS_LABELS = {
  idle: "Connect a bank",
  syncing: "Reading bank data...",
  synced: "Bank linked",
  skipped: "Manual mode",
  error: "Try again",
};

export const PlaidStart = ({ onLinked, onSkip }) => {
  const { simulateLink } = usePlaidMock();
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const openSecurityPage = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("luna-navigate", { detail: { view: "security" } }));
  };

  const handleLink = async () => {
    if (status === "syncing") return;
    setStatus("syncing");
    try {
      const payload = await simulateLink();
      setResult(payload.newTransactions);
      setStatus("synced");
      onLinked?.(payload);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  const handleSkip = () => {
    setStatus("skipped");
    onSkip?.();
  };

  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS.idle;
  const highlight = useMemo(() => {
    if (!result || !result.length) {
      return "We'll import sample activity so you can feel the flow.";
    }
    return `Imported ${result.length} entries. Your Score and Dashboard now reflect them.`;
  }, [result]);

  return (
    <div className="plaid-start-card">
      <div className="plaid-start-header">
        <h3>Secure bank sync</h3>
        <p>Credentials stay local. We encrypt everything before it touches storage.</p>
      </div>
      <div className="plaid-start-body">
        <ul>
          <li>256-bit AES in the browser, never on the server.</li>
          <li>Sync updates stay private - only you can initiate them.</li>
          <li>Skip anytime and keep manual control.</li>
        </ul>
        <button
          type="button"
          className={`plaid-link-btn ${status}`}
          onClick={handleLink}
          disabled={status === "syncing" || status === "synced"}
        >
          <span className="label">{statusLabel}</span>
        </button>
        <button type="button" className="plaid-skip-btn" onClick={handleSkip}>
          I'll do this later
        </button>
        <div className="plaid-highlight">{highlight}</div>
        <div className="plaid-privacy-row">
          <PrivacyNut message="Luna uses encrypted tokens and never sees your banking password." />
          <span>Privacy handshake: health score only.</span>
        </div>
        <button type="button" className="plaid-privacy-link" onClick={openSecurityPage}>
          Learn more about Security & Privacy
        </button>
        {status === "synced" && result && result.length > 0 && (
          <p className="plaid-success-note">
            {result.length} mocked transactions streamed into your live tracker so the ecosystem
            can react in real time.
          </p>
        )}
      </div>
    </div>
  );
};

export default PlaidStart;
