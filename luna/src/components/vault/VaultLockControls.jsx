import { useEffect, useState } from "react";
import { readNamespacedItem } from "../../utils/userStorage";
import VaultUnlockModal from "./VaultUnlockModal";
import { lockVault, unlockVaultWithPassword } from "../../security/vaultLock";
import { vaultMemory } from "../../security/vaultMemory";

const parseIdentity = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const VaultLockControls = () => {
  const [isUnlocked, setIsUnlocked] = useState(vaultMemory.isUnlocked());
  const [showModal, setShowModal] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [identity, setIdentity] = useState(() => parseIdentity(readNamespacedItem("userIdentity")));

  useEffect(() => {
    const refreshIdentity = () => {
      setIdentity(parseIdentity(readNamespacedItem("userIdentity")));
    };
    const refreshState = () => {
      setIsUnlocked(vaultMemory.isUnlocked());
    };
    window.addEventListener("identity-updated", refreshIdentity);
    window.addEventListener("vault-locked", refreshState);
    window.addEventListener("vault-unlocked", refreshState);
    window.addEventListener("luna-current-user-changed", refreshIdentity);
    return () => {
      window.removeEventListener("identity-updated", refreshIdentity);
      window.removeEventListener("vault-locked", refreshState);
      window.removeEventListener("vault-unlocked", refreshState);
      window.removeEventListener("luna-current-user-changed", refreshIdentity);
    };
  }, []);

  const handleUnlock = async (password) => {
    if (!identity?.userId || !identity?.vaultSalt) {
      setUnlockError("Vault metadata is missing.");
      return;
    }
    setIsUnlocking(true);
    setUnlockError("");
    try {
      await unlockVaultWithPassword({
        password,
        userId: identity.userId,
        vaultSalt: identity.vaultSalt,
        vaultKdf: identity.vaultKdf,
      });
      setShowModal(false);
    } catch (error) {
      setUnlockError(error?.message || "Unable to unlock the vault.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLock = () => {
    lockVault("manual");
  };

  return (
    <div className="vault-lock-controls">
      <p>
        Vault status: <strong>{isUnlocked ? "Unlocked" : "Locked"}</strong>
      </p>
      {isUnlocked ? (
        <button className="secondary-btn" type="button" onClick={handleLock}>
          Lock vault
        </button>
      ) : (
        <button className="primary-btn" type="button" onClick={() => setShowModal(true)}>
          Unlock vault
        </button>
      )}
      {showModal && (
        <VaultUnlockModal
          onClose={() => setShowModal(false)}
          onUnlock={handleUnlock}
          loading={isUnlocking}
          error={unlockError}
        />
      )}
    </div>
  );
};

export default VaultLockControls;
