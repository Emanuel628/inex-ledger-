export const VaultErrorCode = {
  LOCKED: "VAULT_LOCKED",
  INVALID_FORMAT: "INVALID_FORMAT",
  DECRYPT_FAILED: "DECRYPT_FAILED",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  MIGRATION_FAILED: "VAULT_MIGRATION_FAILED",
};

export class VaultError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "VaultError";
  }
}
