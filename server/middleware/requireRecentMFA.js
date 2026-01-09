import { MFA_RECENT_WINDOW_MINUTES } from "../config/securityConstants.js";
import { logSecurityEvent } from "../services/securityLogger.js";

export const requireRecentMFA = ({ windowMinutes = MFA_RECENT_WINDOW_MINUTES } = {}) => {
  return (req, res, next) => {
    const user = req.user;
    const route = req.originalUrl || req.url;
    if (!user) {
      logSecurityEvent("SENSITIVE_ACTION_DENIED", null, route);
      return res.status(401).json({
        code: "NOT_AUTHENTICATED",
        message: "Authentication required.",
      });
    }
    if (!user.mfaEnabled) {
      logSecurityEvent("MFA_REQUIRED_TRIGGERED", user.id, route);
      logSecurityEvent("SENSITIVE_ACTION_DENIED", user.id, route);
      return res.status(403).json({
        code: "MFA_NOT_ENABLED",
        message: "Enable MFA to perform this action.",
      });
    }
    const verifiedAt = user.mfa_verified_at ? new Date(user.mfa_verified_at) : null;
    if (!verifiedAt || Date.now() - verifiedAt.getTime() > windowMinutes * 60 * 1000) {
      logSecurityEvent("MFA_REQUIRED_TRIGGERED", user.id, route);
      logSecurityEvent("SENSITIVE_ACTION_DENIED", user.id, route);
      return res.status(401).json({
        code: "MFA_REQUIRED",
        message: "Recent MFA required.",
      });
    }
    logSecurityEvent("SENSITIVE_ACTION_ALLOWED", user.id, route);
    return next();
  };
};
