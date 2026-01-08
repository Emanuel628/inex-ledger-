export const LUNA_MESSAGES = {
  RECONCILED: "One step closer to the truth. Transaction verified! ✨",
  SYNC_COMPLETE: "Vault updated. Your data is encrypted and safe in the brain. 🛡️",
  SCORE_UP: (pillar) => `Nice work! Your ${pillar} pillar just gained some ground. 🚀`,
  VAULT_LOCKED: "Security handshake complete. You're in total control. 🔐",
  DATA_PURGED: "Luna has forgotten everything. You're starting with a clean slate. ⚛️",
};

export const createSuccessTriggers = (showToast) => ({
  reconciled: () => showToast?.(LUNA_MESSAGES.RECONCILED),
  syncComplete: () => showToast?.(LUNA_MESSAGES.SYNC_COMPLETE),
  scoreUp: (pillar = "Liquidity") => showToast?.(LUNA_MESSAGES.SCORE_UP(pillar)),
  vaultLocked: () => showToast?.(LUNA_MESSAGES.VAULT_LOCKED),
  dataPurged: () => showToast?.(LUNA_MESSAGES.DATA_PURGED),
});
