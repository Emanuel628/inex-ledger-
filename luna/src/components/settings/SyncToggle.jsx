import React from "react";
import { CloudOff, CloudRain } from "lucide-react";
import { useSovereignty } from "../../contexts/SovereigntyContext";

export const SyncToggle = () => {
  const { syncMode, toggleSyncMode } = useSovereignty();

  return (
    <div className="sync-toggle">
      <div className="sync-toggle__details">
        {syncMode === "local" ? (
          <CloudOff className="sync-toggle__icon sync-toggle__icon--local" />
        ) : (
          <CloudRain className="sync-toggle__icon sync-toggle__icon--cloud" />
        )}
        <div>
          <div className="sync-toggle__title">
            Storage Mode: {syncMode === "local" ? "Local-Only" : "Cloud-Synced"}
          </div>
          <p className="sync-toggle__description">
            {syncMode === "local"
              ? "Your data stays entirely in this browser. No cloud backups are created."
              : "Encrypted data is mirrored to your private Vault silo for multi-device access."}
          </p>
        </div>
      </div>
      <button
        type="button"
        className={`sync-toggle__button ${syncMode === "local" ? "sync-toggle__button--local" : ""}`}
        onClick={toggleSyncMode}
      >
        {syncMode === "local" ? "Enable Sync" : "Go Local"}
      </button>
    </div>
  );
};
