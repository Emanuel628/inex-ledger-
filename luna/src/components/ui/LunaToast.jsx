import React, { useEffect } from "react";
import "./LunaToast.css";

export const LunaToast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => onClose?.(), 4000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`luna-toast ${type} glassy-bg`}>
      <div className="toast-icon">{type === "success" ? "✨" : "🛡️"}</div>
      <div className="toast-content">
        <p>{message}</p>
      </div>
      <div className="toast-progress" />
    </div>
  );
};
