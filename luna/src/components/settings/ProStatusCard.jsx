import React from "react";

export const ProStatusCard = ({ status = "FREE", onUpgrade }) => {
  const isPro = status?.toLowerCase() === "pro";

  return (
    <div className={`pro-status-card ${isPro ? "pro-status-card--active" : ""}`}>
      <div className="pro-status-card__body">
        <div>
          <h3 className="pro-status-card__title">
            Status: {isPro ? "Luna Pro" : "Luna Free"}
            {isPro && <span className="pro-status-card__badge">Verified</span>}
          </h3>
          <p className="pro-status-card__copy">
            {isPro
              ? "All Fortress-grade protections are unlocked and your Dual-Silo isolation stays live."
              : "Upgrade to unlock Hardware Keys, higher-tier reporting, and full dual-silo privacy."}
          </p>
        </div>
        {!isPro && (
          <button type="button" className="primary-btn pro-status-card__button" onClick={onUpgrade}>
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
};
