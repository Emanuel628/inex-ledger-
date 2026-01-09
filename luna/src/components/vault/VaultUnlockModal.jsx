import { useState } from "react";

const VaultUnlockModal = ({ onClose, onUnlock, loading, error }) => {
  const [password, setPassword] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!password) return;
    onUnlock(password);
  };

  return (
    <div className="vault-modal-backdrop">
      <div className="vault-modal">
        <h2>Unlock your vault</h2>
        <p>Enter the password you used when setting up your Luna workspace.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>
          {error && <p className="vault-error">{error}</p>}
          <div className="vault-modal-actions">
            <button type="button" onClick={onClose} className="secondary-btn">
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VaultUnlockModal;
