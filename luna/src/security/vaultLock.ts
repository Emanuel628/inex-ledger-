import { buildKey } from "../utils/userStorage";
import { deriveVMK, base64ToBytes } from "./kdf";
import { encryptJson, decryptJson } from "./cryptoVault";
import { vaultMemory } from "./vaultMemory";
import { VaultError, VaultErrorCode } from "./vaultErrors";
import {
  VAULT_AUTO_LOCK_CHECK_MS,
  VAULT_IDLE_LOCK_MINUTES,
  VAULT_KEYS,
  LEGACY_VAULT_PREFIXES,
  VAULT_ROOT_AAD,
  VAULT_SENTINEL_AAD,
  getVaultBlobKey,
  getVaultEncryptedFlagKey,
  getVaultSentinelKey,
  VAULT_KDF_ARGON2,
} from "./securityConstants";

let persistenceChain = Promise.resolve();
let autoLockTimer = null;
let activityHandlers = [];

const parseJSON = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const matchesLegacyPrefix = (key, userId) =>
  LEGACY_VAULT_PREFIXES.some(
    (prefix) => key.startsWith(prefix) || key.startsWith(buildKey(prefix, userId))
  );

const ensureSentinel = async (vmk, userId, kdf, saltBytes) => {
  const sentinelKey = getVaultSentinelKey(userId);
  if (localStorage.getItem(sentinelKey)) return;
  const envelope = await encryptJson(vmk, { ok: true, createdAt: new Date().toISOString() }, {
    aad: VAULT_SENTINEL_AAD,
    kdf,
    salt: saltBytes,
  });
  localStorage.setItem(sentinelKey, JSON.stringify(envelope));
};

const persistVaultData = async (force = false) => {
  if (!vaultMemory.isUnlocked()) return;
  if (!force && !vaultMemory.isDirty()) return;
  const userId = vaultMemory.getUserId();
  if (!userId) return;
  const salt = base64ToBytes(vaultMemory.getVaultSalt());
  const envelope = await encryptJson(vaultMemory.getVmk(), vaultMemory.getVaultData(), {
    aad: VAULT_ROOT_AAD,
    kdf: vaultMemory.getVaultKdf() || VAULT_KDF_ARGON2,
    salt,
  });
  localStorage.setItem(getVaultBlobKey(userId), JSON.stringify(envelope));
  vaultMemory.markClean();
};

export const scheduleVaultPersistence = () => {
  persistenceChain = persistenceChain
    .then(() => persistVaultData())
    .catch((error) => {
      console.error("Vault persistence failed", error);
    });
};

const readLegacyItem = (key, userId) => {
  if (typeof localStorage === "undefined") return null;
  const namespaced = buildKey(key, userId);
  const raw = localStorage.getItem(namespaced) ?? localStorage.getItem(key);
  if (!raw) return null;
  return parseJSON(raw);
};

const readLegacyPrefixes = (userId) => {
  const result = {};
  if (typeof localStorage === "undefined") return result;
  for (const storageKey of Object.keys(localStorage)) {
    if (matchesLegacyPrefix(storageKey, userId)) {
      result[storageKey] = parseJSON(localStorage.getItem(storageKey));
    }
  }
  return result;
};

const clearLegacyKeys = (userId) => {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    VAULT_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      localStorage.removeItem(buildKey(key, userId));
    });
    for (const storageKey of Object.keys(localStorage)) {
      if (matchesLegacyPrefix(storageKey, userId)) {
        localStorage.removeItem(storageKey);
      }
    }
    localStorage.setItem(getVaultEncryptedFlagKey(userId), "1");
  } catch (error) {
    console.warn("Unable to clear legacy vault keys", error);
  }
};

const migrateLegacyData = (userId) => {
  if (!userId || typeof localStorage === "undefined") return {};
  const alreadyEncrypted = localStorage.getItem(getVaultEncryptedFlagKey(userId)) === "1";
  if (alreadyEncrypted) return {};
  const payload = {};
  let found = false;
  for (const key of VAULT_KEYS) {
    const entry = readLegacyItem(key, userId);
    if (entry !== null) {
      payload[key] = entry;
      found = true;
    }
  }
  const prefixed = readLegacyPrefixes(userId);
  if (Object.keys(prefixed).length) {
    payload.legacyPrefixes = prefixed;
    found = true;
  }
  return found ? payload : {};
};

export const lockVault = (reason = "manual") => {
  if (!vaultMemory.isUnlocked()) return;
  vaultMemory.clearUnlocked();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vault-locked", { detail: { reason } }));
  }
};

export const unlockVaultWithPassword = async ({
  password,
  userId,
  vaultSalt,
  vaultKdf = VAULT_KDF_ARGON2,
}) => {
  if (!password || !userId || !vaultSalt) {
    throw new VaultError(VaultErrorCode.INVALID_PASSWORD, "Missing vault unlocking parameters.");
  }
  const saltBytes = base64ToBytes(vaultSalt);
  const vmk = await deriveVMK(password, saltBytes, vaultKdf);
  await ensureSentinel(vmk, userId, vaultKdf, saltBytes);
  const blob = parseJSON(localStorage.getItem(getVaultBlobKey(userId)));
  let vaultData = {};
  if (blob) {
    vaultData = await decryptJson(vmk, blob, { aad: VAULT_ROOT_AAD });
  } else {
    vaultData = migrateLegacyData(userId);
    if (Object.keys(vaultData).length) {
      vaultMemory.setUnlocked({ vmk, userId, vaultSalt, vaultKdf, data: vaultData });
      await persistVaultData(true);
      clearLegacyKeys(userId);
    }
  }
  vaultMemory.setUnlocked({ vmk, userId, vaultSalt, vaultKdf, data: vaultData });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vault-unlocked", { detail: { userId } }));
  }
  return vaultData;
};

const onActivity = () => {
  vaultMemory.touchActivity();
};

export const initializeVaultAutoLock = () => {
  if (typeof window === "undefined") return () => {};
  const events = ["mousemove", "keydown", "mousedown", "touchstart", "visibilitychange"];
  events.forEach((event) => {
    window.addEventListener(event, onActivity);
    activityHandlers.push(event);
  });
  if (autoLockTimer) {
    clearInterval(autoLockTimer);
  }
  autoLockTimer = setInterval(() => {
    if (!vaultMemory.isUnlocked()) return;
    const lastActive = vaultMemory.getLastActiveAt() || 0;
    if (Date.now() - lastActive > VAULT_IDLE_LOCK_MINUTES * 60 * 1000) {
      lockVault("idle");
    }
  }, VAULT_AUTO_LOCK_CHECK_MS);
  return () => {
    activityHandlers.forEach((event) => window.removeEventListener(event, onActivity));
    activityHandlers = [];
    if (autoLockTimer) {
      clearInterval(autoLockTimer);
      autoLockTimer = null;
    }
  };
};
