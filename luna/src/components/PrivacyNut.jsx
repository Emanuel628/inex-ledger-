import React, { useEffect, useState } from "react";
import "./PrivacyNut.css";

const PrivacyNut = ({ message = "Luna only sees your health score, never your credentials." }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => setOpen(false), 3500);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <div className="privacy-nut">
      <button
        type="button"
        className="privacy-nut-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Explain privacy"
      >
        🔐
      </button>
      {open && (
        <div className="privacy-nut-popover" role="status">
          {message}
        </div>
      )}
    </div>
  );
};

export default PrivacyNut;
