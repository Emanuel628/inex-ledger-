const VALID_ALGORITHMS = new Set(["A256GCM"]);
const VALID_KDFS = new Set(["argon2id", "pbkdf2"]);

export const validVaultEnvelope = (envelope) => {
  if (!envelope || typeof envelope !== "object") return false;
  if (envelope.v !== 1) return false;
  if (!VALID_ALGORITHMS.has(envelope.alg)) return false;
  if (!VALID_KDFS.has(envelope.kdf)) return false;
  if (typeof envelope.salt_b64 !== "string" || !envelope.salt_b64) return false;
  if (typeof envelope.iv_b64 !== "string" || !envelope.iv_b64) return false;
  if (typeof envelope.ct_b64 !== "string" || !envelope.ct_b64) return false;
  if (envelope.aad && typeof envelope.aad !== "string") return false;
  return true;
};
