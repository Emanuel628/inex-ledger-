import React from "react";
import "./AuditToast.css";

const AuditToast = ({ message }) => {
  if (!message) return null;
  return (
    <div className="audit-toast">
      <span>{message}</span>
    </div>
  );
};

export default AuditToast;
