import { storageManager, shouldUseVault } from "../utils/storageManager";
import {
  LEGACY_VAULT_PREFIXES,
  getVaultEncryptedFlagKey,
  getVaultMigrationCompleteFlagKey,
} from "../security/securityConstants";

const NOTE_VAULT_PREFIX = "luna";
const CURRENT_USER_KEY = "luna_currentUser";
const NON_NAMESPACED_KEYS = new Set([CURRENT_USER_KEY]);

const getCurrentUserId = () => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage.getItem(CURRENT_USER_KEY);
};

const buildNamespacedKey = (key, userId = getCurrentUserId()) => {
  if (!userId) return key;
  return `${NOTE_VAULT_PREFIX}_${userId}_${key}`;
};

const stripNamespace = (key) => {
  const match = /^luna_[^_]+_(.+)$/.exec(String(key));
  return match ? match[1] : key;
};

const LEGACY_KEYS = new Set(["moneyProfile", "liveBudgetTransactions"]);
const matchesLegacyPrefix = (key) =>
  LEGACY_VAULT_PREFIXES.some((prefix) => key.startsWith(prefix) || key.startsWith(buildNamespacedKey(prefix)));

const isLegacyVaultKey = (key) => {
  const plain = stripNamespace(key);
  return LEGACY_KEYS.has(plain) || matchesLegacyPrefix(key);
};

const isVaultFullyActive = () => {
  if (typeof window === "undefined" || !window.localStorage) return false;
  const userId = getCurrentUserId();
  if (!userId) return false;
  try {
    const encrypted = localStorage.getItem(getVaultEncryptedFlagKey(userId)) === "1";
    const migrationComplete =
      localStorage.getItem(getVaultMigrationCompleteFlagKey(userId)) === "1";
    return encrypted && migrationComplete;
  } catch {
    return false;
  }
};

const guardLegacyAccess = (key) => {
  if (!isVaultFullyActive() || !isLegacyVaultKey(key)) return true;
  const message = `Legacy vault key access blocked: ${key}`;
  if (process.env.NODE_ENV !== "production") {
    console.error("Blocked legacy vault access:", key);
    throw new Error(message);
  }
  console.warn(message);
  return false;
};

const getStorageKey = (key) => {
  if (NON_NAMESPACED_KEYS.has(key)) return key;
  return buildNamespacedKey(key);
};

export const storageFacade = {
  get(key, fallback = null) {
    if (typeof window === "undefined") return fallback;
    const normalizedKey = getStorageKey(key);
    if (shouldUseVault(key)) {
      return storageManager.get(normalizedKey);
    }
    if (!guardLegacyAccess(normalizedKey)) return null;
    const raw = localStorage.getItem(normalizedKey);
    if (raw !== null) return raw;
    return localStorage.getItem(key) ?? fallback;
  },
  set(key, value) {
    if (typeof window === "undefined") return;
    const normalizedKey = getStorageKey(key);
    if (shouldUseVault(key)) {
      storageManager.set(normalizedKey, value);
      return;
    }
    if (!guardLegacyAccess(normalizedKey)) return;
    localStorage.setItem(normalizedKey, value);
    if (normalizedKey !== key) {
      localStorage.removeItem(key);
    }
  },
  remove(key) {
    if (typeof window === "undefined") return;
    const normalizedKey = getStorageKey(key);
    if (shouldUseVault(key)) {
      storageManager.remove(normalizedKey);
      return;
    }
    if (!guardLegacyAccess(normalizedKey)) return;
    localStorage.removeItem(normalizedKey);
    localStorage.removeItem(key);
  },
  clearVaultOnly() {
    if (typeof window === "undefined") return;
    const userId = getCurrentUserId();
    if (!userId) return;
    const encryptedFlag = localStorage.getItem(getVaultEncryptedFlagKey(userId)) === "1";
    if (!encryptedFlag) {
      console.warn("Vault not marked encrypted; skipping clearVaultOnly");
      return;
    }
    const legacyPlaintextKeys = ["moneyProfile", "liveBudgetTransactions"];
    legacyPlaintextKeys.forEach((key) => {
      localStorage.removeItem(buildNamespacedKey(key, userId));
      localStorage.removeItem(key);
    });
    for (const storageKey of Object.keys(localStorage)) {
      if (matchesLegacyPrefix(storageKey)) {
        localStorage.removeItem(storageKey);
      }
    }
  },
};
