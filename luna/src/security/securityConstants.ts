export const VAULT_STORAGE_VERSION = 1;
export const VAULT_IDLE_LOCK_MINUTES = 10;
export const VAULT_AUTO_LOCK_CHECK_MS = 5000;
export const VAULT_SENTINEL_AAD = "vault:sentinel";
export const VAULT_ROOT_AAD = "vault:root";
export const VAULT_KDF_ARGON2 = "argon2id";
export const VAULT_KDF_PBKDF2 = "pbkdf2";
export const VAULT_SALT_RANDOM_BYTES = 16;

export const VAULT_KEYS = [
  "moneyProfile",
  "liveBudgetTransactions",
  "financialHealthScore",
  "debtCashForm",
  "payPeriodPlans",
  "payPeriodLatestPlanId",
];

export const LEGACY_VAULT_PREFIXES = [
  "periodHistory_",
  "periodHistoryIndex_",
  "monthlyHistory_",
  "monthlyHistoryIndex_",
];

export const VAULT_MANAGED_KEYS = new Set(VAULT_KEYS);

export const getVaultBlobKey = (userId) => `luna_${userId}_vault_blob_v${VAULT_STORAGE_VERSION}`;
export const getVaultSentinelKey = (userId) => `luna_${userId}_vault_sentinel`;
export const getVaultEncryptedFlagKey = (userId) => `luna_${userId}_vault_encrypted`;
export const getVaultMigrationCompleteFlagKey = (userId) =>
  `luna_${userId}_vault_migration_complete`;
