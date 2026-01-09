export const VALID_VAULT_ALG = "A256GCM";
export const VALID_VAULT_VERSION = 1;
export const VALID_VAULT_KDFS = new Set(["argon2id", "pbkdf2"]);

export const isVaultEnvelope = (envelope) => {
  if (!envelope || typeof envelope !== "object") return false;
  if (envelope.v !== VALID_VAULT_VERSION) return false;
  if (envelope.alg !== VALID_VAULT_ALG) return false;
  if (!VALID_VAULT_KDFS.has(envelope.kdf)) return false;
  if (typeof envelope.salt_b64 !== "string" || !envelope.salt_b64) return false;
  if (typeof envelope.iv_b64 !== "string" || !envelope.iv_b64) return false;
  if (typeof envelope.ct_b64 !== "string" || !envelope.ct_b64) return false;
  if (envelope.aad && typeof envelope.aad !== "string") return false;
  return true;
};

export const normalizeVaultEnvelope = (value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
};
