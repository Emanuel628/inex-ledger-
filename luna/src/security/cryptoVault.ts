import { VaultError, VaultErrorCode } from "./vaultErrors";
import { isVaultEnvelope } from "./vaultFormat";
import { base64ToBytes } from "./kdf";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

const bytesToBase64 = (buffer) => {
  if (!(buffer instanceof Uint8Array)) {
    buffer = new Uint8Array(buffer);
  }
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
};

const getAadBytes = (aad) => (aad ? ENCODER.encode(aad) : undefined);

export const encryptJson = async (key, payload, { salt, aad, kdf }) => {
  if (!key) {
    throw new VaultError(VaultErrorCode.LOCKED, "Vault must be unlocked to encrypt data.");
  }
  try {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = ENCODER.encode(JSON.stringify(payload));
    const cipher = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: getAadBytes(aad),
      },
      key,
      encoded
    );
    return {
      v: 1,
      alg: "A256GCM",
      kdf: kdf || "argon2id",
      salt_b64: bytesToBase64(salt),
      iv_b64: bytesToBase64(iv),
      ct_b64: bytesToBase64(new Uint8Array(cipher)),
      aad: aad || undefined,
    };
  } catch (error) {
    throw new VaultError(VaultErrorCode.DECRYPT_FAILED, "Unable to encrypt vault payload.");
  }
};

export const decryptJson = async (key, envelope, { aad }) => {
  if (!key) {
    throw new VaultError(VaultErrorCode.LOCKED, "Vault is locked.");
  }
  const parsed = isVaultEnvelope(envelope) ? envelope : null;
  if (!parsed) {
    throw new VaultError(VaultErrorCode.INVALID_FORMAT, "Vault envelope malformed.");
  }
  try {
    const iv = base64ToBytes(parsed.iv_b64);
    const ciphertext = base64ToBytes(parsed.ct_b64);
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: getAadBytes(aad ?? parsed.aad),
      },
      key,
      ciphertext
    );
    return JSON.parse(DECODER.decode(decrypted));
  } catch (error) {
    throw new VaultError(VaultErrorCode.DECRYPT_FAILED, "Unable to decrypt vault payload.");
  }
};
