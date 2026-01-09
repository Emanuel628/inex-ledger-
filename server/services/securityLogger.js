import crypto from "crypto";

export const anonymizeId = (value) => {
  if (!value) return "anonymous";
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
};

export const logSecurityEvent = (event, { userId, route, metadata } = {}) => {
  console.info({
    event,
    user: anonymizeId(userId),
    route,
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
  });
};
