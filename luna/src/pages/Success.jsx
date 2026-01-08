import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

const Success = () => {
  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    let handle;
    const pollStatus = async () => {
      try {
        const response = await fetch("/api/user/subscription-status");
        if (!response.ok) {
          throw new Error("Unable to fetch subscription status.");
        }
        const data = await response.json();
        if (data.status === "PRO") {
          setStatus("verified");
          return;
        }
        handle = setTimeout(pollStatus, 2000);
      } catch (err) {
        setError(err.message);
        handle = setTimeout(pollStatus, 4000);
      }
    };

    pollStatus();
    return () => clearTimeout(handle);
  }, []);

  return (
    <div className="success-page">
      {status === "verifying" ? (
        <div className="success-spinner">
          <div className="success-spinner__icon" />
          <h1>Verifying Your Fortress...</h1>
          <p>Communicating with the Identity Silo.</p>
          {error && <p className="success-error">{error}</p>}
        </div>
      ) : (
        <div className="success-verified">
          <ShieldCheck className="success-check" />
          <h1>Fortress Verified</h1>
          <p>Your Hardware Keys and Pro insights are now unlocked.</p>
          <button className="primary-btn success-enter" onClick={() => (window.location.href = "/dashboard")}>
            Enter the Vault
          </button>
        </div>
      )}
    </div>
  );
};

export default Success;
