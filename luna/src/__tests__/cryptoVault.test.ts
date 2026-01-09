import { describe, it, expect, beforeAll } from "vitest";
import { deriveVMK } from "../security/kdf";
import { encryptJson, decryptJson } from "../security/cryptoVault";
import { VaultError } from "../security/vaultErrors";

beforeAll(() => {
  if (typeof global.window === "undefined") {
    global.window = global;
  }
  if (!window.crypto && global.crypto) {
    window.crypto = global.crypto;
  }
  if (typeof window.btoa === "undefined") {
    window.btoa = (value) => Buffer.from(value, "binary").toString("base64");
  }
  if (typeof window.atob === "undefined") {
    window.atob = (value) => Buffer.from(value, "base64").toString("binary");
  }
});

describe("crypto vault helpers", () => {
  it("encrypts and decrypts a JSON payload", async () => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveVMK("TestPassword!", salt, "argon2id");
    const envelope = await encryptJson(key, { ok: true }, { salt, kdf: "argon2id", aad: "vault:test" });
    const decrypted = await decryptJson(key, envelope, { aad: "vault:test" });
    expect(decrypted).toEqual({ ok: true });
  });

  it("rejects decryption from the wrong key", async () => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveVMK("TestPassword!", salt, "argon2id");
    const envelope = await encryptJson(key, { marker: "yes" }, { salt, kdf: "argon2id", aad: "vault:test" });
    const wrongKey = await deriveVMK("OtherPassword!", salt, "argon2id");
    await expect(decryptJson(wrongKey, envelope, { aad: "vault:test" })).rejects.toThrow(VaultError);
  });
});
