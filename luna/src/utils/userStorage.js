const CURRENT_USER_KEY = "luna_currentUser";
const KEY_PREFIX = "luna";
const CURRENT_USER_EVENT = "luna-current-user-changed";
const ONBOARDING_STATUS_EVENT = "luna-onboarding-status-changed";

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const deriveUserId = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return `user-${Date.now()}`;
  return `user-${hashString(normalized)}`;
};

const dispatchUserChange = (userId) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CURRENT_USER_EVENT, { detail: { userId } }));
};

const dispatchOnboardingStatus = (userId, completed) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_STATUS_EVENT, {
      detail: { userId, completed: Boolean(completed) },
    })
  );
};

const getCurrentUserId = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_USER_KEY);
};

const setCurrentUserId = (userId) => {
  if (typeof window === "undefined" || !userId) return;
  localStorage.setItem(CURRENT_USER_KEY, userId);
  dispatchUserChange(userId);
};

const buildKey = (key, userId = getCurrentUserId()) => {
  if (!userId) return key;
  return `${KEY_PREFIX}_${userId}_${key}`;
};

const namespacedItem = (key) => {
  const namespaced = buildKey(key);
  return namespaced || key;
};

const readNamespacedItem = (key, fallback = null) => {
  if (typeof window === "undefined") return fallback;
  const ns = namespacedItem(key);
  const stored = localStorage.getItem(ns);
  if (stored !== null) {
    return stored;
  }
  return localStorage.getItem(key) ?? fallback;
};

const writeNamespacedItem = (key, value) => {
  if (typeof window === "undefined") return;
  const ns = namespacedItem(key);
  localStorage.setItem(ns, value);
  if (ns !== key) {
    localStorage.removeItem(key);
  }
};

const removeNamespacedItem = (key) => {
  if (typeof window === "undefined") return;
  const ns = namespacedItem(key);
  localStorage.removeItem(ns);
  localStorage.removeItem(key);
};

const markOnboardingComplete = (userId = getCurrentUserId()) => {
  if (!userId) return;
  writeNamespacedItem("onboardingCompleted", "true");
  dispatchOnboardingStatus(userId, true);
};

const hasCompletedOnboarding = (userId = getCurrentUserId()) => {
  if (!userId) return false;
  return readNamespacedItem("onboardingCompleted") === "true";
};

const clearOnboardingFlag = (userId = getCurrentUserId()) => {
  if (!userId) return;
  removeNamespacedItem("onboardingCompleted");
  dispatchOnboardingStatus(userId, false);
};

export {
  CURRENT_USER_KEY,
  CURRENT_USER_EVENT,
  ONBOARDING_STATUS_EVENT,
  deriveUserId,
  getCurrentUserId,
  setCurrentUserId,
  buildKey,
  readNamespacedItem,
  writeNamespacedItem,
  removeNamespacedItem,
  markOnboardingComplete,
  hasCompletedOnboarding,
  clearOnboardingFlag,
};
