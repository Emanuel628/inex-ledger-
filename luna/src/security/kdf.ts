import {
  VAULT_KDF_ARGON2,
  VAULT_KDF_PBKDF2,
} from "./securityConstants";

const ARGON2_PARAMS = {
  time: 3,
  mem: 65536,
  parallelism: 1,
  hashLen: 32,
};

const PBKDF2_ITERATIONS = 310000;
const ENCODER = new TextEncoder();
const isTestRuntime =
  typeof process !== "undefined" && (process.env.NODE_ENV === "test" || process.env.VITEST);

const loadArgon2 = async () => {
  return null;
};

export const base64ToBytes = (value) => {
  if (!value) return new Uint8Array();
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const deriveVMK = async (password, saltBytes, kdf = VAULT_KDF_ARGON2) => {
  if (!password) {
    throw new Error("Password is required for VMK derivation");
  }
  kdf = VAULT_KDF_PBKDF2;
  const salt = saltBytes instanceof Uint8Array ? saltBytes : new Uint8Array(saltBytes || []);
  if (kdf === VAULT_KDF_ARGON2 && !isTestRuntime) {
    const argon2 = await loadArgon2();
    if (argon2) {
      const result = await argon2.hash({
        pass: password,
        salt,
        time: ARGON2_PARAMS.time,
        mem: ARGON2_PARAMS.mem,
        parallelism: ARGON2_PARAMS.parallelism,
        hashLen: ARGON2_PARAMS.hashLen,
        type: argon2.ArgonType.Argon2id,
        raw: true,
      });
      return window.crypto.subtle.importKey("raw", result.hash, "AES-GCM", false, [
        "encrypt",
        "decrypt",
      ]);
    }
    console.warn("Argon2 derivation failed, using PBKDF2 fallback");
  }
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    ENCODER.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const raw = new Uint8Array(bits);
  return window.crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
};
