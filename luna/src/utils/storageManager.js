import { LATEST_VERSIONS, runMigrations } from "./storageMigrations";
import { vaultMemory } from "../security/vaultMemory";
import { scheduleVaultPersistence } from "../security/vaultLock";
import {
  VAULT_MANAGED_KEYS,
  getVaultEncryptedFlagKey,
} from "../security/securityConstants";
import { getCurrentUserId } from "./userStorage";

const META_SUFFIX = "__meta";
const STORAGE_STATE_KEY = "storageState";
const STORAGE_STATE_EVENT = "storage-state-change";
const DEFAULT_STATE = "localOnly";

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
};

const readMeta = (key) => safeParse(localStorage.getItem(`${key}${META_SUFFIX}`));

export const getStoredVersion = (key, data) => {
  if (Array.isArray(data)) {
    const meta = readMeta(key);
    return Number(meta?._version) || 1;
  }
  return Number(data?._version) || 1;
};

const writeMeta = (key, version) => {
  const payload = {
    _version: Number(version) || 1,
    _lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(`${key}${META_SUFFIX}`, JSON.stringify(payload));
};

const backupKey = (key, version) => `${key}_backup_v${version}`;

const dispatchState = (state) => {
  window.dispatchEvent(new CustomEvent(STORAGE_STATE_EVENT, { detail: { state } }));
};

const stripNamespace = (key) => {
  const match = /^luna_[^_]+_(.+)$/.exec(String(key));
  return match ? match[1] : key;
};

const isVaultKey = (key) => VAULT_MANAGED_KEYS.has(stripNamespace(key));

const isVaultEnabled = () => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
  const userId = getCurrentUserId();
  if (!userId) return false;
  return localStorage.getItem(getVaultEncryptedFlagKey(userId)) === "1";
};

const shouldUseVault = (key) => isVaultKey(key) && isVaultEnabled();

const attachMeta = (value, meta) => {
  if (!meta) return value;
  try {
    if (Array.isArray(value)) {
      Object.defineProperty(value, "_version", { value: meta._version, enumerable: false });
      Object.defineProperty(value, "_lastUpdated", { value: meta._lastUpdated, enumerable: false });
      return value;
    }
    return { ...value, _version: meta._version, _lastUpdated: meta._lastUpdated };
  } catch (error) {
    return value;
  }
};

export const storageManager = {
  get: (key) => {
    if (typeof window === "undefined") return null;
    if (shouldUseVault(key)) {
      const baseKey = stripNamespace(key);
      if (!vaultMemory.isUnlocked()) return null;
      const stored = vaultMemory.getField(baseKey);
      if (stored === null || typeof stored === "undefined") return null;
      return attachMeta(stored, vaultMemory.getMetadata(baseKey));
    }
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = safeParse(raw);
    if (Array.isArray(parsed) && parsed.length === 0) return [];
    if (parsed === null) return null;

    const currentVersion = getStoredVersion(key, parsed);
    const targetVersion = LATEST_VERSIONS[key] || currentVersion;

    if (currentVersion < targetVersion) {
      try {
        localStorage.setItem(backupKey(key, currentVersion), raw);
        if (Array.isArray(parsed)) {
          const meta = readMeta(key);
          if (meta) {
            localStorage.setItem(`${backupKey(key, currentVersion)}${META_SUFFIX}`, JSON.stringify(meta));
          }
        }
      } catch (e) {
        /* ignore */
      }
      const migrated = runMigrations(key, parsed, currentVersion);
      storageManager.set(key, migrated.data, migrated.version);
      return migrated.data;
    }

    if (Array.isArray(parsed)) {
      const meta = readMeta(key);
      if (!meta) {
        storageManager.set(key, parsed, currentVersion);
      }
    }
    return parsed;
  },
  set: (key, value, versionOverride) => {
    if (typeof window === "undefined") return false;
    const version = Number(versionOverride) || LATEST_VERSIONS[key] || 1;
    const updatedAt = new Date().toISOString();
    const targetVersion = version;

    if (shouldUseVault(key)) {
      const baseKey = stripNamespace(key);
      const meta = { _version: version, _lastUpdated: updatedAt };
      const storedValue = Array.isArray(value) ? value : { ...value };
      vaultMemory.setField(baseKey, storedValue, meta);
      scheduleVaultPersistence();
      return true;
    }

    const rawExisting = localStorage.getItem(key);
    if (rawExisting) {
      const existing = safeParse(rawExisting);
      const existingVersion = existing ? getStoredVersion(key, existing) : 1;
      if (existingVersion > targetVersion) {
        console.warn(
          `Blocked write to ${key}: storage v${existingVersion} > tab v${targetVersion}. Dispatching storage-collision.`
        );
        window.dispatchEvent(
          new CustomEvent("storage-collision", {
            detail: { key, existingVersion, targetVersion },
          })
        );
        return false;
      }
    }

    if (Array.isArray(value)) {
      localStorage.setItem(key, JSON.stringify(value));
      writeMeta(key, version);
      return true;
    }

    const payload = {
      ...value,
      _version: version,
      _lastUpdated: updatedAt,
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return true;
  },
  remove: (key) => {
    if (typeof window === "undefined") return;
    if (shouldUseVault(key)) {
      const baseKey = stripNamespace(key);
      vaultMemory.deleteField(baseKey);
      scheduleVaultPersistence();
      return;
    }
    localStorage.removeItem(key);
  },
  init: (keys = []) => {
    keys.forEach((key) => {
      try {
        storageManager.get(key);
      } catch (e) {
        /* ignore */
      }
    });
  },
  setState: (state) => {
    if (typeof window === "undefined") return;
    const next = state || DEFAULT_STATE;
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(next));
    dispatchState(next);
  },
  getState: () => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    const raw = localStorage.getItem(STORAGE_STATE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = safeParse(raw);
    return typeof parsed === "string" ? parsed : DEFAULT_STATE;
  },
  onStateChange: (listener) => {
    window.addEventListener(STORAGE_STATE_EVENT, listener);
    return () => window.removeEventListener(STORAGE_STATE_EVENT, listener);
  },
  clear: () => {
    if (typeof window === "undefined") return;
    console.warn("storageManager.clear is deprecated; use storageFacade.clearVaultOnly instead.");
  },
};

export { shouldUseVault, isVaultEnabled };
